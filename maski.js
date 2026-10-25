// Маски «Не улыбайся»: корона рисуется кодом, остальные — спрайты из maski/*.webp (прозрачные PNG-картинки масок, despill сделан офлайн).
// Система координат маски: начало — верх лба (точка 10), ось x — от правой щеки к левой (234→454), единица — ширина лица W,
// y вниз. Лицо повернуто — маска сжимается по x (yaw) и держится на точках носа/губ. Рот, подбородок и щёки не закрываем.
// Видео везде показывается зеркально (CSS), поэтому текст на табличках рисуем зеркально — зрителю он читается.

export const PAID_FROM = new Date('2026-11-01T00:00:00+07:00');   // с этой даты платные маски закрываются ⭐ (одна константа)
export const STYLES = {hell: 'Ад', glam: 'Гламур', meme: 'Мемы', anime: 'Аниме', cyber: 'Киберпанк', hat: 'Головные уборы'};

// free — бесплатна всегда; vip — золотая рамка, после PAID_FROM открыта только VIP-пользователям (цены и vip держит сервер)
export const MASKS = [
  {id: 'crown',    name: 'Корона',        style: 'hat',   free: true},
  {id: 'wreath',   name: 'Лавр',          style: 'hat'},
  {id: 'hellfire', name: 'Огненная корона', style: 'hell'},
  {id: 'demon',    name: 'Демон',         style: 'hell'},
  {id: 'angel',    name: 'Ангел',         style: 'glam'},
  {id: 'unicorn',  name: 'Единорог',      style: 'anime'},
  {id: 'deer',     name: 'Олень',         style: 'anime'},
  {id: 'bunny',    name: 'Зайка',         style: 'anime'},
  {id: 'hearts',   name: 'Сердечки',      style: 'glam'},
  {id: 'klub',     name: 'Клуб без баб',  style: 'meme'},
  {id: 'fembo',    name: 'ФЕМБОЙ',        style: 'meme'},
  {id: 'clown',    name: 'Клоун',         style: 'meme'},
  {id: 'chef',     name: 'Повар',         style: 'hat'},
  {id: 'santa',    name: 'Санта',         style: 'hat'},
];

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const P = (lm, i, w, h) => ({x: lm[i].x * w, y: lm[i].y * h});

// кадр лица в пикселях и в системе маски
export function faceFrame(lm, w, h){
  const top = P(lm, 10, w, h), L = P(lm, 234, w, h), R = P(lm, 454, w, h), ch = P(lm, 152, w, h);
  // единица — ширина лица, но в профиле щёки сходятся — тогда берём по высоте лица; наклон — по оси лоб→подбородок
  const W = Math.max(Math.hypot(R.x - L.x, R.y - L.y), Math.hypot(ch.x - top.x, ch.y - top.y) / 1.42), ang = Math.atan2(ch.y - top.y, ch.x - top.x) - Math.PI / 2;
  const c = Math.cos(-ang), s = Math.sin(-ang);
  const loc = p => ({x: ((p.x - top.x) * c - (p.y - top.y) * s) / W, y: ((p.x - top.x) * s + (p.y - top.y) * c) / W});
  const pt = i => loc(P(lm, i, w, h));
  const a = pt(33), b = pt(263), nose = pt(1);
  return {x: top.x, y: top.y, W, ang, room: top.y / W,
    eye: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(b.x - a.x, b.y - a.y)},
    nose, lip: pt(0), chin: pt(152), cl: pt(205), cr: pt(425),
    yaw: clamp(nose.x / 0.2, -1.2, 1.2)};
}
// условное лицо для превью-карточек
export function previewFrame(size){
  return {x: size / 2, y: size * 0.5, W: size * 0.5, ang: 0, eye: {x: 0, y: 0.42, d: 0.42},
    nose: {x: 0, y: 0.7}, lip: {x: 0, y: 0.92}, chin: {x: 0, y: 1.25}, cl: {x: -0.28, y: 0.78}, cr: {x: 0.28, y: 0.78}, yaw: 0, room: 9};
}

