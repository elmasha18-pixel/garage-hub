import asyncio, logging
logging.basicConfig(level=logging.ERROR)
import harness
harness.VERBOSE = False
from harness import Harness, click_data
import config, db

async def main():
    h = Harness()
    c = h.user(900000001, "test_client"); a = h.user(config.ADMIN_ID, "admin")
    steps = [
        (c, "send", "/start"), (c, "send", "Найти бокс"), (c, "click", "Гараж самообслуживания"),
        (c, "click", "Марьино"), (c, "click", "Далее"), (c, "click", "Неважно"), (c, "click", "Неважно"),
        (c, "click", "Неважно"), (c, "click", "Забронировать"), (c, "click", "Завтра"),
        (c, "click", "12:00"), (c, "click", "14:00"), (c, "click", "Отправить"),
        (a, "click", "Подтвердить"), (c, "send", "Мои заявки"), (c, "click", "🟢"),
        (c, "click", "Отменить заявку"), (c, "click", "Да, отменить"),
        (a, "send", "/start"), (a, "send", "Все объекты"), (a, "click", "ТЕСТ"), (a, "click", "Как видит клиент"),
        (a, "click", "Удалить"), (a, "click", "Да, удалить"),
        (c, "send", "/find"), (c, "click", "Показать"),
    ]
    for who, kind, arg in steps:
        if kind == "send": await who.send(arg)
        else: await who.click(arg)
    errors = [x for x in h.session.log if "пошло не так" in (x[2] or "") or "Ошибка в боте" in (x[2] or "")]
    print("шагов:", len(steps), "| сообщений бота:", len(h.session.log), "| ошибок:", len(errors))
    last = [x for x in h.session.log if x[1] == 900000001][-1]
    print("ТЕСТ-объект после удаления виден клиенту:", "ТЕСТ" in (last[2] or "") or any("ТЕСТ" in (x[2] or "") for x in h.session.log[-6:] if x[1]==900000001))

asyncio.run(main())
