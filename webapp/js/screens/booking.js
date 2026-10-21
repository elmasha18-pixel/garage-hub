import { api } from "../api.js";
import { html } from "../dom.js";
import { dayLong, dayNumber, hhmm, money, span, weekdayShort } from "../format.js";
import { icon } from "../icons.js";
import { back, go, patch, render } from "../router.js";
import { garageById, setActiveBookings, state } from "../store.js";
import { haptic } from "../tg.js";
import { hoursText, priceLine, thumb } from "../ui/cards.js";
import { toast } from "../ui/toast.js";
import { setLastBooking } from "./done.js";

let garage = null;
let av = null;          // доступность на 7 дней
let day = null;         // выбранная дата «YYYY-MM-DD»
let selected = [];      // выбранные часы подряд
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
  return html`<div class="dates" id="dates" role="listbox" aria-label="Дата">${av.days.map((d, i) => html`
    <button class="date ${d.date === day ? "is-on" : ""} ${d.free === 0 ? "is-full" : ""}" data-action="day" data-date="${d.date}" role="option" aria-selected="${d.date === day}" aria-label="${dayLong(d.date)}, свободно ${hoursText(d.free)}">
      <span class="wd">${i === 0 ? "сегодня" : weekdayShort(d.date)}</span>
      <span class="dn">${dayNumber(d.date)}</span>
      <span class="fr">${d.free ? `${d.free} ч` : "нет"}</span>
    </button>`)}</div>`;
}

function hint() {
  if (!selected.length) return "Нажмите на первый час, затем на последний — часы между ними выберутся сами.";
  if (selected.length === 1) return "Можно отправить заявку на один час или выбрать последний час.";
  return "Чтобы изменить время, нажмите на другой час.";
}

function slotsMarkup() {
  const blocked = blockedSet();
  const lo = selected[0], hi = selected[selected.length - 1];
  const buttons = [];
  for (let h = av.open_hour; h < av.close_hour; h++) {
    const isSel = selected.includes(h);
    const cls = blocked.has(h) ? "is-busy" : isSel && (h === lo || h === hi) ? "is-sel" : isSel ? "is-mid" : "";
    buttons.push(html`<button class="slot ${cls}" data-action="slot" data-hour="${h}" aria-pressed="${isSel}" ${blocked.has(h) ? html`aria-disabled="true"` : ""}>${hhmm(h)}</button>`);
  }
  return html`
    <p class="caption">${hint()}</p>
    <div class="slots mt-m">${buttons}</div>`;
}

function ctaMarkup() {
  if (!selected.length) {
    return html`<div class="sum caption" style="flex:1">Выберите время</div>
      <button class="btn primary l" data-action="send" disabled>Отправить заявку</button>`;
  }
  const total = selected.length * av.price;
  return html`
    <div class="sum">
      <div class="price num">${money(total)}</div>
      <div class="caption num">${span(selected[0], selected[selected.length - 1] + 1)}, ${hoursText(selected.length)}</div>
    </div>
    <button class="btn primary l ${sending ? "is-loading" : ""}" data-action="send">Отправить заявку</button>`;
}

function update() {
  patch("#slots", slotsMarkup());
  const cta = document.getElementById("cta");
  if (cta) cta.innerHTML = String(ctaMarkup());
}

function paint(ctx) {
  render(ctx, html`
    <div class="header">
      <button class="icon-btn" data-action="back" aria-label="Назад">${icon("left")}</button>
      <h1 class="title-s">Выбор времени</h1>
      <span class="spacer"></span>
    </div>
    <div class="row">
      ${thumb(garage.photos[0])}
      <div class="grow">
        <div class="ellipsis" style="font-weight:600">${garage.name}</div>
        <div class="mt-xs">${priceLine(garage.price, "за час")}</div>
      </div>
    </div>

    <section class="section">
      <h2 class="title-s">Дата</h2>
      <div class="mt-m" id="datesWrap">${datesMarkup()}</div>
    </section>

    <section class="section">
      <h2 class="title-s">Время</h2>
      <div class="mt-s" id="slots">${slotsMarkup()}</div>
    </section>

    <div class="cta-bar" id="cta">${ctaMarkup()}</div>`, { tabbar: false });
  const active = document.querySelector(".date.is-on");
  if (active) active.scrollIntoView({ inline: "nearest", block: "nearest" });
}

async function enter(ctx) {
  sending = false;
  selected = [];
  garage = garageById(ctx.params.id);
  render(ctx, html`
    <div class="header"><div class="skeleton" style="width:40px;height:40px;border-radius:50%"></div></div>
    <div class="skeleton" style="height:48px"></div>
    <div class="skeleton mt-xl" style="height:64px"></div>
    <div class="skeleton mt-xl" style="height:200px"></div>`, { tabbar: false });
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
  day = (av.days.find((d) => d.free > 0) || av.days[0]).date;
  paint(ctx);
}

async function send() {
  if (sending || !selected.length) return;
  sending = true;
  update();
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
      try { av = await api.availability(garage.id); } catch { /* оставим прежние данные */ }
      selected = [];
      patch("#datesWrap", datesMarkup());
    } else {
      toast(e.message, "err");
    }
    update();
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
      document.querySelectorAll(".date").forEach((t) => {
        const on = t.dataset.date === day;
        t.classList.toggle("is-on", on);
        t.setAttribute("aria-selected", on);
      });
      update();
    },
    slot(el) {
      const hour = Number(el.dataset.hour);
      if (blockedSet().has(hour)) { haptic.error(); return; }
      haptic.select();
      selected = toggleRange(selected, hour, blockedSet());
      update();
    },
    send: () => send(),
  },
};
