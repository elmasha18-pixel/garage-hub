import { html } from "../dom.js";
import { icon, placeholderArt } from "../icons.js";
import { hhmm, money, SIZES, STATUS, TYPES_SHORT } from "../format.js";
import { isFav } from "../store.js";

export const locationLine = (g) => [g.district, g.address].filter(Boolean).join(" · ");

export function photoOrPlaceholder(src, alt = "") {
  return src
    ? html`<img class="fade-img" src="${src}" alt="${alt}" loading="lazy" decoding="async">`
    : placeholderArt;
}

export function typePill(type) {
  return html`<span class="type-pill">${icon(type === "detailing" ? "sparkle" : "garage")}${TYPES_SHORT[type] || "Гараж"}</span>`;
}

export function favButton(id) {
  const on = isFav(id);
  return html`<button class="icon-btn glass ${on ? "is-on" : ""}" data-action="fav" data-id="${id}" aria-label="${on ? "Убрать из избранного" : "В избранное"}" aria-pressed="${on}">${icon("heart")}</button>`;
}

export function featureTags(g) {
  if (g.type === "detailing") {
    return html`<div class="tags">${g.size ? html`<span class="tag ok">${icon("ruler")}${SIZES[g.size]}</span>` : ""}</div>`;
  }
  const tools = g.tools === "all" ? ["ok", "Инструмент"] : g.tools === "partial" ? ["ok", "Инструмент частично"] : ["off", "Свой инструмент"];
  return html`<div class="tags">
    <span class="tag ${g.has_lift ? "ok" : "off"}">${icon("lift")}Подъёмник</span>
    <span class="tag ${g.has_pit ? "ok" : "off"}">${icon("pit")}Яма</span>
    <span class="tag ${tools[0]}">${icon("wrench")}${tools[1]}</span>
  </div>`;
}

export function availability(g) {
  if (g.free_today > 0) {
    return html`<span class="avail on"><i class="dot"></i>Сегодня свободно с ${hhmm(g.next_free)} · ${g.free_today} ч</span>`;
  }
  return html`<span class="avail"><i class="dot"></i>Сегодня мест нет</span>`;
}

export function garageCard(g) {
  return html`
    <article class="card g-card press" data-action="open" data-id="${g.id}">
      <div class="media">
        ${photoOrPlaceholder(g.photos[0])}
        <div class="tl">${typePill(g.type)}</div>
        <div class="tr">${favButton(g.id)}</div>
        <div class="bl"><span class="price-tag">${money(g.price)}<small>/ч</small></span></div>
      </div>
      <div class="body">
        <div class="name ellipsis">${g.name}</div>
        <div class="row muted" style="gap:6px;margin:3px 0 10px;font-size:13.5px">
          <span style="width:14px;height:14px;display:inline-flex;flex:none">${icon("pin")}</span>
          <span class="ellipsis">${locationLine(g) || "Адрес уточняется"}</span>
        </div>
        ${featureTags(g)}
        <div style="margin-top:12px">${availability(g)}</div>
      </div>
    </article>`;
}

export function skeletonCards(n = 3) {
  return html`${Array.from({ length: n }, () => html`
    <div class="card g-card">
      <div class="skeleton" style="aspect-ratio:16/10;border-radius:0"></div>
      <div class="body">
        <div class="skeleton" style="height:20px;width:60%"></div>
        <div class="skeleton" style="height:14px;width:80%;margin-top:10px"></div>
        <div class="skeleton" style="height:26px;width:70%;margin-top:14px"></div>
      </div>
    </div>`)}`;
}

export function statusPill(status) {
  return html`<span class="pill ${status}">${STATUS[status] || status}</span>`;
}

export function miniThumb(src) {
  return html`<div class="mini-thumb">${src ? html`<img class="fade-img" src="${src}" alt="" loading="lazy">` : placeholderArt}</div>`;
}

export function emptyState({ iconName, title, text, button }) {
  return html`
    <div class="empty">
      <div class="art">${icon(iconName)}</div>
      <h3>${title}</h3>
      <p>${text}</p>
      ${button || ""}
    </div>`;
}

export function errorState(message) {
  return emptyState({
    iconName: "info",
    title: "Не удалось загрузить",
    text: message,
    button: html`<button class="btn secondary" data-action="retry">Повторить</button>`,
  });
}
