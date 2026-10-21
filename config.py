import os
from pathlib import Path
from zoneinfo import ZoneInfo

import httpx
from dotenv import load_dotenv
from supabase import ClientOptions, create_client

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SECRET_KEY")
ADMIN_ID = int(os.getenv("ADMIN_ID", "5121580545"))
ADMIN_TG = os.getenv("ADMIN_TG", "@mamedov99999")
ADMIN_PHONE = os.getenv("ADMIN_PHONE", "+7 (999) 462-47-30")

if not TOKEN:
    raise RuntimeError("TELEGRAM_BOT_TOKEN не найден в .env")
if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL не найден в .env")
if not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_SECRET_KEY не найден в .env")

# Запросы к базе идут из разных потоков одновременно. Общее HTTP/2-соединение для этого не рассчитано
# (случайные ReadError под нагрузкой), поэтому берём HTTP/1.1 с пулом соединений.
_http = httpx.Client(
    http2=False,
    timeout=httpx.Timeout(15.0, connect=10.0),
    limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
)
supabase = create_client(SUPABASE_URL, SUPABASE_KEY, options=ClientOptions(httpx_client=_http))

LOCAL_TZ = ZoneInfo("Europe/Moscow")
ASSETS_DIR = BASE_DIR / "assets"
LOGS_DIR = BASE_DIR / "logs"

# Часы бронирования по умолчанию (если у объекта не распознаны свои)
DEFAULT_OPEN_HOUR = 9
DEFAULT_CLOSE_HOUR = 22
BOOKING_WINDOW_DAYS = 7
MAX_PHOTOS = 5

# Напоминания (в минутах)
ADMIN_REMIND_AFTER_MIN = 15      # заявка висит без ответа → напомнить админу
CLIENT_WAIT_NOTICE_MIN = 60      # клиенту: «заявка ещё на согласовании»
VISIT_REMIND_BEFORE_MIN = 120    # клиенту: «через 2 часа ждём вас»
REMINDER_INTERVAL_SEC = 60

# ─── Mini App (веб-интерфейс) ────────────────────────────────
WEBAPP_DIR = BASE_DIR / "webapp"
CACHE_DIR = BASE_DIR / "cache"
WEB_HOST = os.getenv("WEB_HOST", "127.0.0.1")
WEB_PORT = int(os.getenv("WEB_PORT", "8080"))
# Публичный HTTPS-адрес Mini App (нужен Telegram). Пусто — приложение в боте не показывается.
WEBAPP_URL = (os.getenv("WEBAPP_URL") or "").strip().rstrip("/")
# Режим разработки: вход без Telegram, только с локального адреса. На сервере НЕ включать.
MINIAPP_DEV = os.getenv("MINIAPP_DEV", "").lower() in ("1", "true", "yes")
INIT_DATA_MAX_AGE_SEC = 24 * 3600
