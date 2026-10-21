"""Бизнес-логика, общая для бота и Mini App.

Бот и API вызывают одни и те же функции, поэтому правила (занятость слотов,
повторное нажатие кнопок, уведомления) не могут разойтись между каналами.
"""
import logging
from datetime import date, timedelta
from typing import Dict, List, Optional, Tuple

from aiogram import Bot

import db
import keyboards as kb
import texts as t
from config import ADMIN_ID, BOOKING_WINDOW_DAYS
from utils import (
    at_hour, busy_hours, garage_hours, now, parse_dt, past_hours, user_lock,
)

log = logging.getLogger(__name__)

MAX_ACTIVE_REQUESTS = 5


class ServiceError(Exception):
    """Ошибка с понятным пользователю текстом."""

    def __init__(self, code: str, message: str, status: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status


# ─── Свободное время ────────────────────────────────────────

def window_days() -> List[date]:
    today = now().date()
    return [today + timedelta(days=i) for i in range(BOOKING_WINDOW_DAYS)]


async def blocked_hours(g: dict, day: date) -> set:
    open_h, close_h = garage_hours(g)
    bookings = await db.busy_bookings(g["id"], at_hour(day, open_h), at_hour(day, close_h))
    return busy_hours(bookings, day, open_h, close_h) | past_hours(day, open_h, close_h)


async def availability(g: dict) -> Dict[date, set]:
    """Занятые и прошедшие часы на каждый из ближайших дней — одним запросом к базе."""
    days = window_days()
    open_h, close_h = garage_hours(g)
    bookings = await db.busy_bookings(g["id"], at_hour(days[0], 0), at_hour(days[-1], 24))
    return {
        day: busy_hours(bookings, day, open_h, close_h) | past_hours(day, open_h, close_h)
        for day in days
    }


def free_by_day(g: dict, blocked: Dict[date, set]) -> Dict[date, int]:
    open_h, close_h = garage_hours(g)
    return {day: (close_h - open_h) - len(hours) for day, hours in blocked.items()}


# ─── Создание заявки ────────────────────────────────────────

def check_hours(g: dict, hours: List[int]) -> List[int]:
    hours = sorted(set(int(h) for h in hours))
    if not hours:
        raise ServiceError("no_hours", "Выберите хотя бы один час.")
    if any(b - a != 1 for a, b in zip(hours, hours[1:])):
        raise ServiceError("gap", "Выбирайте часы подряд, без пропусков.")
    open_h, close_h = garage_hours(g)
    if hours[0] < open_h or hours[-1] >= close_h:
        raise ServiceError("outside", "Это время вне часов работы площадки.")
    return hours


async def create_booking_request(bot: Bot, user_id: int, username: Optional[str],
                                 garage_id, day: date, hours: List[int]) -> Tuple[dict, dict]:
    """Создаёт заявку pending и отправляет её админу. Возвращает (заявка, объект)."""
    g = await db.garage(garage_id)
    if not g or not g.get("is_active", True):
        raise ServiceError("unavailable", "Эта площадка сейчас недоступна.", 404)
    if day not in window_days():
        raise ServiceError("bad_date", "Эта дата недоступна для брони.")
    hours = check_hours(g, hours)

    async with user_lock(user_id):
        active = [b for b in await db.client_bookings(user_id)
                  if b["status"] == "pending" and parse_dt(b["end_time"]) > now()]
        if len(active) >= MAX_ACTIVE_REQUESTS:
            raise ServiceError(
                "too_many",
                "У вас уже несколько заявок на согласовании. Дождитесь ответа или отмените лишние.",
            )
        blocked = await blocked_hours(g, day)
        if any(h in blocked for h in hours):
            raise ServiceError("taken", t.SLOT_TAKEN, 409)
        start, end = at_hour(day, hours[0]), at_hour(day, hours[-1] + 1)
        total = len(hours) * float(g.get("price_per_hour") or 0)
        created = await db.create_booking({
            "garage_id": g["id"],
            "client_telegram_id": user_id,
            "client_username": username,
            "start_time": start.isoformat(),
            "end_time": end.isoformat(),
            "total_price": total,
            "status": "pending",
        })
    if not created:
        raise ServiceError("save_failed", "Не удалось отправить заявку. Попробуйте ещё раз.", 500)

    try:
        await bot.send_message(
            ADMIN_ID,
            t.admin_booking_card(created, g, start, end, None, now(), title="Новая заявка"),
            reply_markup=kb.decide(created["id"]),
        )
    except Exception:
        log.exception("Заявка №%s создана, но не дошла до админа", created["id"])
    return created, g


# ─── Решения по заявке ──────────────────────────────────────

async def _notify(bot: Bot, chat_id: int, text: str, markup=None) -> bool:
    try:
        await bot.send_message(chat_id, text, reply_markup=markup)
        return True
    except Exception as e:
        log.warning("Не удалось написать клиенту %s: %s", chat_id, e)
        return False


async def confirm_booking(bot: Bot, booking_id: int):
    """pending → confirmed. None, если заявку уже обработали. Иначе (заявка, объект, доставлено ли клиенту)."""
    b = await db.change_booking_status(booking_id, "confirmed", ["pending"])
    if not b:
        return None
    g = await db.garage(b["garage_id"]) or {}
    start, end = parse_dt(b["start_time"]), parse_dt(b["end_time"])
    delivered = await _notify(
        bot, b["client_telegram_id"],
        t.confirmed_for_client(b["id"], g, start, end, b["total_price"]),
        kb.after_confirm(g),
    )
    return b, g, delivered


async def reject_booking(bot: Bot, booking_id: int, reason: str):
    """pending → rejected с причиной. None, если заявку уже обработали."""
    b = await db.change_booking_status(booking_id, "rejected", ["pending"], comment=reason)
    if not b:
        return None
    g = await db.garage(b["garage_id"]) or {}
    start, end = parse_dt(b["start_time"]), parse_dt(b["end_time"])
    delivered = await _notify(
        bot, b["client_telegram_id"],
        t.rejected_for_client(b["id"], g.get("name") or "", start, end, reason),
        kb.after_reject(),
    )
    return b, g, delivered


def can_cancel(b: dict) -> bool:
    return b["status"] in db.ACTIVE_STATUSES and parse_dt(b["end_time"]) > now()


async def cancel_booking(bot: Bot, user_id: int, booking_id: int) -> dict:
    """Клиент отменяет свою заявку; админу уходит уведомление."""
    b = await db.booking(booking_id)
    if not b or b["client_telegram_id"] != user_id:
        raise ServiceError("not_found", "Заявка не найдена.", 404)
    if not can_cancel(b):
        raise ServiceError("closed", "Эту заявку уже нельзя отменить.", 409)
    updated = await db.change_booking_status(booking_id, "cancelled", db.ACTIVE_STATUSES)
    if not updated:
        raise ServiceError("changed", "Статус заявки уже изменился.", 409)
    g = await db.garage(b["garage_id"])
    start, end = parse_dt(b["start_time"]), parse_dt(b["end_time"])
    try:
        await bot.send_message(
            ADMIN_ID, t.client_cancelled_for_admin(updated, (g or {}).get("name") or "—", start, end),
        )
    except Exception:
        log.exception("Не удалось уведомить админа об отмене №%s", booking_id)
    return updated


# ─── Заявки владельцев ──────────────────────────────────────

async def create_owner_request(bot: Bot, user_id: int, username: Optional[str], name: str,
                               phone: str, object_type: str, address: str) -> None:
    lead = {
        "name": name,
        "phone": phone,
        "object_type": t.object_type(object_type),
        "address": address,
        "telegram_id": user_id,
        "telegram_username": t.username_label(username, user_id),
    }
    saved = None
    try:
        saved = await db.create_owner_request(lead)
    except Exception:
        log.exception("Не удалось сохранить заявку владельца")
    await bot.send_message(
        ADMIN_ID,
        t.owner_lead(saved or {**lead, "id": "—"}),
        reply_markup=kb.lead_actions(saved["id"]) if saved else None,
    )
