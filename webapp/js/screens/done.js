import { html } from "../dom.js";
import { dayLong, hours, money, span } from "../format.js";
import { icon } from "../icons.js";
import { go, render } from "../router.js";
import { miniThumb } from "../ui/cards.js";

let last = null;
export const setLastBooking = (booking) => { last = booking; };

export function stepper(status) {
  const done = (label, text) => html`<div class="step done"><span class="node">${icon("check")}</span><div><div class="t">${label}</div>${text ? html`<div class="d">${text}</div>` : ""}</div></div>`;
  if (status === "confirmed") {
    return html`<div class="steps">${done("Заявка отправлена")}${done("Подтверждена", "Приезжайте в выбранное время")}
      <div class="step now"><span class="node">${icon("clock")}</span><div><div class="t">Визит</div></div></div></div>`;
  }
  return html`<div class="steps">
    ${done("Заявка отправлена")}
    <div class="step now"><span class="node">${icon("clock")}</span><div><div class="t">Ожидает подтверждения</div><div class="d">Сообщение придёт в Telegram</div></div></div>
    <div class="step future"><span class="node">${icon("garage")}</span><div><div class="t">Визит</div></div></div>
  </div>`;
}

export default {
  enter(ctx) {
    if (!last) { go("/my", { replace: true }); return; }
    const b = last;
    render(ctx, html`
      <div class="success-hero">
        <div class="check-ring">
          <svg viewBox="0 0 92 92"><circle class="ring" cx="46" cy="46" r="45"/><path class="tick" d="M28 47l12 12 24-26"/></svg>
        </div>
        <h1 class="h-title" style="margin-top:18px">Заявка №${b.id} отправлена</h1>
        <p class="muted" style="margin-top:6px">Как только её подтвердят, мы напишем вам в Telegram.</p>
      </div>

      <div class="card pad stack" style="margin-top:22px">
        <div class="row" style="gap:12px">
          ${miniThumb(b.garage.photo)}
          <div class="grow"><div style="font-weight:650">${b.garage.name}</div><div class="muted" style="font-size:13.5px">${b.garage.district || b.garage.address}</div></div>
        </div>
        <div class="row-between" style="padding-top:12px;border-top:1px solid var(--border)">
          <div><div class="faint" style="font-size:13px">${dayLong(b.date)}</div><div style="font-weight:700;font-size:17px" class="num">${span(b.start_hour, b.end_hour)} · ${hours(b.hours)}</div></div>
          <div class="num" style="font-size:20px;font-weight:800">${money(b.total)}</div>
        </div>
      </div>

      <div class="card pad" style="margin-top:12px">${stepper("pending")}</div>
      <p class="faint" style="text-align:center;font-size:13px;margin-top:14px">Оплата на месте, напрямую площадке.</p>

      <div class="stack" style="margin-top:22px">
        <button class="btn primary block" data-action="my">Мои заявки</button>
        <button class="btn secondary block" data-action="home">Найти ещё</button>
      </div>`, { tabbar: false });
    document.querySelector(".screen").classList.remove("no-tabbar");
    document.querySelector(".screen").style.paddingBottom = "calc(var(--safe-bottom) + 32px)";
  },
  actions: {
    my: () => go("/my", { replace: true }),
    home: () => go("/", { replace: true }),
  },
};
