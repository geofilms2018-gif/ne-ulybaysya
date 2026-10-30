// Нейро-маски «Бэйби» и «Старик» (тест для админа, ветка baby-starik-test; из maski-baby-test, ночь 29→30.10): модель-ученик 256 px (idei/baby_ml/train.py),
// кроп головы по точкам MediaPipe как в FFHQ (тот же quad, что prep.py), вклейка обратно с мягким краем; рот и губы — живой кадр.
// Модель считается асинхронно: пока идёт кадр N, рисуем результат кадра N−1 по точкам текущего кадра — маска не отстаёт от головы.
const U = f => new URL(f, import.meta.url).href;   // модели рядом с модулем: страница может быть и в v2/
const S = 256, FILE = {baby: U('models/child.onnx'), starik: U('models/old.onnx')};
export const IDS = new Set(Object.keys(FILE));
// сеть кожи считается в воркере (nn_worker.js): на iPhone без WebGPU кадр ~0,2 с — в главном потоке игра падала до 3–4 к/с
const sess = {}, sessP = {}, wait = {}, failed = {};
let W = null;
function worker(){
  if (W) return W;
  W = new Worker(U('nn_worker.js'));
  W.onmessage = ({data: m}) => { const w = wait[m.t === 'loaded' ? 'load_' + m.id : 'run']; if (!w) return; delete wait[m.t === 'loaded' ? 'load_' + m.id : 'run']; m.t === 'err' ? w.bad(new Error(m.e)) : w.ok(m); };
  W.onerror = e => { console.warn('maski_nn воркер', e.message || e); for (const k in wait){ wait[k].bad(new Error('worker')); delete wait[k]; } };
  return W;
}
const ask = (k, msg, tr) => new Promise((ok, bad) => { wait[k] = {ok, bad}; worker().postMessage(msg, tr || []); });
export function prepare(id){
  if (!FILE[id] || failed[id] > 2) return Promise.resolve(); meshP;   // сеть не встала трижды — остаёмся на варпе
  return sessP[id] || (sessP[id] = ask('load_' + id, {t: 'load', id, url: FILE[id]}).then(() => sess[id] = true).catch(e => { sessP[id] = null; failed[id] = (failed[id] || 0) + 1; stat.err = String(e.message || e); console.warn('maski_nn', id, e); }));
}
const C = document.createElement('canvas'); C.width = C.height = S; const cx = C.getContext('2d', {willReadFrequently: true});
const R = document.createElement('canvas'); R.width = R.height = S; const rx = R.getContext('2d');
const MK = document.createElement('canvas'); MK.width = MK.height = S;
{ const m = MK.getContext('2d'), g = m.createRadialGradient(S / 2, S * 0.48, S * 0.3, S / 2, S * 0.48, S * 0.5); g.addColorStop(0, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)'); m.fillStyle = g; m.fillRect(0, 0, S, S); }
function quad(P){   // как idei/baby_ml/prep.py
  const eL = P[468], eR = P[473], m = [(P[13].x + P[14].x + P[61].x + P[291].x) / 4, (P[13].y + P[14].y + P[61].y + P[291].y) / 4], ea = [(eL.x + eR.x) / 2, (eL.y + eR.y) / 2];
  const e2m = [m[0] - ea[0], m[1] - ea[1]]; let x = [eR.x - eL.x + e2m[1], eR.y - eL.y - e2m[0]]; const n = Math.hypot(...x); x = [x[0] / n, x[1] / n];
  const s = Math.max(Math.hypot(eR.x - eL.x, eR.y - eL.y) * 2.0, Math.hypot(...e2m) * 1.8); x = [x[0] * s, x[1] * s]; const y = [-x[1], x[0]], c = [ea[0] + e2m[0] * 0.1, ea[1] + e2m[1] * 0.1];
  return {q0: [c[0] - x[0] - y[0], c[1] - x[1] - y[1]], ex: [2 * x[0] / S, 2 * x[1] / S], ey: [2 * y[0] / S, 2 * y[1] / S]};
}
const GUBY = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185];
let busy = false, ready = null, sm = null, lastId = '';
// ---------- варп формы (гибрид): смещения 478 точек из пар базы (idei/baby_ml/disp.py), меш MediaPipe + кольцо без сдвига вокруг овала ----------
const DK = {baby: 'child', starik: 'old'}, GAIN = {baby: 1.0, starik: 1.0}, FORMA = {baby: 1.0, starik: 1.5}, LIPS = new Set([0, 13, 14, 17, 37, 39, 40, 61, 78, 80, 81, 82, 84, 87, 88, 91, 95, 146, 178, 181, 185, 191, 267, 269, 270, 291, 308, 310, 311, 312, 314, 317, 318, 321, 324, 375, 402, 405, 409, 415]);
let MESH = null, DISP = null; const rotSdvig = [0, 0]; const meshP = Promise.all([U('models/mesh.json'), U('models/disp.json')].map(u => fetch(u).then(r => r.json()))).then(([m, d]) => { MESH = m; DISP = d; }).catch(e => console.warn('maski_nn меш', e));
const GLC = document.createElement('canvas'); let gl = null, glTex, glBuf, glUv, glIdx, glN = 0;
function glInit(){
  gl = GLC.getContext('webgl', {premultipliedAlpha: false, preserveDrawingBuffer: true}); if (!gl) return;
  const sh = (t, src) => { const o = gl.createShader(t); gl.shaderSource(o, src); gl.compileShader(o); return o; }, pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 p; attribute vec2 u; uniform vec2 S; varying vec2 v; void main(){ v = u / S; gl_Position = vec4(p / S * vec2(2., -2.) + vec2(-1., 1.), 0., 1.); }'));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, 'precision mediump float; uniform sampler2D t; varying vec2 v; void main(){ gl_FragColor = texture2D(t, v); }'));
  gl.linkProgram(pr); gl.useProgram(pr); gl.prog = pr;
  glTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, glTex); [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.LINEAR)); [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
  glBuf = gl.createBuffer(); glUv = gl.createBuffer(); glIdx = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glIdx); const c0 = 478 + 2 * MESH.oval.length; gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([c0, c0 + 1, c0 + 2, c0, c0 + 2, c0 + 3, ...MESH.tri.flat()]), gl.STATIC_DRAW); glN = MESH.tri.length * 3 + 6;   // сначала весь кадр, сверху меш
}
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// Форма по пропорциям (ресерч res_d.md: ребёнок 4–7 — лоб ×1.10, глаза ×1.07–1.2, нос короче ×0.92, нижняя треть ×0.85–0.9, щёки полнее;
// старик 80–90 — обвисание щёк и брылей, нос и нижняя треть длиннее, брови ниже). loc — точки в системе лица, k — сила. → смещения в IOD.
function forma(id, loc, k){
  const yn = loc[2][1], eyes = [loc[468], loc[473]];
  return loc.map(([x, y], i) => {
    let dx = 0, dy = 0; const ax = Math.abs(x), sg = Math.sign(x);
    if (id === 'baby'){
      dy += y < 0 ? y * 0.10 : y <= yn ? -0.08 * y : -0.08 * yn - 0.15 * (y - yn);                 // лоб выше, нос короче, нижняя треть короче
      for (const e of eyes){ const r = Math.hypot(x - e[0], y - e[1]), s = 0.16 * (1 - ss(0.18, 0.5, r)); dx += (x - e[0]) * s; dy += (y - e[1]) * s; }   // глаза крупнее
      dx += sg * 0.08 * ss(0.45, 0.95, ax) * Math.exp(-(((y - 1.25) / 0.5) ** 2));                 // щёки полнее
      if (ax < 0.35 && y > 0.25 && y < yn + 0.15) dx -= x * 0.15;                                   // нос уже
    } else if (id === 'starik'){
      dy += 0.08 * ss(0.5, 1.6, y) * ss(0.3, 0.85, ax);                                             // щёки и брыли вниз
      dx += sg * 0.045 * ss(1.3, 2.0, y) * ss(0.5, 0.9, ax);                                        // брыли шире
      if (y > -0.5 && y < -0.12) dy += 0.035 * ss(0.15, 0.55, ax);                                  // брови и верхние веки ниже (не центр глаза)
      if (ax < 0.35 && y > 0 && y < yn + 0.1) dy += 0.05 * Math.min(1, y / yn);                     // нос длиннее
      if (y > yn) dy += 0.05 * (y - yn);                                                            // нижняя треть длиннее
    }
    return [dx * k, dy * k];
  });
}
const warp = {gain: null, forma: null};   // для тестов: NN.warp.gain = 0 — без варпа
function warpDraw(g, id, P, v){
  if (!MESH || !DISP || !DISP[DK[id]]){ stat.noMesh = (stat.noMesh || 0) + 1; return; } if (!gl) glInit(); if (!gl){ stat.noGl = (stat.noGl || 0) + 1; return; }
  if (gl.isContextLost()){ stat.lost = (stat.lost || 0) + 1; return; } stat.warp = (stat.warp || 0) + 1;
  const W = g.canvas.width, H = g.canvas.height, d = DISP[DK[id]], G = warp.gain ?? GAIN[id];
  if (GLC.width !== W || GLC.height !== H){ GLC.width = W; GLC.height = H; }
  const eL = P[468], eR = P[473], ox = (eL.x + eR.x) / 2, oy = (eL.y + eR.y) / 2, iod = Math.hypot(eR.x - eL.x, eR.y - eL.y), xa = [(eR.x - eL.x) / iod, (eR.y - eL.y) / iod];
  let ya = [-xa[1], xa[0]]; if ((P[13].x - ox) * ya[0] + (P[13].y - oy) * ya[1] < 0) ya = [-ya[0], -ya[1]];
  const no = MESH.oval.length, n = 478 + 2 * no + 4, pos = new Float32Array(n * 2), uv = new Float32Array(n * 2);
  // смещение каждой точки в системе лица (x — вдоль глаз, y — вниз, единица IOD) = выученное из пар × G + форма по пропорциям (forma)
  const loc = P.map(p => [((p.x - ox) * xa[0] + (p.y - oy) * xa[1]) / iod, ((p.x - ox) * ya[0] + (p.y - oy) * ya[1]) / iod]);
  const D = forma(id, loc, warp.forma ?? FORMA[id]).map((f, i) => [f[0] + (d[i] ? d[i][0] * G : 0), f[1] + (d[i] ? d[i][1] * G : 0)]);
  let lx = 0, ly = 0; LIPS.forEach(i => { lx += D[i][0] / LIPS.size; ly += D[i][1] / LIPS.size; });   // губы — целиком, без растяжения
  rotSdvig[0] = (lx * xa[0] + ly * ya[0]) * iod; rotSdvig[1] = (lx * xa[1] + ly * ya[1]) * iod;
  for (let i = 0; i < 478; i++){ const L = LIPS.has(i), dx = (L ? lx : D[i][0]) * iod, dy = (L ? ly : D[i][1]) * iod;
    uv[i * 2] = P[i].x; uv[i * 2 + 1] = P[i].y; pos[i * 2] = P[i].x + dx * xa[0] + dy * ya[0]; pos[i * 2 + 1] = P[i].y + dx * xa[1] + dy * ya[1]; }
  // два кольца вокруг овала (от кончика носа): ближнее ×1.3 идёт за краем лица на 70 % (шея и волосы без «клина»), дальнее ×2 стоит на месте
  const c = [P[1].x, P[1].y];
  MESH.oval.forEach((i, j) => { const ex = pos[i * 2] - P[i].x, ey = pos[i * 2 + 1] - P[i].y;
    for (const [k, R, f] of [[478 + j, 1.3, 0.7], [478 + no + j, 2.0, 0]]){ const x = c[0] + (P[i].x - c[0]) * R, y = c[1] + (P[i].y - c[1]) * R;
      uv[k * 2] = x; uv[k * 2 + 1] = y; pos[k * 2] = x + ex * f; pos[k * 2 + 1] = y + ey * f; } });
  [[0, 0], [W, 0], [W, H], [0, H]].forEach(([x, y], j) => { const k = n - 4 + j; pos[k * 2] = uv[k * 2] = x; pos[k * 2 + 1] = uv[k * 2 + 1] = y; });
  gl.viewport(0, 0, W, H); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindTexture(gl.TEXTURE_2D, glTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, v);
  const at = (nm, buf, data) => { const l = gl.getAttribLocation(gl.prog, nm); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); };
  at('p', glBuf, pos); at('u', glUv, uv); gl.uniform2f(gl.getUniformLocation(gl.prog, 'S'), W, H);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, glIdx); gl.drawElements(gl.TRIANGLES, glN, gl.UNSIGNED_SHORT, 0);
  g.drawImage(GLC, 0, 0);
}
async function infer(id){
  const px = cx.getImageData(0, 0, S, S).data.buffer;
  const m = await ask('run', {t: 'run', id, px}, [px]), im = new ImageData(new Uint8ClampedArray(m.px), S, S);
  rx.globalCompositeOperation = 'source-over'; rx.putImageData(im, 0, 0); rx.globalCompositeOperation = 'destination-in'; rx.drawImage(MK, 0, 0);
  ready = id;
}
function zhivoyRot(g, P, v){   // рот и губы — всегда живой кадр (правило Гео): внешний контур губ, раздут, мягкий край
  // без filter и source-in: в игре Safari (iPhone) такая маска накрывала живым видео весь кадр и варп пропадал (Гео 30.10).
  // Мягкий край — три вложенных контура с разной прозрачностью, каждый через clip
  const W = g.canvas.width, H = g.canvas.height, [sx, sy] = rotSdvig;
  const m = GUBY.reduce((s, i) => [s[0] + P[i].x / GUBY.length, s[1] + P[i].y / GUBY.length], [0, 0]);
  for (const [kx, ky, a] of [[1.3, 1.45, 0.35], [1.22, 1.35, 0.55], [1.15, 1.25, 1]]){
    g.save(); g.beginPath();
    GUBY.forEach((i, k) => { const x = m[0] + (P[i].x - m[0]) * kx + sx, y = m[1] + (P[i].y - m[1]) * ky + sy; k ? g.lineTo(x, y) : g.moveTo(x, y); });
    g.closePath(); g.clip(); g.globalAlpha = a; g.drawImage(v, sx, sy, W, H); g.restore();
  }
}
export const stat = {n: 0, ms: 0}; export {warp};
export const net = {on: !/[?&]nnkozha=0/.test(location.search)};   // сеть кожи; ?nnkozha=0 или NN.net.on = false — только варп
// g — кадр с уже нарисованной камерой, lm — точки MediaPipe (0..1), v — чистая камера (для живого рта)
export function draw(g, id, lm, v){   // порядок гибрида: сеть кожи на исходном кадре → варп формы по результату → живой рот
  if (!sess[id]) prepare(id);
  if (id !== lastId){ lastId = id; ready = null; sm = null; }
  const W = g.canvas.width, H = g.canvas.height, P = lm.map(p => ({x: p.x * W, y: p.y * H}));
  if (sess[id] && net.on){
    let Q = quad(P); if (sm){ const L = (p, c) => p.map((u, i) => c[i] + (u - c[i]) * 0.6); Q = {q0: L(Q.q0, sm.q0), ex: L(Q.ex, sm.ex), ey: L(Q.ey, sm.ey)}; } sm = Q;
    const [a, b] = Q.ex, [c, d] = Q.ey;
    if (!busy){
      const det = a * d - b * c, ia = d / det, ib = -b / det, ic = -c / det, id2 = a / det;
      cx.setTransform(ia, ib, ic, id2, -(ia * Q.q0[0] + ic * Q.q0[1]), -(ib * Q.q0[0] + id2 * Q.q0[1])); cx.fillStyle = '#000'; cx.fillRect(-1e4, -1e4, 2e4, 2e4); cx.drawImage(v, 0, 0, W, H); cx.setTransform(1, 0, 0, 1, 0, 0);
      busy = stat.busy = true; const t0 = performance.now();
      infer(id).catch(e => console.warn('maski_nn', e)).finally(() => { busy = stat.busy = false; stat.n++; stat.ms = stat.ms * 0.9 + (performance.now() - t0) * 0.1; });
    }
    if (ready === id){ g.save(); g.setTransform(a, b, c, d, Q.q0[0], Q.q0[1]); g.drawImage(R, 0, 0); g.restore(); }
  }
  rotSdvig[0] = rotSdvig[1] = 0; warpDraw(g, id, P, g.canvas);
  zhivoyRot(g, P, v);
}
if (typeof window !== 'undefined') window.__nn = {warp, net, stat};   // для тестов
