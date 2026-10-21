import { html } from "../dom.js";
import { icon } from "../icons.js";
import { plural } from "../format.js";
import { go, patch, render, view } from "../router.js";
import { applyFilters, loadGarages, resetFilters, setFilters, state, toggleFav } from "../store.js";
import { haptic } from "../tg.js";
import { emptyState, errorState, garageCard, skeletonCards } from "../ui/cards.js";

const SORTS = [
  { id: "smart", label: "Сначала свободные" },
  { id: "cheap", label: "Дешевле" },
  { id: "expensive", label: "Дороже" },
];

let garages = [];

const districtsOf = (list) => [...new Set(list.map((g) => g.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));

function filtersMarkup() {
  const f = state.filters;
  const segment = (id, label) => html`<button class="${f.type === id ? "is-on" : ""}" data-action="type" data-value="${id}">${label}</button>`;
  const chip = (key, label, iconName) => html`<button class="chip ${f[key] ? "is-on" : ""}" data-action="toggle" data-value="${key}" aria-pressed="${Boolean(f[key])}">${icon(iconName)}${label}</button>`;

  const pool = applyFilters(garages, f, "districts");
  const districts = districtsOf(garages)
    .map((d) => ({ name: d, count: pool.filter((g) => g.district === d).length }))
    .filter((d) => d.count > 0 || f.districts.includes(d.name));

  return html`
    <div class="segmented" role="tablist">
      ${segment("all", "Все")}${segment("garage", "Гаражи")}${segment("detailing", "Детейлинг")}
    </div>
    <div class="chips" style="margin-top:12px">
      ${f.type !== "detailing" ? html`${chip("lift", "Подъёмник", "lift")}${chip("pit", "Яма", "pit")}${chip("tools", "Инструмент", "wrench")}` : ""}
      ${chip("fav", "Избранное", "heart")}
    </div>
    ${districts.length ? html`
      <div class="chips" style="margin-top:8px">
        ${districts.map((d) => html`<button class="chip ${f.districts.includes(d.name) ? "is-on" : ""}" data-action="district" data-value="${d.name}">${d.name} <span class="count">${d.count}</span></button>`)}
      </div>` : ""}`;
}

function resultsMarkup() {
  const list = applyFilters(garages);
  if (!garages.length) {
    return emptyState({ iconName: "garage", title: "Каталог пополняется", text: "Новые боксы появятся совсем скоро. Загляните позже." });
  }
  if (!list.length) {
    return emptyState({
      iconName: "search",
      title: "Ничего не нашлось",
      text: state.filters.fav ? "В избранном пока пусто или ничего не подходит под фильтры." : "Попробуйте другой район или уберите часть условий.",
      button: html`<button class="btn secondary" data-action="reset">Сбросить фильтры</button>`,
    });
  }
  return html`<div class="list">${list.map(garageCard)}</div>`;
}

function countMarkup() {
  const n = applyFilters(garages).length;
  const sort = SORTS.find((s) => s.id === state.filters.sort) || SORTS[0];
  return html`
    <span class="muted num" style="font-size:14px"><b style="color:var(--text)">${n}</b> ${plural(n, "бокс", "бокса", "боксов")}</span>
    <button class="chip" data-action="sort" style="height:32px">${icon("sliders")}${sort.label}</button>`;
}

function updateAll() {
  const scrollers = [...view().querySelectorAll(".chips")].map((el) => el.scrollLeft);
  patch("#filters", filtersMarkup());
  [...view().querySelectorAll("#filters .chips")].forEach((el, i) => { el.scrollLeft = scrollers[i] || 0; });
  patch("#count", countMarkup());
  patch("#results", resultsMarkup());
}

function shell(ctx, body, { animate = true } = {}) {
  return render(ctx, html`
    <div class="row-between" style="margin-bottom:18px">
      <span class="wordmark">Garage<b>Hub</b></span>
      <span class="faint" style="font-size:13px">Москва и область</span>
    </div>
    <h1 class="h-display">Найдите бокс<br>на пару часов</h1>
    <p class="lead" style="margin:8px 0 18px">Гаражи с подъёмником и детейлинг-боксы с почасовой оплатой.</p>
    ${body}`, { animate });
}

async function enter(ctx) {
  const cached = state.garages;
  if (ctx.refresh && cached && document.getElementById("results")) {
    try {
      const fresh = await loadGarages({ force: true });
      if (ctx.isCurrent()) { garages = fresh; updateAll(); }
    } catch { /* оставим то, что на экране */ }
    return;
  }
  if (cached) {
    garages = cached;
    shell(ctx, html`
      <div id="filters" class="stack">${filtersMarkup()}</div>
      <div class="stickybar row-between" id="count" style="margin-top:14px">${countMarkup()}</div>
      <div id="results" style="margin-top:6px">${resultsMarkup()}</div>`, { animate: !ctx.refresh });
    watchSticky();
  } else {
    shell(ctx, html`
      <div class="skeleton" style="height:42px"></div>
      <div id="results" class="list" style="margin-top:18px">${skeletonCards(3)}</div>`);
  }

  try {
    const fresh = await loadGarages();
    if (!ctx.isCurrent()) return;
    if (fresh !== cached) {
      garages = fresh;
      shell(ctx, html`
        <div id="filters" class="stack">${filtersMarkup()}</div>
        <div class="stickybar row-between" id="count" style="margin-top:14px">${countMarkup()}</div>
        <div id="results" style="margin-top:6px">${resultsMarkup()}</div>`, { animate: !cached });
      watchSticky();
    }
  } catch (e) {
    if (!ctx.isCurrent() || cached) return;
    patch("#results", errorState(e.message));
  }
}

let observer = null;
function watchSticky() {
  if (observer) observer.disconnect();
  const bar = document.getElementById("count");
  if (!bar || !("IntersectionObserver" in window)) return;
  const sentinel = document.createElement("div");
  sentinel.style.cssText = "height:1px;margin-top:-1px";
  bar.before(sentinel);
  observer = new IntersectionObserver(([entry]) => bar.classList.toggle("is-stuck", !entry.isIntersecting), { threshold: 1 });
  observer.observe(sentinel);
}

export default {
  enter,
  leave() { if (observer) observer.disconnect(); },
  actions: {
    open: (el) => go(`/g/${el.dataset.id}`),
    fav(el) {
      const on = toggleFav(el.dataset.id);
      haptic.light();
      el.classList.toggle("is-on", on);
      el.setAttribute("aria-pressed", on);
      if (state.filters.fav && !on) updateAll();
    },
    type(el) {
      haptic.select();
      const type = el.dataset.value;
      setFilters(type === "detailing" ? { type, lift: false, pit: false, tools: false } : { type });
      updateAll();
    },
    toggle(el) {
      haptic.select();
      const key = el.dataset.value;
      setFilters({ [key]: !state.filters[key] });
      updateAll();
    },
    district(el) {
      haptic.select();
      const name = el.dataset.value;
      const set = new Set(state.filters.districts);
      if (set.has(name)) set.delete(name); else set.add(name);
      setFilters({ districts: [...set] });
      updateAll();
    },
    sort() {
      haptic.select();
      const i = SORTS.findIndex((s) => s.id === state.filters.sort);
      setFilters({ sort: SORTS[(i + 1) % SORTS.length].id });
      updateAll();
    },
    reset() { resetFilters(); updateAll(); },
    retry: () => { state.garages = null; location.reload(); },
  },
};
