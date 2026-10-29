// Маски «надеты на голову» (прототип idei/proto3d/index.html и penni.html, Гео 29.10) — в игре.
// MediaPipe FaceLandmarker (точки + матрица лица) → three.js: голова-окклюдер (сетка лица + череп) пишет только глубину, шапка «надета».
// Система — каноническое лицо MediaPipe в сантиметрах: y вверх, z к камере, верх лба ≈ (0, 8.3, 4.5).
// Деформации лица (Пучеглазик, Шнобель, Пришелец, Мегамозг, Циклоп) — по пикселям кадра; рот и губы — всегда живой кадр.
// Клоун-Пеннивайз — «принцип клоуна»: только краска из атласа генерации на живой сетке лица + светотень с живого кадра + шевелюра + 3D-нос.
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {faceFrame} from './maski.js';

const BASE = new URL('./maski3d/', import.meta.url).href, MBASE = new URL('./maski/', import.meta.url).href;
// ассеты Nano Banana (29.10): координаты в пикселях исходника ow×oh (картинки в игре уменьшены — UV те же)
const ASSET = {
  mult:     {file: '02_mult_glaza_bez.webp', ow: 2048, oh: 2048, eyes: [540, 1160, 1508, 1160], opt: {googly: true}},
  latex:    {file: '01_zayka_latex_cut.webp', ow: 2048, oh: 2048, eyes: [807, 1631, 1242, 1631]},
  ushi:     [{kind: 'face', file: '06_ushi_L.webp', ow: 763, oh: 1115, box: 'all', x0: -13.4, x1: -7.6, yc: 1.6}, {kind: 'face', file: '06_ushi_R.webp', ow: 763, oh: 1115, box: 'all', x0: 7.6, x1: 13.4, yc: 1.6}],
  durshlag: {kind: 'hat', file: 'h_durshlag_cut.webp', ow: 2048, oh: 2048, box: [68, 418, 1981, 1625], x0: -9.8, x1: 9.8, y: 5.6},
  vertolet: {kind: 'hat', file: 'h_vertolet_cut.webp', ow: 2048, oh: 2048, box: [481, 496, 1571, 1546], x0: -8.8, x1: 8.8, y: 5.4},
  wreath:   {kind: 'hat', file: 'o_wreath_cut.webp', ow: 2048, oh: 2048, box: [146, 564, 1886, 1506], x0: -8.9, x1: 8.9, y: 6.0},
};
const HX = 9.0, HT = 14.3, HC = 1.2, TILT = 0.3;   // голова с волосами: шире и выше черепа
const BAND = {
  unicorn: {file: 'unicorn', cx: 100, yt: 190, yw: 290, a: 98.5, ok: 0.85},
  deer:    {file: 'deer',    cx: 190, yt: 200, yw: 300, a: 97.5, ok: 0.8},
  bunny:   {file: 'bunny',   cx: 160, yt: 222, yw: 330, a: 101.5, ok: 0.75},
  hearts:  {file: 'hearts',  cx: 180, yt: 133, yw: 240, a: 104.5, ok: 0.75},
  klub:    {file: 'klub',    cx: 160, yt: 178, yw: 280, a: 102.5, ok: 0.45, text: {lines: ['КЛУБ', 'БЕЗ БАБ'], cx: 159.5, cy: 82.5, bw: 285, bh: 140, ang: 0}},
  fembo:   {file: 'fembo',   cx: 165, yt: 189, yw: 290, a: 98.5, ok: 0.45, text: {lines: ['ФЕМБОЙ'], cx: 159.5, cy: 97, bw: 255, bh: 110, ang: -0.129}},
};
// маски этого модуля (остальные — 2D в maski.js)
export const IDS = new Set(['crown', 'wreath', 'angel', ...Object.keys(BAND), 'clown', 'latex', 'mult', 'cyclop', 'kaki', 'ushi', 'puchi', 'durshlag', 'vertolet', 'shnobel', 'alien', 'mozg']);

// ---------- каноническое лицо: вершины, треугольники, UV ----------
let CV, CF, UV;
async function loadObj(){
  if (CV) return;
  const obj = await (await fetch(BASE + 'canonical_face_model.obj')).text(), VT = [];
  CV = []; CF = []; UV = new Float32Array(468 * 2);
  for (const l of obj.split('\n')){ const p = l.trim().split(/\s+/);
    if (p[0] === 'v') CV.push(p.slice(1, 4).map(Number));
    else if (p[0] === 'vt') VT.push(p.slice(1, 3).map(Number));
    else if (p[0] === 'f'){ const t = p.slice(1, 4).map(s => s.split('/').map(n => parseInt(n) - 1)); CF.push(t.map(a => a[0])); for (const [v, u] of t) if (u >= 0 && VT[u]){ UV[v * 2] = VT[u][0]; UV[v * 2 + 1] = VT[u][1]; } } }
}
// глубина поверхности лица в точке (x,y): взвешенно по ближайшим вершинам; sm — сглаживание (см)
function faceZ(x, y, sm = 0){ let s = 0, w = 0; const near = CV.map(v => [Math.hypot(v[0] - x, v[1] - y), v[2]]).sort((a, b) => a[0] - b[0]).slice(0, sm ? 16 : 6);
  for (const [d, z] of near){ const k = sm ? Math.exp(-d * d / (2 * sm * sm)) : 1 / (d * d + 0.05); s += z * k; w += k; } return s / w; }

