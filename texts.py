from html import escape as h

from config import ADMIN_PHONE, ADMIN_TG

LOGO = "GarageHub"
DIVIDER = "──────────────"


def money(value) -> str:
    number = float(value)
    if number.is_integer():
        return f"{int(number)} ₽"
    return f"{number:g} ₽"


def clip(text: str, limit: int) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "…"


def object_type(value: str) -> str:
    return "Гараж самообслуживания" if value == "garage" else "Детейлинг-бокс"


def tools(value: str) -> str:
    return {
        "all": "есть на площадке",
        "none": "нужен свой",
        "partial": "частично",
    }.get(value, value or "не указано")


def size(value: str) -> str:
    return {
        "small": "до 4,5 м — седаны",
        "medium": "до 5,5 м — внедорожники",
        "large": "до 7 м — Газели",
    }.get(value, value or "не указано")


def yes_no(flag) -> str:
    return "есть" if flag else "нет"


def booking_status(value: str) -> str:
    return {
        "pending": "на согласовании",
        "confirmed": "подтверждена",
        "rejected": "отклонена",
        "cancelled": "отменена",
    }.get(value, value)


def slot_range(slots) -> str:
    if not slots:
        return "не выбрано"
    return f"{min(slots):02d}:00–{max(slots) + 1:02d}:00"


# ─── Стартовые экраны ────────────────────────────────────────

START = (
    f"<b>{LOGO}</b>\n"
    f"{DIVIDER}\n"
    "Площадки для самостоятельного ремонта\n"
    "и профессионального детейлинга.\n\n"
    "Выберите бокс, укажите удобное время\n"
    "и отправьте заявку — всё остальное берём на себя.\n\n"
    "<i>Оплата на месте, напрямую площадке.</i>"
)

START_ADMIN = (
    f"<b>{LOGO} · Панель управления</b>\n"
    f"{DIVIDER}\n"
    "Новые заявки клиентов приходят сюда."
)

# ─── Поиск ───────────────────────────────────────────────────

FIND_INTRO = (
    f"<b>Найти бокс</b>\n"
    f"{DIVIDER}\n"
    "Что ищете?"
)

DISTRICT_INTRO = "Выберите район. Можно несколько."
LIFT_INTRO = "Нужен подъёмник?"
PIT_INTRO = "Нужна смотровая яма?"
TOOLS_INTRO = "Нужен инструмент на площадке?"

NOT_FOUND = (
    "По заданным параметрам площадок не найдено.\n\n"
    "Попробуйте изменить фильтры."
)

LOAD_ERROR = "Не удалось загрузить данные. Попробуйте позже."

# ─── Арендодатель ────────────────────────────────────────────

OWNER_INTRO = (
    f"<b>Разместить бокс</b>\n"
    f"{DIVIDER}\n"
    "Оставьте заявку — мы свяжемся с вами,\n"
    "обсудим условия и добавим объект в каталог.\n\n"
    "Как к вам обращаться?"
)

OWNER_PHONE = "Ваш номер телефона:"
OWNER_TYPE = "Тип объекта:"
OWNER_ADDRESS = "Адрес площадки:"

OWNER_DONE = (
    "Заявка принята.\n\n"
    "Мы свяжемся с вами в ближайшее время.\n\n"
    f"<b>Контакт:</b>\n"
    f"{ADMIN_TG}\n"
    f"{ADMIN_PHONE}"
)

CONTACT = (
    f"<b>{LOGO}</b>\n"
    f"{DIVIDER}\n"
    f"Telegram: {ADMIN_TG}\n"
    f"Телефон: {ADMIN_PHONE}"
)

# ─── Бронирование ────────────────────────────────────────────

DATE_INTRO = "Выберите дату"

SLOTS_INTRO = (
    "Выберите часы.\n"
    "Часы должны идти подряд, без разрывов.\n"
    "Занятое время недоступно."
)

