/* Нижняя шторка. Кнопки внутри — с data-action; обработчики передаются в openSheet. */
import { haptic } from "../tg.js";

const stack = [];

export const hasOpenSheet = () => stack.length > 0;
export const closeTopSheet = () => { const top = stack[stack.length - 1]; if (top) top.close(); };

export function openSheet(markup, { actions = {}, onClose } = {}) {
  const root = document.getElementById("sheet-root");
  const overlay = document.createElement("div");
  overlay.className = "sheet-overlay";
  const sheet = document.createElement("div");
  sheet.className = "sheet";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.innerHTML = `<div class="grab"></div>${markup}`;
  root.append(overlay, sheet);

  let closed = false;
  const handle = {
    el: sheet,
    update(newMarkup) { sheet.innerHTML = `<div class="grab"></div>${newMarkup}`; },
    close() {
      if (closed) return;
      closed = true;
      stack.splice(stack.indexOf(handle), 1);
      sheet.classList.add("is-closing");
      overlay.classList.add("is-closing");
      setTimeout(() => { sheet.remove(); overlay.remove(); }, 200);
      document.removeEventListener("keydown", onKey);
      if (onClose) onClose();
    },
  };

  const onKey = (e) => { if (e.key === "Escape") handle.close(); };
  document.addEventListener("keydown", onKey);
  overlay.addEventListener("click", () => handle.close());
  sheet.addEventListener("click", (e) => {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    if (el.dataset.action === "close") { handle.close(); return; }
    const fn = actions[el.dataset.action];
    if (fn) fn(el, e, handle);
  });
  sheet.addEventListener("input", (e) => {
    const el = e.target.closest("[data-input]");
    const fn = el && actions[`input:${el.dataset.input}`];
    if (fn) fn(el, e, handle);
  });

  stack.push(handle);
  haptic.light();
  return handle;
}
