import { html } from "../dom.js";
import { dayLong, money, span } from "../format.js";
import { icon } from "../icons.js";
import { go, render } from "../router.js";
import { hoursText } from "../ui/cards.js";

let last = null;
export const setLastBooking = (booking) => { last = booking; };

/* Где сейчас заявка: отправлена → подтверждение → визит */
export function stepper(status) {
  const step = (state, iconName, title, detail) => html`
    <li class="step ${state}"><span class="node">${icon(iconName)}</span>
      <div><div class="t">${title}</div>${detail ? html`<div class="d">${detail}</div>` : ""}</div></li>`;
  if (status === "confirmed") {
    return html`<ol class="steps">
      ${step("done", "check", "Заявка отправлена")}
      ${step("done", "check", "Подтверждена", "Приезжайте в выбранное время")}
      ${step("now", "clock", "Визит")}
    </ol>`;
  }
  return html`<ol class="steps">
    ${step("done", "check", "Заявка отправлена")}
    ${step("now", "clock", "Ждёт подтверждения", "Ответ придёт сообщением в Telegram")}
    ${step("future", "garage", "Визит")}
  </ol>`;
}

export function bookingProps(b) {
  return html`<dl class="props">
    <dt>Бокс</dt><dd>${b.garage.name}</dd>
    <dt>Адрес</dt><dd>${[b.garage.district, b.garage.address].filter(Boolean).join(", ") || "—"}</dd>
    <dt>Дата</dt><dd>${dayLong(b.date)}</dd>
    <dt>Время</dt><dd class="num">${span(b.start_hour, b.end_hour)}, ${hoursText(b.hours)}</dd>
    <dt>Сумма</dt><dd class="num" style="font-weight:600">${money(b.total)}</dd>
  </dl>`;
}

export default {
  enter(ctx) {
    if (!last) { go("/my", { replace: true }); return; }
    const b = last;
    render(ctx, html`
      <div class="mt-xl"><span class="done-mark">${html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`}</span></div>
      <h1 class="title-l mt-l">Заявка отправлена</h1>
      <p class="muted mt-s">Номер заявки ${b.id}. Как только её подтвердят, придёт сообщение в Telegram.</p>

      <section class="section">${bookingProps(b)}</section>
      <section class="section">${stepper("pending")}</section>
      <p class="hint section">${icon("info")}<span>Оплата на месте, напрямую площадке.</span></p>

      <div class="section stack">
        <button class="btn primary l block" data-action="my">Мои заявки</button>
        <button class="btn secondary l block" data-action="home">Найти ещё бокс</button>
      </div>`, { tabbar: false });
    const screen = document.querySelector(".screen");
    screen.classList.remove("no-tabbar");
    screen.style.paddingBottom = "calc(var(--safe-bottom) + 32px)";
  },
  actions: {
    my: () => go("/my", { replace: true }),
    home: () => go("/", { replace: true }),
  },
};
