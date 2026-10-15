"""Бронирование (дата → часы → заявка) и «Мои заявки» клиента."""
import logging
from datetime import date, timedelta

from aiogram import Router
from aiogram.fsm.context import FSMContext
from aiogram.types import CallbackQuery, Message

import db
import keyboards as kb
import texts as t
from callbacks import BookCb, MyCb
from config import ADMIN_ID, BOOKING_WINDOW_DAYS
from states import Booking
from utils import (
    answer_quietly, at_hour, busy_hours, edit_or_send, garage_hours, now, parse_dt,
    past_hours, toggle_range, user_lock,
)

log = logging.getLogger(__name__)
router = Router(name="booking")


# ─── Расчёт свободного времени ──────────────────────────────

def window_days():
    today = now().date()
    return [today + timedelta(days=i) for i in range(BOOKING_WINDOW_DAYS)]


async def blocked_hours(g: dict, day: date) -> set:
    open_h, close_h = garage_hours(g)
    bookings = await db.busy_bookings(g["id"], at_hour(day, open_h), at_hour(day, close_h))
    return busy_hours(bookings, day, open_h, close_h) | past_hours(day, open_h, close_h)


async def free_by_day(g: dict) -> dict:
    days = window_days()
    open_h, close_h = garage_hours(g)
    bookings = await db.busy_bookings(g["id"], at_hour(days[0], 0), at_hour(days[-1], 24))
    free = {}
    for day in days:
        blocked = busy_hours(bookings, day, open_h, close_h) | past_hours(day, open_h, close_h)
        free[day] = (close_h - open_h) - len(blocked)
    return free


async def show_dates(message: Message, g: dict, edit: bool) -> None:
    free = await free_by_day(g)
    text, markup = t.dates_screen(g), kb.booking_dates(window_days(), free)
    if edit:
        await edit_or_send(message, text, markup)
    else:
        await message.answer(text, reply_markup=markup)


def slots_view(b: dict):
    g = b["garage"]
    day = date.fromisoformat(b["day"])
    open_h, close_h = garage_hours(g)
    price = float(g.get("price_per_hour") or 0)
    selected = b.get("selected", [])
    total = len(selected) * price if selected else None
    return (
        t.slots_screen(g, day, selected, price),
        kb.booking_slots(open_h, close_h, set(b["blocked"]), selected, total),
    )


# ─── Сценарий брони ─────────────────────────────────────────

@router.callback_query(BookCb.filter())
async def on_booking(callback: CallbackQuery, callback_data: BookCb, state: FSMContext):
    action, value = callback_data.action, callback_data.value

    if action == "start":
        g = await db.garage(value)
        if not g or not g.get("is_active", True):
            await answer_quietly(callback, "Эта площадка сейчас недоступна.", alert=True)
            return
        await answer_quietly(callback)
        await state.set_state(Booking.date)
        await state.update_data(booking={"garage": g})
        await show_dates(callback.message, g, edit=False)
        return

    b = (await state.get_data()).get("booking")
    if not b:
        await answer_quietly(callback, t.SESSION_EXPIRED, alert=True)
        return
    g = b["garage"]

    if action == "dates":
        await answer_quietly(callback)
        b.pop("selected", None)
        await state.set_state(Booking.date)
        await state.update_data(booking=b)
        await show_dates(callback.message, g, edit=True)
        return

    if action == "date":
        day = date.fromisoformat(value)
        if day not in window_days():
            await answer_quietly(callback, "Эта дата уже недоступна.", alert=True)
            return
        await answer_quietly(callback)
        b.update(day=value, selected=[], blocked=sorted(await blocked_hours(g, day)))
        await state.set_state(Booking.slots)
        await state.update_data(booking=b)
        text, markup = slots_view(b)
        await edit_or_send(callback.message, text, markup)
        return

    if action == "slot" and b.get("day"):
        hour = int(value)
        blocked = set(b["blocked"])
        if hour in blocked:
            await answer_quietly(callback, "Это время недоступно.", alert=True)
            return
        b["selected"] = toggle_range(b.get("selected", []), hour, blocked)
        await state.update_data(booking=b)
        await answer_quietly(callback)
        text, markup = slots_view(b)
        await edit_or_send(callback.message, text, markup)
        return

    if action == "send":
        async with user_lock(callback.from_user.id):
            await submit(callback, state)


