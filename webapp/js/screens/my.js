import { api } from "../api.js";
import { html } from "../dom.js";
import { dayLong, dayShort, hours, mapUrl, money, plural, span } from "../format.js";
import { icon } from "../icons.js";
import { go, patch, render } from "../router.js";
import { setActiveBookings } from "../store.js";
import { haptic, openLink } from "../tg.js";
import { emptyState, errorState, miniThumb, statusPill } from "../ui/cards.js";
import { openSheet } from "../ui/sheet.js";
import { toast } from "../ui/toast.js";
import { stepper } from "./done.js";

let bookings = [];
let tab = "upcoming";

const upcomingOf = () => bookings.filter((b) => b.can_cancel).sort((a, b) => (a.date + a.start_hour).localeCompare(b.date + b.start_hour, "ru", { numeric: true }));
const historyOf = () => bookings.filter((b) => !b.can_cancel);

function card(b) {
  return html`
    <article class="card pad press" data-action="open" data-id="${b.id}">
      <div class="row" style="gap:12px">
        ${miniThumb(b.garage.photo)}
        <div class="grow">
          <div style="font-weight:650" class="ellipsis">${b.garage.name}</div>
          <div class="muted num" style="font-size:13.5px;margin-top:1px">${dayShort(b.date)} · ${span(b.start_hour, b.end_hour)}</div>
          <div class="row-between" style="margin-top:7px">${statusPill(b.status)}<b class="num">${money(b.total)}</b></div>
        </div>
      </div>
    </article>`;
}

function listMarkup() {
  const list = tab === "upcoming" ? upcomingOf() : historyOf();
  if (!list.length) {
    return tab === "upcoming"
      ? emptyState({ iconName: "calendar", title: "Предстоящих заявок нет", text: "Выберите бокс и удобное время — это займёт минуту.", button: html`<button class="btn primary" data-action="find">Найти бокс</button>` })
      : emptyState({ iconName: "list", title: "История пока пуста", text: "Здесь появятся завершённые и отменённые заявки." });
  }
  return html`<div class="list">${list.map(card)}</div>`;
}

function tabsMarkup() {
  const up = upcomingOf().length;
  return html`
    <div class="segmented">
      <button class="${tab === "upcoming" ? "is-on" : ""}" data-action="tab" data-value="upcoming">Предстоящие${up ? html`<span class="badge">${up}</span>` : ""}</button>
      <button class="${tab === "history" ? "is-on" : ""}" data-action="tab" data-value="history">История</button>
    </div>`;
}

function paint(ctx, animate = true) {
  render(ctx, html`
    <h1 class="h-display" style="margin-bottom:16px">Мои заявки</h1>
    <div id="tabs">${tabsMarkup()}</div>
    <div id="list" style="margin-top:16px">${listMarkup()}</div>`, { animate });
}

async function load(ctx, { silent = false } = {}) {
  try {
    const data = await api.myBookings();
    bookings = data.bookings;
    setActiveBookings(upcomingOf().length);
    if (!ctx || ctx.isCurrent()) return true;
  } catch (e) {
    if (!silent && ctx && ctx.isCurrent()) {
      render(ctx, html`<h1 class="h-display" style="margin-bottom:16px">Мои заявки</h1>${errorState(e.message)}`);
    }
  }
  return false;
}

/* ── Карточка заявки в шторке ───────────────────────────── */

function detailsMarkup(b) {
  const g = b.garage;
  const location = [g.district, g.address].filter(Boolean).join(" · ");
  return html`
    <div class="row-between" style="margin-bottom:14px">
      <div class="h-title">Заявка №${b.id}</div>${statusPill(b.status)}
    </div>
    <div class="card pad stack">
      <div class="row" style="gap:12px">${miniThumb(g.photo)}<div class="grow"><div style="font-weight:650">${g.name}</div><div class="muted" style="font-size:13.5px">${location}</div></div></div>
      <div class="row-between" style="padding-top:12px;border-top:1px solid var(--border)">
        <div><div class="faint" style="font-size:13px">${dayLong(b.date)}</div><div class="num" style="font-weight:700;font-size:17px">${span(b.start_hour, b.end_hour)} · ${hours(b.hours)}</div></div>
        <div class="num" style="font-size:20px;font-weight:800">${money(b.total)}</div>
      </div>
    </div>
    ${b.status === "rejected" && b.comment ? html`<div class="note warn" style="margin-top:12px">${icon("info")}<span><b>Причина отказа:</b> ${b.comment}</span></div>` : ""}
    ${b.status === "pending" || b.status === "confirmed" ? html`<div class="card pad" style="margin-top:12px">${stepper(b.status)}</div>` : ""}
    <div class="stack" style="margin-top:16px">
      ${b.status === "confirmed" ? html`<button class="btn secondary block" data-action="route">${icon("route")}Маршрут</button>` : ""}
      ${b.can_cancel ? html`<button class="btn danger block" data-action="askCancel">Отменить заявку</button>` : html`<button class="btn primary block" data-action="again">Забронировать снова</button>`}
      <button class="btn ghost block" data-action="close">Закрыть</button>
    </div>`;
}

function openDetails(b) {
  let sheet;
  const actions = {
    route: () => openLink(mapUrl(b.garage)),
    again: () => { sheet.close(); go(`/g/${b.garage.id}/book`); },
    askCancel: () => {
      haptic.medium();
      sheet.update(html`
        <div class="h-title" style="margin-bottom:6px">Отменить заявку?</div>
        <p class="muted" style="margin-bottom:18px">${b.garage.name}, ${dayLong(b.date)}, ${span(b.start_hour, b.end_hour)}. Время освободится для других клиентов.</p>
        <div class="stack">
          <button class="btn danger block" data-action="doCancel">Да, отменить</button>
          <button class="btn secondary block" data-action="keep">Нет, оставить</button>
        </div>`);
    },
    keep: () => sheet.update(detailsMarkup(b)),
    async doCancel(el) {
      el.classList.add("is-loading");
      try {
        await api.cancelBooking(b.id);
        sheet.close();
        toast("Заявка отменена");
        await load(null, { silent: true });
        patch("#tabs", tabsMarkup());
        patch("#list", listMarkup());
      } catch (e) {
        el.classList.remove("is-loading");
        toast(e.message, "err");
      }
    },
  };
  sheet = openSheet(detailsMarkup(b), { actions });
}

async function enter(ctx) {
  if (ctx.refresh) {
    if (await load(ctx, { silent: true })) { patch("#tabs", tabsMarkup()); patch("#list", listMarkup()); }
    return;
  }
  render(ctx, html`
    <h1 class="h-display" style="margin-bottom:16px">Мои заявки</h1>
    <div class="skeleton" style="height:42px"></div>
    <div class="list" style="margin-top:16px">${[1, 2].map(() => html`<div class="skeleton" style="height:104px;border-radius:var(--r-lg)"></div>`)}</div>`);
  if (await load(ctx)) paint(ctx, false);
}

export async function refreshBadge() {
  await load(null, { silent: true });
}

export default {
  enter,
  actions: {
    tab(el) { haptic.select(); tab = el.dataset.value; patch("#tabs", tabsMarkup()); patch("#list", listMarkup()); },
    open(el) { const b = bookings.find((x) => x.id === Number(el.dataset.id)); if (b) openDetails(b); },
    find: () => go("/", { replace: true }),
    retry: () => location.reload(),
  },
};
