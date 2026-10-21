"""Запускает ТОЛЬКО веб-часть Mini App (без бота), чтобы смотреть и править интерфейс.
Вход без Telegram: http://localhost:8080/?dev=client  или  ?dev=admin
"""
import asyncio
import logging
import os

os.environ.setdefault("MINIAPP_DEV", "1")

from aiogram import Bot

from api.server import start_web
from config import TOKEN

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s: %(message)s")


async def main():
    bot = Bot(TOKEN)
    runner = await start_web(bot)
    try:
        await asyncio.Event().wait()
    finally:
        await runner.cleanup()
        await bot.session.close()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
