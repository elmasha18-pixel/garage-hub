import { ADMIN_PHONE, ADMIN_TG } from "../config.js";
import { html } from "../dom.js";
import { icon } from "../icons.js";
import { render } from "../router.js";
import { callPhone, haptic, openTelegramLink } from "../tg.js";

const FAQ = [
  ["Как забронировать бокс?", "Выберите бокс, дату и часы и отправьте заявку. Когда её подтвердят, придёт сообщение в Telegram — после этого можно приезжать."],
  ["Нужно ли платить онлайн?", "Нет. Оплата на месте, напрямую площадке. Приложение деньги не принимает."],
  ["Как отменить заявку?", "Во вкладке «Заявки» откройте нужную заявку и нажмите «Отменить заявку». Время освободится для других."],
  ["Что взять с собой?", "В карточке бокса указано, что есть на месте: подъёмник, яма, инструмент. Если инструмента нет, привезите свой."],
  ["Как разместить свой гараж?", "Откройте вкладку «Владельцам» и оставьте заявку. Размещение сейчас бесплатное."],
];

const contact = (iconName, title, value, action) => html`
  <button class="item press" data-action="${action}">
    <span class="lead">${icon(iconName)}</span>
    <span class="grow"><span style="display:block">${title}</span><span class="caption num">${value}</span></span>
    <span class="chev">${icon("right")}</span>
  </button>`;

export default {
  enter(ctx) {
    render(ctx, html`
      <h1 class="title-xl">Контакты</h1>
      <p class="muted mt-s">Поможем с бронью, ответим на вопросы о площадках.</p>
      <div class="rows mt-l">
        ${contact("send", "Написать в Telegram", `@${ADMIN_TG}`, "tg")}
        ${contact("phone", "Позвонить", ADMIN_PHONE, "call")}
      </div>

      <section class="section">
        <h2 class="title-m">Вопросы и ответы</h2>
        <div class="faq">${FAQ.map(([q, a]) => html`
          <div class="qa">
            <button class="q" data-action="faq" aria-expanded="false"><span>${q}</span>${icon("down")}</button>
            <p class="a">${a}</p>
          </div>`)}</div>
      </section>

      <p class="caption section" style="text-align:center"><span class="wordmark" style="font-size:15px">Garage<b>Hub</b></span><br>Почасовая аренда боксов в Москве и области</p>`, { animate: !ctx.refresh });
  },
  actions: {
    tg: () => { haptic.light(); openTelegramLink(`https://t.me/${ADMIN_TG}`); },
    call: () => { haptic.light(); callPhone(ADMIN_PHONE); },
    faq(el) {
      haptic.select();
      const open = el.closest(".qa").classList.toggle("is-open");
      el.setAttribute("aria-expanded", open);
    },
  },
};
