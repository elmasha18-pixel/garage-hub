import { html } from "../dom.js";
import { icon } from "../icons.js";
import { haptic } from "../tg.js";

export function toast(message, type = "ok") {
  const root = document.getElementById("toast-root");
  const el = document.createElement("div");
  el.className = `toast ${type}`;
  el.setAttribute("role", type === "err" ? "alert" : "status");
  el.innerHTML = String(html`${icon(type === "err" ? "info" : "check")}<span>${message}</span>`);
  root.append(el);
  if (type === "err") haptic.error(); else haptic.success();
  setTimeout(() => {
    el.classList.add("is-leaving");
    setTimeout(() => el.remove(), 220);
  }, type === "err" ? 3600 : 2200);
}
