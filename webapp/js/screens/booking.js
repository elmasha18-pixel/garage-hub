import { api } from "../api.js";
import { html } from "../dom.js";
import { dayLong, dayNumber, hhmm, hours, money, plural, span, weekdayShort } from "../format.js";
import { icon } from "../icons.js";
import { back, go, patch, render } from "../router.js";
import { garageById, setActiveBookings, state } from "../store.js";
import { haptic } from "../tg.js";
import { miniThumb } from "../ui/cards.js";
import { toast } from "../ui/toast.js";
import { setLastBooking } from "./done.js";

let garage = null;
let av = null;          // доступность на 7 дней
let day = null;         // выбранная дата «YYYY-MM-DD»
let selected = [];      // выбранные часы (подряд)
let sending = false;

const seq = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/* Выбор диапазона двумя нажатиями — то же правило, что в боте */
function toggleRange(sel, hour, blocked) {
  if (!sel.length) return [hour];
  const lo = sel[0], hi = sel[sel.length - 1];
  if (sel.includes(hour)) {
    if (hour === lo) return sel.slice(1);
    if (hour === hi) return sel.slice(0, -1);
    return [hour];
  }
  const range = hour < lo ? seq(hour, hi) : seq(lo, hour);
  return range.some((h) => blocked.has(h)) ? [hour] : range;
}

const dayData = () => av.days.find((d) => d.date === day);
const blockedSet = () => new Set(dayData().blocked);

function datesMarkup() {
  return html`<div class="dates" id="dates">${av.days.map((d, i) => html`
    <button class="date-tile ${d.date === day ? "is-on" : ""} ${d.free === 0 ? "is-full" : ""}" data-action="day" data-date="${d.date}" aria-pressed="${d.date === day}">
      <span class="wd">${i === 0 ? "Сегодня" : weekdayShort(d.date)}</span>
      <span class="dn">${dayNumber(d.date)}</span>
      <span class="fr">${d.free ? `${d.free} ч` : "занято"}</span>
    </button>`)}</div>`;
}

function slotsMarkup() {
  const blocked = blockedSet();
  const lo = selected[0], hi = selected[selected.length - 1];
  const cells = [];
  const buttons = [];
  for (let h = av.open_hour; h < av.close_hour; h++) {
    const isSel = selected.includes(h);
    const edge = isSel && (h === lo || h === hi);
    cells.push(html`<i class="${blocked.has(h) ? "busy" : ""} ${isSel ? "sel" : ""}"></i>`);
    const cls = blocked.has(h) ? "is-busy" : edge || (isSel && selected.length === 1) ? "is-sel" : isSel ? "is-mid" : "";
    buttons.push(html`<button class="slot ${cls}" data-action="slot" data-hour="${h}" ${blocked.has(h) ? html`aria-disabled="true"` : ""} aria-pressed="${isSel}">${hhmm(h)}</button>`);
  }
  const hint = !selected.length
    ? "Нажмите на первый час, затем на последний — всё между ними выберется само."
    : selected.length === 1
      ? "Можно отправить заявку на один час или нажать на последний час, чтобы выбрать больше."
      : "Нажмите на другой час, чтобы изменить время.";
  return html`
    <div class="daybar">${cells}</div>
    <div class="daybar-scale"><span>${hhmm(av.open_hour)}</span><span>${hhmm(av.close_hour)}</span></div>
    <p class="muted" style="font-size:13.5px;margin:14px 0 12px">${hint}</p>
    <div class="slots">${buttons}</div>`;
}

function summaryMarkup() {
  if (!selected.length) {
    return html`<div class="card pad row" style="gap:12px;color:var(--text-3)">${icon("clock")}<span>Выберите время, чтобы увидеть сумму</span></div>`;
  }
  const lo = selected[0], hi = selected[selected.length - 1] + 1;
  const total = selected.length * av.price;
  return html`
    <div class="card pad summary">
      <div class="grow">
        <div class="faint" style="font-size:13px">${dayLong(day)}</div>
        <div style="font-size:19px;font-weight:700;letter-spacing:-0.02em" class="num">${span(lo, hi)}</div>
        <div class="muted" style="font-size:13.5px">${hours(selected.length)}</div>
      </div>
      <div class="big num">${money(total)}</div>
    </div>`;
}

