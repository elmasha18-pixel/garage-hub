/* Данные каталога. Сайт берёт их из того же открытого API, что и Mini App:
   GET /api/garages, /api/garages/{id}, /api/garages/{id}/availability — только публичные поля.
   Режим примеров (?demo или window.GH_DEMO) — для превью без работающего бота. */

export const DEMO = Boolean(window.GH_DEMO) || /[?&]demo\b/.test(location.search);

export class LoadError extends Error {}

async function getJSON(path) {
  let response;
  try {
    response = await fetch(path, { headers: { Accept: "application/json" } });
  } catch {
    throw new LoadError("network");
  }
  if (response.status === 404) throw new LoadError("not_found");
  if (!response.ok) throw new LoadError("server");
  return response.json();
}

const demo = () => import("./demo.js");

export async function garages() {
  if (DEMO) return (await demo()).garages();
  return (await getJSON("/api/garages")).garages;
}

export async function garage(id) {
  if (DEMO) {
    const g = (await demo()).garages().find((x) => String(x.id) === String(id));
    if (!g) throw new LoadError("not_found");
    return g;
  }
  return getJSON(`/api/garages/${encodeURIComponent(id)}`);
}

export async function availability(id) {
  if (DEMO) return (await demo()).availability(id);
  return getJSON(`/api/garages/${encodeURIComponent(id)}/availability`);
}

/* Районы из самих объектов, по алфавиту, с количеством — как в боте */
export function districts(list) {
  const counts = new Map();
  for (const g of list) if (g.district) counts.set(g.district, (counts.get(g.district) || 0) + 1);
  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0], "ru")).map(([name, count]) => ({ name, count }));
}
