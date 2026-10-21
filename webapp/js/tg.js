/* Обёртка над Telegram WebApp. Вне Telegram (браузер, будущий сайт) всё работает без ошибок:
   вызовы превращаются в безопасные заглушки. */

const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;

export const inTelegram = Boolean(tg && tg.initData);
export const initData = () => (tg ? tg.initData : "");
export const startParam = () => (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || "";

function call(fn, ...args) {
  try { return fn && fn(...args); } catch { return undefined; }
}

export function themeName() {
  if (inTelegram && tg.colorScheme) return tg.colorScheme;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme() {
  document.documentElement.dataset.theme = themeName();
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  if (inTelegram && bg) {
    call(tg.setHeaderColor && tg.setHeaderColor.bind(tg), bg);
    call(tg.setBackgroundColor && tg.setBackgroundColor.bind(tg), bg);
    call(tg.setBottomBarColor && tg.setBottomBarColor.bind(tg), bg);
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && bg) meta.setAttribute("content", bg);
}

export function initTelegram() {
  applyTheme();
  if (!inTelegram) {
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
  if (!inTelegram || !tg.BackButton) return;
  if (backHandler) tg.BackButton.offClick(backHandler);
  backHandler = handler || null;
  if (backHandler) tg.BackButton.onClick(backHandler);
  if (visible) tg.BackButton.show(); else tg.BackButton.hide();
}

/* Тактильный отклик */
export const haptic = {
  select: () => inTelegram && tg.HapticFeedback && call(tg.HapticFeedback.selectionChanged.bind(tg.HapticFeedback)),
  light: () => inTelegram && tg.HapticFeedback && call(tg.HapticFeedback.impactOccurred.bind(tg.HapticFeedback), "light"),
  medium: () => inTelegram && tg.HapticFeedback && call(tg.HapticFeedback.impactOccurred.bind(tg.HapticFeedback), "medium"),
  success: () => inTelegram && tg.HapticFeedback && call(tg.HapticFeedback.notificationOccurred.bind(tg.HapticFeedback), "success"),
  error: () => inTelegram && tg.HapticFeedback && call(tg.HapticFeedback.notificationOccurred.bind(tg.HapticFeedback), "error"),
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
