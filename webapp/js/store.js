/* Общее состояние приложения: пользователь, каталог, избранное, фильтры. */
import { api } from "./api.js";
import { safeStorage } from "./dom.js";

const local = safeStorage("local");
const session = safeStorage("session");

const read = (storage, key, fallback) => {
  try { const v = storage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
const write = (storage, key, value) => { try { storage.setItem(key, JSON.stringify(value)); } catch { /* память переполнена — не критично */ } };

export const state = {
  me: null,
  garages: null,
  garagesAt: 0,
  favorites: new Set(read(local, "gh_fav", [])),
  filters: read(session, "gh_filters", { type: "all", districts: [], lift: false, pit: false, tools: false, fav: false, sort: "smart" }),
  activeBookings: 0,
};

const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn(state));

export async function loadMe() {
  state.me = await api.me();
  return state.me;
}

const FRESH_MS = 30_000;
let inflight = null;

/* Каталог: отдаём из памяти, если он свежий; force — перезагрузить. */
export async function loadGarages({ force = false } = {}) {
  const fresh = state.garages && Date.now() - state.garagesAt < FRESH_MS;
  if (fresh && !force) return state.garages;
  if (!inflight) {
    inflight = api.garages()
      .then((data) => { state.garages = data.garages; state.garagesAt = Date.now(); return state.garages; })
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function garageById(id) {
  return (state.garages || []).find((g) => g.id === Number(id)) || null;
}

export function isFav(id) { return state.favorites.has(Number(id)); }

export function toggleFav(id) {
  id = Number(id);
  if (state.favorites.has(id)) state.favorites.delete(id); else state.favorites.add(id);
  write(local, "gh_fav", [...state.favorites]);
  emit();
  return state.favorites.has(id);
}

export function setFilters(patch) {
  state.filters = { ...state.filters, ...patch };
  write(session, "gh_filters", state.filters);
}

export function resetFilters() {
  setFilters({ type: "all", districts: [], lift: false, pit: false, tools: false, fav: false });
}

export function setActiveBookings(n) {
  state.activeBookings = n;
  emit();
}

/* Фильтрация и сортировка каталога — на устройстве, чтобы счётчики и список обновлялись мгновенно */
export function applyFilters(garages, filters = state.filters, ignore = null) {
  let list = garages.filter((g) => {
    if (filters.type !== "all" && g.type !== filters.type) return false;
    if (ignore !== "districts" && filters.districts.length && !filters.districts.includes(g.district)) return false;
    if (filters.lift && !g.has_lift) return false;
    if (filters.pit && !g.has_pit) return false;
    if (filters.tools && g.tools !== "all") return false;
    if (filters.fav && !state.favorites.has(g.id)) return false;
    return true;
  });
  const free = (g) => (g.free_today > 0 ? 0 : 1);
  if (filters.sort === "cheap") list = list.sort((a, b) => a.price - b.price);
  else if (filters.sort === "expensive") list = list.sort((a, b) => b.price - a.price);
  else list = list.sort((a, b) => free(a) - free(b) || a.price - b.price);
  return list;
}
