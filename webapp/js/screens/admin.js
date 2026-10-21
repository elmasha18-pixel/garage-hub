/* Раздел администратора: заявки, расписание, объекты, заявки владельцев. Виден только админу (сервер проверяет права сам). */
import { api } from "../api.js";
import { BOT_USERNAME } from "../config.js";
import { html } from "../dom.js";
import { ago, dayLong, dayNumber, dayShort, hours, money, plural, span, weekdayShort } from "../format.js";
import { icon } from "../icons.js";
import { patch, render } from "../router.js";
import { haptic, callPhone, openTelegramLink } from "../tg.js";
import { emptyState, errorState, miniThumb, statusPill } from "../ui/cards.js";
import { openSheet } from "../ui/sheet.js";
import { toast } from "../ui/toast.js";

const REASONS = ["Это время уже занято", "Площадка в этот день не работает", "На площадке технические работы"];

let section = "inbox";
let dayOffset = 0;
let summary = null;
let items = { inbox: [], day: null, objects: [], leads: [] };

/* ── Мелкие помощники ───────────────────────────────────── */

const handle = (value) => String(value || "").replace(/^@/, "");
const isHandle = (value) => /^@?[A-Za-z0-9_]{4,}$/.test(String(value || "").trim());

function contactLinks(b) {
  const parts = [];
  if (b.owner_phone) parts.push(html`<a data-action="call" data-phone="${b.owner_phone}">${b.owner_phone}</a>`);
  if (b.owner_contact) parts.push(isHandle(b.owner_contact) ? html`<a data-action="tg" data-handle="${handle(b.owner_contact)}">@${handle(b.owner_contact)}</a>` : html`<span>${b.owner_contact}</span>`);
  return parts.length ? html`${parts.map((p, i) => html`${i ? " · " : ""}${p}`)}` : html`<span class="faint">контакты не указаны</span>`;
}

/* ── Заявки ─────────────────────────────────────────────── */

function requestCard(b, { withActions = true } = {}) {
  const client = b.client_username ? html`<a data-action="tg" data-handle="${b.client_username}">@${b.client_username}</a>` : html`id ${b.client_id}`;
  return html`
    <article class="card pad req" data-id="${b.id}">
      <div class="head"><b class="ellipsis">${b.garage.name}</b>${statusPill(b.status)}</div>
      <div class="sub num">${dayLong(b.date)} · ${span(b.start_hour, b.end_hour)} · ${hours(b.hours)} · <b style="color:var(--text)">${money(b.total)}</b></div>
      <div class="sub">Клиент: ${client}${b.minutes_ago != null ? html` · ${ago(b.minutes_ago)}` : ""}</div>
      ${b.comment ? html`<div class="sub">Причина: ${b.comment}</div>` : ""}
      <div class="owner">Владелец: <b>${b.owner_name || "—"}</b><br>${contactLinks(b)}</div>
      ${withActions && b.status === "pending" ? html`
        <div class="btns">
          <button class="btn danger sm" data-action="reject" data-id="${b.id}">Отказать</button>
          <button class="btn primary sm" data-action="confirm" data-id="${b.id}">Подтвердить</button>
        </div>` : ""}
    </article>`;
}

function inboxMarkup() {
  if (!items.inbox.length) return emptyState({ iconName: "check", title: "Все заявки разобраны", text: "Новых заявок нет." });
  return html`<div class="list" id="inboxList">${items.inbox.map((b) => requestCard(b))}</div>`;
}

function dayMarkup() {
  const d = items.day;
  const base = d ? d.date : null;
  const strip = html`<div class="dates" style="margin-bottom:14px">${[0, 1, 2, 3, 4, 5, 6].map((i) => {
    const date = d ? shiftDay(d.date, i - d.offset) : null;
    return html`<button class="date-tile ${i === dayOffset ? "is-on" : ""}" data-action="day" data-offset="${i}">
      <span class="wd">${i === 0 ? "Сегодня" : date ? weekdayShort(date) : "…"}</span><span class="dn">${date ? dayNumber(date) : "·"}</span></button>`;
  })}</div>`;
  if (!d) return html`${strip}<div class="skeleton" style="height:120px"></div>`;
  const body = d.bookings.length
    ? html`<div class="list">${d.bookings.map((b) => requestCard(b))}</div>
        <div class="card pad row-between" style="margin-top:12px"><span class="muted">Подтверждено на сумму</span><b class="num">${money(d.confirmed_total)}</b></div>`
    : emptyState({ iconName: "calendar", title: "Броней нет", text: `На ${dayLong(d.date)} заявок пока нет.` });
  return html`${strip}${body}`;
}