// ---------- сцена ----------
let R = null;
function initR(){
  if (R) return R;
  const renderer = new THREE.WebGLRenderer({alpha: true, antialias: true, preserveDrawingBuffer: true});
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(63, 4 / 3, 1, 400);   // камера MediaPipe face geometry: vFOV 63°
  const env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture; scene.environment = env;
  const key = new THREE.DirectionalLight(0xffffff, 1.4); key.position.set(-0.5, 1, 1); scene.add(key); scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const head = new THREE.Group(); head.matrixAutoUpdate = false; scene.add(head);
  // окклюдер: лицо + череп (только глубина); голова чуть «глубже» — надетое на неё не мерцает
  const occ = new THREE.MeshBasicMaterial({colorWrite: false, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2});
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(CV.flat(), 3)); fg.setIndex(CF.flat());
  const faceOcc = new THREE.Mesh(fg, occ); faceOcc.renderOrder = -1; head.add(faceOcc);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), occ); skull.scale.set(7.7, 10.6, 8.0); skull.position.set(0, 1.2, -4.0); skull.renderOrder = -1; head.add(skull);
  const parts = new THREE.Group(); head.add(parts);
  R = {renderer, scene, camera, head, parts, env, w: 0, h: 0};
  return R;
}
const texLoader = new THREE.TextureLoader();
async function loadTex(file){ const t = await texLoader.loadAsync(BASE + file); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }

