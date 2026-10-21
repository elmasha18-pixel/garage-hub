import { api } from "../api.js";
import { shareLink } from "../config.js";
import { html } from "../dom.js";
import { hhmm, mapUrl, money, SIZES, TOOLS, TYPES } from "../format.js";
import { icon, placeholderArt } from "../icons.js";
import { back, go, patch, render, view } from "../router.js";
import { garageById, isFav, toggleFav } from "../store.js";
import { haptic, openLink, openTelegramLink } from "../tg.js";
import { errorState, favButton, locationLine } from "../ui/cards.js";
import { openLightbox } from "../ui/lightbox.js";

let garage = null;

function gallery(g) {
  const photos = g.photos;
  const slides = photos.length
    ? photos.map((src, i) => html`<div class="slide" data-action="photo" data-index="${i}"><img class="fade-img" src="${src}" alt="${g.name}, фото ${i + 1}" ${i ? "" : html`fetchpriority="high"`}></div>`)
    : html`<div class="slide">${placeholderArt}</div>`;
  return html`
    <div class="gallery">
      <div class="track" id="track">${slides}</div>
      <div class="shade"></div>
      <div class="bar">
        <button class="icon-btn glass" data-action="back" aria-label="Назад">${icon("left")}</button>
        <div class="group">
          <button class="icon-btn glass" data-action="share" aria-label="Поделиться">${icon("share")}</button>
          ${favButton(g.id)}
        </div>
      </div>
      ${photos.length > 1 ? html`<div class="dots" id="dots">${photos.map((_, i) => html`<i class="${i === 0 ? "is-on" : ""}"></i>`)}</div>` : ""}
    </div>`;
}

function features(g) {
  const row = (iconName, key, value, ok) => html`
    <div class="item"><span class="ico ${ok ? "ok" : ""}">${icon(iconName)}</span><span class="k">${key}</span><span class="v">${value}</span></div>`;
  const rows = [];
  if (g.type !== "detailing") {
    rows.push(row("lift", "Подъёмник", g.has_lift ? "Есть" : "Нет", g.has_lift));
    rows.push(row("pit", "Смотровая яма", g.has_pit ? "Есть" : "Нет", g.has_pit));
    rows.push(row("wrench", "Инструмент", TOOLS[g.tools] || "Не указано", g.tools === "all"));
  }
  if (g.size) rows.push(row("ruler", "Размер бокса", SIZES[g.size], false));
  if (g.working_hours) rows.push(row("clock", "Часы работы", g.working_hours, false));
  return html`<div class="kv">${rows}</div>`;
}

function todayStrip(av) {
  const day = av.days[0];
  const blocked = new Set(day.blocked);
  const cells = [];
  for (let h = av.open_hour; h < av.close_hour; h++) cells.push(html`<i class="${blocked.has(h) ? "busy" : ""}"></i>`);
  const free = day.free;
  return html`
    <div class="row-between" style="margin-bottom:10px">
      <span class="h-section">Сегодня</span>
      <span class="avail ${free > 0 ? "on" : ""}"><i class="dot"></i>${free > 0 ? `свободно ${free} ч` : "мест нет"}</span>
    </div>
    <div class="daybar">${cells}</div>
    <div class="daybar-scale"><span>${hhmm(av.open_hour)}</span><span>${hhmm(av.close_hour)}</span></div>`;
}

function body(g) {
  const long = (g.description || "").length > 220;
  return html`
    ${gallery(g)}
    <div class="sheet-body-up stack-lg">
      <div class="stack">
        <div class="row-between">
          <span class="pill" style="background:var(--surface-2)">${TYPES[g.type]}</span>
        </div>
        <h1 class="h-title" style="font-size:25px">${g.name}</h1>
        <div class="row" style="gap:8px;align-items:flex-start">
          <span style="width:18px;height:18px;flex:none;margin-top:2px;color:var(--text-3)">${icon("pin")}</span>
          <span class="grow muted">${locationLine(g) || "Адрес уточняется"}</span>
          <a class="link-btn" data-action="route">Маршрут</a>
        </div>
      </div>

      <div class="card pad" id="today"><div class="skeleton" style="height:56px"></div></div>

      <div class="stack">
        <div class="h-section">Что есть</div>
        ${features(g)}
      </div>

      ${g.description ? html`
        <div class="stack">
          <div class="h-section">О площадке</div>
          <p class="quote ${long ? "is-clamped" : ""}" id="desc">${g.description}</p>
          ${long ? html`<button class="link-btn" data-action="more">Читать полностью</button>` : ""}
        </div>` : ""}

      <div class="note">${icon("info")}<span>Оплата на месте, напрямую площадке. Заявка подтверждается, и вы получаете сообщение в Telegram.</span></div>
    </div>
    <div class="cta-bar">
      <div class="sum"><small>Стоимость</small><b class="num">${money(g.price)}<span class="faint" style="font-size:13px;font-weight:600"> /ч</span></b></div>
      <button class="btn primary" data-action="book">Выбрать время</button>
    </div>`;
}

function bindGallery() {
  const track = document.getElementById("track");
  const dots = document.getElementById("dots");
  if (!track || !dots) return;
  track.addEventListener("scroll", () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    [...dots.children].forEach((d, n) => d.classList.toggle("is-on", n === i));
  }, { passive: true });
}

async function enter(ctx) {
  const id = ctx.params.id;
  garage = garageById(id);
  if (!garage) {
    render(ctx, html`<div class="skeleton" style="height:260px;margin:0 calc(var(--gutter) * -1)"></div>`, { tabbar: false });
    try {
      garage = await api.garage(id);
    } catch (e) {
      if (!ctx.isCurrent()) return;
      render(ctx, html`<div class="topbar"><button class="icon-btn" data-action="back" aria-label="Назад">${icon("left")}</button></div>${errorState(e.status === 404 ? "Эта площадка больше недоступна." : e.message)}`, { tabbar: false });
      return;
    }
    if (!ctx.isCurrent()) return;
  }
  render(ctx, body(garage), { tabbar: false, flush: true, animate: !ctx.refresh });
  bindGallery();

  try {
    const av = await api.availability(id);
    if (ctx.isCurrent()) patch("#today", todayStrip(av));
  } catch {
    if (ctx.isCurrent()) patch("#today", html`<span class="muted">Расписание временно недоступно</span>`);
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
      const text = `${garage.name} — ${money(garage.price)}/ч`;
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
