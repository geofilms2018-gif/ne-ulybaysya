// Маски «Не улыбайся»: рисуются кодом поверх кадра по точкам FaceLandmarker.
// Система координат маски: начало — верх лба (точка 10), ось x — от правой щеки к левой (234→454),
// единица — ширина лица. y растёт вниз. Рот, щёки и подбородок (y > ~0.55 при |x| < 0.5) не трогаем никогда.

export const MASKS = [
  {id: 'horns',   name: 'Рожки',          free: true},
  {id: 'crown',   name: 'Корона',         free: true},
  {id: 'cat',     name: 'Ушки',           free: true},
  {id: 'witch',   name: 'Ведьма'},
  {id: 'bats',    name: 'Мыши'},
  {id: 'halohorn',name: 'Нимб и рожки'},
  {id: 'deal',    name: 'Deal'},
  {id: 'fire',    name: 'Огонь'},
  {id: 'spider',  name: 'Паук'},
  {id: 'pumpkin', name: 'Тыква'},
  {id: 'sorting', name: 'Шляпа'},
  {id: 'shades',  name: 'Очки'},
  {id: 'fairy',   name: 'Фея'},
  {id: 'halo',    name: 'Нимб'},
  {id: 'tiara',   name: 'Тиара'},
  {id: 'catbow',  name: 'Ушки с бантом'},
  {id: 'hornfl',  name: 'Рожки в цветах'},
];

const P = (lm, i, w, h) => ({x: lm[i].x * w, y: lm[i].y * h});

// кадр лица в пикселях: где верх лба, какой наклон, какая ширина, где глаза (в координатах маски)
export function faceFrame(lm, w, h){
  const top = P(lm, 10, w, h), L = P(lm, 234, w, h), R = P(lm, 454, w, h), eL = P(lm, 33, w, h), eR = P(lm, 263, w, h);
  const W = Math.hypot(R.x - L.x, R.y - L.y), ang = Math.atan2(R.y - L.y, R.x - L.x);
  const c = Math.cos(-ang), s = Math.sin(-ang);
  const loc = p => ({x: ((p.x - top.x) * c - (p.y - top.y) * s) / W, y: ((p.x - top.x) * s + (p.y - top.y) * c) / W});
  const a = loc(eL), b = loc(eR);
  return {x: top.x, y: top.y, W, ang, eye: {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, d: Math.hypot(b.x - a.x, b.y - a.y)}};
}
export function previewFrame(size){
  return {x: size / 2, y: size * 0.5, W: size * 0.42, ang: 0, eye: {x: 0, y: 0.42, d: 0.42}};
}

// t — секунды, t0 — когда маску надели (для анимации падения очков)
export function drawMask(g, id, f, t, t0){
  g.save();
  g.translate(f.x, f.y); g.rotate(f.ang); g.scale(f.W, f.W);
  g.lineJoin = 'round'; g.lineCap = 'round';
  const glow = (col, k) => { g.shadowColor = col; g.shadowBlur = f.W * (k || 0.08); };
  const noGlow = () => { g.shadowBlur = 0; };
  try { (DRAW[id] || (() => {}))(g, f, t, t0 || 0, glow, noGlow); } catch(e){}
  g.restore();
}