REQUEST_SENT = (
    f"<b>Заявка отправлена</b>\n"
    f"{DIVIDER}\n"
    "Ожидайте подтверждения — мы напишем вам в этот чат.\n\n"
    "<i>Оплата после подтверждения, на месте.</i>"
)

SESSION_EXPIRED = "Сессия устарела. Нажмите «Найти бокс» и начните заново."
NO_BOOKINGS = "У вас пока нет заявок."
EMPTY_CATALOG = "В каталоге пока нет объектов."
NO_PENDING = "Новых заявок нет."

# ─── Добавление объекта ──────────────────────────────────────

ADD_TYPE = "Тип объекта:"
ADD_NAME = "Название площадки:"
ADD_DISTRICT = "Район (например: Марьино, Химки, Одинцово):"
ADD_ADDRESS = "Полный адрес:"
ADD_PHOTOS = "Пришлите до 5 фото. Когда закончите — нажмите «Готово»."
ADD_PRICE = "Цена за час (только цифра):"
ADD_LIFT = "Есть подъёмник?"
ADD_PIT = "Есть смотровая яма?"
ADD_TOOLS = "Инструмент на площадке:"
ADD_SIZE = "Размер бокса:"
ADD_HOURS = "Часы работы (например: ежедневно 9:00–22:00):"
ADD_DESC = "Описание площадки (свободный текст от владельца):"
ADD_OWNER_NAME = "Имя владельца (только для вас):"
ADD_OWNER_PHONE = "Телефон владельца (только для вас):"
ADD_OWNER_TG = "Telegram владельца (только для вас):"

EDIT_CHOOSE = "Что хотите изменить?"
EDIT_DONE = "Данные обновлены."

# ─── Функции форматирования ──────────────────────────────────

def found_count(n: int) -> str:
    if n == 1:
        return "Найдена 1 площадка"
    if 2 <= n <= 4:
        return f"Найдено {n} площадки"
    return f"Найдено {n} площадок"


def catalog_card(g: dict, *, detailed: bool = False) -> str:
    type_label = object_type(g.get("type") or "")
    lines = [
        f"<b>{h(g.get('name') or '')}</b>",
        f"<i>{type_label}</i>",
        f"{DIVIDER}",
        f"Адрес: {h(g.get('district') or '')} — {h(g.get('address') or '')}",
        f"Цена: {money(g.get('price_per_hour') or 0)} / час",
        f"Подъёмник: {yes_no(g.get('has_lift'))}",
        f"Яма: {yes_no(g.get('has_pit'))}",
        f"Инструмент: {tools(g.get('tool_availability') or '')}",
    ]
    if detailed:
        lines.append(f"Размер: {size(g.get('box_size') or '')}")
        if g.get("working_hours"):
            lines.append(f"Работает: {h(g['working_hours'])}")
        if g.get("description"):
            lines.append(f"{DIVIDER}")
            lines.append(h(clip(g["description"], 600)))
    return "\n".join(lines)


def admin_object_card(g: dict) -> str:
    return (
        f"<b>{h(g.get('name') or '')}</b>\n"
        f"<i>{object_type(g.get('type') or '')}</i>\n"
        f"{DIVIDER}\n"
        f"Район: {h(g.get('district') or '—')}\n"
        f"Адрес: {h(g.get('address') or '—')}\n"
        f"Цена: {money(g.get('price_per_hour') or 0)} / час\n"
        f"Подъёмник: {yes_no(g.get('has_lift'))} · Яма: {yes_no(g.get('has_pit'))}\n"
        f"Инструмент: {tools(g.get('tool_availability') or '')}\n"
        f"Размер: {size(g.get('box_size') or '')}\n"
        f"Работает: {h(g.get('working_hours') or '—')}\n"
        f"{DIVIDER}\n"
        f"Владелец: {h(g.get('owner_name') or '—')}\n"
        f"Телефон: {h(g.get('owner_phone') or '—')}\n"
        f"Telegram: {h(g.get('owner_contact') or '—')}"
    )


