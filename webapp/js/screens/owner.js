import { api } from "../api.js";
import { ADMIN_PHONE, ADMIN_TG } from "../config.js";
import { html } from "../dom.js";
import { icon } from "../icons.js";
import { go, render } from "../router.js";
import { haptic, userFirstName } from "../tg.js";
import { toast } from "../ui/toast.js";

let type = "garage";
let sending = false;
const draft = { name: "", phone: "", address: "" };

const benefit = (iconName, title, text) => html`
  <div class="benefit"><span class="ico">${icon(iconName)}</span><div><b>${title}</b><span>${text}</span></div></div>`;

function form() {
  return html`
    <h1 class="h-display">Сдайте свой гараж</h1>
    <p class="lead" style="margin:8px 0 20px">GarageHub — сервис почасовой аренды гаражей самообслуживания и детейлинг-боксов в Москве и области.</p>

    <div class="hero-benefits card pad" style="margin-bottom:22px">
      ${benefit("rub", "Размещение бесплатное", "Без комиссии и абонентской платы")}
      ${benefit("calendar", "Клиенты бронируют по часам", "Оплата — вам на месте, напрямую")}
      ${benefit("list", "Расписание и заявки — у нас", "Вам остаётся принимать гостей")}
    </div>

    <div class="h-section" style="margin-bottom:12px">Оставьте заявку</div>
    <div class="stack" id="form">
      <label class="field" data-field="name"><span>Как к вам обращаться</span>
        <input class="input" data-input="name" autocomplete="given-name" maxlength="80" placeholder="Имя" value="${draft.name}">
        <div class="err">Укажите имя</div></label>
      <label class="field" data-field="phone"><span>Телефон</span>
        <input class="input" data-input="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="30" placeholder="+7 900 123-45-67" value="${draft.phone}">
        <div class="err">Проверьте номер: не хватает цифр</div></label>
      <div class="field"><span>Что сдаёте</span>
        <div class="segmented" id="type">
          <button class="${type === "garage" ? "is-on" : ""}" data-action="type" data-value="garage">Гараж</button>
          <button class="${type === "detailing" ? "is-on" : ""}" data-action="type" data-value="detailing">Детейлинг-бокс</button>
        </div></div>
      <label class="field" data-field="address"><span>Адрес площадки</span>
        <input class="input" data-input="address" autocomplete="street-address" maxlength="200" placeholder="Город, улица, дом" value="${draft.address}">
        <div class="err">Укажите адрес</div></label>
      <button class="btn primary block" data-action="send" style="margin-top:8px">Отправить заявку</button>
      <p class="faint" style="font-size:12.5px;text-align:center">Отправляя заявку, вы соглашаетесь на обработку контактных данных для связи по размещению.</p>
    </div>`;
}

function success() {
  return html`
    <div class="success-hero" style="padding-top:36px">
      <div class="check-ring"><svg viewBox="0 0 92 92"><circle class="ring" cx="46" cy="46" r="45"/><path class="tick" d="M28 47l12 12 24-26"/></svg></div>
      <h1 class="h-title" style="margin-top:18px">Заявка принята</h1>
      <p class="muted" style="margin-top:6px">Свяжемся с вами в ближайшее время.</p>
    </div>
    <div class="card pad stack" style="margin-top:22px">
      <div class="muted" style="font-size:14px">Если удобнее написать самим:</div>
      <div style="font-weight:650">@${ADMIN_TG}</div>
      <div style="font-weight:650" class="num">${ADMIN_PHONE}</div>
    </div>
    <button class="btn secondary block" data-action="home" style="margin-top:16px">На главную</button>`;
}

function validate() {
  let ok = true;
  const mark = (name, bad) => {
    const field = document.querySelector(`[data-field="${name}"]`);
    if (field) field.classList.toggle("has-error", bad);
    if (bad) ok = false;
  };
  mark("name", draft.name.trim().length < 2);
  mark("phone", draft.phone.replace(/\D/g, "").length < 10);
  mark("address", draft.address.trim().length < 5);
  return ok;
}

export default {
  enter(ctx) {
    if (!draft.name) draft.name = userFirstName();
    render(ctx, form(), { animate: !ctx.refresh });
  },
  inputs: {
    name: (el) => { draft.name = el.value; el.closest(".field").classList.remove("has-error"); },
    phone: (el) => { draft.phone = el.value; el.closest(".field").classList.remove("has-error"); },
    address: (el) => { draft.address = el.value; el.closest(".field").classList.remove("has-error"); },
  },
  actions: {
    type(el) {
      haptic.select();
      type = el.dataset.value;
      document.querySelectorAll("#type button").forEach((b) => b.classList.toggle("is-on", b.dataset.value === type));
    },
    async send(el) {
      if (sending) return;
      if (!validate()) { haptic.error(); return; }
      sending = true;
      el.classList.add("is-loading");
      try {
        await api.ownerRequest({ name: draft.name.trim(), phone: draft.phone.trim(), object_type: type, address: draft.address.trim() });
        haptic.success();
        draft.phone = ""; draft.address = "";
        render({ direction: "fade" }, success());
      } catch (e) {
        el.classList.remove("is-loading");
        toast(e.message, "err");
      } finally {
        sending = false;
      }
    },
    home: () => go("/", { replace: true }),
  },
};
