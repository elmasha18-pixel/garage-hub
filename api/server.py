"""Веб-сервер: API + статические файлы приложения. Работает в одном процессе с ботом."""
import logging

from aiogram import Bot
from aiohttp import web

from api import photos, routes
from config import WEB_HOST, WEB_PORT, WEBAPP_DIR

log = logging.getLogger(__name__)


async def index(request: web.Request) -> web.StreamResponse:
    return web.FileResponse(WEBAPP_DIR / "index.html")


def build_app(bot: Bot) -> web.Application:
    app = web.Application(
        middlewares=[routes.headers_middleware, routes.errors_middleware, routes.auth_middleware],
        client_max_size=64 * 1024,
    )
    app["bot"] = bot
    routes.add_routes(app)
    app.router.add_get("/api/photo/{file_id}", photos.photo)
    app.router.add_get("/", index)
    app.router.add_static("/", WEBAPP_DIR, show_index=False)
    return app


async def start_web(bot: Bot) -> web.AppRunner:
    runner = web.AppRunner(build_app(bot), access_log=None)
    await runner.setup()
    await web.TCPSite(runner, WEB_HOST, WEB_PORT).start()
    log.info("Mini App: http://%s:%s", WEB_HOST, WEB_PORT)
    return runner