def slots_caption(date_label: str, selected) -> str:
    extra = f"\nВыбрано: <b>{slot_range(selected)}</b>" if selected else ""
    return f"<b>{h(date_label)}</b>\n{SLOTS_INTRO}{extra}"


def request_summary(name, date_label, start_hour, end_hour, duration, total) -> str:
    return (
        f"{REQUEST_SENT}\n\n"
        f"<b>{h(name)}</b>\n"
        f"{DIVIDER}\n"
        f"Дата: {h(date_label)}\n"
        f"Время: {start_hour:02d}:00–{end_hour:02d}:00\n"
        f"Длительность: {duration} ч.\n"
        f"Сумма: {money(total)}"
    )


def admin_new_request(
    username, name, date_label, start_hour, end_hour, duration, total,
    owner_name, owner_phone, owner_contact
) -> str:
    return (
        f"<b>Новая заявка</b>\n"
        f"{DIVIDER}\n"
        f"Клиент: {h(username)}\n"
        f"Площадка: <b>{h(name)}</b>\n"
        f"Дата: {h(date_label)}\n"
        f"Время: {start_hour:02d}:00–{end_hour:02d}:00\n"
        f"Длительность: {duration} ч. · {money(total)}\n"
        f"{DIVIDER}\n"
        f"Владелец: {h(owner_name or '—')}\n"
        f"Телефон: {h(owner_phone or '—')}\n"
        f"Telegram: {h(owner_contact or '—')}"
    )


def confirmed_for_client(g: dict, start, end, total) -> str:
    name = (g or {}).get("name") or ""
    district = (g or {}).get("district") or ""
    address = (g or {}).get("address") or ""
    location = f"{h(district)} — {h(address)}" if district else h(address)
    return (
        f"<b>Заявка подтверждена</b>\n"
        f"{DIVIDER}\n"
        f"<b>{h(name)}</b>\n"
        f"Адрес: {location}\n"
        f"Дата: {start.strftime('%d.%m.%Y')}\n"
        f"Время: {start.strftime('%H:%M')}–{end.strftime('%H:%M')}\n"
        f"Сумма: {money(total)}\n"
        f"{DIVIDER}\n"
        "<i>Оплата на месте, напрямую площадке.</i>"
    )


def rejected_for_client(name: str, reason: str) -> str:
    return (
        f"<b>Заявка отклонена</b>\n"
        f"{DIVIDER}\n"
        f"Площадка: {h(name)}\n"
        f"Причина: {h(reason)}\n\n"
        "Выберите другое время или другую площадку."
    )


def client_booking_card(name, start, end, total, status, comment=None) -> str:
    text = (
        f"<b>{h(name)}</b>\n"
        f"{DIVIDER}\n"
        f"Дата: {start.strftime('%d.%m.%Y')}\n"
        f"Время: {start.strftime('%H:%M')}–{end.strftime('%H:%M')}\n"
        f"Сумма: {money(total)}\n"
        f"Статус: {booking_status(status)}"
    )
    if comment and status == "rejected":
        text += f"\nПричина: {h(comment)}"
    return text


def admin_inbox_card(booking_id, name, username, start, end, total) -> str:
    return (
        f"<b>Заявка #{booking_id}</b>\n"
        f"{DIVIDER}\n"
        f"Площадка: <b>{h(name)}</b>\n"
        f"Клиент: {h(username)}\n"
        f"Дата: {start.strftime('%d.%m.%Y')}\n"
        f"Время: {start.strftime('%H:%M')}–{end.strftime('%H:%M')}\n"
        f"Сумма: {money(total)}"
    )


def owner_lead_for_admin(name, phone, object_type_label, address, username) -> str:
    return (
        f"<b>Заявка на размещение</b>\n"
        f"{DIVIDER}\n"
        f"Имя: {h(name)}\n"
        f"Телефон: {h(phone)}\n"
        f"Тип: {h(object_type_label)}\n"
        f"Адрес: {h(address)}\n"
        f"Telegram: {h(username)}"
    )
