/* Шаблоны с автоматическим экранированием.
   Всё, что подставляется в html`...`, экранируется; доверенную разметку (иконки, вложенные шаблоны)
   передаём через raw() или вложенный html`...`. Так данные из базы не могут сломать страницу. */

const ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

class Raw {
  constructor(value) { this.value = value; }
  toString() { return this.value; }
}

export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ESCAPES[c]);
export const raw = (value) => new Raw(value);

function render(value) {
  if (value == null || value === false || value === true) return "";
  if (value instanceof Raw) return value.value;
  if (Array.isArray(value)) return value.map(render).join("");
  return esc(value);
}

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += render(values[i]) + strings[i + 1];
  return new Raw(out);
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function safeStorage(kind = "local") {
  try {
    const storage = kind === "local" ? window.localStorage : window.sessionStorage;
    storage.setItem("__t", "1");
    storage.removeItem("__t");
    return storage;
  } catch {
    const memory = new Map();
    return {
      getItem: (k) => (memory.has(k) ? memory.get(k) : null),
      setItem: (k, v) => memory.set(k, String(v)),
      removeItem: (k) => memory.delete(k),
    };
  }
}