function ctaMarkup() {
  const total = selected.length * (av ? av.price : 0);
  return html`
    <div class="sum"><small>Итого</small><b class="num">${selected.length ? money(total) : "—"}</b></div>
    <button class="btn primary ${sending ? "is-loading" : ""}" data-action="send" ${selected.length && !sending ? "" : html`disabled`}>Отправить заявку</button>`;
}

function updateSlots() {
  patch("#slots", slotsMarkup());
  patch("#summary", summaryMarkup());
  const cta = document.getElementById("cta");
  if (cta) cta.innerHTML = String(ctaMarkup());
}

function paint(ctx, animate = true) {
  render(ctx, html`
    <div class="topbar">
      <button class="icon-btn" data-action="back" aria-label="Назад">${icon("left")}</button>
      <div class="grow"><div class="h-title">Выберите время</div></div>
    </div>
    <div class="card pad row" style="gap:12px;margin-bottom:22px">
      ${miniThumb(garage.photos[0])}
      <div class="grow">
        <div style="font-weight:650" class="ellipsis">${garage.name}</div>
        <div class="muted" style="font-size:13.5px">${money(garage.price)} за час</div>
      </div>
    </div>

    <div class="h-section" style="margin-bottom:10px">Дата</div>
    <div id="datesWrap">${datesMarkup()}</div>

    <div class="h-section" style="margin:24px 0 12px">Время</div>
    <div id="slots">${slotsMarkup()}</div>

    <div style="margin-top:22px" id="summary">${summaryMarkup()}</div>

    <div class="cta-bar" id="cta">${ctaMarkup()}</div>`, { tabbar: false, animate });
  const active = document.querySelector(".date-tile.is-on");
  if (active) active.scrollIntoView({ inline: "center", block: "nearest" });
}

async function enter(ctx) {
  sending = false;
  selected = [];
  garage = garageById(ctx.params.id);
  render(ctx, html`<div class="topbar"><div class="skeleton" style="width:40px;height:40px;border-radius:50%"></div></div><div class="skeleton" style="height:70px"></div><div class="skeleton" style="height:90px;margin-top:22px"></div>`, { tabbar: false });
  try {
    if (!garage) garage = await api.garage(ctx.params.id);
    av = await api.availability(ctx.params.id);
  } catch (e) {
    if (!ctx.isCurrent()) return;
    toast(e.message, "err");
    back("/");
    return;
  }
  if (!ctx.isCurrent()) return;
  const firstFree = av.days.find((d) => d.free > 0);
  day = (firstFree || av.days[0]).date;
  paint(ctx);
}

async function send(ctx) {
  if (sending || !selected.length) return;
  sending = true;
  updateSlots();
  try {
    const booking = await api.createBooking({ garage_id: garage.id, date: day, hours: selected });
    haptic.success();
    setLastBooking(booking);
    setActiveBookings(state.activeBookings + 1);
    go("/done", { replace: true });
  } catch (e) {
    sending = false;
    if (e.code === "taken") {
      toast("Это время только что заняли. Выберите другое.", "err");
      try { av = await api.availability(garage.id); } catch { /* оставим старые данные */ }
      selected = [];
      patch("#datesWrap", datesMarkup());
    } else {
      toast(e.message, "err");
    }
    updateSlots();
  }
}

export default {
  enter,
  actions: {
    back: () => back("/"),
    day(el) {
      haptic.select();
      day = el.dataset.date;
      selected = [];
      document.querySelectorAll(".date-tile").forEach((t) => {
        const on = t.dataset.date === day;
        t.classList.toggle("is-on", on);
        t.setAttribute("aria-pressed", on);
      });
      updateSlots();
    },
    slot(el) {
      const hour = Number(el.dataset.hour);
      if (blockedSet().has(hour)) { haptic.error(); return; }
      haptic.select();
      selected = toggleRange(selected, hour, blockedSet());
      updateSlots();
    },
    send: (el, e, ctx) => send(ctx),
  },
};
