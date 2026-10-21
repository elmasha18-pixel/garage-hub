import { html } from "../dom.js";
import { icon } from "../icons.js";
import { plural } from "../format.js";
import { go, patch, render, view } from "../router.js";
import { applyFilters, loadGarages, resetFilters, setFilters, state, toggleFav } from "../store.js";
import { haptic } from "../tg.js";
import { emptyState, errorState, listing, skeletonListings } from "../ui/cards.js";
import { openSheet } from "../ui/sheet.js";

const SORTS = [
  { id: "smart", label: "Сначала свободные сегодня" },
  { id: "cheap", label: "Сначала дешевле" },
  { id: "expensive", label: "Сначала дороже" },
];

let garages = [];

const districtsOf = (list) => [...new Set(list.map((g) => g.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));
const countBoxes = (n) => `${n} ${plural(n, "бокс", "бокса", "боксов")}`;

function districtChipLabel() {
  const chosen = state.filters.districts;
  if (!chosen.length) return "Район";
  return chosen.length === 1 ? chosen[0] : `${chosen[0]} и ещё ${chosen.length - 1}`;
}

function filtersMarkup() {
  const f = state.filters;
  const segment = (id, label) => html`<button class="${f.type === id ? "is-on" : ""}" data-action="type" data-value="${id}" aria-pressed="${f.type === id}">${label}</button>`;
  const toggle = (key, label) => html`<button class="chip ${f[key] ? "is-on" : ""}" data-action="toggle" data-value="${key}" aria-pressed="${Boolean(f[key])}">${label}</button>`;
  const hasDistricts = districtsOf(garages).length > 0;
  return html`
    <div class="segmented">${segment("all", "Все")}${segment("garage", "Гаражи")}${segment("detailing", "Детейлинг")}</div>
    <div class="chips mt-m">
      ${hasDistricts ? html`<button class="chip ${f.districts.length ? "is-on" : ""}" data-action="districts">${districtChipLabel()}${icon("down")}</button>` : ""}
      ${f.type !== "detailing" ? html`${toggle("lift", "Подъёмник")}${toggle("pit", "Яма")}${toggle("tools", "Инструмент")}` : ""}
      <button class="chip ${f.fav ? "is-on" : ""}" data-action="toggle" data-value="fav" aria-pressed="${f.fav}">${icon("heart")}Избранное</button>
    </div>`;
}

function countMarkup() {
  const n = applyFilters(garages).length;
  const sort = SORTS.find((s) => s.id === state.filters.sort) || SORTS[0];
  return html`
    <span class="muted num">${countBoxes(n)}</span>
    <button class="btn plain s" data-action="sort" style="padding-right:0">${sort.label}${icon("down")}</button>`;
}

function resultsMarkup() {
  if (!garages.length) {
    return emptyState({ iconName: "garage", title: "Каталог пополняется", text: "Скоро здесь появятся первые боксы. Загляните чуть позже." });
  }
  const list = applyFilters(garages);
  if (!list.length) {
    return emptyState({
      iconName: "search",
      title: "Ничего не нашлось",
      text: state.filters.fav && !state.favorites.size ? "Добавляйте боксы в избранное сердечком — они появятся здесь." : "Попробуйте другой район или уберите часть фильтров.",
      button: html`<button class="btn secondary" data-action="reset">Сбросить фильтры</button>`,
    });
  }
  return html`<div class="grid">${list.map(listing)}</div>`;
}

function updateResults() {
  patch("#count", countMarkup());
  patch("#results", resultsMarkup());
}

function updateAll() {
  const chips = view().querySelector("#filters .chips");
  const left = chips ? chips.scrollLeft : 0;
  patch("#filters", filtersMarkup());
  const next = view().querySelector("#filters .chips");
  if (next) next.scrollLeft = left;
  updateResults();
}

function paint(ctx, body, animate) {
  render(ctx, html`
    <div class="between">
      <span class="wordmark">Garage<b>Hub</b></span>
      <span class="caption">Москва и область</span>
    </div>
    <label class="search mt-l">
      ${icon("search")}
      <input type="search" data-input="q" placeholder="Район, улица или название" value="${state.filters.q}" enterkeyhint="search" autocomplete="off">
      <button class="clear" data-action="clearq" aria-label="Очистить поиск" ${state.filters.q ? "" : html`hidden`}>${icon("x")}</button>
    </label>
    ${body}`, { animate });
}

function fullBody() {
  return html`
    <div id="filters" class="mt-m">${filtersMarkup()}</div>
    <div class="toolbar between mt-s" id="count">${countMarkup()}</div>
    <div id="results" class="mt-s">${resultsMarkup()}</div>`;
}

async function enter(ctx) {
  const cached = state.garages;
  if (ctx.refresh && cached && document.getElementById("results")) {
    try {
      const fresh = await loadGarages({ force: true });
      if (ctx.isCurrent()) { garages = fresh; updateAll(); }
    } catch { /* оставляем то, что на экране */ }
    return;
  }
  if (cached) {
    garages = cached;
    paint(ctx, fullBody(), !ctx.refresh);
    watchSticky();
  } else {
    paint(ctx, html`<div class="skeleton mt-m" style="height:38px"></div><div class="mt-xl">${skeletonListings(4)}</div>`, true);
  }
  try {
    const fresh = await loadGarages();
    if (!ctx.isCurrent() || fresh === cached) return;
    garages = fresh;
    paint(ctx, fullBody(), false);
    watchSticky();
  } catch (e) {
    if (ctx.isCurrent() && !cached) patch(".mt-xl", errorState(e.message));
  }
}

let observer = null;
function watchSticky() {
  if (observer) observer.disconnect();
  const bar = document.getElementById("count");
  if (!bar || !("IntersectionObserver" in window)) return;
  const sentinel = document.createElement("div");
  sentinel.style.height = "1px";
  bar.before(sentinel);
  observer = new IntersectionObserver(([entry]) => bar.classList.toggle("is-stuck", !entry.isIntersecting));
  observer.observe(sentinel);
}

/* Район — в шторке со списком и галочками, как фильтры в объявлениях */
function openDistricts() {
  let chosen = new Set(state.filters.districts);
  const pool = applyFilters(garages, state.filters, "districts");
  const all = districtsOf(garages);
  const markup = () => {
    const n = applyFilters(garages, { ...state.filters, districts: [...chosen] }).length;
    return html`
      <h2 class="title-m">Район</h2>
      <div>${all.map((d) => {
        const count = pool.filter((g) => g.district === d).length;
        const on = chosen.has(d);
        return html`<button class="option ${on ? "is-on" : ""}" data-action="pick" data-value="${d}" aria-pressed="${on}">
          <span class="check">${icon("check")}</span><span class="grow">${d}</span><span class="n">${count}</span></button>`;
      })}</div>
      <div class="actions">
        <button class="btn secondary" data-action="clear">Сбросить</button>
        <button class="btn primary" data-action="apply">${n ? `Показать ${countBoxes(n)}` : "Ничего не найдено"}</button>
      </div>`;
  };
  const sheet = openSheet(markup(), {
    actions: {
      pick(el, e, s) { haptic.select(); const d = el.dataset.value; if (chosen.has(d)) chosen.delete(d); else chosen.add(d); s.update(markup()); },
      clear(el, e, s) { chosen = new Set(); s.update(markup()); },
      apply(el, e, s) { setFilters({ districts: [...chosen] }); s.close(); updateAll(); },
    },
  });
  return sheet;
}

function openSort() {
  openSheet(html`
    <h2 class="title-m">Сортировка</h2>
    <div>${SORTS.map((s) => html`<button class="option ${state.filters.sort === s.id ? "is-on" : ""}" data-action="pick" data-value="${s.id}"><span class="radio"></span><span class="grow">${s.label}</span></button>`)}</div>`, {
    actions: {
      pick(el, e, sheet) { haptic.select(); setFilters({ sort: el.dataset.value }); sheet.close(); updateResults(); },
    },
  });
}

export default {
  enter,
  leave() { if (observer) observer.disconnect(); },
  inputs: {
    q(el) {
      setFilters({ q: el.value });
      const clear = view().querySelector(".search .clear");
      if (clear) clear.hidden = !el.value;
      updateResults();
    },
  },
  actions: {
    open: (el) => go(`/g/${el.dataset.id}`),
    fav(el, e) {
      e.stopPropagation();
      const on = toggleFav(el.dataset.id);
      haptic.light();
      el.classList.toggle("is-on", on);
      el.setAttribute("aria-pressed", on);
      if (state.filters.fav && !on) updateResults();
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
    districts: () => openDistricts(),
    sort: () => openSort(),
    clearq() {
      setFilters({ q: "" });
      const input = view().querySelector(".search input");
      if (input) { input.value = ""; input.focus(); }
      view().querySelector(".search .clear").hidden = true;
      updateResults();
    },
    reset() {
      resetFilters();
      const input = view().querySelector(".search input");
      if (input) input.value = "";
      updateAll();
    },
    retry: () => { state.garages = null; location.reload(); },
  },
};
