"""Просмотр сайта на Маке, без сервера и без домена.

Запуск из корня проекта:  source venv/bin/activate && python3 site/serve.py
Открыть:                  http://localhost:8090         (настоящий каталог, если бот запущен)
                          http://localhost:8090/?demo   (примеры боксов, бот не нужен)

Страницы отдаются из папки site/, а запросы /api/... пересылаются боту на 127.0.0.1:8080
(он уже отдаёт открытый каталог и фото). Скрипт только читает: в базу и в Telegram ничего не пишет.
Бот и его код этот скрипт не трогает.
"""
import os
from pathlib import Path

from aiohttp import ClientError, ClientSession, ClientTimeout, web

SITE_DIR = Path(__file__).resolve().parent
BOT_API = os.getenv("BOT_API", "http://127.0.0.1:8080")
PORT = int(os.getenv("SITE_PORT", "8090"))


async def index(request: web.Request) -> web.FileResponse:
    return web.FileResponse(SITE_DIR / "index.html")


async def proxy(request: web.Request) -> web.Response:
    # Только чтение открытых данных: каталог, свободные часы, фото
    url = BOT_API + request.path_qs
    try:
        async with request.app["http"].get(url) as r:
            body = await r.read()
            return web.Response(body=body, status=r.status, content_type=r.content_type,
                                headers={"Cache-Control": r.headers.get("Cache-Control", "no-store")})
    except ClientError:
        return web.json_response({"error": {"code": "bot_offline", "message": "Бот не запущен"}}, status=503)


async def on_startup(app: web.Application) -> None:
    app["http"] = ClientSession(timeout=ClientTimeout(total=20))


async def on_cleanup(app: web.Application) -> None:
    await app["http"].close()


def main() -> None:
    app = web.Application()
    app.on_startup.append(on_startup)
    app.on_cleanup.append(on_cleanup)
    app.router.add_get("/", index)
    app.router.add_get("/api/{tail:.*}", proxy)
    app.router.add_static("/", SITE_DIR, show_index=False)
    print(f"Сайт: http://localhost:{PORT}   (примеры: http://localhost:{PORT}/?demo)")
    print("Остановить: Ctrl+C")
    web.run_app(app, host="127.0.0.1", port=PORT, print=None)


if __name__ == "__main__":
    main()
