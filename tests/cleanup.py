import sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent.parent))
import config
r = config.supabase.table("bookings").delete().eq("client_telegram_id", 900000001).execute()
print("удалено тестовых заявок:", len(r.data or []))
r = config.supabase.table("owner_requests").delete().eq("telegram_id", 900000001).execute()
print("удалено тестовых заявок владельцев:", len(r.data or []))
r = config.supabase.table("garages").delete().like("name", "ТЕСТ%").execute()
print("удалено тестовых объектов:", len(r.data or []))