function shiftDay(iso, delta) {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

/* ── Объекты ────────────────────────────────────────────── */

function objectsMarkup() {
  const rows = items.objects.map((g) => html`
    <article class="card pad press row" data-action="object" data-id="${g.id}" style="gap:12px">
      ${miniThumb(g.photos[0])}
      <div class="grow">
        <div style="font-weight:650" class="ellipsis">${g.name}</div>
        <div class="muted" style="font-size:13px">${[g.district, money(g.price) + "/ч"].filter(Boolean).join(" · ")}</div>
        <div style="margin-top:5px"><span class="pill ${g.is_active ? "confirmed" : "archived"}">${g.is_active ? "В каталоге" : "В архиве"}</span>${g.upcoming ? html` <span class="faint" style="font-size:12.5px">· броней: ${g.upcoming}</span>` : ""}</div>
      </div>
      <span style="width:18px;height:18px;color:var(--text-3)">${icon("right")}</span>
    </article>`);
  return html`
    <div class="note" style="margin-bottom:14px">${icon("info")}<span>Добавление объектов, редактирование и загрузка фото — пока в боте (кнопки «Добавить объект» и «Все объекты»).</span></div>
    ${items.objects.length ? html`<div class="list">${rows}</div>` : emptyState({ iconName: "garage", title: "Объектов нет", text: "Добавьте первый объект в боте." })}
    <button class="btn secondary block" data-action="bot" style="margin-top:14px">${icon("send")}Открыть бота</button>`;
}

function objectSheet(g) {
  const links = contactLinks(g);
  let sheet;
  const markup = () => html`
    <div class="row-between" style="margin-bottom:12px"><div class="h-title" style="font-size:20px">${g.name}</div>
      <span class="pill ${g.is_active ? "confirmed" : "archived"}">${g.is_active ? "В каталоге" : "В архиве"}</span></div>
    <div class="kv">
      <div class="item"><span class="k">Район</span><span class="v">${g.district || "—"}</span></div>
      <div class="item"><span class="k">Адрес</span><span class="v">${g.address || "—"}</span></div>
      <div class="item"><span class="k">Цена</span><span class="v num">${money(g.price)} / ч</span></div>
      <div class="item"><span class="k">Слоты брони</span><span class="v num">${span(g.open_hour, g.close_hour)}</span></div>
      <div class="item"><span class="k">Фото</span><span class="v">${g.photos.length} из 5</span></div>
      <div class="item"><span class="k">Активных броней</span><span class="v">${g.upcoming}</span></div>
    </div>
    <div class="card pad" style="margin-top:12px"><div class="faint" style="font-size:12.5px;margin-bottom:4px">Владелец (видите только вы)</div><b>${g.owner_name || "—"}</b><div class="req" style="margin-top:4px"><span class="owner" style="background:none;padding:0;margin:0">${links}</span></div></div>
    ${g.is_active && g.upcoming ? html`<div class="note warn" style="margin-top:12px">${icon("info")}<span>Есть активные брони (${g.upcoming}). Клиенты их не потеряют, но решить по ним нужно вам.</span></div>` : ""}
    <div class="stack" style="margin-top:16px">
      ${g.is_active
        ? html`<button class="btn danger block" data-action="archive">${icon("archive")}Убрать в архив</button>`
        : html`<button class="btn success block" data-action="restore">${icon("restore")}Вернуть в каталог</button>`}
      <button class="btn ghost block" data-action="close">Закрыть</button>
    </div>`;
  const setActive = (fn, message) => async (el) => {
    el.classList.add("is-loading");
    try {
      const updated = await fn(g.id);
      Object.assign(g, updated);
      sheet.close();
      toast(message);
      patch("#section", objectsMarkup());
      loadSummary();
    } catch (e) {
      el.classList.remove("is-loading");
      toast(e.message, "err");
    }
  };
  sheet = openSheet(markup(), {
    actions: { call: (el) => callPhone(el.dataset.phone), tg: (el) => openTelegramLink(`https://t.me/${el.dataset.handle}`), archive: setActive(api.admin.archive, "Объект в архиве"), restore: setActive(api.admin.restore, "Объект снова в каталоге") },
  });
}

/* ── Заявки владельцев ──────────────────────────────────── */

function leadsMarkup() {
  if (!items.leads.length) return emptyState({ iconName: "mail", title: "Новых заявок нет", text: "Заявки владельцев появятся здесь." });
  return html`<div class="list">${items.leads.map((r) => html`
    <article class="card pad req" data-id="${r.id}">
      <div class="head"><b>${r.name}</b><span class="pill pending">${r.object_type}</span></div>
      <div class="sub">${r.address}</div>
      <div class="owner"><a data-action="call" data-phone="${r.phone}">${r.phone}</a>${isHandle(r.telegram) ? html` · <a data-action="tg" data-handle="${handle(r.telegram)}">@${handle(r.telegram)}</a>` : html` · ${r.telegram}`}</div>
      <div class="btns"><button class="btn secondary sm" data-action="leadDone" data-id="${r.id}">${icon("check")}Обработано</button></div>
    </article>`)}</div>`;
}

/* ── Каркас ─────────────────────────────────────────────── */

function tilesMarkup() {
  const s = summary || {};
  const tile = (id, n, label, hot) => html`<button class="tile ${hot && n ? "hot" : ""} ${section === id ? "" : ""}" data-action="section" data-value="${id}" style="${section === id ? "box-shadow:0 0 0 2px var(--accent) inset" : ""}">
    <div class="n">${n ?? "·"}</div><div class="l">${label}</div></button>`;
  return html`<div class="tiles">
    ${tile("inbox", s.pending, "Ждут решения", true)}
    ${tile("day", s.today, "Броней сегодня", false)}
    ${tile("objects", s.active, "Объектов в каталоге", false)}
    ${tile("leads", s.leads, "Заявки владельцев", true)}
  </div>`;
}

function sectionMarkup() {
  return { inbox: inboxMarkup, day: dayMarkup, objects: objectsMarkup, leads: leadsMarkup }[section]();
}

const TITLES = { inbox: "Новые заявки", day: "Расписание", objects: "Объекты", leads: "Заявки владельцев" };

function paint(ctx, animate = true) {
  render(ctx, html`
    <div class="row-between" style="margin-bottom:16px">
      <h1 class="h-display">Панель</h1>
      <span class="pill confirmed">Администратор</span>
    </div>
    <div id="tiles">${tilesMarkup()}</div>
    <div class="h-section" id="sectionTitle" style="margin:24px 0 12px">${TITLES[section]}</div>
    <div id="section">${sectionMarkup()}</div>`, { animate });
}

async function loadSummary() {
  try { summary = await api.admin.summary(); patch("#tiles", tilesMarkup()); } catch { /* не критично */ }
}

async function loadSection(ctx) {
  try {
    if (section === "inbox") items.inbox = (await api.admin.inbox()).bookings;
    else if (section === "day") items.day = await api.admin.day(dayOffset);
    else if (section === "objects") items.objects = (await api.admin.garages()).garages;
    else items.leads = (await api.admin.leads()).leads;
    if (!ctx || ctx.isCurrent()) patch("#section", sectionMarkup());
  } catch (e) {
    patch("#section", errorState(e.message));
  }
}

function showSection(next) {
  section = next;
  patch("#tiles", tilesMarkup());
  const title = document.getElementById("sectionTitle");
  if (title) title.textContent = TITLES[section];
  patch("#section", html`<div class="skeleton" style="height:140px;border-radius:var(--r-lg)"></div>`);
  loadSection(null);
}

/* ── Решения по заявке ──────────────────────────────────── */

function findBooking(id) {
  return items.inbox.find((b) => b.id === id) || (items.day && items.day.bookings.find((b) => b.id === id));
}

function applyDecision(updated) {
  items.inbox = items.inbox.filter((b) => b.id !== updated.id);
  if (items.day) items.day.bookings = items.day.bookings.map((b) => (b.id === updated.id ? updated : b));
  const el = document.querySelector(`#section .req[data-id="${updated.id}"]`);
  if (section === "inbox" && el) {
    el.classList.add("is-gone");
    setTimeout(() => patch("#section", sectionMarkup()), 320);
  } else {
    patch("#section", sectionMarkup());
  }
  loadSummary();
}

async function confirm(el) {
  const id = Number(el.dataset.id);
  el.classList.add("is-loading");
  try {
    const { booking, delivered } = await api.admin.confirm(id);
    haptic.success();
    toast(delivered ? "Подтверждено, клиент уведомлён" : "Подтверждено, но клиенту сообщение не дошло");
    applyDecision(booking);
  } catch (e) {
    el.classList.remove("is-loading");
    toast(e.message, "err");
    if (e.code === "decided") loadSection(null);
  }
}

function rejectSheet(id) {
  let sheet;
  let reason = "";
  const send = async (el) => {
    const text = reason.trim();
    if (text.length < 2) { haptic.error(); toast("Укажите причину", "err"); return; }
    el.classList.add("is-loading");
    try {
      const { booking, delivered } = await api.admin.reject(id, text);
      sheet.close();
      toast(delivered ? "Отклонено, клиент уведомлён" : "Отклонено, но клиенту сообщение не дошло");
      applyDecision(booking);
    } catch (e) {
      el.classList.remove("is-loading");
      toast(e.message, "err");
    }
  };
  sheet = openSheet(html`
    <div class="h-title" style="margin-bottom:4px">Причина отказа</div>
    <p class="muted" style="margin-bottom:14px">Клиент увидит её в сообщении.</p>
    <div class="stack">
      ${REASONS.map((r) => html`<button class="btn secondary block" data-action="preset" data-reason="${r}" style="justify-content:flex-start;min-height:48px">${r}</button>`)}
      <textarea class="input" data-input="reason" placeholder="Или напишите свою причину" maxlength="300"></textarea>
      <button class="btn danger block" data-action="send">Отказать</button>
    </div>`, {
    actions: {
      preset(el) { reason = el.dataset.reason; send(el); },
      "input:reason": (el) => { reason = el.value; },
      send,
    },
  });
}

/* ── Экран ──────────────────────────────────────────────── */

async function enter(ctx) {
  paint(ctx, !ctx.refresh);
  loadSummary();
  await loadSection(ctx);
}

export default {
  enter,
  actions: {
    section(el) { haptic.select(); showSection(el.dataset.value); },
    day(el) {
      haptic.select();
      dayOffset = Number(el.dataset.offset);
      items.day = null;
      patch("#section", dayMarkup());
      loadSection(null);
    },
    confirm,
    reject: (el) => rejectSheet(Number(el.dataset.id)),
    call: (el) => callPhone(el.dataset.phone),
    tg: (el) => openTelegramLink(`https://t.me/${el.dataset.handle}`),
    object(el) { const g = items.objects.find((x) => x.id === Number(el.dataset.id)); if (g) objectSheet(g); },
    bot: () => openTelegramLink(`https://t.me/${BOT_USERNAME}`),
    async leadDone(el) {
      el.classList.add("is-loading");
      try {
        await api.admin.leadDone(Number(el.dataset.id));
        items.leads = items.leads.filter((r) => r.id !== Number(el.dataset.id));
        const card = el.closest(".req");
        card.classList.add("is-gone");
        setTimeout(() => patch("#section", leadsMarkup()), 320);
        loadSummary();
      } catch (e) {
        el.classList.remove("is-loading");
        toast(e.message, "err");
      }
    },
    retry: () => loadSection(null),
  },
};
