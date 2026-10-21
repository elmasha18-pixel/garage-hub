# GarageHub

Почасовая аренда гаражей самообслуживания и детейлинг-боксов в Москве и области.
Telegram-бот [@garazh_rent_bot](https://t.me/garazh_rent_bot) + Mini App внутри Telegram. Следующий шаг — сайт ([план](docs/SITE_PLAN.md)).

## Запуск

```bash
cd ~/Desktop/garage_bot && ./start.sh
```

Запускает бота, приложение и временный HTTPS-адрес для приложения. Пока работает — Мак не засыпает. Остановить: Ctrl+C.
Только бот, без приложения: `source venv/bin/activate && python3 bot.py`.

## Проверка

```bash
cd ~/Desktop/garage_bot && source venv/bin/activate && python3 tests/run_all.py
```

Все тесты одной командой; в конце тестовые данные удаляются сами, в настоящий Telegram ничего не уходит.

## Устройство

```
core/      общее: настройки (.env), база (Supabase), правила брони
tgbot/     Telegram-бот: обработчики, кнопки, тексты, напоминания
api/       HTTP API для Mini App и будущего сайта (вход через подпись Telegram)
webapp/    интерфейс Mini App, основа сайта; правила дизайна — webapp/DESIGN.md
assets/    картинки бота (обложка, заглушка, описание)
sql/       изменения базы (выполняются в Supabase → SQL Editor)
tests/     автотесты
tools/     служебное: туннель (tunnel.py), тестовый веб-сервер (dev_web.py)
docs/      документы и планы
```

Секреты — только в `.env` (в git не попадает). Подробности для разработки — в `CLAUDE.md`.
