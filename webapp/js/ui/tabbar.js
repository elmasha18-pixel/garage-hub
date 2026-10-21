import { html, raw } from "../dom.js";
import { icon } from "../icons.js";
import { haptic } from "../tg.js";
import { state, subscribe } from "../store.js";

const TABS = [
  { id: "search", path: "/", label: "Поиск", icon: "search" },
  { id: "my", path: "/my", label: "Заявки", icon: "list" },
  { id: "owner", path: "/owner", label: "Владельцам", icon: "garage" },
  { id: "contacts", path: "/contacts", label: "Контакты", icon: "phone" },
  { id: "admin", path: "/admin", label: "Админ", icon: "shield", adminOnly: true },
];

let active = null;
let visible = true;
let onNavigate = null;

export function initTabbar(navigate) {
  onNavigate = navigate;
  const bar = document.getElementById("tabbar");
  bar.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (!tab) return;
    if (tab.dataset.tab !== active) haptic.select();
    onNavigate(TABS.find((t) => t.id === tab.dataset.tab).path);
  });
  subscribe(draw);
}

export function updateTabbar(tabId, show) {
  active = tabId;
  visible = show;
  draw();
}

function draw() {
  const bar = document.getElementById("tabbar");
  if (!bar) return;
  bar.hidden = !visible || !state.me;
  if (bar.hidden) return;
  const tabs = TABS.filter((t) => !t.adminOnly || (state.me && state.me.is_admin));
  bar.innerHTML = String(html`${tabs.map((t) => html`
    <button class="tab ${t.id === active ? "is-on" : ""}" data-tab="${t.id}" aria-label="${t.label}" ${t.id === active ? raw('aria-current="page"') : ""}>
      ${icon(t.icon)}
      <span>${t.label}</span>
      ${t.id === "my" && state.activeBookings ? html`<span class="badge">${state.activeBookings}</span>` : ""}
    </button>`)}`);
}