// ---------- спрайты ----------
// w — ширина спрайта в W; (ax, ay) — якорь в пикселях спрайта; (x, y) — куда якорь ставится (система лица: 0,0 — верх лба);
// fade — [y0, y1] в системе лица: ниже y0 спрайт плавно гаснет до y1 (ножки ободка не тянем по щекам);
// text — надпись на табличке: центр (cx, cy), размер (bw, bh) и наклон (ang) в пикселях спрайта; hole — овал лица, вырезаемый из парика.
const SPR = {
  wreath:   {file: 'wreath',   w: 1.14, ax: 200, ay: 238, x: 0,    y: 0.0},
  hellfire: {file: 'hellfire', w: 1.2,  ax: 190, ay: 262, x: 0,    y: 0.04, bob: 0.01},
  demon:    {file: 'demon',    w: 1.5,  ax: 180, ay: 108, x: 0,    y: -0.10, fade: [0.36, 0.60]},
  angel:    {file: 'angel',    w: 0.86, ax: 190, ay: 82,  x: 0,    y: -0.30, bob: 0.02},
  unicorn:  {file: 'unicorn',  w: 1.02, ax: 100, ay: 192, x: 0,    y: -0.12, fade: [0.30, 0.43]},
  deer:     {file: 'deer',     w: 1.9,  ax: 190, ay: 208, x: 0,    y: -0.12, fade: [0.30, 0.43]},
  bunny:    {file: 'bunny',    w: 1.75, ax: 160, ay: 238, x: 0,    y: -0.2,  fade: [0.2, 0.34]},
  hearts:   {file: 'hearts',   w: 1.7,  ax: 180, ay: 137, x: 0,    y: -0.12, fade: [0.30, 0.43]},
  klub:     {file: 'klub',     w: 1.5,  ax: 160, ay: 180, x: 0,    y: -0.12, fade: [0.30, 0.43],
             text: {lines: ['КЛУБ', 'БЕЗ БАБ'], cx: 159.5, cy: 82.5, bw: 285, bh: 140, ang: 0}},
  fembo:    {file: 'fembo',    w: 1.6,  ax: 160, ay: 191, x: 0,    y: -0.12, fade: [0.30, 0.43],
             text: {lines: ['ФЕМБОЙ'], cx: 159.5, cy: 97, bw: 255, bh: 110, ang: -0.129}},
  wig:      {file: 'wig',      w: 1.6,  ax: 200, ay: 0,   x: 0,    y: -0.45, hole: {cx: 0, cy: 0.65, rx: 0.5, ry: 0.68}},
  nose:     {file: 'nose',     w: 0.25, ax: 80,  ay: 80,  x: 'nose', y: 'nose'},
  chef:     {file: 'chef',     w: 1.05, ax: 130, ay: 300, x: 0,    y: 0.13},
  santa:    {file: 'santa',    w: 1.3,  ax: 170, ay: 240, x: -0.03, y: 0.13},
};
const LAYERS = {   // порядок слоёв: что рисуется первым — лежит под остальным
  wreath: ['wreath'], hellfire: ['hellfire'], demon: ['demon'], angel: ['angel'], unicorn: ['unicorn'], deer: ['deer'], bunny: ['bunny'],
  hearts: ['hearts'], klub: ['klub'], fembo: ['fembo'], clown: ['wig', 'nose'], chef: ['chef'], santa: ['santa'],
};
const IMG = {};   // готовые спрайты: {cv, w, h} или null, пока не загрузились
const LOADING = {};
function prepareSprite(key, img){
  const c = SPR[key], w = img.naturalWidth, h = img.naturalHeight;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const pxW = w / c.w;                                   // пикселей спрайта на единицу W
  if (c.fade){                                           // гасим ножки ободка ниже ушей
    const y0 = (c.ay + (c.fade[0] - c.y) * pxW) / h, y1 = (c.ay + (c.fade[1] - c.y) * pxW) / h;
    const k = g.createLinearGradient(0, 0, 0, h); k.addColorStop(clamp(y0, 0, 1), 'rgba(0,0,0,1)'); k.addColorStop(clamp(y1, 0.001, 1), 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'destination-in'; g.fillStyle = k; g.fillRect(0, 0, w, h);
  }
  if (c.hole){                                           // парик: вырезаем овал лица (лицо — на видео под маской), край мягкий
    const o = c.hole, cx = c.ax + (o.cx - c.x) * pxW, cy = c.ay + (o.cy - c.y) * pxW, rx = o.rx * pxW, ry = o.ry * pxW;
    g.globalCompositeOperation = 'destination-out'; g.save(); g.translate(cx, cy); g.scale(1, ry / rx);
    const k = g.createRadialGradient(0, 0, 0, 0, 0, rx); k.addColorStop(0, 'rgba(0,0,0,1)'); k.addColorStop(0.88, 'rgba(0,0,0,1)'); k.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = k; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
  }
  IMG[key] = {cv, w, h};
}
function loadSprite(key){
  if (LOADING[key]) return LOADING[key];
  return LOADING[key] = new Promise(res => {
    const im = new Image();
    im.onload = () => { try { prepareSprite(key, im); } catch(e){} res(); };
    im.onerror = () => res();
    im.src = new URL('./maski/' + SPR[key].file + '.webp', import.meta.url).href;
  });
}
// загрузить все спрайты заранее (или один набор масок); drawMask сам подгружает при первом вызове
export function preloadMasks(){ return Promise.all(Object.keys(SPR).map(loadSprite)).then(() => true); }

const FONT = '"Arial Black", Impact, "Helvetica Neue", Arial, sans-serif';
function fitText(g, tx){
  if (tx.fit) return tx.fit;
  g.font = `900 100px ${FONT}`;
  const mw = Math.max(...tx.lines.map(s => g.measureText(s).width));
  return tx.fit = Math.min(tx.bw / mw * 100, tx.bh / (tx.lines.length * 1.08));
}
function drawSprite(g, key, f, t){
  const c = SPR[key], s = IMG[key]; if (!s) return;
  const k = c.w / s.w, bob = c.bob ? Math.sin(t * 2.2) * c.bob : 0;
  let x = c.x, y = c.y;
  if (x === 'nose'){ x = f.nose.x; y = f.nose.y; } else x -= f.nose.x * 0.55;   // голова повернута — маска чуть смещается вслед за носом
  g.save(); g.translate(x, y + bob); g.scale(k, k); g.translate(-c.ax, -c.ay);
  g.drawImage(s.cv, 0, 0);
  const tx = c.text;
  if (tx){
    g.translate(tx.cx, tx.cy); g.rotate(tx.ang); g.scale(-1, 1);   // зеркально: зритель увидит нормальный текст
    const fs = fitText(g, tx), lh = fs * 1.08;
    g.font = `900 ${fs}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#0b0b0b';
    tx.lines.forEach((ln, i) => g.fillText(ln, 0, (i - (tx.lines.length - 1) / 2) * lh + fs * 0.04));
  }
  g.restore();
}

// ---------- отрисовка ----------
export function drawMask(g, id, f, t, t0){
  const crownFn = id === 'crown';
  const layers = LAYERS[id]; if (!crownFn && !layers) return;
  if (layers){
    let ready = true;
    for (const key of layers){ if (!IMG[key]){ ready = false; loadSprite(key); } }
    if (!ready) return;
  }
  const sq = 1 - 0.3 * Math.min(1, Math.abs(f.yaw));          // поворот головы: сжимаем маску по ширине
  const fx = p => ({x: p.x / sq, y: p.y});                     // точки лица внутри сжатой системы
  const F = {...f, nose: fx(f.nose), lip: fx(f.lip), chin: fx(f.chin), cl: fx(f.cl), cr: fx(f.cr), eye: {...f.eye, x: f.eye.x / sq}, sq};
  g.save();
  g.translate(f.x, f.y); g.rotate(f.ang); g.scale(f.W * sq, f.W);
  // над головой мало места (голова у верхнего края кадра) — высокие маски уменьшаем к основанию
  const up = TALL[id]; if (up && f.room < up * 1.05){ const k = clamp(f.room / (up * 1.05), 0.55, 1); g.translate(0, 0.04); g.scale(k, k); g.translate(0, -0.04); }
  g.lineJoin = 'round'; g.lineCap = 'round';
  try {
    if (crownFn) crownDraw(g, F, t);
    else for (const key of layers) drawSprite(g, key, F, t);
  } catch(e){}
  g.restore();
}
const TALL = {wreath: 0.5, hellfire: 0.55, demon: 0.8, angel: 0.5, unicorn: 0.85, deer: 0.95, bunny: 1.05, hearts: 0.7, klub: 0.8, fembo: 0.85, clown: 0.75, chef: 1.25, santa: 0.8};   // насколько вверх от лба тянется маска (в ширинах лица)

// ---------- корона (кодом) ----------
const CROWN = [
  'Y.....Y.....Y',
  'YY...YYY...YY',
  'YYY.YYYYY.YYY',
  'YYYYYYYYYYYYY',
  'YRYYBYYYBYYRY',
  'YYYYYYYYYYYYY',
  'DDDDDDDDDDDDD',
];
function pixels(g, rows, px, x0, y0, pal){
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++){
    const col = pal[rows[r][c]]; if (!col) continue;
    g.fillStyle = col; g.fillRect(x0 + c * px, y0 + r * px, px * 1.02, px * 1.02);
  }
}
function crownDraw(g, f, t){
  const px = 0.055, b = 0.012 * Math.sin(t * 2);
  pixels(g, CROWN, px, -px * 13 / 2, -0.06 - px * 7 + b, {Y: '#f5c400', D: '#a87400', R: '#e0115f', B: '#2b8cff'});
  g.fillStyle = '#fff7b0'; g.fillRect(-px * 5.5, -0.06 - px * 4 + b, px, px);
}
