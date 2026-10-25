// Маски «Не улыбайся»: рисуются кодом поверх кадра по точкам FaceLandmarker (никаких картинок).
// Система координат маски: начало — верх лба (точка 10), ось x — от правой щеки к левой (234→454), единица — ширина лица W,
// y вниз. Лицо повернуто — маска сжимается по x (yaw) и держится на точках носа/губ. Рот, подбородок и щёки не закрываем
// (румянец — только прозрачный). Видео везде показывается зеркально (CSS), поэтому текст рисуем зеркально — зрителю он читается.

export const PAID_FROM = new Date('2026-11-01T00:00:00+07:00');   // с этой даты платные маски закрываются ⭐ (одна константа)
export const STYLES = {hell: 'Ад', glam: 'Гламур', meme: 'Мемы', anime: 'Аниме', cyber: 'Киберпанк', hat: 'Головные уборы'};

// free — бесплатна всегда; vip — золотая рамка, после PAID_FROM открыта только VIP-пользователям
export const MASKS = [
  {id: 'horns',    name: 'Рожки',       style: 'hell',   free: true},
  {id: 'crown',    name: 'Корона',      style: 'hat',    free: true},
  {id: 'cat',      name: 'Ушки',        style: 'anime',  free: true},
  {id: 'hellfire', name: 'Огонь',       style: 'hell'},
  {id: 'halohorn', name: 'Ангел/демон', style: 'hell'},
  {id: 'bats',     name: 'Мыши',        style: 'hell'},
  {id: 'tiara',    name: 'Тиара',       style: 'glam'},
  {id: 'hearts',   name: 'Сердечки',    style: 'glam'},
  {id: 'catbow',   name: 'Кошка в бантах', style: 'glam'},
  {id: 'fembo',    name: 'ФЕМБОЙ',      style: 'meme'},
  {id: 'klub',     name: 'Клуб без баб', style: 'meme'},
  {id: 'mustache', name: 'Усы',         style: 'meme'},
  {id: 'clown',    name: 'Клоун',       style: 'meme'},
  {id: 'bunny',    name: 'Зайка',       style: 'anime'},
  {id: 'blush',    name: 'Аниме-эмоции', style: 'anime'},
  {id: 'cyber',    name: 'Наушники',    style: 'cyber',  vip: true},
  {id: 'glitch',   name: 'Глитч',       style: 'cyber',  vip: true},
  {id: 'cashier',  name: 'Кепка',       style: 'hat'},
  {id: 'witch',    name: 'Ведьма',      style: 'hat'},
  {id: 'sorting',  name: 'Шляпа',       style: 'hat'},
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

export function drawMask(g, id, f, t, t0){
  const fn = DRAW[id]; if (!fn) return;
  const sq = 1 - 0.3 * Math.min(1, Math.abs(f.yaw));          // поворот головы: сжимаем маску по ширине
  const fx = p => ({x: p.x / sq, y: p.y});                     // точки лица внутри сжатой системы
  const F = {...f, nose: fx(f.nose), lip: fx(f.lip), chin: fx(f.chin), cl: fx(f.cl), cr: fx(f.cr), eye: {...f.eye, x: f.eye.x / sq}, sq};
  g.save();
  g.translate(f.x, f.y); g.rotate(f.ang); g.scale(f.W * sq, f.W);
  // над головой мало места (голова у верхнего края кадра) — высокие маски уменьшаем к основанию
  const up = TALL[id]; if (up && f.room < up * 1.05){ const k = clamp(f.room / (up * 1.05), 0.55, 1); g.translate(0, 0.04); g.scale(k, k); g.translate(0, -0.04); }
  g.lineJoin = 'round'; g.lineCap = 'round';
  const E = {W: f.W, glow: (col, k) => { g.shadowColor = col; g.shadowBlur = f.W * (k || 0.08); }, noGlow: () => { g.shadowBlur = 0; g.shadowColor = 'transparent'; }};
  try { fn(g, F, t, t0 || 0, E); } catch(e){}
  g.restore();
}

// ---------- помощники ----------
const lg = (g, x0, y0, x1, y1, stops) => { const k = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) k.addColorStop(o, c); return k; };
const rg = (g, x, y, r0, r1, stops) => { const k = g.createRadialGradient(x, y, r0, x, y, r1); for (const [o, c] of stops) k.addColorStop(o, c); return k; };
const tw = (t, sp, ph) => 0.5 + 0.5 * Math.sin(t * sp + (ph || 0));
function sparkle(g, x, y, r, col){
  g.fillStyle = col; g.beginPath();
  g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}
