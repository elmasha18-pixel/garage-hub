import asyncio
from datetime import datetime, timedelta

from aiogram import Bot, Dispatcher, F
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import (
    CallbackQuery,
    InputMediaPhoto,
    Message,
)

import keyboards as kb
import texts as t
from config import (
    ADMIN_ID,
    CLOSE_HOUR,
    LOCAL_TZ,
    MAX_PHOTOS,
    OPEN_HOUR,
    TOKEN,
    supabase,
)
from keyboards import Btn

dp = Dispatcher()


# ============================================================
# СОСТОЯНИЯ
# ============================================================

class AddGarageForm(StatesGroup):
    type = State()
    name = State()
    district = State()
    address = State()
    photos = State()
    price = State()
    has_lift = State()
    has_pit = State()
    tools = State()
    box_size = State()
    working_hours = State()
    description = State()
    owner_name = State()
    owner_phone = State()
    owner_contact = State()


class EditGarageForm(StatesGroup):
    field = State()
    value = State()


class BookingForm(StatesGroup):
    date = State()
    slots = State()


class OwnerRequestForm(StatesGroup):
    name = State()
    phone = State()
    object_type = State()
    address = State()


class RejectForm(StatesGroup):
    reason = State()


# ============================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================================

def parse_dt(value):
    value = value.replace("Z", "+00:00")
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=LOCAL_TZ)
    return dt.astimezone(LOCAL_TZ)


def is_admin(user_id: int) -> bool:
    return user_id == ADMIN_ID


def home_markup(user_id: int):
    return kb.admin_menu() if is_admin(user_id) else kb.user_menu()


async def get_garage(garage_id):
    result = supabase.table("garages").select("*").eq("id", garage_id).single().execute()
    return result.data


async def get_occupied_slots(garage_id, selected_date):
    occupied = set()
    result = (
        supabase.table("bookings")
        .select("start_time, end_time, status")
        .eq("garage_id", garage_id)
        .in_("status", ["pending", "confirmed"])
        .execute()
    )
    for booking in result.data or []:
        start = parse_dt(booking["start_time"])
        end = parse_dt(booking["end_time"])
        if start.date() != selected_date:
            continue
        current = start
        while current < end:
            occupied.add(current.hour)
            current += timedelta(hours=1)
    return occupied


def past_hours(selected_date):
    now = datetime.now(LOCAL_TZ)
    if selected_date != now.date():
        return set()
    return {hour for hour in range(OPEN_HOUR, CLOSE_HOUR) if hour <= now.hour}


async def get_districts():
    result = supabase.table("garages").select("district").execute()
    return sorted({g["district"] for g in (result.data or []) if g.get("district")})


async def send_garage_card(message: Message, g: dict, *, detailed: bool = False):
    text = t.catalog_card(g, detailed=detailed)
    photos = g.get("photos") or []
    markup = kb.garage_request(g["id"]) if detailed else kb.garage_open(g["id"])
    if detailed and len(photos) > 1:
        media = [InputMediaPhoto(media=photos[0], caption=text, parse_mode=ParseMode.HTML)] + [
            InputMediaPhoto(media=ph) for ph in photos[1:MAX_PHOTOS]
        ]
        await message.answer_media_group(media=media)
        await message.answer("Хотите забронировать?", reply_markup=markup)
        return
    if photos:
        await message.answer_photo(photo=photos[0], caption=text, reply_markup=markup)
        return
    await message.answer(text, reply_markup=markup)


# ============================================================
# СТАРТ
# ============================================================

@dp.message(CommandStart())
async def start_command(message: Message, state: FSMContext):
    await state.clear()
    markup = home_markup(message.from_user.id)
    text = t.START_ADMIN if is_admin(message.from_user.id) else t.START
    await message.answer(text, reply_markup=markup)


@dp.message(F.text.in_({Btn.CANCEL, "Главная"}))
async def cancel_flow(message: Message, state: FSMContext):
    await state.clear()
    await start_command(message, state)


# ============================================================
# КОНТАКТЫ
# ============================================================

@dp.message(F.text == Btn.CONTACT)
async def contact_admin(message: Message):
    await message.answer(t.CONTACT)


# ============================================================
# АРЕНДОДАТЕЛЬ — ЗАЯВКА НА РАЗМЕЩЕНИЕ
# ============================================================