async def submit(callback: CallbackQuery, state: FSMContext) -> None:
    b = (await state.get_data()).get("booking")
    if not b or not b.get("selected"):
        await answer_quietly(callback, t.SESSION_EXPIRED, alert=True)
        return
    g, day, selected = b["garage"], date.fromisoformat(b["day"]), b["selected"]
    start, end = at_hour(day, selected[0]), at_hour(day, selected[-1] + 1)

    blocked = await blocked_hours(g, day)
    if any(h in blocked for h in selected):
        b.update(selected=[], blocked=sorted(blocked))
        await state.update_data(booking=b)
        await answer_quietly(callback, t.SLOT_TAKEN, alert=True)
        text, markup = slots_view(b)
        await edit_or_send(callback.message, text, markup)
        return

    user = callback.from_user
    total = len(selected) * float(g.get("price_per_hour") or 0)
    created = await db.create_booking({
        "garage_id": g["id"],
        "client_telegram_id": user.id,
        "client_username": user.username,
        "start_time": start.isoformat(),
        "end_time": end.isoformat(),
        "total_price": total,
        "status": "pending",
    })
    if not created:
        await answer_quietly(callback, "Не удалось отправить заявку. Попробуйте ещё раз.", alert=True)
        return

    await state.update_data(booking=None)
    await state.set_state(None)
    await answer_quietly(callback, "Заявка отправлена")
    await edit_or_send(
        callback.message,
        t.request_sent(created["id"], g.get("name") or "", start, end, total),
        kb.my_bookings_link(),
    )
    await callback.bot.send_message(
        ADMIN_ID,
        t.admin_booking_card(created, g, start, end, None, now(), title="Новая заявка"),
        reply_markup=kb.decide(created["id"]),
    )


# ─── Мои заявки ─────────────────────────────────────────────

async def my_bookings_view(user_id: int):
    rows = await db.client_bookings(user_id)
    if not rows:
        return t.NO_BOOKINGS, None
    garages = await db.garages_by_ids(b["garage_id"] for b in rows)
    current = now()
    upcoming, history = [], []
    for b in rows:
        start, end = parse_dt(b["start_time"]), parse_dt(b["end_time"])
        name = (garages.get(b["garage_id"]) or {}).get("name") or "Площадка недоступна"
        item = (b, name, start, end)
        if b["status"] in db.ACTIVE_STATUSES and end > current:
            upcoming.append(item)
        else:
            history.append(item)
    upcoming.sort(key=lambda x: x[2])
    return t.my_bookings(upcoming, history[:5]), kb.my_bookings(upcoming)


async def show_my_bookings(message: Message, user_id: int, edit: bool = False) -> None:
    text, markup = await my_bookings_view(user_id)
    if edit:
        await edit_or_send(message, text, markup)
    else:
        await message.answer(text, reply_markup=markup)


async def own_booking(callback: CallbackQuery, booking_id: int):
    b = await db.booking(booking_id)
    if not b or b["client_telegram_id"] != callback.from_user.id:
        await answer_quietly(callback, "Заявка не найдена.", alert=True)
        return None
    return b


def can_cancel(b: dict) -> bool:
    return b["status"] in db.ACTIVE_STATUSES and parse_dt(b["end_time"]) > now()


async def show_my_card(callback: CallbackQuery, b: dict) -> None:
    g = await db.garage(b["garage_id"])
    start, end = parse_dt(b["start_time"]), parse_dt(b["end_time"])
    await edit_or_send(callback.message, t.my_booking_card(b, g, start, end), kb.my_booking_card(b, g, can_cancel(b)))


@router.callback_query(MyCb.filter())
async def on_my(callback: CallbackQuery, callback_data: MyCb):
    action = callback_data.action

    if action == "list":
        await answer_quietly(callback)
        await show_my_bookings(callback.message, callback.from_user.id, edit=True)
        return

    b = await own_booking(callback, callback_data.booking_id)
    if not b:
        return

    if action == "view":
        await answer_quietly(callback)
        await show_my_card(callback, b)
        return

    if action == "cancel":
        if not can_cancel(b):
            await answer_quietly(callback, "Эту заявку уже нельзя отменить.", alert=True)
            return
        await answer_quietly(callback)
        start, end = parse_dt(b["start_time"]), parse_dt(b["end_time"])
        g = await db.garage(b["garage_id"])
        await edit_or_send(
            callback.message,
            f"{t.my_booking_card(b, g, start, end)}\n\n<b>{t.CANCEL_ASK}</b>",
            kb.cancel_confirm(b["id"]),
        )
        return

    if action == "cancel_yes":
        updated = await db.change_booking_status(b["id"], "cancelled", db.ACTIVE_STATUSES)
        if not updated:
            await answer_quietly(callback, "Статус заявки уже изменился.", alert=True)
            await show_my_card(callback, await db.booking(b["id"]))
            return
        await answer_quietly(callback, t.CANCEL_DONE)
        await show_my_card(callback, updated)
        g = await db.garage(b["garage_id"])
        start, end = parse_dt(b["start_time"]), parse_dt(b["end_time"])
        await callback.bot.send_message(
            ADMIN_ID, t.client_cancelled_for_admin(updated, (g or {}).get("name") or "—", start, end),
        )
