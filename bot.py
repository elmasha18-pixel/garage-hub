"""Запуск бота GarageHub (вместе с веб-частью Mini App).

    python3 bot.py        — только бот
    ./start.sh            — бот + временный HTTPS для Mini App (обычный способ)
"""
from tgbot.app import run

if __name__ == "__main__":
    run()
