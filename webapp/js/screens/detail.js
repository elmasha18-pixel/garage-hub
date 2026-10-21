import { api } from "../api.js";
import { shareLink } from "../config.js";
import { html } from "../dom.js";
import { hhmm, mapUrl, money, SIZES, TOOLS, TYPES } from "../format.js";
import { icon, placeholderArt } from "../icons.js";
import { back, go, patch, render } from "../router.js";
import { garageById, toggleFav } from "../store.js";
import { haptic, openLink, openTelegramLink } from "../tg.js";
import { errorState, favButton, hoursText, locationLine, priceLine } from "../ui/cards.js";
import { openLightbox } from "../ui/lightbox.js";

let garage = null;

function gallery(g) {
  const photos = g.photos;
  const slides = photos.length
    ? photos.map((src, i) => html`<div class="slide" data-action="photo" data-index="${i}"><img class="fade-img" src="${src}" alt="${g.name}, фото ${i + 1} из ${photos.length}"></div>`)
    : html`<div class="slide">${placeholderArt}</div>`;
  return html`
    <div class="gallery">
      <div class="track" id="track">${slides}</div>
      <div class="bar">
        <button class="icon-btn on-photo" data-action="back" aria-label="Назад">${icon("left")}</button>
        <div class="group">
          <button class="icon-btn on-photo" data-action="share" aria-label="Поделиться">${icon("share")}</button>
          ${favButton(g.id)}
        </div>
      </div>
      ${photos.length > 1 ? html`<span class="counter" id="counter">1 / ${photos.length}</span>` : ""}
    </div>`;
}

function props(g) {
  const rows = [["Тип", TYPES[g.type]]];
  if (g.type !== "detailing") {
    rows.push(["Подъёмник", g.has_lift ? "Есть" : "Нет"]);
    rows.push(["Смотровая яма", g.has_pit ? "Есть" : "Нет"]);
    rows.push(["Инструмент", TOOLS[g.tools] ? TOOLS[g.tools][0].toUpperCase() + TOOLS[g.tools].slice(1) : "Не указан"]);
  }
  if (g.size) rows.push(["Размер бокса", SIZES[g.size]]);
  if (g.working_hours) rows.push(["Часы работы", g.working_hours]);
  return html`<dl class="props">${rows.map(([k, v]) => html`<dt>${k}</dt><dd>${v}</dd>`)}</dl>`;
}

function today(av) {
  const day = av.days[0];
  const blocked = new Set(day.blocked);
  const cells = [];
  let first = null;
  for (let h = av.open_hour; h < av.close_hour; h++) {
    const busy = blocked.has(h);
    if (!busy && first === null) first = h;
    cells.push(html`<i class="${busy ? "busy" : ""}"></i>`);
  }
  return html`
    <div class="between">
      <h2 class="title-s">Сегодня</h2>
      ${day.free > 0
        ? html`<span class="avail on" style="margin:0">Свободно с ${hhmm(first)}, ${hoursText(day.free)}</span>`
        : html`<span class="avail" style="margin:0">Мест нет, смотрите другие дни</span>`}
    </div>
    <div class="daybar mt-m" role="img" aria-label="Загрузка на сегодня: свободно ${hoursText(day.free)}">${cells}</div>
    <div class="daybar-scale"><span>${hhmm(av.open_hour)}</span><span>${hhmm(av.close_hour)}</span></div>`;
}

function body(g) {
  const long = (g.description || "").length > 260;
  return html`
    ${gallery(g)}
    <div class="pad">
      <h1 class="title-m mt-l">${g.name}</h1>
      <div class="mt-s big-price">${priceLine(g.price, "за час")}</div>
      <div class="mt-m">
        <div>${locationLine(g) || "Адрес уточняется"}</div>
        ${g.address ? html`<button class="link mt-xs" data-action="route">Показать на карте</button>` : ""}
      </div>

      <section class="section" id="today"><div class="skeleton" style="height:48px"></div></section>

      <section class="section">
        <h2 class="title-m">Характеристики</h2>
        ${props(g)}
      </section>

      ${g.description ? html`
        <section class="section">
          <h2 class="title-m">Описание</h2>
          <p class="description ${long ? "is-clamped" : ""}" id="desc">${g.description}</p>
          ${long ? html`<button class="link mt-s" data-action="more">Показать полностью</button>` : ""}
        </section>` : ""}

      <p class="hint section">${icon("info")}<span>Оплата на месте, напрямую площадке. Когда заявку подтвердят, придёт сообщение в Telegram.</span></p>
    </div>
    <div class="cta-bar"><button class="btn primary l" data-action="book">Выбрать время</button></div>`;
}

function bindGallery() {
  const track = document.getElementById("track");
  const counter = document.getElementById("counter");
  if (!track || !counter) return;
  const total = garage.photos.length;
  track.addEventListener("scroll", () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    counter.textContent = `${i + 1} / ${total}`;
  }, { passive: true });
}

async function enter(ctx) {
  const id = ctx.params.id;
  garage = garageById(id);
  if (!garage) {
    render(ctx, html`<div class="skeleton" style="aspect-ratio:4/3;border-radius:0"></div><div class="pad"><div class="skeleton mt-l" style="height:24px;width:70%"></div></div>`, { tabbar: false, flush: true });
    try {
      garage = await api.garage(id);
    } catch (e) {
      if (!ctx.isCurrent()) return;
      render(ctx, html`<div class="header"><button class="icon-btn" data-action="back" aria-label="Назад">${icon("left")}</button></div>${errorState(e.status === 404 ? "Эта площадка больше недоступна." : e.message)}`, { tabbar: false });
      return;
    }
    if (!ctx.isCurrent()) return;
  }
  render(ctx, body(garage), { tabbar: false, flush: true, animate: !ctx.refresh });
  bindGallery();
  try {
    const av = await api.availability(id);
    if (ctx.isCurrent()) patch("#today", today(av));
  } catch {
    if (ctx.isCurrent()) patch("#today", html`<p class="caption">Расписание сейчас недоступно. Время можно выбрать на следующем шаге.</p>`);
  }
}

export default {
  enter,
  actions: {
    back: () => back("/"),
    book: () => go(`/g/${garage.id}/book`),
    route: () => openLink(mapUrl(garage)),
    photo: (el) => openLightbox(garage.photos, Number(el.dataset.index)),
    share() {
      const text = `${garage.name}, ${money(garage.price)} за час`;
      openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(shareLink(garage.id))}&text=${encodeURIComponent(text)}`);
    },
    fav(el) {
      const on = toggleFav(el.dataset.id);
      haptic.light();
      el.classList.toggle("is-on", on);
      el.setAttribute("aria-pressed", on);
    },
    more(el) {
      document.getElementById("desc").classList.remove("is-clamped");
      el.remove();
    },
  },
};
