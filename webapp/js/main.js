import { canAuthenticate } from "./api.js";
import { html } from "./dom.js";
import { icon } from "./icons.js";
import { defineRoute, go, refresh, start } from "./router.js";
import { loadMe, setActiveBookings, state } from "./store.js";
import { initTelegram, startParam } from "./tg.js";
import { initTabbar } from "./ui/tabbar.js";

import catalog from "./screens/catalog.js";
import detail from "./screens/detail.js";
import booking from "./screens/booking.js";
import done from "./screens/done.js";
import my, { refreshBadge } from "./screens/my.js";
import owner from "./screens/owner.js";
import contacts from "./screens/contacts.js";
import admin from "./screens/admin.js";

initTelegram();

/* Фото: плавное появление; если не загрузилось — заглушка вместо битой картинки */
document.addEventListener("load", (e) => {
  if (e.target.tagName === "IMG") e.target.classList.add("is-loaded");
}, true);
document.addEventListener("error", (e) => {
  const img = e.target;
  if (img.tagName !== "IMG" || !img.classList.contains("fade-img")) return;
  img.classList.add("is-loaded");
  img.style.visibility = "hidden";
}, true);

function fatal(title, text) {
  document.getElementById("view").innerHTML = String(html`
    <section class="screen"><div class="empty">
      <div class="art">${icon("info")}</div><h3>${title}</h3><p>${text}</p>
    </div></section>`);
}

async function boot() {
  if (!canAuthenticate()) {
    fatal("Откройте через Telegram", "Это приложение работает внутри Telegram. Найдите бота @garazh_rent_bot и нажмите «Открыть».");
    return;
  }
  try {
    await loadMe();
  } catch (e) {
    fatal("Не удалось войти", e.message);
    return;
  }

  defineRoute("/", catalog, { tab: "search", refresh: true });
  defineRoute("/g/:id", detail, { tabbar: false });
  defineRoute("/g/:id/book", booking, { tabbar: false });
  defineRoute("/done", done, { tabbar: false });
  defineRoute("/my", my, { tab: "my", refresh: true });
  defineRoute("/owner", owner, { tab: "owner" });
  defineRoute("/contacts", contacts, { tab: "contacts" });
  if (state.me.is_admin) defineRoute("/admin", admin, { tab: "admin", refresh: true });

  initTabbar((path) => go(path, { replace: true }));

  const param = startParam();
  if (param && /^g\d+$/.test(param) && !location.hash) location.hash = `#/g/${param.slice(1)}`;
  start();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  refreshBadge();   // число активных заявок на вкладке «Заявки»
}

boot();
