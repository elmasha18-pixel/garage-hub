"""GarageHub — точка входа: логи, подключение обработчиков, напоминания, запуск."""
import asyncio
import logging
import time
from logging.handlers import RotatingFileHandler

from aiogram import Bot, Dispatcher
from aiogram.client.default import DefaultBotProperties
from aiogram.enums import ParseMode
from aiogram.exceptions import TelegramBadRequest
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import BotCommand, BotCommandScopeChat, BotCommandScopeDefault, ErrorEvent

import reminders
import texts as t
from config import ADMIN_ID, LOGS_DIR, TOKEN, supabase
from handlers import admin_bookings, admin_objects, booking, common, owners, search

log = logging.getLogger("garagehub")


def setup_logging() -> None:
    LOGS_DIR.mkdir(exist_ok=True)
    fmt = logging.Formatter("%(asctime)s %(levelname)-7s %(name)s: %(message)s", "%Y-%m-%d %H:%M:%S")
    file_handler = RotatingFileHandler(LOGS_DIR / "bot.log", maxBytes=2_000_000, backupCount=3, encoding="utf-8")
    file_handler.setFormatter(fmt)
    console = logging.StreamHandler()
    console.setFormatter(fmt)
    logging.basicConfig(level=logging.INFO, handlers=[console, file_handler])
    for noisy in ("httpx", "httpcore", "hpack"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def build_dispatcher() -> Dispatcher:
    dp = Dispatcher(storage=MemoryStorage())
    # Порядок важен: сначала меню (срабатывает в любом состоянии), потом сценарии.
    dp.include_routers(
        common.router,
        admin_bookings.router,
        admin_objects.router,
        booking.router,
        search.router,
        owners.router,
    )
    dp.errors.register(on_error)
    return dp


_last_error_report = 0.0


async def on_error(event: ErrorEvent) -> bool:
    global _last_error_report
    error = event.exception
    if isinstance(error, TelegramBadRequest) and (
        "not modified" in str(error) or "query is too old" in str(error)
    ):
        return True
    log.exception("Ошибка при обработке обновления", exc_info=error)

    update = event.update
    bot = update.bot if hasattr(update, "bot") else None
    message = update.message or (update.callback_query.message if update.callback_query else None)
    where = "сообщение" if update.message else "кнопка" if update.callback_query else "обновление"
    if update.callback_query:
        where += f" «{update.callback_query.data}»"
    elif update.message and update.message.text:
        where += f" «{t.clip(update.message.text, 40)}»"

    try:
        if update.callback_query:
            await update.callback_query.answer("Что-то пошло не так. Попробуйте ещё раз.", show_alert=True)
        elif message:
            await message.answer("Что-то пошло не так. Попробуйте ещё раз или начните с /start.")
    except Exception:
        pass

    if message and time.monotonic() - _last_error_report > 60:
        _last_error_report = time.monotonic()
        try:
            await message.bot.send_message(ADMIN_ID, t.error_for_admin(where, error))
        except Exception:
            pass
    return True


def check_schema() -> bool:
    try:
        supabase.table("garages").select("is_active, open_hour, close_hour").limit(1).execute()
        supabase.table("bookings").select("admin_reminded, client_wait_notified, visit_reminded").limit(1).execute()
        supabase.table("owner_requests").select("id").limit(1).execute()
        return True
    except Exception as e:
        log.error("База не обновлена: %s", e)
        return False


async def setup_commands(bot: Bot) -> None:
    common_commands = [
        BotCommand(command="start", description="Главное меню"),
        BotCommand(command="find", description="Найти бокс"),
        BotCommand(command="my", description="Мои заявки"),
        BotCommand(command="contacts", description="Контакты"),
    ]
    await bot.set_my_commands(common_commands, scope=BotCommandScopeDefault())
    await bot.set_my_commands(
        common_commands + [
            BotCommand(command="admin", description="Панель управления"),
            BotCommand(command="client", description="Посмотреть глазами клиента"),
        ],
        scope=BotCommandScopeChat(chat_id=ADMIN_ID),
    )


async def main() -> None:
    setup_logging()
    if not check_schema():
        log.error("Выполните sql/001_v2.sql в Supabase → SQL Editor и перезапустите бота.")
        return

    bot = Bot(token=TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
    dp = build_dispatcher()
    me = await bot.get_me()
    await setup_commands(bot)
    reminder_task = asyncio.create_task(reminders.run(bot))
    log.info("GarageHub запущен: @%s", me.username)
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        reminder_task.cancel()
        await bot.session.close()
        log.info("GarageHub остановлен")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
