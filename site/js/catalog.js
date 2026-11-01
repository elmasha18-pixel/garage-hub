import { html, $, $$ } from "./dom.js";
import * as data from "./data.js";
import { boot, countLine, errorState, listing, skeletonGrid, swap, watchImages } from "./ui.js";

boot();

/* Фильтры живут в адресе страницы: ссылкой на подборку можно поделиться, «Назад» возвращает к ней */
const FLAGS = { lift: "has_lift", pit: "has_pit", tools: "tools", today: "free_today" };

function readState() {
  const q = new URLSearchParams(location.search);
  return {
    type: q.get("type") || "",
    district: q.get("district") || "",
    sort: q.get("sort") || "",
    flags: new Set(Object.keys(FLAGS).filter((k) => q.has(k))),
  };
}

function writeState(s) {
  const q = new URLSearchParams();
  if (s.type) q.set("type", s.type);
  if (s.district) q.set("district", s.district);
  for (const f of s.flags) q.set(f, "1");
  if (s.sort) q.set("sort", s.sort);
  if (data.DEMO) q.set("demo", "");
  const str = q.toString().replace(/demo=(&|$)/, "demo$1");
  history.replaceState(null, "", `${location.pathname}${str ? `?${str}` : ""}`);
}

function apply(list, s) {
  let out = list.filter((g) =>
    (!s.type || g.type === s.type) &&
    (!s.district || g.district === s.district) &&
    (!s.flags.has("lift") || g.has_lift) &&
    (!s.flags.has("pit") || g.has_pit) &&
    (!s.flags.has("tools") || g.tools === "all") &&
    (!s.flags.has("today") || g.free_today > 0));
  if (s.sort === "cheap") out = out.sort((a, b) => a.price - b.price);
  else if (s.sort === "expensive") out = out.sort((a, b) => b.price - a.price);
  else out = out.sort((a, b) => (b.free_today > 0) - (a.free_today > 0) || b.id - a.id);
  return out;
}

async function main() {
  const results = $("#results");
  const line = $("#result-line");
  results.innerHTML = String(skeletonGrid(8));

  let list;
  try {
    list = await data.garages();
  } catch (e) {
    line.hidden = true;
    results.outerHTML = String(errorState(e.message));
    return;
  }

  const state = readState();
  const select = $("#district");
  for (const d of data.districts(list)) select.append(new Option(`${d.name} (${d.count})`, d.name));
  if (state.district && ![...select.options].some((o) => o.value === state.district)) select.append(new Option(state.district, state.district));

  // Привести элементы управления к состоянию из адреса
  $(`input[name="type"][value="${state.type}"]`).checked = true;
  select.value = state.district;
  $("#sort").value = state.sort;
  for (const chip of $$(".chip[data-flag]")) chip.setAttribute("aria-pressed", String(state.flags.has(chip.dataset.flag)));

  const render = (animate) => {
    const found = apply(list, state);
    line.textContent = found.length ? `Найдено ${countLine(found.length)}` : "";
    const markup = found.length
      ? html`<div class="grid">${found.map(listing)}</div>`
      : html`<div class="empty"><p class="h-3">По этим условиям боксов нет</p><p>Попробуйте убрать часть фильтров или выбрать другой район.</p><button class="btn secondary" type="button" data-reset>Сбросить фильтры</button></div>`;
    if (animate) swap(results, markup); else { results.innerHTML = String(markup); watchImages(results); }
    writeState(state);
  };

  $("#filters").addEventListener("change", (e) => {
    if (e.target.name === "type") state.type = e.target.value;
    if (e.target.id === "district") state.district = e.target.value;
    if (e.target.id === "sort") state.sort = e.target.value;
    render(true);
  });
  $("#filters").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip[data-flag]");
    if (!chip) return;
    const on = chip.getAttribute("aria-pressed") !== "true";
    chip.setAttribute("aria-pressed", String(on));
    if (on) state.flags.add(chip.dataset.flag); else state.flags.delete(chip.dataset.flag);
    render(true);
  });
  results.addEventListener("click", (e) => {
    if (!e.target.closest("[data-reset]")) return;
    Object.assign(state, { type: "", district: "", sort: "", flags: new Set() });
    $(`input[name="type"][value=""]`).checked = true;
    select.value = ""; $("#sort").value = "";
    for (const chip of $$(".chip[data-flag]")) chip.setAttribute("aria-pressed", "false");
    render(true);
  });

  render(false);
}

main();
