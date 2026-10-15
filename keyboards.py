from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)

from config import BOOKING_WINDOW_DAYS, CLOSE_HOUR, OPEN_HOUR


class Btn:
    FIND = "Найти бокс"
    BOOKINGS = "Мои заявки"
    LIST = "Разместить бокс"
    CONTACT = "Контакты"
    ADD = "Добавить объект"
    ALL = "Все объекты"
    INBOX = "Новые заявки"
    TODAY = "Заявки сегодня"
    CANCEL = "Отмена"


def user_menu():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=Btn.FIND), KeyboardButton(text=Btn.BOOKINGS)],
            [KeyboardButton(text=Btn.LIST), KeyboardButton(text=Btn.CONTACT)],
        ],
        resize_keyboard=True,
        is_persistent=True,
    )


def admin_menu():
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text=Btn.ADD), KeyboardButton(text=Btn.ALL)],
            [KeyboardButton(text=Btn.INBOX), KeyboardButton(text=Btn.TODAY)],
        ],
        resize_keyboard=True,
        is_persistent=True,
    )


def cancel_menu():
    return ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=Btn.CANCEL)]],
        resize_keyboard=True,
    )


def yes_no(yes_cb: str, no_cb: str):
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="Да", callback_data=yes_cb),
        InlineKeyboardButton(text="Нет", callback_data=no_cb),
    ]])


def skip_or_yes(yes_cb: str, skip_cb: str, yes="Да", skip="Неважно"):
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=yes, callback_data=yes_cb),
        InlineKeyboardButton(text=skip, callback_data=skip_cb),
    ]])


def type_choice(prefix: str, with_any: bool = False):
    rows = [
        [InlineKeyboardButton(text="Гараж самообслуживания", callback_data=f"{prefix}garage")],
        [InlineKeyboardButton(text="Детейлинг-бокс", callback_data=f"{prefix}detailing")],
    ]
    if with_any:
        rows.append([InlineKeyboardButton(text="Любой", callback_data=f"{prefix}any")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def photos_done():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Готово", callback_data="photos_done")]
    ])


def tools_choice():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Есть на площадке", callback_data="tools_all")],
        [InlineKeyboardButton(text="Нужен свой", callback_data="tools_none")],
        [InlineKeyboardButton(text="Частично", callback_data="tools_partial")],
    ])


def edit_tools_choice():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Есть на площадке", callback_data="etools_all")],
        [InlineKeyboardButton(text="Нужен свой", callback_data="etools_none")],
        [InlineKeyboardButton(text="Частично", callback_data="etools_partial")],
    ])


def edit_size_choice():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="до 4,5 м — седаны", callback_data="esize_small")],
        [InlineKeyboardButton(text="до 5,5 м — внедорожники", callback_data="esize_medium")],
        [InlineKeyboardButton(text="до 7 м — Газели", callback_data="esize_large")],
    ])


def size_choice():
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="до 4,5 м — седаны", callback_data="size_small")],
        [InlineKeyboardButton(text="до 5,5 м — внедорожники", callback_data="size_medium")],
        [InlineKeyboardButton(text="до 7 м — Газели", callback_data="size_large")],
    ])


def district_filter(districts, selected):
    selected = selected or []
    rows = []
    for i, name in enumerate(districts):
        mark = " ✓" if name in selected else ""
        rows.append([InlineKeyboardButton(text=f"{name}{mark}", callback_data=f"f_d_{i}")])
    rows.append([InlineKeyboardButton(text="Показать результаты", callback_data="f_d_ok")])
    rows.append([InlineKeyboardButton(text="Все районы", callback_data="f_d_any")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def garage_open(garage_id):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Подробнее", callback_data=f"garage_{garage_id}")]
    ])


def garage_request(garage_id):
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Забронировать", callback_data=f"rent_{garage_id}")]
    ])


def garage_edit_menu(garage_id):
    """Меню редактирования полей объекта"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Название", callback_data=f"edit_name_{garage_id}")],
        [InlineKeyboardButton(text="Район", callback_data=f"edit_district_{garage_id}")],
        [InlineKeyboardButton(text="Адрес", callback_data=f"edit_address_{garage_id}")],
        [InlineKeyboardButton(text="Цена", callback_data=f"edit_price_{garage_id}")],
        [InlineKeyboardButton(text="Подъёмник", callback_data=f"edit_lift_{garage_id}")],
        [InlineKeyboardButton(text="Яма", callback_data=f"edit_pit_{garage_id}")],
        [InlineKeyboardButton(text="Инструмент", callback_data=f"edit_tools_{garage_id}")],
        [InlineKeyboardButton(text="Размер", callback_data=f"edit_size_{garage_id}")],
        [InlineKeyboardButton(text="Часы работы", callback_data=f"edit_hours_{garage_id}")],
        [InlineKeyboardButton(text="Описание", callback_data=f"edit_desc_{garage_id}")],
        [InlineKeyboardButton(text="Контакт владельца", callback_data=f"edit_owner_{garage_id}")],
    ])


def admin_object_actions(garage_id):
    """Кнопки действий под карточкой объекта для админа"""
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="Редактировать", callback_data=f"edit_garage_{garage_id}")]
    ])


def dates(today, days=BOOKING_WINDOW_DAYS):
    from datetime import timedelta
    weekdays = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"]
    rows = []
    for i in range(days):
        day = today + timedelta(days=i)
        if i == 0:
            label = f"Сегодня, {day.strftime('%d.%m')}"
        elif i == 1:
            label = f"Завтра, {day.strftime('%d.%m')}"
        else:
            label = f"{day.strftime('%d.%m')}, {weekdays[day.weekday()]}"
        rows.append([InlineKeyboardButton(text=label, callback_data=f"booking_date_{day.isoformat()}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def slots(occupied, selected, past):
    occupied = set(occupied or [])
    selected = set(selected or [])
    past = set(past or [])
    rows = []
    for hour in range(OPEN_HOUR, CLOSE_HOUR):
        label = f"{hour:02d}:00–{hour + 1:02d}:00"
        if hour in occupied or hour in past:
            rows.append([InlineKeyboardButton(text=f"{label}  занято", callback_data="slot_busy")])
        elif hour in selected:
            rows.append([InlineKeyboardButton(text=f"{label}  выбрано", callback_data=f"slot_{hour}")])
        else:
            rows.append([InlineKeyboardButton(text=label, callback_data=f"slot_{hour}")])
    rows.append([InlineKeyboardButton(text="Отправить заявку", callback_data="booking_confirm")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def admin_decide(booking_id, client_id):
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="Подтвердить", callback_data=f"confirm_booking_{booking_id}_{client_id}"),
        InlineKeyboardButton(text="Отказать", callback_data=f"reject_booking_{booking_id}_{client_id}"),
    ]])
