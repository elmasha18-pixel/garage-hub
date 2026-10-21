"""Разбор времени из базы: все форматы, которые отдаёт Postgres/PostgREST."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from utils import parse_dt

CASES = {
    "2026-10-21T18:17:08.17434+00:00": "2026-10-21 21:17:08.174340",   # 5 цифр — та самая ошибка
    "2026-10-21T18:17:08.1+00:00": "2026-10-21 21:17:08.100000",
    "2026-10-21T18:17:08.123456+00:00": "2026-10-21 21:17:08.123456",
    "2026-10-21T18:17:08.1234567+00:00": "2026-10-21 21:17:08.123456",  # 7 цифр — обрезаем
    "2026-10-21T18:17:08+00:00": "2026-10-21 21:17:08",
    "2026-10-21T18:17:08Z": "2026-10-21 21:17:08",
    "2026-10-21 18:17:08.5+00": "2026-10-21 21:17:08.500000",          # пробел и короткий пояс
    "2026-10-22T13:00:00+03:00": "2026-10-22 13:00:00",
}
fails = 0
for raw, expected in CASES.items():
    got = parse_dt(raw).strftime("%Y-%m-%d %H:%M:%S.%f").rstrip("0").rstrip(".") if "." in expected else parse_dt(raw).strftime("%Y-%m-%d %H:%M:%S")
    exp = expected.rstrip("0").rstrip(".") if "." in expected else expected
    ok = got == exp
    fails += not ok
    print(("  ✓ " if ok else "  ✗ ") + raw + ("" if ok else f" → {got}, ждали {exp}"))
print("ИТОГ:", "всё прошло" if not fails else f"упало {fails}")
sys.exit(1 if fails else 0)
