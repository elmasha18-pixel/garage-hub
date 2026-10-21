const NB = " ";
const numberFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });

export const money = (n) => numberFmt.format(Number(n) || 0).replace(/[ \s]/g, NB) + NB + "₽";

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  return b === 1 ? one : many;
}

/* Даты приходят с сервера как «2026-10-22» (московский день). Разбираем в UTC, чтобы часовой пояс устройства ничего не сдвинул. */
export const parseDay = (iso) => new Date(`${iso}T12:00:00Z`);
const fmt = (opts) => new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC", ...opts });
const wdShort = fmt({ weekday: "short" });
const dayMonth = fmt({ day: "numeric", month: "long" });

export const weekdayShort = (iso) => wdShort.format(parseDay(iso)).replace(".", "");
export const dayNumber = (iso) => parseDay(iso).getUTCDate();
export const dayLong = (iso) => `${weekdayShort(iso)}, ${dayMonth.format(parseDay(iso))}`;

export const hhmm = (h) => `${String(h).padStart(2, "0")}:00`;
export const span = (start, end) => `${hhmm(start)}–${hhmm(end)}`;

export const hours = (n) => `${n}${NB}ч`;

export function ago(minutes) {
  if (minutes == null) return "";
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h} ч назад`;
  return `${Math.floor(h / 24)} д назад`;
}

export const SIZES = {
  small: "до 4,5 м (седаны)",
  medium: "до 5,5 м (внедорожники)",
  large: "до 7 м (Газели)",
};
export const TOOLS = { all: "есть на площадке", none: "нужен свой", partial: "частично" };
export const TYPES = { garage: "Гараж самообслуживания", detailing: "Детейлинг-бокс" };
export const TYPES_SHORT = { garage: "Гараж", detailing: "Детейлинг" };
export const STATUS = {
  pending: "На согласовании",
  confirmed: "Подтверждена",
  rejected: "Отклонена",
  cancelled: "Отменена",
};

export function mapUrl(g) {
  const parts = [g.district, g.address].filter(Boolean).join(", ");
  const query = /москв|обл/i.test(parts) ? parts : `Москва, ${parts}`;
  return `https://yandex.ru/maps/?text=${encodeURIComponent(query)}`;
}