// ассет-картинка натянута на рельеф лица: px→см по прорезям глаз (они = глаза канонического лица ±3,15 / 2,65)
async function buildPic(a, G){
  const tex = await loadTex(a.file), iw = a.ow, ih = a.oh, opt = a.opt || {}, [ax, ay, bx, by] = a.eyes, k = Math.hypot(bx - ax, by - ay) / 6.3, cx = (ax + bx) / 2, cy = (ay + by) / 2;
  const X = px => (px - cx) / k, Y = py => 2.65 + (cy - py) / k;
  const geo = new THREE.PlaneGeometry(iw / k, ih / k, 100, 100); geo.translate((X(0) + X(iw)) / 2, (Y(0) + Y(ih)) / 2, 0);
  const p = geo.attributes.position, top = opt.top ?? 8.3;
  const surf = (x, y) => { const xe = Math.max(-7.3, Math.min(7.3, x)); let z = faceZ(xe, Math.min(y, top), 1.0) + (opt.lift ?? 0.45); z -= Math.max(0, Math.abs(x) - 7.3) * 0.9; return z; };
  for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i); let z = surf(x, y); if (y > top) z -= (y - top) * (opt.lean ?? 0.18); p.setZ(i, z); }
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map: tex, transparent: true, alphaTest: 0.03, side: THREE.DoubleSide})); m.renderOrder = 1; G.add(m);
  if (opt.googly){
    // глаза-болтунчики: зрачок свободно катается в куполе — падает вниз по наклону головы, глаза врозь
    const pt = await loadTex('02_zrachok.webp');
    for (const [ex, ey] of [[ax, ay], [bx, by]]){ const x0 = X(ex), y0 = Y(ey), pm = new THREE.Mesh(new THREE.PlaneGeometry(500 / k, 500 / k), new THREE.MeshBasicMaterial({map: pt, transparent: true, depthTest: false}));
      pm.position.set(x0, y0, surf(x0, y0) + 0.3); pm.renderOrder = 2; G.add(pm); G.userData.googly = (G.userData.googly || []).concat({pm, x0, y0, max: 125 / k}); }
  }
}
// головные уборы: картинка по рамке предмета — ширина = ширина головы, низ на заданной высоте; огибает голову (лицо + череп)
async function buildHat(a, G){
  const tex = await loadTex(a.file), iw = a.ow, ih = a.oh, [bx0, , bx1, by1] = a.box, k = (bx1 - bx0) / (a.x1 - a.x0), lift = a.lift ?? 0.6;
  const X = px => a.x0 + (px - bx0) / k, Y = py => a.y + (by1 - py) / k;
  const geo = new THREE.PlaneGeometry(iw / k, ih / k, 100, 100); geo.translate((X(0) + X(iw)) / 2, (Y(0) + Y(ih)) / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++){
    const x = p.getX(i), y = p.getY(i), yy = Math.min(y, 9.0), e = Math.max(0, 1 - (x / 8.6) ** 2 - ((yy - 1.2) / 11.6) ** 2);
    let z = -4.0 + 9.6 * Math.sqrt(e) + lift;
    if (Math.abs(x) < 7.3 && yy < 8.4) z = Math.max(z, faceZ(x, yy, 1.2) + lift);
    if (y > 9.0) z -= (y - 9.0) * 0.18;
    if (e === 0) z = Math.min(z, -1.0);
    p.setZ(i, z);
  }
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map: tex, transparent: true, alphaTest: 0.03, side: THREE.DoubleSide})); m.renderOrder = 1; G.add(m);
}
// накладка на лицо по рамке: рамка → [x0,x1] по ширине, центр по высоте yc; лежит на рельефе лица, по бокам (|x|>7.3) — у висков
async function buildFace(a, G){
  const tex = await loadTex(a.file), iw = a.ow, ih = a.oh, [bx0, by0, bx1, by1] = a.box === 'all' ? [0, 0, iw, ih] : a.box, k = (bx1 - bx0) / (a.x1 - a.x0), lift = a.lift ?? 0.5;
  const X = px => a.x0 + (px - bx0) / k, Y = py => a.yc + ((by0 + by1) / 2 - py) / k;
  const geo = new THREE.PlaneGeometry(iw / k, ih / k, 60, 60); geo.translate((X(0) + X(iw)) / 2, (Y(0) + Y(ih)) / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++){ const x = p.getX(i), y = p.getY(i), xe = Math.max(-7.3, Math.min(7.3, x)); p.setZ(i, Math.abs(x) > 7.3 ? Math.max(0.3, faceZ(xe, y, 1.2) + lift - (Math.abs(x) - 7.3) * 0.4) : faceZ(xe, y, 1.2) + lift); }
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map: tex, transparent: true, alphaTest: 0.03, side: THREE.DoubleSide})); m.renderOrder = 1; G.add(m);
}
// ободок — плоская карточка в поперечной плоскости головы; дуга картинки ложится на сечение головы с волосами, ножки гаснут к вискам
async function buildBand(key, G){
  const c = BAND[key], img = new Image(); img.crossOrigin = 'anonymous'; img.src = MBASE + c.file + '.webp'; await img.decode();
  const iw = img.naturalWidth, ih = img.naturalHeight, cv = document.createElement('canvas'); cv.width = iw; cv.height = ih; const x = cv.getContext('2d', {willReadFrequently: true}); x.drawImage(img, 0, 0);
  const k = HX / c.a, ky = k, ok = c.ok || 1, TR = 40, sx = py => py >= c.yt ? 1 : py <= c.yt - TR ? ok : ok + (1 - ok) * (py - c.yt + TR) / TR;
  const Y = py => py >= c.yt ? HT - (py - c.yt) * ky : py >= c.yt - TR ? HT + (c.yt - py) * k * (1 + sx(py)) / 2 : HT + TR * k * (1 + ok) / 2 + (c.yt - TR - py) * k * ok;
  { // ножки гаснут мягким градиентом; кайма вырезки (полупрозрачные жёлто-зелёные пиксели) — прочь, край сжат на 1 px
    const d = x.getImageData(0, 0, iw, ih), D = d.data, A0 = new Uint8ClampedArray(iw * ih); for (let i = 0; i < iw * ih; i++) A0[i] = D[i * 4 + 3];
    const fy0 = c.yt + (HT - 11.8) / ky, fy1 = c.yt + (HT - 9.6) / ky;
    for (let y = 0; y < ih; y++) for (let xx = 0; xx < iw; xx++){ const o = y * iw + xx; let a = A0[o]; if (!a) continue;
      let mn = a; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]){ const X2 = xx + dx, Y2 = y + dy; mn = Math.min(mn, X2 < 0 || Y2 < 0 || X2 >= iw || Y2 >= ih ? 0 : A0[Y2 * iw + X2]); }
      const r = D[o * 4], g2 = D[o * 4 + 1], b2 = D[o * 4 + 2]; if (a < 250 && g2 > b2 + 20 && g2 >= r * 0.9) a = 0; else a = Math.min(a, mn + 40);
      if (y > fy0){ const w = Math.max(0, Math.min(1, (fy1 - y) / (fy1 - fy0))); a *= w * w * (3 - 2 * w); }
      D[o * 4 + 3] = a; }
    x.putImageData(d, 0, 0); }
  if (c.text){ const t = c.text, F = '"Arial Black", Impact, Arial, sans-serif'; x.font = `900 100px ${F}`; const mw = Math.max(...t.lines.map(l => x.measureText(l).width)), fs = Math.min(t.bw / mw * 100, t.bh / (t.lines.length * 1.08));
    x.save(); x.translate(t.cx, t.cy); x.rotate(t.ang); x.scale(-1, 1); x.font = `900 ${fs}px ${F}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#0b0b0b';
    t.lines.forEach((l, i) => x.fillText(l, 0, (i - (t.lines.length - 1) / 2) * fs * 1.08 + fs * 0.04)); x.restore(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const NY = Math.round(ih / 2), geo = new THREE.PlaneGeometry(1, 1, 1, NY), p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++){ const u = uv.getX(i), v = uv.getY(i), px = u * iw, py = (1 - v) * ih; p.setXYZ(i, (px - c.cx) * k * sx(py), Y(py) - HC, 0); }
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({map: tex, transparent: true, alphaTest: 0.03, side: THREE.DoubleSide})); m.renderOrder = 1;
  const grp = new THREE.Group(); grp.position.set(0, HC, -4.0); grp.rotation.x = TILT; grp.add(m); G.add(grp);
}
// корона (прежняя из игры, кодом, 1:1 по пикселям): карточка на макушке 3D-головы
function buildCrown(G){
  const ROWS = ['Y.....Y.....Y', 'YY...YYY...YY', 'YYY.YYYYY.YYY', 'YYYYYYYYYYYYY', 'YRYYBYYYBYYRY', 'YYYYYYYYYYYYY', 'DDDDDDDDDDDDD'], pal = {Y: '#f5c400', D: '#a87400', R: '#e0115f', B: '#2b8cff'}, px = 40;
  const cv = document.createElement('canvas'); cv.width = 13 * px; cv.height = 7 * px; const x = cv.getContext('2d');
  ROWS.forEach((r, j) => [...r].forEach((ch, i) => { if (pal[ch]){ x.fillStyle = pal[ch]; x.fillRect(i * px, j * px, px + 0.5, px + 0.5); } }));
  x.fillStyle = '#fff7b0'; x.fillRect(1.5 * px, 3 * px, px, px);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const w = 12.5, h = w * 7 / 13, m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: tex, transparent: true, side: THREE.DoubleSide})); m.renderOrder = 1;
  m.position.set(0, HT - 2.2 + h / 2 - HC, 0); const grp = new THREE.Group(); grp.position.set(0, HC, -4.0); grp.rotation.x = TILT; grp.add(m); G.add(grp);
}
// нимб: карточка над макушкой (центр кольца на 2,6 см выше головы), ширина 14 см, слегка отклонён назад
async function buildHalo(G){
  const img = new Image(); img.crossOrigin = 'anonymous'; img.src = MBASE + 'angel.webp'; await img.decode();
  const tex = new THREE.Texture(img); tex.needsUpdate = true; tex.colorSpace = THREE.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const w = 14, h = w * img.naturalHeight / img.naturalWidth, m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: tex, transparent: true, side: THREE.DoubleSide, depthTest: false}));
  m.position.set(0, HT + 2.6, -3.0); m.rotation.x = -0.15; m.renderOrder = 2; G.add(m);
}

// ---------- Пеннивайз: грим в UV на живой сетке лица ----------
const OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
const LIPP = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const EYE_A = [33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7], EYE_B = [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249];
let PN = null;
async function buildPenni(){
  if (PN) return PN;
  const T = 1024, WHITE = [244, 241, 236], paint = document.createElement('canvas'); paint.width = paint.height = T; const pg = paint.getContext('2d', {willReadFrequently: true});
  const U = i => ({x: UV[i * 2] * T, y: (1 - UV[i * 2 + 1]) * T});
  const path = (x, ids) => { x.beginPath(); ids.forEach((i, k) => { const p = U(i); k ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y); }); x.closePath(); };
  const ti = new Image(); ti.crossOrigin = 'anonymous'; ti.src = BASE + 'penni_grim_col.webp'; await ti.decode();
  pg.drawImage(ti, 0, 0, T, T); const d = pg.getImageData(0, 0, T, T), D = d.data;
  // только краска: красные линии — красным, всё остальное — ровные белила; глаза, брови, кожа — живой кадр игрока
  for (let o = 0; o < D.length; o += 4){ const r = D[o], g2 = D[o + 1], b2 = D[o + 2];
    if (r > g2 + 70 && r > b2 + 60){ D[o] = 180; D[o + 1] = 18; D[o + 2] = 28; } else { D[o] = WHITE[0]; D[o + 1] = WHITE[1]; D[o + 2] = WHITE[2]; } }
  pg.putImageData(d, 0, 0);
  { const m = document.createElement('canvas'); m.width = m.height = T; const mx = m.getContext('2d'); mx.fillStyle = '#000'; path(mx, OVAL); mx.filter = 'blur(22px)'; mx.fill();
    pg.globalCompositeOperation = 'destination-in'; pg.drawImage(m, 0, 0); pg.globalCompositeOperation = 'source-over'; }
  { // вырезы: рот (губы с запасом) и глаза по контуру век — край мягкий
    const c = document.createElement('canvas'); c.width = c.height = T; const x = c.getContext('2d'); x.fillStyle = x.strokeStyle = '#000'; x.lineJoin = 'round';
    path(x, LIPP); x.lineWidth = T * 0.045; x.stroke(); x.fill();
    for (const e of [EYE_A, EYE_B]){ path(x, e); x.lineWidth = T * 0.016; x.stroke(); x.fill(); }
    pg.globalCompositeOperation = 'destination-out'; pg.filter = 'blur(5px)'; pg.drawImage(c, 0, 0); pg.filter = 'none'; pg.globalCompositeOperation = 'source-over'; }
  // шевелюра: penni_shevelyura (пучки генерации), размер парика игры 400×355 + 120 px запаса сверху; овал лица вырезан
  const hairImg = new Image(); hairImg.crossOrigin = 'anonymous'; hairImg.src = BASE + 'penni_shevelyura.webp'; await hairImg.decode();
  const HS = document.createElement('canvas'); HS.width = 400; HS.height = 475;
  { const x = HS.getContext('2d');
    x.filter = 'hue-rotate(-8deg) saturate(1.2) brightness(0.95)'; x.drawImage(hairImg, 0, 0, 400, 475); x.filter = 'none';
    const pxW = 400 / 1.6, cx = 200, cy = (0.65 + 0.45) * pxW + 120, rx = 0.5 * pxW, ry = 0.68 * pxW;
    x.globalCompositeOperation = 'destination-out'; x.save(); x.translate(cx, cy); x.scale(1, ry / rx); const k = x.createRadialGradient(0, 0, 0, 0, 0, rx); k.addColorStop(0, '#000'); k.addColorStop(0.88, '#000'); k.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = k; x.beginPath(); x.arc(0, 0, rx, 0, Math.PI * 2); x.fill(); x.restore(); }
  const camP = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1), fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(468 * 3), 3)); fgeo.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); fgeo.setIndex(CF.flat());
  const fcol = new Float32Array(468 * 4).fill(1); fgeo.setAttribute('color', new THREE.BufferAttribute(fcol, 4));
  const ptex = new THREE.CanvasTexture(paint); ptex.colorSpace = THREE.SRGBColorSpace;
  const sceneP = new THREE.Scene(); sceneP.add(new THREE.Mesh(fgeo, new THREE.MeshBasicMaterial({map: ptex, transparent: true, vertexColors: true, side: THREE.DoubleSide, depthTest: false})));
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.45, 48, 32), new THREE.MeshPhysicalMaterial({color: 0xd80e1a, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05}));
  const noseScene = new THREE.Scene(), noseCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000); noseScene.add(nose); noseScene.environment = R.env;
  noseScene.add(new THREE.AmbientLight(0xffffff, 0.5)); { const l = new THREE.DirectionalLight(0xffffff, 1.6); l.position.set(-0.5, 1, 1); noseScene.add(l); }
  const layer = document.createElement('canvas'), shade = document.createElement('canvas');
  PN = {HS, fgeo, fcol, sceneP, camP, nose, noseScene, noseCam, layer, lg: layer.getContext('2d'), shade, sg: shade.getContext('2d', {willReadFrequently: true})};
  return PN;
}
function drawPenni(g, lm, W, H){
  const p = PN, P = k => ({x: lm[k].x * W, y: lm[k].y * H}), f = faceFrame(lm, W, H), {lg, sg, layer, shade} = p;
  if (layer.width !== W || layer.height !== H){ layer.width = shade.width = W; layer.height = shade.height = H; }
  lg.clearRect(0, 0, W, H);
  const pa = p.fgeo.attributes.position.array; for (let k = 0; k < 468; k++){ pa[k * 3] = lm[k].x * 2 - 1; pa[k * 3 + 1] = 1 - lm[k].y * 2; pa[k * 3 + 2] = 0; } p.fgeo.attributes.position.needsUpdate = true;
  // дальняя сторона лица на повороте гаснет (глубже 0,7 ширины лица от кончика носа)
  { const FWn = Math.hypot(lm[454].x - lm[234].x, lm[454].y - lm[234].y); for (let k = 0; k < 468; k++){ const dz = (lm[k].z - lm[1].z) / FWn; p.fcol[k * 4 + 3] = Math.max(0, Math.min(1, (0.85 - dz) / 0.15)); } p.fgeo.attributes.color.needsUpdate = true; }
  // как в прототипе: без тонмаппинга — краска своих цветов
  const r = R.renderer; r.toneMapping = THREE.NoToneMapping; r.render(p.sceneP, p.camP); lg.drawImage(r.domElement, 0, 0);
  lg.save(); lg.globalCompositeOperation = 'destination-out'; lg.beginPath(); LIPP.forEach((k, j) => { const q = P(k); j ? lg.lineTo(q.x, q.y) : lg.moveTo(q.x, q.y); }); lg.closePath(); lg.lineWidth = f.W * 0.05; lg.lineJoin = 'round'; lg.filter = 'blur(2px)'; lg.stroke(); lg.fill(); lg.restore();
  // светотень с живого кадра: серый кадр, нормированный по яркости кожи (тёмная кожа не даёт серый грим), только под гримом, multiply
  sg.globalCompositeOperation = 'source-over'; sg.filter = 'none'; sg.clearRect(0, 0, W, H); sg.drawImage(g.canvas, 0, 0);
  let t = 0, n = 0; for (const k of [50, 280, 151, 9]){ const q = P(k), d = sg.getImageData(Math.round(q.x) - 2, Math.round(q.y) - 2, 5, 5).data; for (let m = 0; m < d.length; m += 4){ t += 0.3 * d[m] + 0.59 * d[m + 1] + 0.11 * d[m + 2]; n++; } }
  const sk = t / Math.max(1, n);
  sg.clearRect(0, 0, W, H); sg.filter = `grayscale(1) brightness(${Math.min(5, 235 / Math.max(25, sk)).toFixed(2)}) contrast(1.3)`; sg.drawImage(g.canvas, 0, 0); sg.filter = 'none';
  sg.globalCompositeOperation = 'destination-in'; sg.drawImage(layer, 0, 0);
  g.save(); g.globalAlpha = 0.9; g.drawImage(layer, 0, 0); g.restore();
  g.save(); g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.75; g.drawImage(shade, 0, 0); g.restore();
  // шевелюра: математика парика игры
  const sq = 1 - 0.3 * Math.min(1, Math.abs(f.yaw)), kh = 1.85 / 400;
  g.save(); g.translate(f.x, f.y); g.rotate(f.ang); g.scale(f.W * sq, f.W); g.translate(-(f.nose.x / sq) * 0.55, -0.6); g.scale(kh, kh); g.translate(-200, -120); g.drawImage(p.HS, 0, 0); g.restore();
  // нос: шар на кончике носа, низ выше верхней губы
  const FW = Math.hypot(P(454).x - P(234).x, P(454).y - P(234).y), tip = P(1), lip = P(0), rad = Math.max(1, Math.min(FW * 0.1, (lip.y - tip.y) * 0.9));
  p.noseCam.left = 0; p.noseCam.right = W; p.noseCam.top = H; p.noseCam.bottom = 0; p.noseCam.updateProjectionMatrix();
  p.nose.scale.setScalar(rad / 1.45); p.nose.position.set(tip.x, H - (tip.y - rad * 0.15), 0);
  r.render(p.noseScene, p.noseCam); r.toneMapping = THREE.ACESFilmicToneMapping; g.drawImage(r.domElement, 0, 0);
}

// ---------- деформации по пикселям ----------
function warp(g, c, R0, s, light = 1){
  const W = g.canvas.width, H = g.canvas.height;
  const Rr = Math.floor(R0); if (!(Rr >= 4)) return; const x0 = Math.round(c.x) - Rr, y0 = Math.round(c.y) - Rr, n = 2 * Rr;
  if (x0 < 0 || y0 < 0 || x0 + n > W || y0 + n > H) return;
  const src = g.getImageData(x0, y0, n, n), S = src.data, o2 = g.createImageData(n, n), O = o2.data, p = 1 + s;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++){
    const dx = x - Rr, dy = y - Rr, d = Math.hypot(dx, dy), o = (y * n + x) * 4;
    if (d >= Rr){ for (let ch = 0; ch < 4; ch++) O[o + ch] = S[o + ch]; continue; }
    const t = d / Rr, k = d ? Math.pow(t, p) * Rr / d : 0, sx = Rr + dx * k, sy = Rr + dy * k, ix = Math.min(n - 2, sx | 0), iy = Math.min(n - 2, sy | 0), fx = sx - ix, fy = sy - iy, l = 1 + (light - 1) * (1 - t) * (1 - t);
    for (let ch = 0; ch < 3; ch++){ const i0 = (iy * n + ix) * 4 + ch; O[o + ch] = Math.min(255, (S[i0] * (1 - fx) * (1 - fy) + S[i0 + 4] * fx * (1 - fy) + S[i0 + n * 4] * (1 - fx) * fy + S[i0 + n * 4 + 4] * fx * fy) * l); }
    O[o + 3] = 255;
  }
  g.putImageData(o2, x0, y0);
}
// радужка ярче: насыщенность и контраст внутри круга r (только тёмная радужка)
function irisPop(g, c, r, amt){
  r = Math.floor(r); if (r < 3) return; const x0 = Math.round(c.x) - r, y0 = Math.round(c.y) - r, n = 2 * r;
  let im; try { im = g.getImageData(x0, y0, n, n); } catch(e){ return; } const D = im.data;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++){
    const d = Math.hypot(x - r, y - r) / r; if (d >= 1) continue; const a = amt * Math.min(1, (1 - d) / 0.35), o = (y * n + x) * 4;
    const Rr = D[o], G = D[o + 1], B = D[o + 2], L = 0.3 * Rr + 0.59 * G + 0.11 * B; if (L > 120) continue;
    for (let ch = 0; ch < 3; ch++){ const v = D[o + ch]; D[o + ch] = Math.max(0, Math.min(255, (L + (v - L) * (1 + 0.35 * a) - 110) * (1 + 0.18 * a) + 110 + 14 * a)); }
  }
  g.putImageData(im, x0, y0);
}
// глаз как миндалина (rx×ry) → увеличен k; возвращает «положить в точку» (мягкий край)
function cutEye(g, c, rx, ry, k){
  const n = Math.ceil(2 * rx * k), cv = document.createElement('canvas'); cv.width = cv.height = Math.max(1, n); const x = cv.getContext('2d');
  x.drawImage(g.canvas, c.x - rx, c.y - rx, 2 * rx, 2 * rx, 0, 0, n, n); x.globalCompositeOperation = 'destination-in';
  x.save(); x.translate(n / 2, n / 2); x.scale(1, ry / rx); const rg = x.createRadialGradient(0, 0, 0, 0, 0, n / 2); rg.addColorStop(0, '#000'); rg.addColorStop(0.62, '#000'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = rg; x.beginPath(); x.arc(0, 0, n / 2, 0, Math.PI * 2); x.fill(); x.restore();
  return d => g.drawImage(cv, d.x - n / 2, d.y - n / 2);
}
// затирка глаза: кусок кожи над глазом, цвет подогнан к коже вокруг глаза, тень от брови сверху; мягкий овал
function eraseEye(g, c, src, rx, ry){
  rx = Math.floor(rx); ry = Math.floor(ry); if (rx < 2 || ry < 2) return; const w = 2 * rx, h = 2 * ry;
  const P = g.getImageData(Math.round(src.x) - rx, Math.round(src.y) - ry, w, h), T = g.getImageData(Math.round(c.x) - rx, Math.round(c.y) - ry, w, h), D = P.data, E = T.data;
  const mean = (d, ring) => { const m = [0, 0, 0]; let n = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const e = Math.hypot((x - rx) / rx, (y - ry) / ry); if (ring ? (e > 0.85 && e < 1) : e < 0.8){ const o = (y * w + x) * 4; m[0] += d[o]; m[1] += d[o + 1]; m[2] += d[o + 2]; n++; } } return m.map(v => v / Math.max(n, 1)); };
  const ms = mean(D, false), mt = mean(E, true);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){
    const e = Math.hypot((x - rx) / rx, (y - ry) / ry); if (e >= 1) continue; const a = Math.min(1, (1 - e) / 0.55), o = (y * w + x) * 4, sh = 0.9 + 0.1 * (y / h);
    for (let ch = 0; ch < 3; ch++){ const v = (D[o + ch] - ms[ch] + mt[ch]) * sh; E[o + ch] = E[o + ch] * (1 - a) + v * a; }
  }
  g.putImageData(T, Math.round(c.x) - rx, Math.round(c.y) - ry);
}
// поле смещений (плавное, без линзы и ступенек): выход q берёт пиксель исходника из q − d(q), билинейно; исходник — та же рамка
function field(g, x0, y0, x1, y1, d){
  const W = g.canvas.width, H = g.canvas.height;
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1)); const w = x1 - x0, h = y1 - y0; if (w < 4 || h < 4) return;
  const src = g.getImageData(x0, y0, w, h), S = src.data, out = g.createImageData(w, h), O = out.data; O.set(S);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++){ const [dx, dy] = d(x0 + x, y0 + y); if (Math.abs(dx) + Math.abs(dy) < 0.05) continue;
    const sx = Math.max(0, Math.min(w - 1.001, x - dx)), sy = Math.max(0, Math.min(h - 1.001, y - dy)), ix = sx | 0, iy = sy | 0, fx = sx - ix, fy = sy - iy, o = (y * w + x) * 4;
    for (let c = 0; c < 3; c++){ const i0 = (iy * w + ix) * 4 + c; O[o + c] = S[i0] * (1 - fx) * (1 - fy) + S[i0 + 4] * fx * (1 - fy) + S[i0 + w * 4] * (1 - fx) * fy + S[i0 + w * 4 + 4] * fx * fy; } }
  g.putImageData(out, x0, y0);
}
const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };

function warps2d(g, id, lm, W, H){
  const LPx = i => ({x: lm[i].x * W, y: lm[i].y * H}), FW = Math.hypot((lm[454].x - lm[234].x) * W, (lm[454].y - lm[234].y) * H);
  const safeR = (c, Rr) => Math.min(Rr, Math.min(...LIPP.map(i => Math.hypot(LPx(i).x - c.x, LPx(i).y - c.y))) - FW * 0.03);
  if (id === 'puchi'){ const cut = lm[1].y * H;
    for (const [i, o, n, u, l] of [[468, 33, 133, 159, 145], [473, 263, 362, 386, 374]]){
      const c = LPx(i), w = Math.hypot(LPx(n).x - LPx(o).x, LPx(n).y - LPx(o).y), open = Math.min(1, Math.hypot(LPx(u).x - LPx(l).x, LPx(u).y - LPx(l).y) / w / 0.3), vis = Math.min(1, w / (FW * 0.2));
      // почти закрыт или дальний глаз на повороте — не трогаем
      if (open < 0.2 || vis < 0.7) continue;
      warp(g, c, Math.min(FW * 0.25 * vis, cut - c.y), 1.1 * open, 1.07); if (vis > 0.75) irisPop(g, c, FW * 0.1, 1);
    } }
  if (id === 'cyclop'){   // свой глаз на лбу (снят до затирки) + свои глаза затёрты кожей со лба над глазом
    const own = cutEye(g, LPx(468), FW * 0.11, FW * 0.065, 3.0), up = {x: (LPx(9).x + LPx(151).x) / 2, y: (LPx(9).y + LPx(151).y) / 2};
    for (const i of [468, 473]){ const e = LPx(i); eraseEye(g, e, {x: e.x, y: e.y - FW * 0.2}, FW * 0.16, FW * 0.09); }
    own(up);
  }
  if (id === 'shnobel'){ const a4 = LPx(4), a6 = LPx(6), c = {x: a4.x * 0.7 + a6.x * 0.3, y: a4.y * 0.7 + a6.y * 0.3}; warp(g, c, safeR(c, FW * 0.34), 1.7, 1.03); }
  if (id === 'mozg'){   // лоб от бровей до линии волос растягивается вверх ×1,8 — только по высоте; над лбом всё сдвигается целиком; к вискам и выше головы гаснет
    const up = {x: (LPx(10).x - LPx(152).x), y: (LPx(10).y - LPx(152).y)}, ul = Math.hypot(up.x, up.y) || 1; up.x /= ul; up.y /= ul;
    const side = {x: -up.y, y: up.x}, ctr = LPx(9), along = p => (p.x - ctr.x) * up.x + (p.y - ctr.y) * up.y, across = p => (p.x - ctr.x) * side.x + (p.y - ctr.y) * side.y;
    const brow = Math.max(along(LPx(105)), along(LPx(334))) + FW * 0.04, top = along(LPx(10)) + FW * 0.15, Hf = Math.max(FW * 0.25, top - brow), K = 1.8, ext = Hf * (K - 1);
    const c = LPx(10), sgx = FW * 0.5;
    field(g, c.x - FW * 1.2, c.y - FW * 1.6, c.x + FW * 1.2, c.y + FW * 0.6, (x, y) => { const p = {x, y}, a = along(p); if (a <= brow) return [0, 0];
      const src = a < brow + K * Hf ? brow + (a - brow) / K : a - ext, fade = sstep(top + ext + FW * 1.1, top + ext + FW * 0.4, a);
      const w = Math.exp(-(across(p) ** 2) / (2 * sgx * sgx)) * fade, D = (a - src) * w; return [up.x * D, up.y * D]; });
  }
  if (id === 'alien'){ for (const i of [468, 473]){ const c = LPx(i); warp(g, c, FW * 0.17, 1.15, 1); } const n = LPx(4); warp(g, n, safeR(n, FW * 0.14), -0.55, 1); const c = LPx(151); warp(g, {x: c.x, y: c.y - FW * 0.05}, FW * 0.4, 0.8, 1.03); }
  if (id === 'ushi'){ const c5 = LPx(5); warp(g, c5, Math.min(FW * 0.2, LPx(0).y - c5.y - FW * 0.025), 0.95, 1); warp(g, LPx(151), FW * 0.26, -0.3, 1); }
}
function kaki(g, lm, W, H){   // брови-какашки: коричневая спираль по линии брови
  const LPx = i => ({x: lm[i].x * W, y: lm[i].y * H});
  for (const br of [[70, 63, 105, 66, 107], [300, 293, 334, 296, 336]]){
    const o = LPx(br[0]), n = LPx(br[4]), c = LPx(br[2]), ang = Math.atan2(n.y - o.y, n.x - o.x), w = Math.hypot(n.x - o.x, n.y - o.y) * 1.25;
    g.save(); g.translate(c.x, c.y + w * 0.08); g.rotate(ang > Math.PI / 2 || ang < -Math.PI / 2 ? ang + Math.PI : ang); g.scale(w, w);
    const tier = (y, rx, ry) => { const k = g.createLinearGradient(0, y - ry, 0, y + ry); k.addColorStop(0, '#9a6232'); k.addColorStop(1, '#5a3315');
      g.fillStyle = k; g.strokeStyle = '#3d220d'; g.lineWidth = 0.018; g.beginPath(); g.ellipse(0, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 0.022; g.beginPath(); g.ellipse(-rx * 0.25, y - ry * 0.35, rx * 0.45, ry * 0.35, 0, Math.PI * 1.05, Math.PI * 1.6); g.stroke(); };
    tier(-0.06, 0.5, 0.14); tier(-0.22, 0.37, 0.12); tier(-0.36, 0.24, 0.1);
    g.fillStyle = '#7a4a22'; g.beginPath(); g.moveTo(-0.1, -0.42); g.quadraticCurveTo(0.02, -0.62, 0.12, -0.5); g.quadraticCurveTo(0.04, -0.46, 0.08, -0.4); g.closePath(); g.fill();
    g.restore();
  }
}

// ---------- выбор маски и кадр ----------
const has3d = id => id === 'crown' || id === 'angel' || id === 'latex' || id === 'mult' || BAND[id] || ASSET[id];
let cur = '', ready = '', loading = null;
// готовит сцену маски (асинхронно); пока не готово — draw() рисует только 2D-часть
export function prepare(id){
  if (!IDS.has(id) || id === cur) return loading || Promise.resolve();
  cur = id; ready = '';
  return loading = (async () => {
    await loadObj(); initR();
    const G = new THREE.Group();
    if (id === 'crown') buildCrown(G);
    else if (id === 'angel') await buildHalo(G);
    else if (BAND[id]) await buildBand(id, G);
    else if (id === 'clown') await buildPenni();
    else if (ASSET[id]) for (const a of [].concat(ASSET[id])){ if (a.kind === 'hat') await buildHat(a, G); else if (a.kind === 'face') await buildFace(a, G); else await buildPic(a, G); }
    if (cur !== id) return;
    R.parts.clear(); R.parts.add(G); R.parts.userData = G.userData; ready = id;
  })().catch(e => { console.warn('maski3d', id, e); if (cur === id) cur = ''; }).finally(() => { loading = null; });
}
// кадр: g — холст с кадром камеры; lm — точки лица; M — матрица лица (16 чисел) или null
export function draw(g, id, lm, M){
  if (!lm || !IDS.has(id)) return;
  if (cur !== id) prepare(id);
  const W = g.canvas.width, H = g.canvas.height;
  try { warps2d(g, id, lm, W, H); } catch(e){}
  if (ready !== id) return;
  if (R.w !== W || R.h !== H){ R.renderer.setSize(W, H, false); R.camera.aspect = W / H; R.camera.updateProjectionMatrix(); R.w = W; R.h = H; }
  if (id === 'clown'){ drawPenni(g, lm, W, H); return; }
  if (id === 'kaki'){ kaki(g, lm, W, H); return; }
  if (!has3d(id) || !M) return;
  R.head.matrix.fromArray(M); R.head.matrixWorldNeedsUpdate = true;
  const gg = R.parts.userData.googly;
  if (gg){ const dn = new THREE.Vector3(0, -1, 0).transformDirection(new THREE.Matrix4().copy(R.head.matrix).invert());   // «вниз» в системе головы
    gg.forEach((e, j) => { const a = Math.atan2(dn.y, dn.x) + (j ? 0.55 : -0.35), r = e.max * 0.95; e.pm.position.x = e.x0 + Math.cos(a) * r; e.pm.position.y = e.y0 + Math.sin(a) * r; }); }
  R.renderer.render(R.scene, R.camera); g.drawImage(R.renderer.domElement, 0, 0);
}
