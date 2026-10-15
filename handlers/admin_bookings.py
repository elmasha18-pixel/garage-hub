"""Админ: новые заявки, расписание по дням, подтверждение/отказ, заявки владельцев."""
import logging
from datetime import timedelta

from aiogram import F, Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

import db
import keyboards as kb
import texts as t
from callbacks import DayCb, DecideCb, LeadCb
from states import Reject
from utils import IsAdmin, answer_quietly, at_hour, edit_or_send, now, parse_dt, reset, user_lock

log = logging.getLogger(__name__)
router = Router(name="admin_bookings")
router.message.filter(IsAdmin())
router.callback_query.filter(IsAdmin())


def booking_times(b: dict):
    return parse_dt(b["start_time"]), parse_dt(b["end_time"])


async def booking_card(b: dict, g=None, title: str = "") -> str:
    g = g if g is not None else await db.garage(b["garage_id"])
    start, end = booking_times(b)
    created = parse_dt(b["created_at"]) if b.get("created_at") else None
    return t.admin_booking_card(b, g, start, end, created, now(), title=title)


# ─── Новые заявки ───────────────────────────────────────────

async def show_inbox(message: Message) -> None:
    rows = await db.pending_bookings()
    if not rows:
        await message.answer(t.NO_PENDING)
        return
    garages = await db.garages_by_ids(b["garage_id"] for b in rows)
    noun = t.plural(len(rows), "заявка ждёт", "заявки ждут", "заявок ждут")
    await message.answer(f"<b>{len(rows)}</b> {noun} решения · от ранних к поздним")
    for b in rows:
        await message.answer(
            await booking_card(b, garages.get(b["garage_id"], {})),
            reply_markup=kb.decide(b["id"]),
        )


# ─── Расписание по дням ─────────────────────────────────────

async def day_view(offset: int):
    day = now().date() + timedelta(days=offset)
    rows = await db.bookings_between(at_hour(day, 0), at_hour(day, 24))
    garages = await db.garages_by_ids(b["garage_id"] for b in rows)
    items = []
    for b in rows:
        start, end = booking_times(b)
        name = (garages.get(b["garage_id"]) or {}).get("name") or "Объект недоступен"
        items.append((b, name, start, end))
    pending = [item for item in items if item[0]["status"] == "pending"]
    return t.day_schedule(day, items, offset), kb.day_schedule(offset, pending)


async def show_day(message: Message, offset: int, edit: bool = False) -> None:
    text, markup = await day_view(offset)
    if edit:
        await edit_or_send(message, text, markup)
    else:
        await message.answer(text, reply_markup=markup)


@router.callback_query(DayCb.filter())
async def on_day(callback: CallbackQuery, callback_data: DayCb):
    await answer_quietly(callback)
    await show_day(callback.message, max(0, min(6, callback_data.offset)), edit=True)


# ─── Решение по заявке ──────────────────────────────────────

async def notify_client(callback_or_message, chat_id: int, text: str, markup=None) -> bool:
    try:
        await callback_or_message.bot.send_message(chat_id, text, reply_markup=markup)
        return True
    except Exception as e:
        log.warning("Не удалось написать клиенту %s: %s", chat_id, e)
        return False


async def already_decided(callback: CallbackQuery, booking_id: int) -> None:
    b = await db.booking(booking_id)
    status = t.status_line(b["status"]) if b else "не найдена"
    await answer_quietly(callback, t.ALREADY_DECIDED.format(status=status), alert=True)
    if b:
        await edit_or_send(callback.message, await booking_card(b))


async def reject(bot_holder, booking_id: int, reason: str):
    """Отклоняет заявку и пишет клиенту. Возвращает заявку или None, если она уже обработана."""
    b = await db.change_booking_status(booking_id, "rejected", ["pending"], comment=reason)
    if not b:
        return None
    g = await db.garage(b["garage_id"]) or {}
    start, end = booking_times(b)
    await notify_client(
        bot_holder, b["client_telegram_id"],
        t.rejected_for_client(b["id"], g.get("name") or "", start, end, reason),
        kb.after_reject(),
    )
    return b


