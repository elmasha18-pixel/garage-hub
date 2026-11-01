/* Примеры боксов для превью сайта без работающего бота (?demo).
   Это не настоящие объекты: на странице в этом режиме висит пометка «Примеры для показа».
   Вместо фото — нарисованные интерьеры боксов. */

const SCENES = {
  garage: [
    { wall: "#5d636c", wall2: "#4a4f57", floor: "#33363b", lamp: "#fff6dd", lift: "#ffb020", board: "#2a2d32" },
    { wall: "#6f6a62", wall2: "#5a564f", floor: "#3a3936", lamp: "#fff3d6", lift: "#d9dde2", board: "#34312d" },
    { wall: "#4c5866", wall2: "#3d4753", floor: "#2b3036", lamp: "#e9f2ff", lift: "#ffb020", board: "#262b31" },
  ],
  detailing: [
    { wall: "#dfe2e6", wall2: "#c9cdd3", floor: "#9aa0a8", lamp: "#ffffff", lift: "#14161a", board: "#b8bdc4" },
    { wall: "#2b2e34", wall2: "#22252a", floor: "#17191c", lamp: "#ffffff", lift: "#ffb020", board: "#1c1e22" },
  ],
};

function scene(type, n, view = 0) {
  const s = SCENES[type][n % SCENES[type].length];
  const shift = view * 26;
  const detailing = type === "detailing";
  const lamps = detailing
    ? [0, 1, 2, 3, 4].map((i) => `<rect x="${60 + i * 60 - shift / 2}" y="18" width="40" height="5" rx="2.5" fill="${s.lamp}"/>`).join("")
    : [0, 1, 2].map((i) => `<rect x="${70 + i * 100 - shift / 2}" y="20" width="60" height="6" rx="3" fill="${s.lamp}"/>`).join("");
  const lift = detailing
    ? `<rect x="${150 - shift}" y="196" width="100" height="6" rx="3" fill="${s.lift}" opacity=".85"/>`
    : `<rect x="${118 - shift}" y="96" width="9" height="122" fill="${s.lift}"/><rect x="${273 - shift}" y="96" width="9" height="122" fill="${s.lift}"/>` +
      `<rect x="${118 - shift}" y="176" width="164" height="7" fill="${s.lift}" opacity=".9"/>`;
  const tools = detailing
    ? `<rect x="${310 - shift}" y="110" width="44" height="64" rx="4" fill="${s.board}"/><rect x="${318 - shift}" y="120" width="10" height="26" rx="3" fill="${s.lift}" opacity=".7"/><rect x="${334 - shift}" y="120" width="10" height="20" rx="3" fill="${s.lamp}" opacity=".6"/>`
    : `<rect x="${306 - shift}" y="82" width="70" height="56" rx="3" fill="${s.board}"/>` +
      [0, 1, 2, 3].map((i) => `<rect x="${314 + i * 15 - shift}" y="92" width="4" height="${18 + (i % 2) * 10}" rx="2" fill="#c9ced6"/>`).join("") +
      `<rect x="${310 - shift}" y="168" width="58" height="50" rx="3" fill="#b8302f"/><rect x="${310 - shift}" y="182" width="58" height="2" fill="#7d1f1f"/><rect x="${310 - shift}" y="198" width="58" height="2" fill="#7d1f1f"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">` +
    `<rect width="400" height="300" fill="${s.wall2}"/>` +
    `<path d="M0 0H400V218H0z" fill="${s.wall}"/>` +
    `<path d="M0 0L70 40H330L400 0z" fill="${s.wall2}"/>` +
    `<path d="M0 300L70 218H330L400 300z" fill="${s.floor}"/>` +
    `<path d="M70 40V218M330 40V218" stroke="${s.wall2}" stroke-width="2"/>` +
    `<path d="M200 218V300M135 218L100 300M265 218L300 300" stroke="#000" stroke-opacity=".12" stroke-width="2"/>` +
    lamps + lift + tools +
    `<ellipse cx="200" cy="260" rx="150" ry="22" fill="#000" opacity=".12"/>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

const RAW = [
  { id: 101, type: "garage", name: "Тёплый бокс с подъёмником", district: "Марьино", address: "ул. Перерва, 41, стр. 2", price: 900, has_lift: true, has_pit: false, tools: "all", size: "medium", working_hours: "Ежедневно 9:00–22:00", open_hour: 9, close_hour: 22, free_today: 6, next_free: 15,
    description: "Отапливаемый бокс на две машины. Двухстоечный подъёмник до 4 тонн, компрессор, набор головок и ключей.\nМожно оставить машину на ночь по договорённости." },
  { id: 102, type: "garage", name: "Гараж с ямой и верстаком", district: "Люберцы", address: "Октябрьский пр-т, 112", price: 600, has_lift: false, has_pit: true, tools: "partial", size: "small", working_hours: "Ежедневно 8:00–21:00", open_hour: 8, close_hour: 21, free_today: 9, next_free: 12,
    description: "Смотровая яма, верстак с тисками, домкрат и подставки. Свой инструмент лучше взять с собой." },
  { id: 103, type: "detailing", name: "Детейлинг-бокс со светом и водой", district: "Котельники", address: "Новорязанское ш., 6", price: 1200, has_lift: false, has_pit: false, tools: "all", size: "medium", working_hours: "Ежедневно 10:00–23:00", open_hour: 10, close_hour: 23, free_today: 4, next_free: 18,
    description: "Светлый бокс для мойки и полировки: тёплая вода, аппарат высокого давления, пылесос, светодиодные лампы по периметру." },
  { id: 104, type: "garage", name: "Бокс для Газелей и микроавтобусов", district: "Мытищи", address: "ул. Колонцова, 5", price: 1100, has_lift: true, has_pit: true, tools: "all", size: "large", working_hours: "Пн–Сб 9:00–21:00", open_hour: 9, close_hour: 21, free_today: 0, next_free: null,
    description: "Высокие ворота, яма и подъёмник. Подходит для коммерческого транспорта длиной до 7 метров." },
  { id: 105, type: "garage", name: "Гараж самообслуживания у метро", district: "Варшавская", address: "Варшавское ш., 71", price: 800, has_lift: true, has_pit: false, tools: "all", size: "medium", working_hours: "Ежедневно 9:00–22:00", open_hour: 9, close_hour: 22, free_today: 3, next_free: 19,
    description: "Пять минут пешком от метро. Подъёмник, пневмоинструмент, слив масла." },
  { id: 106, type: "detailing", name: "Бокс для полировки и керамики", district: "Химки", address: "Ленинградское ш., 29", price: 1500, has_lift: false, has_pit: false, tools: "partial", size: "large", working_hours: "Ежедневно 10:00–22:00", open_hour: 10, close_hour: 22, free_today: 8, next_free: 14,
    description: "Чистое помещение с вентиляцией, подходит для нанесения керамики и плёнки. Полировальные машинки — свои." },
  { id: 107, type: "garage", name: "Небольшой бокс для простого ремонта", district: "Марьино", address: "Люблинская ул., 169", price: 500, has_lift: false, has_pit: false, tools: "none", size: "small", working_hours: "Ежедневно 9:00–21:00", open_hour: 9, close_hour: 21, free_today: 10, next_free: 11,
    description: "Сухой тёплый бокс для замены колёс, колодок и фильтров. Инструмент свой." },
  { id: 108, type: "garage", name: "Бокс с подъёмником и шиномонтажом", district: "Балашиха", address: "ш. Энтузиастов, 1Б", price: 950, has_lift: true, has_pit: false, tools: "all", size: "medium", working_hours: "Ежедневно 8:00–22:00", open_hour: 8, close_hour: 22, free_today: 5, next_free: 16,
    description: "Подъёмник, шиномонтажный станок и балансировка. Можно поменять резину самому за час." },
];

let cache = null;

export function garages() {
  if (!cache) {
    cache = RAW.map((g, i) => ({ ...g, photos: [0, 1, 2].map((v) => scene(g.type, i, v)) }));
  }
  return cache.map((g) => ({ ...g }));
}

export function availability(id) {
  const g = garages().find((x) => String(x.id) === String(id)) || garages()[0];
  const total = g.close_hour - g.open_hour;
  const start = new Date();
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate() + i, 12));
    const busy = (Number(id) * 7 + i * 5) % (total + 1);
    return { date: d.toISOString().slice(0, 10), blocked: [], free: i === 0 ? g.free_today : Math.max(0, total - busy) };
  });
  return { open_hour: g.open_hour, close_hour: g.close_hour, price: g.price, days };
}