function heart(g, x, y, s, fill, stroke){
  g.save(); g.translate(x, y); g.scale(s, s);
  g.beginPath(); g.moveTo(0, 0.35); g.bezierCurveTo(-0.7, -0.1, -0.35, -0.6, 0, -0.25); g.bezierCurveTo(0.35, -0.6, 0.7, -0.1, 0, 0.35); g.closePath();
  g.fillStyle = fill; g.fill(); if (stroke){ g.strokeStyle = stroke; g.lineWidth = 0.06; g.stroke(); }
  g.restore();
}
function rrect(g, x, y, w, h, r){
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
// зеркальный текст: видео показывается зеркально, зритель увидит обычный
function mtext(g, txt, x, y, size, font){
  g.save(); g.translate(x, y); g.scale(-1, 1); g.font = `900 ${size}px ${font || '"Arial Black", Impact, "Helvetica Neue", sans-serif'}`;
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 0, 0); g.restore();
}
function ember(g, t, x0, y0, spread, n, col, rise){
  for (let i = 0; i < n; i++){
    const ph = (t * 0.7 + i / n) % 1, x = x0 + Math.sin(i * 12.9 + t * 2) * spread * ph + (i / n - 0.5) * spread, y = y0 - ph * (rise || 0.5);
    g.globalAlpha = 1 - ph; g.fillStyle = col; g.beginPath(); g.arc(x, y, 0.012 + 0.012 * (1 - ph), 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}
function flame(g, x, y, w, h, t, ph, cols){
  const k = 1 + 0.14 * Math.sin(t * 9 + ph) + 0.07 * Math.sin(t * 23 + ph * 3), sx = Math.sin(t * 6 + ph) * w * 0.3;
  g.fillStyle = lg(g, x, y, x, y - h * k, cols || [[0, '#d8200a'], [0.45, '#ff7a00'], [0.8, '#ffd23f'], [1, '#fff6b8']]);
  g.beginPath(); g.moveTo(x - w / 2, y);
  g.bezierCurveTo(x - w * 0.62, y - h * 0.45 * k, x - w * 0.1 + sx, y - h * 0.6 * k, x + sx, y - h * k);
  g.bezierCurveTo(x + w * 0.2 + sx, y - h * 0.55 * k, x + w * 0.62, y - h * 0.4 * k, x + w / 2, y);
  g.closePath(); g.fill();
}
// рог: толстый изогнутый конус
function horn(g, s, k, fill, rim, hl){
  const ox = 0.25, tipx = 0.45 * k, tipy = -0.5 * k;
  g.beginPath();
  g.moveTo(s * ox, 0.05);
  g.bezierCurveTo(s * 0.35, -0.1, s * 0.42 * k, -0.28 * k, s * tipx, tipy);
  g.bezierCurveTo(s * 0.33 * k, -0.3 * k, s * 0.19, -0.14, s * 0.1, 0.03);
  g.closePath();
  g.fillStyle = fill; g.fill();
  if (rim){ g.strokeStyle = rim; g.lineWidth = 0.02; g.stroke(); }
  if (hl){   // блик по внешнему краю
    g.strokeStyle = hl; g.lineWidth = 0.014; g.beginPath();
    g.moveTo(s * 0.3, -0.03); g.bezierCurveTo(s * 0.37, -0.12, s * 0.42 * k, -0.27 * k, s * (tipx - 0.02), tipy + 0.05); g.stroke();
  }
}

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
// ушки (кошка): пушистые, с подвижным кончиком и подсветкой внутри
function catEars(g, t, inner, outer, k){
  for (const s of [-1, 1]){
    const tick = Math.pow(Math.max(0, Math.sin(t * 2.3 + s * 1.7)), 12) * 0.25;
    g.save(); g.translate(s * 0.3, -0.02); g.rotate(s * (0.18 + tick)); g.scale(k, k);
    g.fillStyle = lg(g, 0, -0.42, 0, 0.05, [[0, '#2c2a36'], [1, outer]]);
    g.beginPath(); g.moveTo(-0.17, 0.05); g.quadraticCurveTo(-0.15, -0.25, 0.0, -0.44); g.quadraticCurveTo(0.15, -0.25, 0.17, 0.05); g.closePath(); g.fill();
    g.fillStyle = lg(g, 0, -0.3, 0, 0.02, [[0, '#ffc2da'], [1, inner]]);
    g.beginPath(); g.moveTo(-0.09, 0.02); g.quadraticCurveTo(-0.08, -0.16, 0.0, -0.3); g.quadraticCurveTo(0.08, -0.16, 0.09, 0.02); g.closePath(); g.fill();
    g.strokeStyle = '#ffffff55'; g.lineWidth = 0.008; for (const x of [-0.03, 0.03]){ g.beginPath(); g.moveTo(x, -0.01); g.lineTo(x * 0.4, -0.22); g.stroke(); }
    g.restore();
  }
}

const TALL = {fembo: 0.62, klub: 0.7, witch: 0.82, sorting: 0.86, bunny: 0.68, hellfire: 0.5, horns: 0.52, hearts: 0.58, glitch: 0.52, bats: 0.55};   // насколько вверх от лба тянется маска (в ширинах лица)

const DRAW = {
  // ---------- ад ----------
  horns(g, f, t, t0, E){
    for (const s of [-1, 1]){
      E.glow('#ff1d3a', 0.12 + 0.04 * Math.sin(t * 4 + s));
      horn(g, s, 1, lg(g, s * 0.1, 0, s * 0.45, -0.5, [[0, '#5b0010'], [0.5, '#b3001e'], [1, '#ff3b4d']]), '#ff5a6a', '#ffc2c8');
      E.noGlow();
      g.fillStyle = '#2a0008'; g.beginPath(); g.ellipse(s * 0.2, 0.05, 0.09, 0.03, 0, 0, Math.PI * 2); g.fill();   // основание — «лунка» на лбу
    }
    ember(g, t, 0, -0.1, 0.8, 9, '#ff7a2a', 0.45);
  },
  hellfire(g, f, t, t0, E){
    E.glow('#ff5a00', 0.16);
    for (let i = 0; i < 9; i++){ const x = -0.46 + i * 0.115; flame(g, x, 0.07, 0.2, 0.34 + 0.16 * Math.abs(Math.sin(i * 1.9)), t, i * 1.3); }
    for (let i = 0; i < 6; i++){ const x = -0.4 + i * 0.16; flame(g, x, 0.06, 0.12, 0.22 + 0.08 * Math.sin(i), t + 0.4, i * 2.1, [[0, '#ff4d00'], [0.6, '#ffb200'], [1, '#fff3a0']]); }
    E.noGlow();
    ember(g, t, 0, -0.25, 0.9, 12, '#ffd23f', 0.55);
  },
  halohorn(g, f, t, t0, E){
    for (const s of [-1, 1]){
      E.glow('#ff2040', 0.08);
      g.save(); g.translate(s * 0.02, 0.03); horn(g, s, 0.6, lg(g, 0, 0, s * 0.3, -0.3, [[0, '#6a0014'], [1, '#e0182f']]), '#ff6070', '#ffc0c6'); g.restore();
    }
    E.glow('#ffd84d', 0.18 + 0.05 * Math.sin(t * 3));
    const y = -0.38 + 0.015 * Math.sin(t * 2);
    g.strokeStyle = lg(g, -0.3, y, 0.3, y, [[0, '#ffb300'], [0.5, '#fff3a0'], [1, '#ffb300']]); g.lineWidth = 0.055;
    g.beginPath(); g.ellipse(0, y, 0.3, 0.078, 0, 0, Math.PI * 2); g.stroke();
    E.noGlow(); g.strokeStyle = '#fffbe0'; g.lineWidth = 0.014; g.beginPath(); g.ellipse(0, y - 0.006, 0.3, 0.078, 0, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    sparkle(g, 0.3, y - 0.05, 0.035 * tw(t, 5), '#fff');
  },
  bats(g, f, t, t0, E){
    E.glow('#b45cff', 0.1);
    for (let k = 0; k < 3; k++){
      const a = t * 1.4 + k * 2.09, x = 0.7 * Math.cos(a), y = -0.4 + 0.2 * Math.sin(a), sz = 0.2 + 0.05 * Math.sin(a), fl = Math.sin(t * 14 + k);
      g.save(); g.translate(x, y); g.scale(sz, sz); g.fillStyle = '#1c0b2b';
      for (const s of [-1, 1]){
        g.beginPath(); g.moveTo(0, 0);
        g.quadraticCurveTo(s * 0.5, -0.5 * fl - 0.2, s * 1.0, -0.15 * fl);
        g.quadraticCurveTo(s * 0.75, 0.05, s * 0.6, 0.25); g.quadraticCurveTo(s * 0.45, 0.1, s * 0.3, 0.3);
        g.quadraticCurveTo(s * 0.18, 0.12, 0, 0.2); g.fill();
      }
      g.beginPath(); g.ellipse(0, 0.05, 0.16, 0.24, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.moveTo(-0.12, -0.12); g.lineTo(-0.08, -0.3); g.lineTo(-0.02, -0.14); g.moveTo(0.12, -0.12); g.lineTo(0.08, -0.3); g.lineTo(0.02, -0.14); g.fill();
      g.fillStyle = '#ff3355'; g.fillRect(-0.08, -0.04, 0.05, 0.05); g.fillRect(0.03, -0.04, 0.05, 0.05);
      g.restore();
    }
    E.noGlow();
  },
  // ---------- гламур ----------
  tiara(g, f, t, t0, E){
    g.translate(0, 0.008 * Math.sin(t * 2));
    g.strokeStyle = lg(g, -0.36, 0, 0.36, 0, [[0, '#b9c0d4'], [0.5, '#ffffff'], [1, '#b9c0d4']]); g.lineWidth = 0.032;
    g.beginPath(); g.moveTo(-0.36, 0.03); g.quadraticCurveTo(0, -0.1, 0.36, 0.03); g.stroke();
    const gems = [[-0.28, 0.0, 0.05, '#ff7eb6'], [-0.16, -0.06, 0.07, '#7ee8ff'], [0, -0.13, 0.095, '#ff5fa2'], [0.16, -0.06, 0.07, '#7ee8ff'], [0.28, 0.0, 0.05, '#ff7eb6']];
    for (const [x, y, h, c] of gems){
      g.fillStyle = lg(g, x, y - h, x, y + 0.02, [[0, '#ffffff'], [1, '#c8cde0']]);
      g.beginPath(); g.moveTo(x - 0.04, y + 0.02); g.lineTo(x, y - h - 0.07); g.lineTo(x + 0.04, y + 0.02); g.closePath(); g.fill();
      E.glow(c, 0.06); g.fillStyle = rg(g, x - 0.008, y - h - 0.02, 0.003, 0.038, [[0, '#ffffff'], [0.5, c], [1, c]]);
      g.beginPath(); g.arc(x, y - h - 0.02, 0.033, 0, Math.PI * 2); g.fill(); E.noGlow();
    }
    for (let i = 0; i < 4; i++){ const k = Math.max(0, Math.sin(t * 3.2 + i * 1.7)); sparkle(g, -0.3 + i * 0.2, -0.17 - 0.02 * (i % 2), 0.045 * k, '#fff'); }
  },
  hearts(g, f, t, t0, E){
    E.glow('#ff4fa8', 0.14);
    g.strokeStyle = '#ff7cc4'; g.lineWidth = 0.022; g.beginPath(); g.ellipse(0, -0.32, 0.46, 0.1, 0, 0, Math.PI * 2); g.stroke();
    E.noGlow();
    const items = [];
    for (let i = 0; i < 6; i++){ const a = t * 1.3 + i * Math.PI / 3; items.push({x: 0.46 * Math.cos(a), y: -0.32 + 0.1 * Math.sin(a), z: Math.sin(a)}); }
    items.sort((a, b) => a.z - b.z);
    for (const it of items){
      const near = 0.5 + 0.5 * it.z, s = 0.1 + 0.07 * near;
      g.globalAlpha = 0.55 + 0.45 * near; E.glow('#ff2d92', 0.07);
      heart(g, it.x, it.y, s, lg(g, it.x, it.y - s, it.x, it.y + s, [[0, '#ff9ad0'], [1, '#ff2d92']]), '#ffd0ea');
      E.noGlow();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < 5; i++) sparkle(g, -0.4 + i * 0.2, -0.58 + 0.06 * Math.sin(i * 2 + t), 0.04 * tw(t, 4, i), '#ffe6f5');
  },
  catbow(g, f, t, t0, E){
    catEars(g, t, '#ff8fb3', '#14121a', 0.9);
    for (const s of [-1, 1]){
      g.save(); g.translate(s * 0.36, -0.1); g.rotate(s * 0.35 + 0.05 * Math.sin(t * 2));
      for (const q of [-1, 1]){
        g.fillStyle = lg(g, 0, 0, q * 0.16, 0, [[0, '#ff3d94'], [1, '#ff8cc6']]);
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(q * 0.1, -0.12, q * 0.17, -0.06); g.quadraticCurveTo(q * 0.2, 0.02, q * 0.17, 0.07); g.quadraticCurveTo(q * 0.1, 0.13, 0, 0); g.fill();
      }
      g.fillStyle = '#d4207a'; g.beginPath(); g.arc(0, 0, 0.035, 0, Math.PI * 2); g.fill();
      sparkle(g, 0.04, -0.03, 0.025 * tw(t, 5, s), '#fff');
      g.restore();
    }
  },
  // ---------- мемы ----------
  fembo(g, f, t, t0, E){
    const sw = 0.04 * Math.sin(t * 1.6);
    g.strokeStyle = '#ff6fb5'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(-0.46, 0.12); g.quadraticCurveTo(0, -0.14, 0.46, 0.12); g.stroke();
    g.save(); g.translate(0, -0.08); g.rotate(sw);
    g.strokeStyle = '#d9d9e6'; g.lineWidth = 0.018; g.beginPath(); g.moveTo(-0.18, 0); g.lineTo(-0.18, -0.12); g.moveTo(0.18, 0); g.lineTo(0.18, -0.12); g.stroke();
    E.glow('#ff2fa0', 0.12);
    g.fillStyle = '#1a0b2a'; rrect(g, -0.38, -0.4, 0.76, 0.28, 0.07); g.fill();
    g.strokeStyle = '#ff5fb8'; g.lineWidth = 0.022; rrect(g, -0.38, -0.4, 0.76, 0.28, 0.07); g.stroke();
    g.fillStyle = '#fff0fa'; mtext(g, 'ФЕМБОЙ', 0, -0.26, 0.15);
    E.noGlow();
    heart(g, 0.3, -0.43, 0.07 + 0.01 * Math.sin(t * 6), '#ff4fa8', '#ffd0ea');
    sparkle(g, -0.35, -0.42, 0.04 * tw(t, 5), '#fff');
    g.restore();
  },
  klub(g, f, t, t0, E){
    const sw = 0.05 * Math.sin(t * 1.4);
    g.strokeStyle = '#2b2b30'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(-0.46, 0.12); g.quadraticCurveTo(0, -0.14, 0.46, 0.12); g.stroke();
    g.save(); g.translate(0, -0.06); g.rotate(sw);
    g.strokeStyle = '#9a9aa6'; g.lineWidth = 0.014; g.setLineDash([0.025, 0.018]);
    g.beginPath(); g.moveTo(-0.28, 0); g.lineTo(-0.28, -0.1); g.moveTo(0.28, 0); g.lineTo(0.28, -0.1); g.stroke(); g.setLineDash([]);
    g.fillStyle = lg(g, 0, -0.56, 0, -0.1, [[0, '#26262c'], [1, '#0e0e12']]); rrect(g, -0.42, -0.58, 0.84, 0.48, 0.05); g.fill();
    g.strokeStyle = '#d4182b'; g.lineWidth = 0.026; rrect(g, -0.395, -0.555, 0.79, 0.43, 0.04); g.stroke();
    for (let i = 0; i < 11; i++){
      const on = Math.sin(t * 6 - i * 0.7) > 0, x = -0.37 + i * 0.074;
      g.fillStyle = on ? '#fff3a0' : '#6b5a20'; g.beginPath(); g.arc(x, -0.585, 0.011, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(x, -0.095, 0.011, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#ffffff'; mtext(g, 'КЛУБ', 0, -0.44, 0.135);
    g.fillStyle = '#ff3045'; mtext(g, 'БЕЗ БАБ', 0, -0.27, 0.135);
    sparkle(g, -0.34, -0.2, 0.025, '#d4182b'); sparkle(g, 0.34, -0.2, 0.025, '#d4182b');
    g.restore();
  },
  mustache(g, f, t){
    // между носом и верхней губой, выше губы — рот не закрываем
    const y = Math.min((f.nose.y + f.lip.y) / 2, f.lip.y - 0.045), x = (f.nose.x + f.lip.x) / 2, w = 0.32;
    g.save(); g.translate(x, y); g.rotate(0.02 * Math.sin(t * 2));
    g.fillStyle = lg(g, 0, -0.06, 0, 0.05, [[0, '#4a2c16'], [1, '#1c0f06']]);
    for (const s of [-1, 1]){
      g.beginPath(); g.moveTo(0, -0.012);
      g.bezierCurveTo(s * 0.05, -0.06, s * 0.17, -0.05, s * w, -0.02);
      g.bezierCurveTo(s * (w + 0.06), 0.0, s * (w + 0.05), -0.07, s * (w - 0.02), -0.09);
      g.bezierCurveTo(s * 0.26, 0.03, s * 0.12, 0.05, 0, 0.022);
      g.closePath(); g.fill();
    }
    g.strokeStyle = '#8a5a30'; g.lineWidth = 0.008; g.beginPath(); g.moveTo(0.04, -0.02); g.quadraticCurveTo(0.14, -0.04, 0.24, -0.03); g.moveTo(-0.04, -0.02); g.quadraticCurveTo(-0.14, -0.04, -0.24, -0.03); g.stroke();
    g.restore();
  },
  clown(g, f, t){
    const cols = ['#ff5a1f', '#ffb000', '#ff3d6e'];
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++){
      const x = s * (0.58 + 0.07 * (i % 2)), y = -0.1 + i * 0.16 + 0.012 * Math.sin(t * 3 + i + s), r = 0.15 - 0.012 * i;
      g.fillStyle = rg(g, x - 0.02, y - 0.02, 0.01, r, [[0, '#fff'], [0.25, cols[i % 3]], [1, cols[(i + 1) % 3]]]); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const pop = 1 + 0.04 * Math.sin(t * 6), r = 0.095 * pop;
    g.fillStyle = rg(g, f.nose.x - 0.03, f.nose.y - 0.03, 0.005, r * 1.2, [[0, '#ffb0b0'], [0.25, '#ff2a2a'], [1, '#a00808']]);
    g.beginPath(); g.arc(f.nose.x, f.nose.y, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffffcc'; g.beginPath(); g.ellipse(f.nose.x - 0.03, f.nose.y - 0.035, 0.02, 0.012, -0.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff3d6e'; g.beginPath(); g.arc(0.0, -0.1, 0.07, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-0.02, -0.12, 0.02, 0, Math.PI * 2); g.fill();
  },
  // ---------- аниме ----------
  cat(g, f, t){ catEars(g, t, '#ff9cc0', '#15131a', 1); },
  bunny(g, f, t){
    for (const s of [-1, 1]){
      const bend = s * (0.12 + 0.05 * Math.sin(t * 1.7 + s)) + (s > 0 ? 0.35 : 0);   // правое ушко с «заломом»
      g.save(); g.translate(s * 0.2, 0.0); g.rotate(s * 0.14);
      g.fillStyle = lg(g, -0.1, -0.3, 0.1, -0.3, [[0, '#f0ecf5'], [1, '#ffffff']]);
      g.beginPath(); g.moveTo(-0.1, 0.04); g.bezierCurveTo(-0.15, -0.3, -0.1, -0.62, bend * 0.2, -0.68); g.bezierCurveTo(0.12 + bend * 0.1, -0.6, 0.15, -0.3, 0.1, 0.04); g.closePath(); g.fill();
      g.fillStyle = lg(g, 0, 0, 0, -0.6, [[0, '#ff8fb8'], [1, '#ffd0e4']]);
      g.beginPath(); g.moveTo(-0.055, 0.0); g.bezierCurveTo(-0.08, -0.25, -0.05, -0.5, bend * 0.15, -0.56); g.bezierCurveTo(0.07 + bend * 0.08, -0.5, 0.08, -0.25, 0.055, 0.0); g.closePath(); g.fill();
      g.restore();
    }
    g.strokeStyle = '#ff9ec7'; g.lineWidth = 0.03; g.beginPath(); g.moveTo(-0.32, 0.05); g.quadraticCurveTo(0, -0.1, 0.32, 0.05); g.stroke();
  },
  blush(g, f, t){
    // румянец — полупрозрачный, лицо видно; жилка, капля пота, искры
    for (const c of [f.cl, f.cr]){
      g.fillStyle = rg(g, c.x, c.y, 0.005, 0.12, [[0, 'rgba(255,90,130,0.55)'], [1, 'rgba(255,90,130,0)']]); g.beginPath(); g.ellipse(c.x, c.y, 0.12, 0.07, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,60,110,0.6)'; g.lineWidth = 0.012; g.beginPath();
      for (let i = -1; i <= 1; i++){ g.moveTo(c.x + i * 0.05 - 0.02, c.y + 0.03); g.lineTo(c.x + i * 0.05 + 0.02, c.y - 0.03); }
      g.stroke();
    }
    const p = 1 + 0.12 * Math.sin(t * 8);
    g.save(); g.translate(0.34, 0.02); g.scale(p, p); g.strokeStyle = '#ff2a3a'; g.lineWidth = 0.03;
    for (let i = 0; i < 4; i++){ const a = i * Math.PI / 2 + 0.78; g.beginPath(); g.arc(Math.cos(a) * 0.05, Math.sin(a) * 0.05, 0.05, a + Math.PI * 0.75, a + Math.PI * 1.75); g.stroke(); }
    g.restore();
    const d = (t * 0.8) % 1; g.fillStyle = '#9fe3ff'; g.globalAlpha = 0.9 - d * 0.4; g.beginPath(); g.moveTo(-0.34, d * 0.06); g.quadraticCurveTo(-0.28, 0.1 + d * 0.06, -0.34, 0.14 + d * 0.06); g.quadraticCurveTo(-0.4, 0.1 + d * 0.06, -0.34, d * 0.06); g.fill(); g.globalAlpha = 1;
    for (let i = 0; i < 6; i++){ const a = i * 1.05 + t * 0.6; sparkle(g, 0.55 * Math.cos(a), -0.28 + 0.2 * Math.sin(a * 1.3), 0.04 * tw(t, 4, i), i % 2 ? '#fff8a8' : '#ffc6ea'); }
  },
  // ---------- киберпанк ----------
  cyber(g, f, t, t0, E){
    const pulse = 0.6 + 0.4 * Math.sin(t * 4);
    E.glow('#00f0ff', 0.1);
    g.strokeStyle = lg(g, -0.5, 0, 0.5, 0, [[0, '#00f0ff'], [0.5, '#ff2fd0'], [1, '#00f0ff']]); g.lineWidth = 0.035;
    g.beginPath(); g.moveTo(-0.55, 0.45); g.bezierCurveTo(-0.62, -0.35, 0.62, -0.35, 0.55, 0.45); g.stroke();
    E.noGlow();
    for (const s of [-1, 1]){
      const cx = s * 0.57, cy = 0.5;
      g.fillStyle = lg(g, cx - 0.1, cy, cx + 0.1, cy, [[0, '#1a1c2a'], [1, '#2d3050']]); rrect(g, cx - 0.09, cy - 0.16, 0.18, 0.32, 0.07); g.fill();
      E.glow(s > 0 ? '#ff2fd0' : '#00f0ff', 0.08); g.strokeStyle = s > 0 ? '#ff2fd0' : '#00f0ff'; g.lineWidth = 0.014; rrect(g, cx - 0.09, cy - 0.16, 0.18, 0.32, 0.07); g.stroke();
      g.fillStyle = s > 0 ? '#ff7fe6' : '#7fffff'; g.globalAlpha = pulse; g.beginPath(); g.arc(cx, cy, 0.04, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; E.noGlow();
    }
    g.strokeStyle = '#7fffff'; g.lineWidth = 0.01; g.beginPath(); g.moveTo(0.5, 0.0); g.lineTo(0.58, -0.3); g.stroke();
    E.glow('#00f0ff', 0.1); g.fillStyle = '#7fffff'; g.beginPath(); g.arc(0.58, -0.32, 0.025 * (0.7 + 0.5 * pulse), 0, Math.PI * 2); g.fill(); E.noGlow();
  },
  glitch(g, f, t, t0, E){
    const y = -0.32;
    E.glow('#00ffa8', 0.1);
    g.strokeStyle = '#00ffa8'; g.lineWidth = 0.014; g.beginPath(); g.ellipse(0, y, 0.45, 0.1, 0, 0, Math.PI * 2); g.stroke();
    for (let i = 0; i < 24; i++){ const a = i / 24 * Math.PI * 2 + t * 0.8, x = 0.45 * Math.cos(a), yy = y + 0.1 * Math.sin(a), n = i % 4 === 0 ? 0.04 : 0.02; g.beginPath(); g.moveTo(x, yy); g.lineTo(x, yy - n); g.stroke(); }
    E.noGlow();
    g.fillStyle = '#00ffa8'; mtext(g, ['ERR 404', 'NULL', '0xFACE', 'SYNC'][Math.floor(t * 0.9) % 4], 0, y - 0.2 + 0.015 * Math.sin(t * 5), 0.07, '"Courier New", monospace');
    const seed = Math.floor(t * 8);
    for (let i = 0; i < 7; i++){
      const r = Math.sin(seed * 12.99 + i * 78.2) * 43758.5, q = r - Math.floor(r);
      if (q > 0.55) continue;
      const side = i % 2 ? 1 : -1, x = side * (0.55 + 0.1 * q), yy = 0.05 + (i * 0.17) % 0.7, w = 0.08 + 0.18 * q;
      g.fillStyle = ['#ff2fd0', '#00f0ff', '#00ffa8'][i % 3]; g.globalAlpha = 0.8; g.fillRect(side > 0 ? x : x - w, yy, w, 0.025); g.globalAlpha = 1;
    }
  },
  // ---------- головные уборы ----------
  crown(g, f, t){
    const px = 0.055, b = 0.012 * Math.sin(t * 2);
    pixels(g, CROWN, px, -px * 13 / 2, -0.06 - px * 7 + b, {Y: '#f5c400', D: '#a87400', R: '#e0115f', B: '#2b8cff'});
    g.fillStyle = '#fff7b0'; g.fillRect(-px * 5.5, -0.06 - px * 4 + b, px, px);
  },
  cashier(g, f, t){
    // красная кепка с жёлтой полосой и козырьком (без логотипов)
    g.save(); g.translate(0, -0.02);
    g.fillStyle = lg(g, 0, -0.3, 0, 0.05, [[0, '#ff4b3e'], [1, '#c4161c']]);
    g.beginPath(); g.moveTo(-0.5, 0.04); g.bezierCurveTo(-0.52, -0.5, 0.52, -0.5, 0.5, 0.04); g.quadraticCurveTo(0, 0.1, -0.5, 0.04); g.closePath(); g.fill();
    g.strokeStyle = '#8f0d12'; g.lineWidth = 0.009; for (const x of [-0.2, 0, 0.2]){ g.beginPath(); g.moveTo(x * 0.2, -0.41); g.quadraticCurveTo(x * 1.5, -0.2, x * 2.2, 0.03); g.stroke(); }
    g.fillStyle = '#ffd52e'; g.beginPath(); g.moveTo(-0.5, 0.0); g.quadraticCurveTo(0, 0.06, 0.5, 0.0); g.lineTo(0.5, 0.045); g.quadraticCurveTo(0, 0.11, -0.5, 0.045); g.closePath(); g.fill();
    g.fillStyle = '#9e1016'; g.beginPath(); g.arc(0, -0.405, 0.032, 0, Math.PI * 2); g.fill();
    g.fillStyle = lg(g, 0, 0.02, 0, 0.3, [[0, '#9a0e15'], [1, '#e8403a']]);
    g.beginPath(); g.moveTo(-0.5, 0.07); g.bezierCurveTo(-0.3, 0.36, 0.3, 0.36, 0.5, 0.07); g.quadraticCurveTo(0, 0.17, -0.5, 0.07); g.fill();
    g.strokeStyle = '#6f0a10'; g.lineWidth = 0.01; g.beginPath(); g.moveTo(-0.5, 0.07); g.bezierCurveTo(-0.3, 0.36, 0.3, 0.36, 0.5, 0.07); g.stroke();
    g.fillStyle = '#ffffffaa'; g.beginPath(); g.ellipse(-0.2, -0.27, 0.07, 0.022, -0.7, 0, Math.PI * 2); g.fill();
    g.restore();
  },
  witch(g, f, t, t0, E){
    g.save(); g.rotate(0.03 * Math.sin(t * 1.5));
    g.fillStyle = lg(g, 0, -0.8, 0, 0.0, [[0, '#2b1c40'], [1, '#120a1e']]);
    g.beginPath(); g.ellipse(0, -0.05, 0.62, 0.1, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-0.3, -0.07); g.quadraticCurveTo(-0.12, -0.45, 0.02, -0.78); g.quadraticCurveTo(0.22, -0.82, 0.3, -0.68);
    g.quadraticCurveTo(0.14, -0.6, 0.12, -0.5); g.quadraticCurveTo(0.2, -0.3, 0.3, -0.07); g.closePath(); g.fill();
    g.fillStyle = '#7a35c4'; g.fillRect(-0.3, -0.17, 0.6, 0.08);
    g.strokeStyle = '#f5c400'; g.lineWidth = 0.02; g.strokeRect(-0.05, -0.18, 0.1, 0.1);
    for (let i = 0; i < 3; i++) sparkle(g, -0.12 + i * 0.12, -0.38 - i * 0.07, 0.028 * tw(t, 4, i), '#ffe9a0');
    E.glow('#ff9a00', 0.2); flame(g, 0.31, -0.69, 0.07, 0.14, t, 0); E.noGlow();
    g.restore();
  },
  sorting(g, f, t){
    g.save(); g.rotate(0.05 * Math.sin(t * 1.3));
    g.fillStyle = lg(g, -0.3, -0.8, 0.3, 0, [[0, '#7b5232'], [1, '#4a2f1a']]);
    g.beginPath(); g.ellipse(0, -0.05, 0.58, 0.1, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-0.32, -0.07); g.quadraticCurveTo(-0.25, -0.4, -0.08, -0.62); g.quadraticCurveTo(0.05, -0.78, -0.22, -0.8);
    g.quadraticCurveTo(0.12, -0.86, 0.12, -0.6); g.quadraticCurveTo(0.2, -0.35, 0.32, -0.07); g.closePath(); g.fill();
    g.strokeStyle = '#2f1d0e'; g.lineWidth = 0.014;
    g.beginPath(); g.moveTo(-0.15, -0.3); g.quadraticCurveTo(-0.02, -0.26, 0.1, -0.32); g.stroke();
    g.beginPath(); g.moveTo(-0.1, -0.42); g.quadraticCurveTo(0, -0.38, 0.08, -0.44); g.stroke();
    g.fillStyle = '#8c1c1c'; g.fillRect(-0.32, -0.16, 0.64, 0.07);
    g.fillStyle = '#e8b923'; g.fillRect(-0.32, -0.13, 0.64, 0.02);
    g.restore();
  },
};