@dp.message(F.text == Btn.LIST)
async def owner_request_start(message: Message, state: FSMContext):
    await state.clear()
    await state.set_state(OwnerRequestForm.name)
    await message.answer(t.OWNER_INTRO, reply_markup=kb.cancel_menu())


@dp.message(OwnerRequestForm.name)
async def owner_request_name(message: Message, state: FSMContext):
    await state.update_data(name=message.text.strip())
    await state.set_state(OwnerRequestForm.phone)
    await message.answer(t.OWNER_PHONE)


@dp.message(OwnerRequestForm.phone)
async def owner_request_phone(message: Message, state: FSMContext):
    await state.update_data(phone=message.text.strip())
    await state.set_state(OwnerRequestForm.object_type)
    await message.answer(t.OWNER_TYPE, reply_markup=kb.type_choice("ot_"))


@dp.callback_query(F.data.in_({"ot_garage", "ot_detailing"}))
async def owner_request_type(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    label = "Гараж самообслуживания" if callback.data == "ot_garage" else "Детейлинг-бокс"
    await state.update_data(object_type=label)
    await state.set_state(OwnerRequestForm.address)
    await callback.message.answer(t.OWNER_ADDRESS)


@dp.message(OwnerRequestForm.address)
async def owner_request_address(message: Message, state: FSMContext):
    data = await state.get_data()
    await state.clear()
    username = f"@{message.from_user.username}" if message.from_user.username else f"id {message.from_user.id}"
    try:
        await message.bot.send_message(
            chat_id=ADMIN_ID,
            text=t.owner_lead_for_admin(
                data["name"], data["phone"], data["object_type"],
                message.text.strip(), username,
            ),
        )
    except Exception as e:
        print("Ошибка заявки на размещение:", e)
    await message.answer(t.OWNER_DONE, reply_markup=home_markup(message.from_user.id))


# ============================================================
# ДОБАВЛЕНИЕ ОБЪЕКТА (ТОЛЬКО АДМИН)
# ============================================================

@dp.message(F.text == Btn.ADD)
async def add_garage_start(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.clear()
    await state.set_state(AddGarageForm.type)
    await message.answer(t.ADD_TYPE, reply_markup=kb.type_choice("type_"))


@dp.callback_query(F.data.in_({"type_garage", "type_detailing"}))
async def add_type(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    garage_type = "garage" if callback.data == "type_garage" else "detailing"
    await state.update_data(type=garage_type, photos=[])
    await state.set_state(AddGarageForm.name)
    await callback.message.answer(t.ADD_NAME, reply_markup=kb.cancel_menu())


@dp.message(AddGarageForm.name)
async def add_name(message: Message, state: FSMContext):
    await state.update_data(name=message.text.strip())
    await state.set_state(AddGarageForm.district)
    await message.answer(t.ADD_DISTRICT)


@dp.message(AddGarageForm.district)
async def add_district(message: Message, state: FSMContext):
    await state.update_data(district=message.text.strip())
    await state.set_state(AddGarageForm.address)
    await message.answer(t.ADD_ADDRESS)


@dp.message(AddGarageForm.address)
async def add_address(message: Message, state: FSMContext):
    await state.update_data(address=message.text.strip())
    await state.set_state(AddGarageForm.photos)
    await message.answer(t.ADD_PHOTOS, reply_markup=kb.photos_done())


@dp.message(AddGarageForm.photos, F.photo)
async def add_photo(message: Message, state: FSMContext):
    data = await state.get_data()
    photos = data.get("photos", [])
    if len(photos) >= MAX_PHOTOS:
        await message.answer(f"Максимум {MAX_PHOTOS} фото. Нажмите «Готово».")
        return
    photos.append(message.photo[-1].file_id)
    await state.update_data(photos=photos)
    await message.answer(f"Фото {len(photos)}/{MAX_PHOTOS} добавлено.", reply_markup=kb.photos_done())


@dp.callback_query(F.data == "photos_done")
async def photos_done(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    await state.set_state(AddGarageForm.price)
    await callback.message.answer(t.ADD_PRICE)


@dp.message(AddGarageForm.price)
async def add_price(message: Message, state: FSMContext):
    try:
        price = float(message.text.replace(",", ".").strip())
        if price <= 0:
            raise ValueError
    except ValueError:
        await message.answer("Введите корректную цену, например: 500")
        return
    await state.update_data(price_per_hour=price)
    await state.set_state(AddGarageForm.has_lift)
    await message.answer(t.ADD_LIFT, reply_markup=kb.yes_no("lift_yes", "lift_no"))


@dp.callback_query(F.data.in_({"lift_yes", "lift_no"}))
async def add_lift(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(has_lift=callback.data == "lift_yes")
    await state.set_state(AddGarageForm.has_pit)
    await callback.message.answer(t.ADD_PIT, reply_markup=kb.yes_no("pit_yes", "pit_no"))


@dp.callback_query(F.data.in_({"pit_yes", "pit_no"}))
async def add_pit(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(has_pit=callback.data == "pit_yes")
    await state.set_state(AddGarageForm.tools)
    await callback.message.answer(t.ADD_TOOLS, reply_markup=kb.tools_choice())


@dp.callback_query(F.data.in_({"tools_all", "tools_none", "tools_partial"}))
async def add_tools(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(tool_availability=callback.data.replace("tools_", ""))
    await state.set_state(AddGarageForm.box_size)
    await callback.message.answer(t.ADD_SIZE, reply_markup=kb.size_choice())


@dp.callback_query(F.data.in_({"size_small", "size_medium", "size_large"}))
async def add_size(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(box_size=callback.data.replace("size_", ""))
    await state.set_state(AddGarageForm.working_hours)
    await callback.message.answer(t.ADD_HOURS)


@dp.message(AddGarageForm.working_hours)
async def add_hours(message: Message, state: FSMContext):
    await state.update_data(working_hours=message.text.strip())
    await state.set_state(AddGarageForm.description)
    await message.answer(t.ADD_DESC)


@dp.message(AddGarageForm.description)
async def add_description(message: Message, state: FSMContext):
    await state.update_data(description=message.text.strip())
    await state.set_state(AddGarageForm.owner_name)
    await message.answer(t.ADD_OWNER_NAME)


@dp.message(AddGarageForm.owner_name)
async def add_owner_name(message: Message, state: FSMContext):
    await state.update_data(owner_name=message.text.strip())
    await state.set_state(AddGarageForm.owner_phone)
    await message.answer(t.ADD_OWNER_PHONE)


@dp.message(AddGarageForm.owner_phone)
async def add_owner_phone(message: Message, state: FSMContext):
    await state.update_data(owner_phone=message.text.strip())
    await state.set_state(AddGarageForm.owner_contact)
    await message.answer(t.ADD_OWNER_TG)


@dp.message(AddGarageForm.owner_contact)
async def add_owner_contact(message: Message, state: FSMContext):
    data = await state.get_data()
    await state.clear()
    garage = {
        "type": data["type"],
        "name": data["name"],
        "district": data["district"],
        "address": data["address"],
        "photos": data.get("photos", []),
        "price_per_hour": data["price_per_hour"],
        "has_lift": data["has_lift"],
        "has_pit": data["has_pit"],
        "tool_availability": data["tool_availability"],
        "box_size": data["box_size"],
        "working_hours": data["working_hours"],
        "description": data["description"],
        "owner_name": data.get("owner_name"),
        "owner_phone": data.get("owner_phone"),
        "owner_contact": message.text.strip(),
        "owner_telegram_id": ADMIN_ID,
    }
    try:
        supabase.table("garages").insert(garage).execute()
        await message.answer(f"Объект <b>{data['name']}</b> добавлен.", reply_markup=kb.admin_menu())
    except Exception as e:
        print("Ошибка добавления:", e)
        await message.answer("Не удалось добавить объект.")


# ============================================================
# ВСЕ ОБЪЕКТЫ + РЕДАКТИРОВАНИЕ (АДМИН)
# ============================================================

@dp.message(F.text == Btn.ALL)
async def all_objects(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.clear()
    try:
        result = supabase.table("garages").select("*").order("id").execute()
        garages = result.data or []
        if not garages:
            await message.answer(t.EMPTY_CATALOG)
            return
        await message.answer(f"Объектов в каталоге: {len(garages)}")
        for g in garages:
            await message.answer(
                t.admin_object_card(g),
                reply_markup=kb.admin_object_actions(g["id"]),
            )
    except Exception as e:
        print("Ошибка списка:", e)
        await message.answer(t.LOAD_ERROR)


@dp.callback_query(F.data.startswith("edit_garage_"))
async def edit_garage_menu(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    garage_id = callback.data.replace("edit_garage_", "")
    await state.clear()
    await state.update_data(edit_garage_id=garage_id)
    await callback.message.answer(t.EDIT_CHOOSE, reply_markup=kb.garage_edit_menu(garage_id))


# Обработчики нажатий на поля редактирования
EDIT_FIELDS = {
    "edit_name": ("name", "Новое название:"),
    "edit_district": ("district", "Новый район:"),
    "edit_address": ("address", "Новый адрес:"),
    "edit_price": ("price_per_hour", "Новая цена за час:"),
    "edit_hours": ("working_hours", "Новые часы работы:"),
    "edit_desc": ("description", "Новое описание:"),
    "edit_owner": ("owner_contact", "Новый Telegram владельца:"),
}


@dp.callback_query(F.data.startswith(tuple(EDIT_FIELDS.keys())))
async def edit_field_start(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    for prefix, (field, prompt) in EDIT_FIELDS.items():
        if callback.data.startswith(prefix + "_") and not any(
            callback.data.startswith(p + "_") for p in EDIT_FIELDS if p != prefix and len(p) > len(prefix)
        ):
            garage_id = callback.data.replace(prefix + "_", "")
            await state.update_data(edit_garage_id=garage_id, edit_field=field)
            await state.set_state(EditGarageForm.value)
            await callback.message.answer(prompt, reply_markup=kb.cancel_menu())
            return


@dp.callback_query(F.data.startswith("edit_lift_"))
async def edit_lift(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    garage_id = callback.data.replace("edit_lift_", "")
    await state.update_data(edit_garage_id=garage_id, edit_field="has_lift")
    await callback.message.answer("Подъёмник:", reply_markup=kb.yes_no("editval_yes", "editval_no"))


@dp.callback_query(F.data.startswith("edit_pit_"))
async def edit_pit(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    garage_id = callback.data.replace("edit_pit_", "")
    await state.update_data(edit_garage_id=garage_id, edit_field="has_pit")
    await callback.message.answer("Смотровая яма:", reply_markup=kb.yes_no("editval_yes", "editval_no"))


@dp.callback_query(F.data.startswith("edit_tools_"))
async def edit_tools_start(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    garage_id = callback.data.replace("edit_tools_", "")
    await state.update_data(edit_garage_id=garage_id, edit_field="tool_availability")
    await callback.message.answer("Инструмент:", reply_markup=kb.edit_tools_choice())


@dp.callback_query(F.data.startswith("edit_size_"))
async def edit_size_start(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    garage_id = callback.data.replace("edit_size_", "")
    await state.update_data(edit_garage_id=garage_id, edit_field="box_size")
    await callback.message.answer("Размер:", reply_markup=kb.edit_size_choice())


@dp.callback_query(F.data.in_({"editval_yes", "editval_no"}))
async def edit_bool_value(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    data = await state.get_data()
    value = callback.data == "editval_yes"
    await save_edit(callback.message, state, data["edit_garage_id"], data["edit_field"], value)


@dp.callback_query(F.data.in_({"etools_all", "etools_none", "etools_partial"}))
async def edit_tools_value(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    data = await state.get_data()
    value = callback.data.replace("etools_", "")
    await save_edit(callback.message, state, data["edit_garage_id"], "tool_availability", value)


@dp.callback_query(F.data.in_({"esize_small", "esize_medium", "esize_large"}))
async def edit_size_value(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    data = await state.get_data()
    value = callback.data.replace("esize_", "")
    await save_edit(callback.message, state, data["edit_garage_id"], "box_size", value)


@dp.message(EditGarageForm.value)
async def edit_text_value(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    data = await state.get_data()
    field = data.get("edit_field")
    value = message.text.strip()
    if field == "price_per_hour":
        try:
            value = float(value.replace(",", "."))
            if value <= 0:
                raise ValueError
        except ValueError:
            await message.answer("Введите корректную цену, например: 500")
            return
    await save_edit(message, state, data["edit_garage_id"], field, value)


async def save_edit(message, state, garage_id, field, value):
    try:
        supabase.table("garages").update({field: value}).eq("id", garage_id).execute()
        await state.clear()
        await message.answer(t.EDIT_DONE, reply_markup=kb.admin_menu())
    except Exception as e:
        print("Ошибка сохранения:", e)
        await message.answer("Не удалось сохранить изменение.")


# ============================================================
# НОВЫЕ ЗАЯВКИ (АДМИН)
# ============================================================

@dp.message(F.text == Btn.INBOX)
async def pending_bookings(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.clear()
    try:
        result = (
            supabase.table("bookings")
            .select("*")
            .eq("status", "pending")
            .order("start_time")
            .execute()
        )
        bookings = result.data or []
        if not bookings:
            await message.answer(t.NO_PENDING)
            return
        await message.answer(f"На согласовании: {len(bookings)}")
        for b in bookings:
            g = await get_garage(str(b["garage_id"]))
            name = g["name"] if g else "Объект недоступен"
            start = parse_dt(b["start_time"])
            end = parse_dt(b["end_time"])
            username = f"@{b['client_username']}" if b.get("client_username") else str(b["client_telegram_id"])
            await message.answer(
                t.admin_inbox_card(b["id"], name, username, start, end, b["total_price"]),
                reply_markup=kb.admin_decide(b["id"], b["client_telegram_id"]),
            )
    except Exception as e:
        print("Ошибка входящих:", e)
        await message.answer(t.LOAD_ERROR)


# ============================================================
# ЗАЯВКИ СЕГОДНЯ (АДМИН)
# ============================================================

@dp.message(F.text == Btn.TODAY)
async def today_bookings(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    await state.clear()
    today = datetime.now(LOCAL_TZ).date()
    try:
        result = (
            supabase.table("bookings")
            .select("*")
            .in_("status", ["pending", "confirmed"])
            .order("start_time")
            .execute()
        )
        bookings = [
            b for b in (result.data or [])
            if parse_dt(b["start_time"]).date() == today
        ]
        if not bookings:
            await message.answer(f"На сегодня заявок нет.")
            return
        await message.answer(f"Заявки на сегодня: {len(bookings)}")
        for b in bookings:
            g = await get_garage(str(b["garage_id"]))
            name = g["name"] if g else "Объект недоступен"
            start = parse_dt(b["start_time"])
            end = parse_dt(b["end_time"])
            username = f"@{b['client_username']}" if b.get("client_username") else str(b["client_telegram_id"])
            status_label = "на согласовании" if b["status"] == "pending" else "подтверждена"
            await message.answer(
                f"<b>{name}</b>\n"
                f"──────────────\n"
                f"Клиент: {username}\n"
                f"Время: {start.strftime('%H:%M')}–{end.strftime('%H:%M')}\n"
                f"Сумма: {b['total_price']:g} ₽\n"
                f"Статус: {status_label}",
                reply_markup=kb.admin_decide(b["id"], b["client_telegram_id"]) if b["status"] == "pending" else None,
            )
    except Exception as e:
        print("Ошибка заявок сегодня:", e)
        await message.answer(t.LOAD_ERROR)


# ============================================================
# ПОДТВЕРЖДЕНИЕ / ОТКАЗ
# ============================================================

@dp.callback_query(F.data.startswith("confirm_booking_"))
async def confirm_booking(callback: CallbackQuery):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    parts = callback.data.replace("confirm_booking_", "", 1).split("_")
    booking_id, client_id = parts[0], int(parts[1])
    try:
        result = supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
        booking = result.data
        if not booking:
            await callback.message.answer("Заявка не найдена.")
            return
        g = await get_garage(str(booking["garage_id"]))
        start = parse_dt(booking["start_time"])
        end = parse_dt(booking["end_time"])
        supabase.table("bookings").update({"status": "confirmed"}).eq("id", booking_id).execute()
        await callback.message.edit_reply_markup(reply_markup=None)
        await callback.message.answer("Подтверждено. Клиент уведомлён.")
        await callback.bot.send_message(
            chat_id=client_id,
            text=t.confirmed_for_client(g, start, end, booking["total_price"]),
        )
    except Exception as e:
        print("Ошибка подтверждения:", e)
        await callback.message.answer("Не удалось подтвердить заявку.")


@dp.callback_query(F.data.startswith("reject_booking_"))
async def reject_booking_start(callback: CallbackQuery, state: FSMContext):
    if not is_admin(callback.from_user.id):
        return
    await callback.answer()
    parts = callback.data.replace("reject_booking_", "", 1).split("_")
    booking_id, client_id = parts[0], parts[1]
    try:
        result = supabase.table("bookings").select("*").eq("id", booking_id).single().execute()
        booking = result.data
        g = await get_garage(str(booking["garage_id"])) if booking else None
        await state.set_state(RejectForm.reason)
        await state.update_data(
            booking_id=booking_id,
            client_id=client_id,
            garage_name=g["name"] if g else "",
        )
        await callback.message.answer("Причина отказа:", reply_markup=kb.cancel_menu())
    except Exception as e:
        print("Ошибка отказа:", e)
        await callback.message.answer("Не удалось открыть отказ.")


@dp.message(RejectForm.reason)
async def reject_booking_reason(message: Message, state: FSMContext):
    if not is_admin(message.from_user.id):
        return
    data = await state.get_data()
    await state.clear()
    reason = message.text.strip()
    try:
        supabase.table("bookings").update(
            {"status": "rejected", "admin_comment": reason}
        ).eq("id", data["booking_id"]).execute()
        await message.answer("Заявка отклонена.", reply_markup=kb.admin_menu())
        await message.bot.send_message(
            chat_id=int(data["client_id"]),
            text=t.rejected_for_client(data.get("garage_name", ""), reason),
        )
    except Exception as e:
        print("Ошибка отклонения:", e)
        await message.answer("Не удалось отклонить заявку.", reply_markup=kb.admin_menu())


# ============================================================
# ПОИСК БОКСОВ (АРЕНДАТОР)
# ============================================================

@dp.message(F.text == Btn.FIND)
async def find_box(message: Message, state: FSMContext):
    await state.clear()
    await state.update_data(filter_type=None, filter_districts=[], filter_lift=None, filter_pit=None, filter_tools=None, districts_list=[])
    await message.answer(t.FIND_INTRO, reply_markup=kb.type_choice("f_type_", with_any=True))


@dp.callback_query(F.data.in_({"f_type_garage", "f_type_detailing", "f_type_any"}))
async def filter_type(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    val = None if callback.data == "f_type_any" else callback.data.replace("f_type_", "")
    await state.update_data(filter_type=val)
    await show_district_filter(callback.message, state)


async def show_district_filter(message, state):
    districts = await get_districts()
    if not districts:
        await apply_filters(message, state)
        return
    await state.update_data(districts_list=districts)
    data = await state.get_data()
    await message.answer(
        t.DISTRICT_INTRO,
        reply_markup=kb.district_filter(districts, data.get("filter_districts", [])),
    )


@dp.callback_query(F.data.startswith("f_d_"))
async def filter_district(callback: CallbackQuery, state: FSMContext):
    val = callback.data.replace("f_d_", "")
    if val == "any":
        await callback.answer()
        await state.update_data(filter_districts=[])
        await show_lift_filter(callback.message, state)
    elif val == "ok":
        await callback.answer()
        await show_lift_filter(callback.message, state)
    else:
        data = await state.get_data()
        districts_list = data.get("districts_list", [])
        try:
            idx = int(val)
            district_name = districts_list[idx]
        except (ValueError, IndexError):
            await callback.answer()
            return
        selected = data.get("filter_districts", [])
        if district_name in selected:
            selected.remove(district_name)
        else:
            selected.append(district_name)
        await state.update_data(filter_districts=selected)
        await callback.answer(f"Выбрано: {', '.join(selected) or 'ничего'}")
        await callback.message.edit_reply_markup(
            reply_markup=kb.district_filter(districts_list, selected)
        )


async def show_lift_filter(message, state):
    await message.answer(t.LIFT_INTRO, reply_markup=kb.skip_or_yes("f_lift_yes", "f_lift_any"))


@dp.callback_query(F.data.in_({"f_lift_yes", "f_lift_any"}))
async def filter_lift(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(filter_lift=True if callback.data == "f_lift_yes" else None)
    await callback.message.answer(t.PIT_INTRO, reply_markup=kb.skip_or_yes("f_pit_yes", "f_pit_any"))


@dp.callback_query(F.data.in_({"f_pit_yes", "f_pit_any"}))
async def filter_pit(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(filter_pit=True if callback.data == "f_pit_yes" else None)
    await callback.message.answer(t.TOOLS_INTRO, reply_markup=kb.skip_or_yes("f_tools_need", "f_tools_any", yes="Нужен", skip="Неважно"))


@dp.callback_query(F.data.in_({"f_tools_need", "f_tools_any"}))
async def filter_tools(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    await state.update_data(filter_tools="all" if callback.data == "f_tools_need" else None)
    await apply_filters(callback.message, state)


async def apply_filters(message, state):
    data = await state.get_data()
    try:
        query = supabase.table("garages").select("*")
        if data.get("filter_type"):
            query = query.eq("type", data["filter_type"])
        if data.get("filter_lift"):
            query = query.eq("has_lift", True)
        if data.get("filter_pit"):
            query = query.eq("has_pit", True)
        result = query.execute()
        garages = result.data or []
        if data.get("filter_districts"):
            garages = [g for g in garages if g.get("district") in data["filter_districts"]]
        if not garages:
            await message.answer(t.NOT_FOUND, reply_markup=kb.user_menu())
            return
        await message.answer(t.found_count(len(garages)))
        for g in garages:
            await send_garage_card(message, g)
    except Exception as e:
        print("Ошибка фильтрации:", e)
        await message.answer(t.LOAD_ERROR)


# ============================================================
# КАРТОЧКА ОБЪЕКТА
# ============================================================

@dp.callback_query(F.data.startswith("garage_"))
async def garage_card(callback: CallbackQuery):
    await callback.answer()
    garage_id = callback.data.replace("garage_", "")
    try:
        g = await get_garage(garage_id)
        if not g:
            await callback.message.answer("Объект не найден.")
            return
        await send_garage_card(callback.message, g, detailed=True)
    except Exception as e:
        print("Ошибка карточки:", e)
        await callback.message.answer(t.LOAD_ERROR)


# ============================================================
# БРОНИРОВАНИЕ
# ============================================================

@dp.callback_query(F.data.startswith("rent_"))
async def rent_garage(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    garage_id = callback.data.replace("rent_", "")
    try:
        g = await get_garage(garage_id)
        if not g:
            await callback.message.answer("Объект не найден.")
            return
        await state.clear()
        await state.update_data(
            garage_id=g["id"],
            garage_name=g["name"],
            price_per_hour=float(g["price_per_hour"]),
            owner_name=g.get("owner_name", ""),
            owner_phone=g.get("owner_phone", ""),
            owner_contact=g.get("owner_contact", ""),
        )
        await state.set_state(BookingForm.date)
        today = datetime.now(LOCAL_TZ).date()
        await callback.message.answer(t.DATE_INTRO, reply_markup=kb.dates(today))
    except Exception as e:
        print("Ошибка аренды:", e)
        await callback.message.answer(t.LOAD_ERROR)


@dp.callback_query(F.data.startswith("booking_date_"))
async def booking_date(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    date_str = callback.data.replace("booking_date_", "")
    try:
        selected_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        await callback.message.answer("Некорректная дата.")
        return
    data = await state.get_data()
    if not data.get("garage_id"):
        await callback.message.answer(t.SESSION_EXPIRED)
        return
    if selected_date < datetime.now(LOCAL_TZ).date():
        await callback.answer("Эта дата уже прошла.", show_alert=True)
        return
    occupied = await get_occupied_slots(str(data["garage_id"]), selected_date)
    past = past_hours(selected_date)
    await state.update_data(
        selected_date=date_str,
        selected_slots=[],
        occupied_slots=list(occupied),
        past_slots=list(past),
    )
    await state.set_state(BookingForm.slots)
    date_label = selected_date.strftime("%d.%m.%Y")
    try:
        await callback.message.edit_text(
            t.slots_caption(date_label, []),
            reply_markup=kb.slots(occupied, [], past),
        )
    except Exception:
        await callback.message.answer(
            t.slots_caption(date_label, []),
            reply_markup=kb.slots(occupied, [], past),
        )


@dp.callback_query(F.data == "slot_busy")
async def slot_busy(callback: CallbackQuery):
    await callback.answer("Это время недоступно.", show_alert=True)


@dp.callback_query(F.data.startswith("slot_"), BookingForm.slots)
async def booking_slot(callback: CallbackQuery, state: FSMContext):
    await callback.answer()
    hour = int(callback.data.replace("slot_", ""))
    data = await state.get_data()
    selected = sorted(data.get("selected_slots", []))
    occupied = set(data.get("occupied_slots", []))
    past = set(data.get("past_slots", []))
    if hour in occupied or hour in past:
        await callback.answer("Это время недоступно.", show_alert=True)
        return
    if hour in selected:
        selected.remove(hour)
    else:
        selected.append(hour)
        selected.sort()
    await state.update_data(selected_slots=selected)
    date_label = datetime.strptime(data["selected_date"], "%Y-%m-%d").strftime("%d.%m.%Y")
    try:
        await callback.message.edit_text(
            t.slots_caption(date_label, selected),
            reply_markup=kb.slots(occupied, selected, past),
        )
    except Exception:
        pass


@dp.callback_query(F.data == "booking_confirm")
async def booking_confirm(callback: CallbackQuery, state: FSMContext):
    data = await state.get_data()
    selected_slots = sorted(data.get("selected_slots", []))
    if not selected_slots:
        await callback.answer("Выберите хотя бы один час.", show_alert=True)
        return
    for i in range(len(selected_slots) - 1):
        if selected_slots[i + 1] != selected_slots[i] + 1:
            await callback.answer("Выбирайте часы подряд, без пропусков.", show_alert=True)
            return
    try:
        selected_date = datetime.strptime(data["selected_date"], "%Y-%m-%d").date()
    except (KeyError, ValueError):
        await callback.answer(t.SESSION_EXPIRED, show_alert=True)
        await state.clear()
        return
    start_hour = selected_slots[0]
    end_hour = selected_slots[-1] + 1
    start_time = datetime(selected_date.year, selected_date.month, selected_date.day, start_hour, 0, tzinfo=LOCAL_TZ)
    end_time = datetime(selected_date.year, selected_date.month, selected_date.day, end_hour, 0, tzinfo=LOCAL_TZ)
    if end_time <= datetime.now(LOCAL_TZ):
        await callback.answer("Выбранное время уже прошло.", show_alert=True)
        return
    occupied = await get_occupied_slots(str(data["garage_id"]), selected_date) | past_hours(selected_date)
    if any(h in occupied for h in selected_slots):
        await callback.message.answer("Один из часов уже занят. Выберите другое время.")
        await state.clear()
        return
    duration = len(selected_slots)
    total_price = duration * float(data["price_per_hour"])
    booking = {
        "garage_id": data["garage_id"],
        "client_telegram_id": callback.from_user.id,
        "client_username": callback.from_user.username,
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "total_price": total_price,
        "status": "pending",
    }
    try:
        result = supabase.table("bookings").insert(booking).execute()
        if not result.data:
            raise RuntimeError("Нет данных")
        booking_id = result.data[0]["id"]
        date_label = selected_date.strftime("%d.%m.%Y")
        await callback.answer()
        await callback.message.edit_text(
            t.request_summary(data["garage_name"], date_label, start_hour, end_hour, duration, total_price)
        )
        username = f"@{callback.from_user.username}" if callback.from_user.username else f"id {callback.from_user.id}"
        await callback.bot.send_message(
            chat_id=ADMIN_ID,
            text=t.admin_new_request(
                username, data["garage_name"], date_label,
                start_hour, end_hour, duration, total_price,
                data.get("owner_name"), data.get("owner_phone"), data.get("owner_contact"),
            ),
            reply_markup=kb.admin_decide(booking_id, callback.from_user.id),
        )
    except Exception as e:
        print("Ошибка заявки:", e)
        await callback.message.answer("Не удалось создать заявку.")
        return
    await state.clear()


# ============================================================
# МОИ ЗАЯВКИ (КЛИЕНТ)
# ============================================================

@dp.message(F.text == Btn.BOOKINGS)
async def my_bookings(message: Message, state: FSMContext):
    await state.clear()
    try:
        result = (
            supabase.table("bookings")
            .select("id, garage_id, start_time, end_time, total_price, status, admin_comment")
            .eq("client_telegram_id", message.from_user.id)
            .order("id", desc=True)
            .execute()
        )
        bookings = result.data or []
        if not bookings:
            await message.answer(t.NO_BOOKINGS, reply_markup=kb.user_menu())
            return
        for b in bookings:
            g = await get_garage(str(b["garage_id"]))
            name = g["name"] if g else "Объект недоступен"
            start = parse_dt(b["start_time"])
            end = parse_dt(b["end_time"])
            await message.answer(
                t.client_booking_card(name, start, end, b["total_price"], b["status"], b.get("admin_comment"))
            )
    except Exception as e:
        print("Ошибка заявок клиента:", e)
        await message.answer(t.LOAD_ERROR)


# ============================================================
# ЗАПУСК
# ============================================================

async def main():
    bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
