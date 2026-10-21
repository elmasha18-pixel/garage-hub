/* Маршрутизатор на hash-адресах (#/g/12). Не зависит от сервера, работает и в Telegram, и на обычном сайте.

   Экран — это модуль с методами:
     enter(ctx)  — показать экран (async), ctx = { params, query, direction, isCurrent() }
     leave()     — убрать за собой (необязательно)
     actions     — обработчики кнопок с data-action="имя"
     inputs      — обработчики полей с data-input="имя"
*/
import { html } from "./dom.js";
import { setBackButton } from "./tg.js";
import { closeTopSheet, hasOpenSheet } from "./ui/sheet.js";
import { updateTabbar } from "./ui/tabbar.js";

const routes = [];
let current = null;
let token = 0;
let idx = 0;
const scrollMemory = new Map();

export function defineRoute(pattern, screen, meta = {}) {
  const keys = [];
  const source = pattern.replace(/:([a-z]+)/g, (_, key) => { keys.push(key); return "([^/]+)"; });
  routes.push({ pattern, re: new RegExp(`^${source}$`), keys, screen, meta });
}

function match(path) {
  for (const route of routes) {
    const m = route.re.exec(path);
    if (m) {
      const params = {};
      route.keys.forEach((key, i) => { params[key] = decodeURIComponent(m[i + 1]); });
      return { route, params };
    }
  }
  return null;
}

const currentPath = () => (location.hash.replace(/^#/, "") || "/").split("?")[0];
const currentQuery = () => new URLSearchParams((location.hash.split("?")[1]) || "");

export function go(path, { replace = false } = {}) {
  if (hasOpenSheet()) closeTopSheet();
  if (`#${path}` === location.hash || (path === "/" && !location.hash)) return;
  if (replace) {
    history.replaceState({ idx }, "", `#${path}`);
    resolve("fade");
  } else {
    idx += 1;
    history.pushState({ idx }, "", `#${path}`);
    resolve("forward");
  }
}

export function back(fallback = "/") {
  if (hasOpenSheet()) { closeTopSheet(); return; }
  if (idx > 0) history.back();
  else go(fallback, { replace: true });
}

async function resolve(direction) {
  const path = currentPath();
  const found = match(path);
  if (!found) { go("/", { replace: true }); return; }

  if (current) {
    scrollMemory.set(current.path, window.scrollY);
    if (current.screen.leave) current.screen.leave();
  }

  const myToken = ++token;
  const ctx = {
    path,
    params: found.params,
    query: currentQuery(),
    direction,
    isCurrent: () => token === myToken,
  };
  current = { path, screen: found.route.screen, ctx, meta: found.route.meta };

  const isRoot = Boolean(found.route.meta.tab);
  setBackButton(!isRoot, () => back("/"));
  updateTabbar(found.route.meta.tab || null, found.route.meta.tabbar !== false);

  await found.route.screen.enter(ctx);
  if (direction === "back" && scrollMemory.has(path)) window.scrollTo(0, scrollMemory.get(path));
}

/* Экраны рисуют себя через render(); повторный вызов с animate:false обновляет содержимое, не сбрасывая прокрутку */
export function render(ctx, markup, { className = "", tabbar = true, flush = false, animate = true } = {}) {
  const view = document.getElementById("view");
  const section = document.createElement("section");
  const anim = animate ? ({ forward: "enter-forward", back: "enter-back", fade: "enter-fade" }[ctx.direction] || "") : "";
  section.className = ["screen", anim, tabbar ? "" : "no-tabbar", flush ? "flush" : "", className].filter(Boolean).join(" ");
  section.innerHTML = String(markup);
  const scroll = window.scrollY;
  view.replaceChildren(section);
  if (animate) window.scrollTo(0, 0); else window.scrollTo(0, scroll);
  return section;
}

export function patch(selector, markup) {
  const el = document.querySelector(`#view ${selector}`);
  if (el) el.innerHTML = String(markup);
  return el;
}

export const view = () => document.getElementById("view");
/* При возвращении в приложение обновляем данные на экранах-вкладках (не чаще раза в 20 секунд) */
let lastRefresh = Date.now();
export function refresh() {
  if (!current || !current.meta.refresh || Date.now() - lastRefresh < 20_000) return;
  lastRefresh = Date.now();
  current.screen.enter({ ...current.ctx, direction: "none", refresh: true });
}

export function start() {
  history.replaceState({ idx: 0 }, "", location.hash || "#/");
  window.addEventListener("popstate", (e) => {
    const next = (e.state && e.state.idx) || 0;
    const direction = next < idx ? "back" : "forward";
    idx = next;
    resolve(direction);
  });

  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el || el.closest("#sheet-root, #lightbox-root")) return;
    const handler = current && current.screen.actions && current.screen.actions[el.dataset.action];
    if (handler) handler(el, e, current.ctx);
  });

  document.addEventListener("input", (e) => {
    const el = e.target.closest("[data-input]");
    if (!el) return;
    const handler = current && current.screen.inputs && current.screen.inputs[el.dataset.input];
    if (handler) handler(el, e, current.ctx);
  });

  resolve("none");
}
