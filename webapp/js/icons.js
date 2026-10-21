import { raw } from "./dom.js";

const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4-4"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="3.5"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/>',
  list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  garage: '<path d="M3 10.2 12 4l9 6.2V20H3z"/><path d="M7 20v-6.5h10V20M7 16.7h10"/>',
  phone: '<path d="M5.5 4h3.2l1.7 4.4-2.2 1.4a11 11 0 0 0 5.4 5.4l1.4-2.2 4.4 1.7v3.2a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 3.5 6.1 2 2 0 0 1 5.5 4z"/>',
  send: '<path d="m21.5 2.5-19 7.2 7.2 3 3 7.3z"/><path d="m9.7 12.7 5-5"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  route: '<path d="m3 11 19-9-9 19-2-8z"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  lift: '<path d="M3 21h18M6 21V8M18 21V8M3 8h18M5 4.5h14"/>',
  pit: '<path d="M2 8h6v10h8V8h6"/><path d="M8 18h8"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  ruler: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  share: '<path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 17v4M17 19h4"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  rub: '<path d="M8 20V4h5.5a4 4 0 0 1 0 8H8M6 15h8"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  archive: '<rect x="3" y="4" width="18" height="5" rx="1.5"/><path d="M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9M10 13h4"/>',
  restore: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
};

export function icon(name, { fill = false, size } = {}) {
  const body = P[name] || "";
  const dim = size ? ` width="${size}" height="${size}"` : "";
  return raw(
    `<svg viewBox="0 0 24 24"${dim} fill="${fill ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`
  );
}

/* Заглушка для объектов без фото */
export const placeholderArt = raw(
  `<div class="placeholder-art"><svg viewBox="0 0 120 100" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" aria-hidden="true">` +
    `<path d="M10 42 60 10l50 32v48H10z"/><rect x="26" y="44" width="68" height="46" rx="2" fill="currentColor" opacity=".25"/>` +
    `<path d="M26 56h68M26 68h68M26 80h68" opacity=".7"/><circle cx="60" cy="27" r="3.5" fill="#f5a524" stroke="none"/></svg></div>`
);
