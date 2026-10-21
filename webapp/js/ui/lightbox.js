import { html } from "../dom.js";
import { icon } from "../icons.js";
import { haptic } from "../tg.js";

/* Полноэкранный просмотр фото со свайпом */
export function openLightbox(photos, index = 0) {
  const root = document.getElementById("lightbox-root");
  root.innerHTML = String(html`
    <div class="lightbox" role="dialog" aria-modal="true" aria-label="Фотографии">
      <button class="icon-btn close" data-close aria-label="Закрыть">${icon("x")}</button>
      <div class="track">${photos.map((src) => html`<div class="slide"><img src="${src}" alt=""></div>`)}</div>
      <div class="cnt num">${index + 1} / ${photos.length}</div>
    </div>`);
  const box = root.firstElementChild;
  const track = box.querySelector(".track");
  const counter = box.querySelector(".cnt");
  track.scrollLeft = index * track.clientWidth;
  track.addEventListener("scroll", () => {
    const i = Math.round(track.scrollLeft / track.clientWidth);
    counter.textContent = `${i + 1} / ${photos.length}`;
  }, { passive: true });

  const close = () => { root.innerHTML = ""; document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  box.addEventListener("click", (e) => {
    if (e.target.closest("[data-close]") || e.target.classList.contains("slide")) close();
  });
  haptic.light();
}
