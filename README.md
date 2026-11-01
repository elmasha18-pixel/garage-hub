# GarageHub

Почасовая аренда гаражей самообслуживания и детейлинг-боксов в Москве и области.
Telegram-бот [@garazh_rent_bot](https://t.me/garazh_rent_bot) + Mini App внутри Telegram + первая версия сайта (`site/`, [план](docs/SITE_PLAN.md)).

## Установка с нуля (для разработчика)

Нужен Python 3.9 (проект проверен на 3.9.6: синтаксис 3.10+ не использовать).

```bash
git clone <адрес репозитория> garage_bot && cd garage_bot
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # заполнить токен бота и ключи Supabase
```

Схема базы — файлы в `sql/` (выполняются в Supabase → SQL Editor). Бот при старте проверяет схему и не запустится, если SQL не выполнен.

## Запуск

```bash
cd ~/Desktop/garage_bot && ./start.sh
```

Запускает бота, приложение и временный HTTPS-адрес для приложения. Пока работает — Мак не засыпает. Остановить: Ctrl+C.
Только бот, без приложения: `source venv/bin/activate && python3 bot.py`.

Интерфейс Mini App без Telegram: `WEB_PORT=8081 python3 -m tools.dev_web` → http://localhost:8081/?dev=client (или `?dev=admin`).

## Сайт

```bash
source venv/bin/activate && python3 site/serve.py
```

- http://localhost:8090 — настоящий каталог (нужен запущенный бот, он отдаёт данные на 127.0.0.1:8080)
- http://localhost:8090/?demo — примеры боксов, бот не нужен

Подробнее — `site/README.md`.

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
webapp/    интерфейс Mini App; правила дизайна — webapp/DESIGN.md
site/      сайт (статические страницы + serve.py для просмотра)
assets/    картинки бота (обложка, заглушка, описание)
sql/       изменения базы (выполняются в Supabase → SQL Editor)
tests/     автотесты
tools/     служебное: туннель (tunnel.py), тестовый веб-сервер (dev_web.py)
docs/      документы и планы
```

Секреты — только в `.env` (в git не попадает, образец — `.env.example`). Подробности для разработки — в `CLAUDE.md`.
