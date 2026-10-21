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

const FACTS = [
  "Размещение бесплатное, без комиссии",
  "Клиенты бронируют по часам, оплата — вам на месте",
  "Расписание и заявки ведём мы",
];

function form() {
  return html`
    <h1 class="title-xl">Сдайте свой бокс по часам</h1>
    <p class="muted mt-s">GarageHub — сервис почасовой аренды гаражей самообслуживания и детейлинг-боксов в Москве и области.</p>
    <ul class="mt-l" style="list-style:none;margin-left:0;padding:0">
      ${FACTS.map((f) => html`<li class="row mt-s" style="gap:10px;align-items:flex-start"><span style="color:var(--success);margin-top:1px">${icon("check", { size: 20 })}</span><span>${f}</span></li>`)}
    </ul>

    <section class="section">
      <h2 class="title-m">Заявка на размещение</h2>
      <div class="stack" id="form">
        <label class="field" data-field="name"><span>Как к вам обращаться</span>
          <input class="input" data-input="name" autocomplete="given-name" maxlength="80" value="${draft.name}">
          <span class="err">Укажите имя</span></label>
        <label class="field" data-field="phone"><span>Телефон</span>
          <input class="input" data-input="phone" type="tel" inputmode="tel" autocomplete="tel" maxlength="30" placeholder="+7" value="${draft.phone}">
          <span class="err">В номере не хватает цифр</span></label>
        <div class="field"><span>Что сдаёте</span>
          <div class="segmented" id="type">
            <button class="${type === "garage" ? "is-on" : ""}" data-action="type" data-value="garage" aria-pressed="${type === "garage"}">Гараж</button>
            <button class="${type === "detailing" ? "is-on" : ""}" data-action="type" data-value="detailing" aria-pressed="${type === "detailing"}">Детейлинг-бокс</button>
          </div></div>
        <label class="field" data-field="address"><span>Адрес площадки</span>
          <input class="input" data-input="address" autocomplete="street-address" maxlength="200" placeholder="Город, улица, дом" value="${draft.address}">
          <span class="err">Укажите адрес</span></label>
        <button class="btn primary l block" data-action="send">Отправить заявку</button>
        <p class="caption">Нажимая кнопку, вы соглашаетесь, что мы свяжемся с вами по этим контактам.</p>
      </div>
    </section>`;
}

function success() {
  return html`
    <div class="mt-xl"><span class="done-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span></div>
    <h1 class="title-l mt-l">Заявка принята</h1>
    <p class="muted mt-s">Свяжемся с вами в ближайшее время. Если удобнее написать самим — Telegram @${ADMIN_TG} или телефон ${ADMIN_PHONE}.</p>
    <button class="btn secondary l block section" data-action="home">На главную</button>`;
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

const clearError = (el) => el.closest(".field").classList.remove("has-error");

export default {
  enter(ctx) {
    if (!draft.name) draft.name = userFirstName();
    render(ctx, form(), { animate: !ctx.refresh });
  },
  inputs: {
    name: (el) => { draft.name = el.value; clearError(el); },
    phone: (el) => { draft.phone = el.value; clearError(el); },
    address: (el) => { draft.address = el.value; clearError(el); },
  },
  actions: {
    type(el) {
      haptic.select();
      type = el.dataset.value;
      document.querySelectorAll("#type button").forEach((b) => {
        const on = b.dataset.value === type;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-pressed", on);
      });
    },
    async send(el) {
      if (sending) return;
      if (!validate()) { haptic.error(); return; }
      sending = true;
      el.classList.add("is-loading");
      try {
        await api.ownerRequest({ name: draft.name.trim(), phone: draft.phone.trim(), object_type: type, address: draft.address.trim() });
        haptic.success();
        draft.phone = "";
        draft.address = "";
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
