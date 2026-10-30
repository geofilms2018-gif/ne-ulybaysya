// Сеть кожи нейро-масок в отдельном потоке (из maski_nn.js). На iPhone нет WebGPU: ONNX считает на wasm ~0,2 с за кадр,
// в главном потоке это стопорило игру до 3–4 кадров/с (Гео 30.10: «Babyface и Старик не работают в игре»). Здесь игра не ждёт сеть.
//   → {t:'load', id, url} ← {t:'loaded', id} | {t:'err', id, e}
//   → {t:'run', id, px: ArrayBuffer RGBA 256×256} ← {t:'out', id, px: ArrayBuffer RGBA} | {t:'err', id, e}
const ORT = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.19.2/dist/';
importScripts(ORT + 'ort.webgpu.min.js');
ort.env.wasm.wasmPaths = ORT;   // в воркере ORT не знает, откуда загружен, — без этого ищет wasm на нашем сайте
ort.env.wasm.numThreads = 1;    // на Pages нет cross-origin isolation — потоков wasm всё равно не будет
const S = 256, sess = {};
onmessage = async ({data: m}) => {
  try {
    if (m.t === 'load'){
      sess[m.id] = sess[m.id] || await ort.InferenceSession.create(m.url, {executionProviders: self.navigator.gpu ? ['webgpu', 'wasm'] : ['wasm']});
      postMessage({t: 'loaded', id: m.id}); return;
    }
    if (m.t === 'run'){
      const px = new Uint8ClampedArray(m.px), inp = new Float32Array(3 * S * S);
      for (let i = 0; i < S * S; i++){ inp[i] = px[i * 4] / 127.5 - 1; inp[S * S + i] = px[i * 4 + 1] / 127.5 - 1; inp[2 * S * S + i] = px[i * 4 + 2] / 127.5 - 1; }
      const y = (await sess[m.id].run({x: new ort.Tensor('float32', inp, [1, 3, S, S])})).y.data, out = new Uint8ClampedArray(S * S * 4);
      for (let i = 0; i < S * S; i++){ out[i * 4] = (y[i] + 1) * 127.5; out[i * 4 + 1] = (y[S * S + i] + 1) * 127.5; out[i * 4 + 2] = (y[2 * S * S + i] + 1) * 127.5; out[i * 4 + 3] = 255; }
      postMessage({t: 'out', id: m.id, px: out.buffer}, [out.buffer]);
    }
  } catch(e){ postMessage({t: 'err', id: m.id, e: String(e && e.message || e)}); }
};