function pixels(g, rows, px, x0, y0, pal){
  for (let r = 0; r < rows.length; r++) for (let c = 0; c < rows[r].length; c++){
    const col = pal[rows[r][c]]; if (!col) continue;
    g.fillStyle = col; g.fillRect(x0 + c * px, y0 + r * px, px * 1.02, px * 1.02);
  }
}
function horn(g, s, k, fill, stroke){
  g.beginPath();
  g.moveTo(s * 0.17 * k, 0.02);
  g.bezierCurveTo(s * 0.20 * k, -0.18 * k, s * 0.30 * k, -0.30 * k, s * 0.40 * k, -0.42 * k);
  g.bezierCurveTo(s * 0.40 * k, -0.26 * k, s * 0.36 * k, -0.10 * k, s * 0.33 * k, 0.03);
  g.closePath();
  g.fillStyle = fill; g.fill();
  if (stroke){ g.strokeStyle = stroke; g.lineWidth = 0.022; g.stroke(); }
}
function flame(g, x, y, w, h, t, ph){
  const k = 1 + 0.12 * Math.sin(t * 9 + ph) + 0.06 * Math.sin(t * 23 + ph * 3);
  const gr = g.createLinearGradient(x, y, x, y - h * k);
  gr.addColorStop(0, '#ff3b00'); gr.addColorStop(0.5, '#ff9a00'); gr.addColorStop(1, '#fff3a0');
  g.fillStyle = gr;
  g.beginPath();
  g.moveTo(x - w / 2, y);
  g.quadraticCurveTo(x - w * 0.6, y - h * 0.5 * k, x + Math.sin(t * 7 + ph) * w * 0.25, y - h * k);
  g.quadraticCurveTo(x + w * 0.6, y - h * 0.5 * k, x + w / 2, y);
  g.closePath(); g.fill();
}
function bat(g, x, y, sz, t, ph){
  const fl = Math.sin(t * 14 + ph);
  g.save(); g.translate(x, y); g.scale(sz, sz);
  g.fillStyle = '#1c0b2b';
  for (const s of [-1, 1]){
    g.beginPath(); g.moveTo(0, 0);
    g.quadraticCurveTo(s * 0.5, -0.5 * fl - 0.2, s * 1.0, -0.15 * fl);
    g.quadraticCurveTo(s * 0.75, 0.05, s * 0.6, 0.25);
    g.quadraticCurveTo(s * 0.45, 0.1, s * 0.3, 0.3);
    g.quadraticCurveTo(s * 0.18, 0.12, 0, 0.2);
    g.fill();
  }
  g.beginPath(); g.ellipse(0, 0.05, 0.16, 0.24, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ff3355'; g.fillRect(-0.08, -0.04, 0.05, 0.05); g.fillRect(0.03, -0.04, 0.05, 0.05);
  g.restore();
}
function flower(g, x, y, r, col){
  g.fillStyle = col;
  for (let i = 0; i < 5; i++){ const a = i * Math.PI * 2 / 5; g.beginPath(); g.arc(x + Math.cos(a) * r, y + Math.sin(a) * r, r * 0.75, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#ffd84d'; g.beginPath(); g.arc(x, y, r * 0.6, 0, Math.PI * 2); g.fill();
}
function haloRing(g, t, glow, y){
  glow('#ffd84d', 0.15 + 0.05 * Math.sin(t * 3));
  g.strokeStyle = '#ffe680'; g.lineWidth = 0.05;
  g.beginPath(); g.ellipse(0, y + 0.015 * Math.sin(t * 2), 0.3, 0.075, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = '#fff8d0'; g.lineWidth = 0.018; g.stroke();
}
function catEars(g, t, inner){
  for (const s of [-1, 1]){
    const tw = Math.pow(Math.max(0, Math.sin(t * 2.3 + s * 1.7)), 12) * 0.25;
    g.save(); g.translate(s * 0.3, -0.02); g.rotate(s * (0.18 + tw));
    g.fillStyle = '#0d0d0f';
    g.beginPath(); g.moveTo(-0.17, 0.05); g.lineTo(0.0, -0.42); g.lineTo(0.17, 0.05); g.closePath(); g.fill();
    g.fillStyle = inner;
    g.beginPath(); g.moveTo(-0.09, 0.02); g.lineTo(0.0, -0.28); g.lineTo(0.09, 0.02); g.closePath(); g.fill();
    g.restore();
  }
}
function sparkle(g, x, y, r, col){
  g.fillStyle = col; g.beginPath();
  g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
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
const DEAL = [
  'KKKKKKKKKKKKKKKKK',
  '.KWWKKKK.KWWKKKK.',
  '.KKWWKKK.KKWWKKK.',
  '..KKKKK...KKKKK..',
];

const DRAW = {
  horns(g, f, t, t0, glow){
    glow('#ff1f3d', 0.1 + 0.05 * Math.sin(t * 4));
    for (const s of [-1, 1]) horn(g, s, 1, '#3a0008', '#ff2a40');
  },
  crown(g, f, t){
    const px = 0.055, b = 0.012 * Math.sin(t * 2);
    pixels(g, CROWN, px, -px * 13 / 2, -0.06 - px * 7 + b, {Y: '#f5c400', D: '#a87400', R: '#e0115f', B: '#2b8cff'});
    g.fillStyle = '#fff7b0'; g.fillRect(-px * 5.5, -0.06 - px * 4 + b, px, px);   // блик
  },
  cat(g, f, t){ catEars(g, t, '#ff8fb3'); },
  witch(g, f, t, t0, glow, noGlow){
    const sw = 0.03 * Math.sin(t * 1.5);
    g.save(); g.rotate(sw);
    g.fillStyle = '#16101f';
    g.beginPath(); g.ellipse(0, -0.05, 0.62, 0.1, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-0.3, -0.07); g.quadraticCurveTo(-0.12, -0.45, 0.02, -0.78); g.quadraticCurveTo(0.22, -0.82, 0.3, -0.68);
    g.quadraticCurveTo(0.14, -0.6, 0.12, -0.5); g.quadraticCurveTo(0.2, -0.3, 0.3, -0.07); g.closePath(); g.fill();
    g.fillStyle = '#6b2fa8'; g.fillRect(-0.3, -0.17, 0.6, 0.08);
    g.strokeStyle = '#f5c400'; g.lineWidth = 0.018; g.strokeRect(-0.05, -0.18, 0.1, 0.1);
    glow('#ff9a00', 0.2); flame(g, 0.31, -0.69, 0.07, 0.14, t, 0); noGlow();
    g.restore();
  },
  bats(g, f, t, t0, glow){
    glow('#b45cff', 0.1);
    for (let k = 0; k < 3; k++){
      const a = t * 1.4 + k * 2.09, x = 0.66 * Math.cos(a), y = -0.42 + 0.2 * Math.sin(a);
      bat(g, x, y, 0.2 + 0.04 * Math.sin(a), t, k);
    }
  },
  halohorn(g, f, t, t0, glow, noGlow){
    haloRing(g, t, glow, -0.42); noGlow();
    for (const s of [-1, 1]) horn(g, s, 0.7, '#7a0d16', '#c21d2e');
  },
  deal(g, f, t, t0){
    const px = 0.058, k = Math.min(1, Math.max(0, (t - t0) / 0.9)), e = 1 - Math.pow(1 - k, 3);
    const y = f.eye.y - px * 1.5, y0 = -1.6;
    pixels(g, DEAL, px, f.eye.x - px * 17 / 2, y0 + (y - y0) * e, {K: '#000', W: '#fff'});
  },
  fire(g, f, t, t0, glow){
    glow('#ff6a00', 0.12);
    for (let i = 0; i < 7; i++){ const x = -0.42 + i * 0.14; flame(g, x, 0.04, 0.2, 0.28 + 0.12 * Math.abs(Math.sin(i * 1.7)), t, i * 1.3); }
  },
  spider(g, f, t){
    const x = 0.66, y = 0.3 + 0.06 * Math.sin(t * 1.8);
    g.strokeStyle = '#e8e8e8cc'; g.lineWidth = 0.008;
    g.beginPath(); g.moveTo(x, -1.4); g.lineTo(x, y - 0.06); g.stroke();
    g.strokeStyle = '#111'; g.lineWidth = 0.014;
    for (const s of [-1, 1]) for (let i = 0; i < 4; i++){
      const a = -0.7 + i * 0.45, w = 0.02 * Math.sin(t * 6 + i);
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + s * 0.08, y + a * 0.08 - 0.05, x + s * 0.13, y + a * 0.1 + w); g.stroke();
    }
    g.fillStyle = '#111'; g.beginPath(); g.ellipse(x, y, 0.05, 0.06, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x, y - 0.065, 0.03, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ff2040'; g.fillRect(x - 0.018, y - 0.072, 0.012, 0.012); g.fillRect(x + 0.006, y - 0.072, 0.012, 0.012);
  },
  pumpkin(g, f, t, t0, glow, noGlow){
    const y = -0.26;
    g.fillStyle = '#ff7a12';
    for (const [dx, rx] of [[-0.17, 0.17], [0.17, 0.17], [0, 0.2]]){ g.beginPath(); g.ellipse(dx, y, rx, 0.2, 0, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = '#c4520a'; g.lineWidth = 0.012;
    for (const dx of [-0.1, 0.1]){ g.beginPath(); g.ellipse(dx, y, 0.08, 0.19, 0, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#3c7a1e'; g.fillRect(-0.025, y - 0.27, 0.05, 0.09);
    const fl = 0.75 + 0.25 * Math.sin(t * 11) * Math.sin(t * 3.7);
    glow('#ffcc00', 0.12); g.fillStyle = `rgba(255, ${190 + 50 * fl | 0}, 40, 1)`;
    for (const s of [-1, 1]){ g.beginPath(); g.moveTo(s * 0.13, y - 0.07); g.lineTo(s * 0.04, y + 0.03); g.lineTo(s * 0.2, y + 0.03); g.closePath(); g.fill(); }
    g.beginPath(); g.moveTo(-0.15, y + 0.08); for (let i = 0; i <= 6; i++) g.lineTo(-0.15 + i * 0.05, y + 0.08 + (i % 2 ? 0.05 : 0)); g.lineTo(0.15, y + 0.14); g.lineTo(-0.15, y + 0.14); g.closePath(); g.fill();
    noGlow();
  },
  sorting(g, f, t){
    const sw = 0.06 * Math.sin(t * 1.3);
    g.save(); g.rotate(sw);
    g.fillStyle = '#5a3d24';
    g.beginPath(); g.ellipse(0, -0.05, 0.58, 0.1, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-0.32, -0.07); g.quadraticCurveTo(-0.25, -0.4, -0.08, -0.62); g.quadraticCurveTo(0.05, -0.78, -0.22, -0.8);
    g.quadraticCurveTo(0.12, -0.86, 0.12, -0.6); g.quadraticCurveTo(0.2, -0.35, 0.32, -0.07); g.closePath(); g.fill();
    g.strokeStyle = '#3a2614'; g.lineWidth = 0.014;
    g.beginPath(); g.moveTo(-0.15, -0.3); g.quadraticCurveTo(-0.02, -0.26, 0.1, -0.32); g.stroke();
    g.beginPath(); g.moveTo(-0.1, -0.42); g.quadraticCurveTo(0, -0.38, 0.08, -0.44); g.stroke();
    g.fillStyle = '#8c1c1c'; g.fillRect(-0.32, -0.16, 0.64, 0.07);
    g.fillStyle = '#e8b923'; g.fillRect(-0.32, -0.13, 0.64, 0.02);
    g.restore();
  },
  shades(g, f, t, t0, glow, noGlow){
    const e = f.eye, w = Math.max(0.24, e.d * 0.62), y = e.y;
    for (const s of [-1, 1]){
      const cx = e.x + s * e.d / 2;
      const gr = g.createLinearGradient(cx - w / 2, y - 0.1, cx + w / 2, y + 0.1);
      gr.addColorStop(0, '#111a2e'); gr.addColorStop(1, '#2a1640');
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx, y + 0.01, w / 2, 0.1, 0, 0, Math.PI * 2); g.fill();
      glow('#00e5ff', 0.06); g.strokeStyle = '#00e5ff'; g.lineWidth = 0.016; g.stroke(); noGlow();
      const sh = ((t * 0.5 + (s > 0 ? 0.15 : 0)) % 1.6) - 0.3;   // блик бежит по стеклу
      g.save(); g.clip(); g.fillStyle = '#ffffff55';
      g.beginPath(); g.moveTo(cx - w / 2 + sh * w, y - 0.12); g.lineTo(cx - w / 2 + sh * w + 0.05, y - 0.12); g.lineTo(cx - w / 2 + sh * w - 0.03, y + 0.12); g.lineTo(cx - w / 2 + sh * w - 0.08, y + 0.12); g.fill();
      g.restore();
    }
    g.strokeStyle = '#00e5ff'; g.lineWidth = 0.016;
    g.beginPath(); g.moveTo(e.x - e.d / 2 + w / 2, y - 0.02); g.quadraticCurveTo(e.x, y - 0.06, e.x + e.d / 2 - w / 2, y - 0.02); g.stroke();
  },
  fairy(g, f, t, t0, glow, noGlow){
    // крылышки за головой
    const fl = 0.08 * Math.sin(t * 5);
    for (const s of [-1, 1]){
      g.save(); g.translate(s * 0.42, -0.1); g.rotate(s * (0.55 + fl)); g.scale(1.4, 1.4);
      const gr = g.createLinearGradient(0, 0, s * 0.4, -0.4);
      gr.addColorStop(0, '#ffb3f0aa'); gr.addColorStop(1, '#9be8ffaa');
      g.fillStyle = gr; g.strokeStyle = '#ffffffcc'; g.lineWidth = 0.01;
      g.beginPath(); g.ellipse(s * 0.2, -0.22, 0.13, 0.26, s * 0.4, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.ellipse(s * 0.17, 0.08, 0.09, 0.15, -s * 0.5, 0, Math.PI * 2); g.fill(); g.stroke();
      g.restore();
    }
    // маска на глаза с блёстками
    const e = f.eye, w = e.d * 0.75;
    glow('#ff7ee6', 0.08);
    g.fillStyle = '#c86bff';
    g.beginPath(); g.moveTo(e.x - e.d / 2 - w / 2, e.y - 0.02);
    g.quadraticCurveTo(e.x - e.d / 2, e.y - 0.16, e.x, e.y - 0.05);
    g.quadraticCurveTo(e.x + e.d / 2, e.y - 0.16, e.x + e.d / 2 + w / 2, e.y - 0.02);
    g.quadraticCurveTo(e.x + e.d / 2, e.y + 0.11, e.x + 0.03, e.y + 0.04);
    g.quadraticCurveTo(e.x, e.y + 0.02, e.x - 0.03, e.y + 0.04);
    g.quadraticCurveTo(e.x - e.d / 2, e.y + 0.11, e.x - e.d / 2 - w / 2, e.y - 0.02); g.closePath();
    for (const s of [-1, 1]){ g.moveTo(e.x + s * e.d / 2 + 0.075, e.y); g.ellipse(e.x + s * e.d / 2, e.y, 0.075, 0.045, 0, 0, Math.PI * 2); }   // прорези для глаз
    g.fill('evenodd');
    noGlow();
    g.fillStyle = '#fff6a8';
    for (let i = 0; i < 6; i++){ const a = i / 6 * Math.PI, s = i < 3 ? -1 : 1; g.beginPath(); g.arc(e.x + s * (e.d / 2 + 0.11 * Math.cos(a)), e.y - 0.07 - 0.02 * Math.sin(a * 3), 0.01, 0, Math.PI * 2); g.fill(); }   // блёстки
    for (let i = 0; i < 9; i++){
      const a = i * 2.4, r = 0.55 + 0.12 * Math.sin(t + i), tw = 0.5 + 0.5 * Math.sin(t * 6 + i * 1.3);
      const x = Math.cos(a + t * 0.4) * r, y = -0.25 + Math.sin(a + t * 0.4) * 0.3;
      if (y > 0.05 && Math.abs(x) < 0.55) continue;   // искры только вокруг головы, не на лице
      sparkle(g, x, y, 0.035 * tw, '#fff6a8');
    }
  },
  halo(g, f, t, t0, glow){ haloRing(g, t, glow, -0.38); },
  tiara(g, f, t, t0, glow, noGlow){
    const b = 0.01 * Math.sin(t * 2);
    g.strokeStyle = '#e9e4f5'; g.fillStyle = '#e9e4f5'; g.lineWidth = 0.02;
    g.beginPath(); g.moveTo(-0.34, -0.02 + b);
    for (let i = 0; i <= 8; i++){ const x = -0.34 + i * 0.085, h = [0.08, 0.13, 0.1, 0.17, 0.24, 0.17, 0.1, 0.13, 0.08][i]; g.lineTo(x, -0.02 - h + b); g.lineTo(x + 0.042, -0.04 + b); }
    g.stroke();
    glow('#9fe8ff', 0.1);
    const gems = [[-0.17, '#ff7eb6'], [0, '#7ee8ff'], [0.17, '#ff7eb6']];
    for (const [x, c] of gems){ g.fillStyle = c; g.beginPath(); g.ellipse(x, -0.12 + b - (x ? 0 : 0.07), 0.03, 0.04, 0, 0, Math.PI * 2); g.fill(); }
    noGlow();
    for (let i = 0; i < 3; i++){ const tw = Math.max(0, Math.sin(t * 3 + i * 2)); sparkle(g, -0.2 + i * 0.2, -0.3 + b, 0.03 * tw, '#fff'); }
  },
  catbow(g, f, t){
    catEars(g, t, '#ff8fb3');
    g.save(); g.translate(0.3, -0.12); g.rotate(0.3);
    g.fillStyle = '#ff4f9a';
    for (const s of [-1, 1]){ g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 0.14, -0.1, s * 0.14, 0); g.quadraticCurveTo(s * 0.14, 0.1, 0, 0); g.fill(); }
    g.fillStyle = '#d9307a'; g.beginPath(); g.arc(0, 0, 0.03, 0, Math.PI * 2); g.fill();
    g.restore();
  },
  hornfl(g, f, t, t0, glow, noGlow){
    glow('#ff4f7a', 0.06);
    for (const s of [-1, 1]) horn(g, s, 0.85, '#5a0a1e', '#ff5f8a');
    noGlow();
    const sw = 0.01 * Math.sin(t * 2);
    flower(g, -0.24, -0.06 + sw, 0.04, '#ffb3d1'); flower(g, -0.12, -0.03 - sw, 0.032, '#fff'); flower(g, 0.0, -0.02 + sw, 0.036, '#ffd1e6');
    flower(g, 0.13, -0.03 - sw, 0.032, '#fff'); flower(g, 0.25, -0.06 + sw, 0.04, '#ffb3d1');
  },
};