@router.callback_query(DecideCb.filter())
async def on_decide(callback: CallbackQuery, callback_data: DecideCb, state: FSMContext):
    action, bid = callback_data.action, callback_data.booking_id

    if action == "open":
        b = await db.booking(bid)
        await answer_quietly(callback)
        if b:
            await callback.message.answer(
                await booking_card(b), reply_markup=kb.decide(bid) if b["status"] == "pending" else None,
            )
        return

    if action == "ok":
        async with user_lock(callback.from_user.id):
            b = await db.change_booking_status(bid, "confirmed", ["pending"])
        if not b:
            await already_decided(callback, bid)
            return
        g = await db.garage(b["garage_id"]) or {}
        start, end = booking_times(b)
        delivered = await notify_client(
            callback, b["client_telegram_id"],
            t.confirmed_for_client(b["id"], g, start, end, b["total_price"]),
            kb.after_confirm(g),
        )
        await answer_quietly(callback, "Подтверждено. Клиент уведомлён." if delivered else "Подтверждено")
        await edit_or_send(callback.message, await booking_card(b, g))
        if not delivered:
            await callback.message.answer("⚠ Не удалось отправить сообщение клиенту — возможно, он заблокировал бота.")
        return

    if action == "no":
        await answer_quietly(callback)
        await callback.message.edit_text(
            f"{callback.message.html_text}\n\n<b>{t.REJECT_ASK}</b>", reply_markup=kb.reject_reasons(bid),
        )
        return

    if action == "back":
        await answer_quietly(callback)
        b = await db.booking(bid)
        if b:
            await edit_or_send(callback.message, await booking_card(b),
                               kb.decide(bid) if b["status"] == "pending" else None)
        return

    if action == "reason":
        if callback_data.reason == "custom":
            await answer_quietly(callback)
            await state.set_state(Reject.reason)
            await state.update_data(reject={
                "booking_id": bid,
                "chat_id": callback.message.chat.id,
                "message_id": callback.message.message_id,
            })
            await callback.message.answer(t.REJECT_CUSTOM, reply_markup=kb.cancel_menu())
            return
        reason = t.REJECT_REASONS.get(callback_data.reason, "Без указания причины")
        async with user_lock(callback.from_user.id):
            b = await reject(callback, bid, reason)
        if not b:
            await already_decided(callback, bid)
            return
        await answer_quietly(callback, "Отклонено. Клиент уведомлён.")
        await edit_or_send(callback.message, await booking_card(b))


@router.message(Reject.reason, F.text)
async def on_reject_reason(message: Message, state: FSMContext):
    data = (await state.get_data()).get("reject") or {}
    await reset(state)
    if not data:
        return
    b = await reject(message, data["booking_id"], message.text.strip())
    if not b:
        await message.answer("Эта заявка уже обработана.", reply_markup=kb.admin_menu())
        return
    await message.answer("Заявка отклонена, клиент уведомлён.", reply_markup=kb.admin_menu())
    try:
        await message.bot.edit_message_text(
            await booking_card(b), chat_id=data["chat_id"], message_id=data["message_id"],
        )
    except Exception:
        pass


# ─── Заявки владельцев ──────────────────────────────────────

async def show_leads(message: Message) -> None:
    try:
        rows = await db.owner_requests("new")
    except Exception:
        log.exception("Таблица owner_requests недоступна")
        await message.answer("Таблица заявок владельцев ещё не создана — выполните sql/001_v2.sql.")
        return
    if not rows:
        await message.answer(t.NO_LEADS)
        return
    await message.answer(f"Новых заявок от владельцев: <b>{len(rows)}</b>")
    for r in rows:
        await message.answer(t.owner_lead(r), reply_markup=kb.lead_actions(r["id"]))


@router.callback_query(LeadCb.filter(F.action == "done"))
async def on_lead_done(callback: CallbackQuery, callback_data: LeadCb):
    await db.close_owner_request(callback_data.request_id)
    await answer_quietly(callback, "Отмечено")
    await edit_or_send(callback.message, f"{callback.message.html_text}\n{t.DIVIDER}\n✓ Обработано")
