# e2e автоклипа: свой сервер (ветка avtoklip-15s), мок Telegram, 2 игрока ?sim=1 (улыбка на 45-й секунде раунда), у хоста маска «Корона».
# Проверки: клип собран (2 отрезка), превью на экране итога, «В Телеграм» → бот получил mp4 ~15 с с видео и звуком; «Сохранить» → ссылка; кадры.
import asyncio, sys, json, os, time, hashlib, hmac, urllib.parse, subprocess, tempfile, threading, re, shutil
from http.server import BaseHTTPRequestHandler, HTTPServer
from playwright.async_api import async_playwright
WT = os.path.expanduser('~/Projects/ulybka_avtoklip'); SRV = os.path.expanduser('~/Projects/ulybka_server_avtoklip/server/server.py')
OUT = WT + '/idei/AVTOKLIP_3010/'; os.makedirs(OUT, exist_ok=True)
TOKEN = '123456:TEST_TOKEN_not_real'; PORT, MOCK, WEB = 8802, 8803, 8799
BASE = f'http://localhost:{WEB}/index.html'
A = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
     '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--autoplay-policy=no-user-gesture-required']
res = {'ok': [], 'fail': []}
def ok(c, m): res['ok' if c else 'fail'].append(m); print(('ok   ' if c else 'FAIL ') + m, flush=True)
got = {'calls': [], 'files': []}
class Mock(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        n = int(self.headers.get('Content-Length', 0)); body = self.rfile.read(n); meth = self.path.split('/')[-1]
        if meth in ('sendVideo', 'sendDocument'):
            b = self.headers['Content-Type'].split('boundary=')[1].encode()
            for part in body.split(b'--' + b):
                if b'name="video"' in part[:300] or b'name="document"' in part[:300]:
                    data = part.split(b'\r\n\r\n', 1)[1].rsplit(b'\r\n', 1)[0]; fn = tempfile.mktemp(suffix='.mp4'); open(fn, 'wb').write(data); got['files'].append((meth, fn, time.time()))
        got['calls'].append(meth); out = json.dumps({'ok': True, 'result': {'message_id': 1} if meth != 'getMe' else {'id': 1, 'username': 'bot'}}).encode()
        self.send_response(200); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(out))); self.end_headers(); self.wfile.write(out)
    do_GET = do_POST
def init(uid, name):
    d = {'auth_date': str(int(time.time())), 'query_id': 'AA', 'user': json.dumps({'id': uid, 'first_name': name})}
    c = '\n'.join(f'{k}={d[k]}' for k in sorted(d))
    h = hmac.new(hmac.new(b'WebAppData', TOKEN.encode(), hashlib.sha256).digest(), c.encode(), hashlib.sha256).hexdigest()
    return urllib.parse.quote(urllib.parse.urlencode({**d, 'hash': h}), safe='')
def probe(fn):
    pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', fn], capture_output=True, text=True).stdout or '{}')
    return [s['codec_type'] for s in pr.get('streams', [])], float(pr.get('format', {}).get('duration', 0) or 0)
