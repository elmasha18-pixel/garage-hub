/* Обёртка над Telegram WebApp. Вне Telegram (браузер, будущий сайт) всё работает без ошибок:
   вызовы превращаются в безопасные заглушки. */

const sdk = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData ? window.Telegram.WebApp : null;

/* Запасной путь: Telegram кладёт данные входа в адрес страницы (#tgWebAppData=…).
   Если служебный скрипт с telegram.org не загрузился (в России без VPN — частая история),
   берём их отсюда: вход и данные работают, без SDK пропадают только мелочи (вибрация, кнопка «Назад»). */
function fromHash() {
  try {
    const params = new URLSearchParams(location.hash.slice(1));
    return {
      initData: params.get("tgWebAppData") || "",
      startParam: params.get("tgWebAppStartParam") || "",
      theme: JSON.parse(params.get("tgWebAppThemeParams") || "null"),
    };
  } catch {
    return { initData: "", startParam: "", theme: null };
  }
}
const hash = fromHash();
const KEY = "gh_tma";
let rawInitData = (sdk && sdk.initData) || hash.initData;
try {
  if (rawInitData) sessionStorage.setItem(KEY, rawInitData);
  else rawInitData = sessionStorage.getItem(KEY) || "";   // перезагрузка страницы внутри Telegram
} catch { /* хранилище недоступно — не страшно */ }

const tg = sdk;
export const inTelegram = Boolean(rawInitData);
export const sdkLoaded = Boolean(sdk);
export const initData = () => rawInitData;
export const startParam = () => (sdk && sdk.initDataUnsafe && sdk.initDataUnsafe.start_param) || hash.startParam;

function hashThemeIsDark() {
  const bg = hash.theme && hash.theme.bg_color;
  if (!bg || !/^#[0-9a-f]{6}$/i.test(bg)) return null;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 128;
}

function call(fn, ...args) {
  try { return fn && fn(...args); } catch { return undefined; }
}

export function themeName() {
  if (sdk && sdk.colorScheme) return sdk.colorScheme;
  const dark = hashThemeIsDark();
  if (dark !== null) return dark ? "dark" : "light";
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme() {
  document.documentElement.dataset.theme = themeName();
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  if (sdk && bg) {
    call(tg.setHeaderColor && tg.setHeaderColor.bind(tg), bg);
    call(tg.setBackgroundColor && tg.setBackgroundColor.bind(tg), bg);
    call(tg.setBottomBarColor && tg.setBottomBarColor.bind(tg), bg);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute("content", bg);
}

export function initTelegram() {
  applyTheme();
  if (!sdk) {
    if (window.matchMedia) window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", applyTheme);
    return;
  }
  call(tg.ready.bind(tg));
  call(tg.expand.bind(tg));
  call(tg.disableVerticalSwipes && tg.disableVerticalSwipes.bind(tg));
  tg.onEvent("themeChanged", applyTheme);
}

/* Кнопка «Назад» в шапке Telegram */
let backHandler = null;
export function setBackButton(visible, handler) {
  if (!sdk || !sdk.BackButton) return;
  if (backHandler) tg.BackButton.offClick(backHandler);
  backHandler = handler || null;
  if (backHandler) tg.BackButton.onClick(backHandler);
  if (visible) tg.BackButton.show(); else tg.BackButton.hide();
}

/* Тактильный отклик */
export const haptic = {
  select: () => sdk && sdk.HapticFeedback && call(tg.HapticFeedback.selectionChanged.bind(tg.HapticFeedback)),
  light: () => sdk && sdk.HapticFeedback && call(tg.HapticFeedback.impactOccurred.bind(tg.HapticFeedback), "light"),
  medium: () => sdk && sdk.HapticFeedback && call(tg.HapticFeedback.impactOccurred.bind(tg.HapticFeedback), "medium"),
  success: () => sdk && sdk.HapticFeedback && call(tg.HapticFeedback.notificationOccurred.bind(tg.HapticFeedback), "success"),
  error: () => sdk && sdk.HapticFeedback && call(tg.HapticFeedback.notificationOccurred.bind(tg.HapticFeedback), "error"),
};

export function openLink(url) {
  if (tg && tg.openLink) call(tg.openLink.bind(tg), url);
  else window.open(url, "_blank", "noopener");
}

export function openTelegramLink(url) {
  if (tg && tg.openTelegramLink) call(tg.openTelegramLink.bind(tg), url);
  else window.open(url, "_blank", "noopener");
}

export function callPhone(phone) {
  const digits = String(phone).replace(/[^\d+]/g, "");
  window.location.href = `tel:${digits}`;
}

export function userFirstName() {
  return (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.first_name) || "";
}
