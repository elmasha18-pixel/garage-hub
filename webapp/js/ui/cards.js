import { html } from "../dom.js";
import { icon, placeholderArt } from "../icons.js";
import { hhmm, money, plural, STATUS, TYPES_SHORT } from "../format.js";
import { isFav } from "../store.js";

export const locationLine = (g) => [g.district, g.address].filter(Boolean).join(", ");

export function photoOrPlaceholder(src, alt = "") {
  return src
    ? html`<img class="fade-img" src="${src}" alt="${alt}" loading="lazy" decoding="async">`
    : placeholderArt;
}

export function favButton(id, extraClass = "") {
  const on = isFav(id);
  return html`<button class="fav ${extraClass} ${on ? "is-on" : ""}" data-action="fav" data-id="${id}" aria-label="${on ? "Убрать из избранного" : "В избранное"}" aria-pressed="${on}">${icon("heart")}</button>`;
}

export function priceLine(price, unit = "/ час") {
  return html`<span class="price">${money(price)}</span> <span class="unit">${unit}</span>`;
}

export function availability(g) {
  if (g.free_today > 0) {
    return html`<span class="avail on">Сегодня свободно с ${hhmm(g.next_free)}</span>`;
  }
  return html`<span class="avail">Сегодня мест нет</span>`;
}

/* Объявление в каталоге: фото, цена с избранным, название, район, доступность */
export function listing(g) {
  const where = [TYPES_SHORT[g.type], g.district].filter(Boolean).join(", ");
  return html`
    <article class="listing" data-action="open" data-id="${g.id}">
      <div class="photo">${photoOrPlaceholder(g.photos[0], g.name)}</div>
      <div class="price-row"><div>${priceLine(g.price)}</div>${favButton(g.id)}</div>
      <h3 class="name clamp-2">${g.name}</h3>
      <div class="caption ellipsis">${where}</div>
      ${availability(g)}
    </article>`;
}

export function skeletonListings(n = 4) {
  return html`<div class="grid">${Array.from({ length: n }, () => html`
    <div>
      <div class="skeleton" style="aspect-ratio:4/3;border-radius:12px"></div>
      <div class="skeleton mt-s" style="height:18px;width:55%"></div>
      <div class="skeleton mt-s" style="height:14px;width:85%"></div>
      <div class="skeleton mt-s" style="height:12px;width:60%"></div>
    </div>`)}</div>`;
}

export function statusLabel(status) {
  return html`<span class="status ${status}">${STATUS[status] || status}</span>`;
}

export function thumb(src) {
  return html`<div class="thumb">${src ? html`<img class="fade-img" src="${src}" alt="" loading="lazy">` : placeholderArt}</div>`;
}

export const hoursText = (n) => `${n} ${plural(n, "час", "часа", "часов")}`;

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