async def main():
    threading.Thread(target=HTTPServer(('127.0.0.1', MOCK), Mock).serve_forever, daemon=True).start()
    web = subprocess.Popen([sys.executable, '-m', 'http.server', str(WEB), '--directory', WT], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    D = tempfile.mkdtemp(); open(D + '/vip.txt', 'w').write('')
    env = dict(os.environ, PORT=str(PORT), BOT_TOKEN=TOKEN, MATCH_WAIT='900', STATE_FILE=D + '/state.json', SHOP_DB=D + '/shop.db', VIP_FILE=D + '/vip.txt', REC_DIR=D + '/rec',
               BOT_API=f'http://127.0.0.1:{MOCK}', IP_BURST_MULT='50', MAX_CONN_IP='2000', EXTRA_ORIGINS=f'http://localhost:{WEB}', PUBLIC_URL=f'http://127.0.0.1:{PORT}', REC_COOLDOWN='1')
    sp = subprocess.Popen([sys.executable, SRV], env=env, stdout=open(D + '/srv.log', 'w'), stderr=subprocess.STDOUT); await asyncio.sleep(2)
    try:
        async with async_playwright() as p:
            bs, pgs, errs = [], [], []
            for i in range(2):
                b = await p.chromium.launch(channel='chrome', headless=True, args=A + ['--use-file-for-fake-video-capture=' + os.path.expanduser('~/Projects/ulybka_test/cam_neutral.y4m')]); bs.append(b)
                pg = await (await b.new_context(viewport={'width': 390, 'height': 760}, permissions=['camera', 'microphone'], accept_downloads=True)).new_page(); pgs.append(pg)
                pg.on('pageerror', lambda e, i=i: errs.append(f'{i}: {e}'))
            N = ['Гео', 'Маша']
            q = lambda i, extra='': f'?api=http://127.0.0.1:{PORT}&wsbase=ws://127.0.0.1:{PORT}&init={init(1000 + i, N[i])}{extra}'
            await pgs[0].goto(BASE + q(0)); await pgs[0].fill('#name', N[0]); await pgs[0].evaluate("__nu.mask('crown')")
            await pgs[0].click('#btnPlay')
            await pgs[0].wait_for_function("/^[A-Z]{4}$/.test(document.getElementById('roomCode').textContent)", timeout=90000); code = await pgs[0].text_content('#roomCode')
            await pgs[1].goto(BASE + q(1, '&r=' + code)); await pgs[1].fill('#name', N[1]); await pgs[1].click('#btnJoin')
            await pgs[0].wait_for_function("document.querySelectorAll('#players .av').length===2", timeout=120000); ok(True, '2 игрока в лобби')
            await pgs[0].evaluate("__nu.mask('crown')")
            async def face(pg):
                for i in range(15):
                    await pg.click('#btnFace'); await pg.wait_for_timeout(500)
                    await pg.wait_for_function("!document.getElementById('btnFace').disabled", timeout=40000)
                    if (await pg.text_content('#faceHint')).startswith('Готово'): return i + 1
                    await pg.wait_for_timeout(1500)
                return -1
            tries = await asyncio.gather(*(face(pg) for pg in pgs)); ok(all(t > 0 for t in tries), f'фото {tries}')
            await pgs[0].wait_for_function("!document.getElementById('btnStart').disabled", timeout=30000); await pgs[0].click('#btnStart')
            await pgs[0].wait_for_function("__nu.akInfo().on", timeout=120000); ok(True, 'раунд пошёл, автоклип пишется')
            t_on = time.time()
            await pgs[0].wait_for_timeout(20000); ai = await pgs[0].evaluate('__nu.akInfo()'); ok(ai['prev'], f'через 20 с есть прошлый отрезок (кольцо крутится): {ai}')
            await pgs[0].wait_for_timeout(5000); print("SMILE", await pgs[0].evaluate("(()=>{__nu.simSmile(Date.now());return [__nu.decision(), document.getElementById('status').textContent]})()"), flush=True); t_loss = time.time()   # Маша «улыбнулась» на ~25-й секунде
            try: await pgs[0].wait_for_function("__nu.akInfo().clip", timeout=40000)
            except Exception:
                for pg in pgs: print('DIAG', await pg.evaluate("({scr:[...document.querySelectorAll('.scr.on')].map(e=>e.id), ak:__nu.akInfo(), err:window.__akErr||'', ll:JSON.stringify(__nu.lastLoser()).slice(0,200), st:document.getElementById('status').textContent})"), flush=True)
                print('ERRS', errs[:5], flush=True); raise
            cl = [await pg.evaluate('__nu.akInfo().clip') for pg in pgs]; print('CLIP', cl, flush=True)
            ok(all(c and c['len'] >= 14.5 and c['n'] == 2 for c in cl), f"клип у обоих: длина {[c and c['len'] for c in cl]} с, отрезков {[c and c['n'] for c in cl]}, срез {[c and c['ss'] for c in cl]}")
            ok(all(c and c['readyMs'] < 1500 for c in cl), f"клип готов к превью за {[c and c['readyMs'] for c in cl]} мс после проигрыша")
            await pgs[0].wait_for_function("getComputedStyle(document.getElementById('akBox')).display==='flex'", timeout=30000)
            await pgs[0].wait_for_timeout(1500)
            pv = await pgs[0].evaluate("(()=>{const v=document.getElementById('akVid');return {t:v.currentTime,paused:v.paused,w:v.videoWidth,h:v.videoHeight}})()")
            ok(pv['w'] == 540 and not pv['paused'], f'превью играет: {pv}')
            await pgs[0].screenshot(path=OUT + 'ekran_itoga.png')
            n0 = len(got['files']); t0 = time.time(); await pgs[0].click('#akSend')
            await pgs[0].wait_for_function("__nu.akInfo().up && (__nu.akInfo().up.url || __nu.akInfo().up.err)", timeout=120000)
            up = await pgs[0].evaluate('__nu.akInfo().up'); dt = time.time() - t0
            ok(len(got['files']) == n0 + 1 and up.get('send') and not up.get('err'), f'«В Телеграм»: бот получил {got["files"][-1][0] if got["files"] else "-"}, {dt:.1f} с от нажатия, {up}')
            if len(got['files']) > n0:
                fn = got['files'][-1][1]; shutil.copy(fn, OUT + 'klip_test.mp4')
                kinds, dur = probe(fn); size = os.path.getsize(fn)
                ok('video' in kinds and 'audio' in kinds and abs(dur - 15) < 0.6, f'mp4: дорожки {kinds}, длительность {dur:.2f} с, {size // 1024} КБ')
                for k, t in enumerate((1, 8, 14.5)):
                    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(t), '-i', fn, '-frames:v', '1', OUT + f'kadr_{k + 1}_{t}s.jpg'])
                vol = subprocess.run(['ffmpeg', '-i', fn, '-af', 'volumedetect', '-vn', '-f', 'null', '-'], capture_output=True, text=True).stderr
                m = re.search(r'mean_volume: (-?[\d.]+) dB', vol); print('VOL', m and m.group(1))
            await pgs[0].wait_for_timeout(1500)
            # «Сохранить» у второго игрока: send:false, ссылка, скачивание
            n1 = len(got['files'])
            async with pgs[1].expect_download(timeout=90000) as dl: await pgs[1].click('#akSave')
            d = await dl.value; sv = OUT + 'sohranit_test.mp4'; await d.save_as(sv); kinds, dur = probe(sv)
            ok(len(got['files']) == n1 and abs(dur - 15) < 0.6, f'«Сохранить»: боту не ушло, скачан mp4 {dur:.2f} с {os.path.getsize(sv) // 1024} КБ {kinds}')
            ok(not errs, f'ошибок страницы: {errs[:3]}')
            for b in bs: await b.close()
    finally:
        sp.terminate(); web.terminate()
        print('SRVLOG', open(D + '/srv.log').read()[-1500:])
    print(f"\nИтого: {len(res['ok'])}/{len(res['ok']) + len(res['fail'])}")
asyncio.run(main())
