import { html, $ } from "./dom.js";
import { plural } from "./format.js";
import * as data from "./data.js";
import { boot, catalogUrl, countLine, errorState, listing, skeletonGrid, swap } from "./ui.js";

boot();

/* Ворота на первом экране поднимаются, пока экран прокручивается, и светлеет проём */
function initDoor() {
  const door = $(".door");
  const hero = $(".hero");
  if (!door || !hero || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const lift = Math.min(1, Math.max(0, window.scrollY / (hero.offsetHeight * 0.7)));
    door.style.setProperty("--lift", lift.toFixed(3));
  };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
  update();
}

function fillFinder(districts) {
  const select = $("#finder-district");
  for (const d of districts) select.append(new Option(d.name, d.name));
  if (data.DEMO) {
    const flag = document.createElement("input");
    flag.type = "hidden"; flag.name = "demo";
    $(".finder").append(flag);
  }
}

function renderDistricts(districts) {
  const box = $("#districts");
  if (!districts.length) { box.closest("section").hidden = true; return; }
  box.innerHTML = String(html`${districts.map((d) => html`
    <a href="${catalogUrl({ district: d.name })}"><span>${d.name}</span><span class="count">${countLine(d.count)}</span></a>`)}`);
}

async function main() {
  initDoor();
  const grid = $("#fresh");
  grid.innerHTML = String(skeletonGrid(8));
  let list;
  try {
    list = await data.garages();
  } catch (e) {
    grid.outerHTML = String(errorState(e.message));
    return;
  }
  const districts = data.districts(list);
  fillFinder(districts);
  renderDistricts(districts);

  const note = $("#hero-note");
  if (list.length) {
    note.textContent = `Сейчас в каталоге ${countLine(list.length)} в ${districts.length} ${plural(districts.length, "районе", "районах", "районах")}. Оплата на месте.`;
  }

  // Сначала те, где сегодня ещё есть свободные часы
  const fresh = [...list].sort((a, b) => (b.free_today > 0) - (a.free_today > 0) || b.id - a.id).slice(0, 8);
  swap(grid, fresh.length
    ? html`${fresh.map(listing)}`
    : html`<div class="empty" style="grid-column:1/-1"><p class="h-3">Каталог наполняется</p><p>Первые боксы появятся здесь в ближайшие дни.</p></div>`);
}

main();
