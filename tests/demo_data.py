"""Создаёт 3 демо-объекта «ТЕСТ …» для проверки интерфейса Mini App. Удаляются tests/cleanup.py."""
import asyncio, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from core import config, db

BASE = {"photos": [], "owner_name": "Тест", "owner_phone": "+7 900 000-00-01", "owner_contact": "@test_owner",
        "owner_telegram_id": config.ADMIN_ID, "is_active": True}
ITEMS = [
    dict(type="garage", name="ТЕСТ Гараж с подъёмником", district="Марьино", address="ул. Люблинская, 165, бокс 12",
         price_per_hour=800, has_lift=True, has_pit=True, tool_availability="all", box_size="medium",
         working_hours="ежедневно 9:00–22:00", open_hour=9, close_hour=22,
         description="Тёплый бокс 6×4 м. Двухстоечный подъёмник на 4 тонны, смотровая яма, компрессор, набор инструмента, верстак и тиски. Хорошее освещение, розетки 220 В.\nЗаезд со двора, шлагбаум — позвоните за 10 минут до приезда."),
    dict(type="detailing", name="ТЕСТ Детейлинг-бокс Light", district="Люблино", address="ул. Совхозная, 41",
         price_per_hour=1200, has_lift=False, has_pit=False, tool_availability="none", box_size="large",
         working_hours="круглосуточно", open_hour=0, close_hour=24,
         description="Светлый бокс для мойки и полировки: вода, пена, подключение пылесоса, мощный свет."),
    dict(type="garage", name="ТЕСТ Бокс у метро", district="Котельники", address="Дзержинский, ул. Ленина 2",
         price_per_hour=500, has_lift=False, has_pit=True, tool_availability="partial", box_size="small",
         working_hours="ежедневно 10:00–20:00", open_hour=10, close_hour=20,
         description="Небольшой бокс с ямой. Подойдёт для замены масла и колодок."),
]

async def main():
    for item in ITEMS:
        g = await db.create_garage({**BASE, **item})
        print(g["id"], g["name"])

asyncio.run(main())
