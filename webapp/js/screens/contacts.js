import { ADMIN_PHONE, ADMIN_TG } from "../config.js";
import { html } from "../dom.js";
import { icon } from "../icons.js";
import { go, render } from "../router.js";
import { haptic, callPhone, openTelegramLink } from "../tg.js";

const FAQ = [
  ["Как это работает?", "Выберите бокс, дату и часы и отправьте заявку. Когда её подтвердят, вы получите сообщение в Telegram и сможете приезжать."],
  ["Нужно ли платить онлайн?", "Нет. Оплата на месте, напрямую площадке. Приложение деньги не принимает."],
  ["Можно ли отменить заявку?", "Да. В разделе «Заявки» откройте нужную заявку и нажмите «Отменить» — время освободится для других."],
  ["Что взять с собой?", "У каждого бокса указано, что есть на площадке: подъёмник, яма, инструмент. Если инструмента нет, привезите свой."],
  ["Как разместить свой гараж?", "Откройте вкладку «Владельцам» и оставьте заявку. Размещение сейчас бесплатное."],
];

function row(iconName, title, value, action) {
  return html`
    <button class="card pad press row" data-action="${action}" style="width:100%;text-align:left;gap:14px">
      <span class="ico" style="display:grid;place-items:center;width:42px;height:42px;border-radius:13px;background:var(--accent-soft);color:var(--accent-text)"><span style="width:22px;height:22px">${icon(iconName)}</span></span>
      <span class="grow"><span class="faint" style="display:block;font-size:12.5px">${title}</span><b class="num">${value}</b></span>
      <span style="width:18px;height:18px;color:var(--text-3)">${icon("right")}</span>
    </button>`;
}

export default {
  enter(ctx) {
    render(ctx, html`
      <h1 class="h-display" style="margin-bottom:6px">Контакты</h1>
      <p class="lead" style="margin-bottom:20px">Ответим на вопросы по бронированию и площадкам.</p>
      <div class="stack">
        ${row("send", "Telegram", `@${ADMIN_TG}`, "tg")}
        ${row("phone", "Телефон", ADMIN_PHONE, "call")}
      </div>

      <div class="h-section" style="margin:28px 0 12px">Частые вопросы</div>
      <div class="accordion">
        ${FAQ.map(([q, a]) => html`
          <div class="item">
            <button class="q" data-action="faq" aria-expanded="false"><span>${q}</span>${icon("down")}</button>
            <div class="a">${a}</div>
          </div>`)}
      </div>

      <p class="faint" style="text-align:center;font-size:12.5px;margin-top:28px"><span class="wordmark" style="font-size:15px">Garage<b>Hub</b></span><br>Почасовая аренда боксов · Москва и область</p>`, { animate: !ctx.refresh });
  },
  actions: {
    tg: () => { haptic.light(); openTelegramLink(`https://t.me/${ADMIN_TG}`); },
    call: () => { haptic.light(); callPhone(ADMIN_PHONE); },
    faq(el) {
      haptic.select();
      const item = el.closest(".item");
      const open = item.classList.toggle("is-open");
      el.setAttribute("aria-expanded", open);
    },
  },
};
