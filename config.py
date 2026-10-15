import os

from dotenv import load_dotenv
from supabase import create_client
from zoneinfo import ZoneInfo

load_dotenv()

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

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
LOCAL_TZ = ZoneInfo("Europe/Moscow")
OPEN_HOUR = 9
CLOSE_HOUR = 22
BOOKING_WINDOW_DAYS = 7
MAX_PHOTOS = 5
