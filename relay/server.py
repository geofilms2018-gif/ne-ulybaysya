# Ретранслятор кадров «Не улыбайся» для сотовых сетей, где WebRTC не встаёт без TURN.
# Комнаты по коду: каждое сообщение игрока уходит всем остальным в его комнате.
# Адрес туннеля (из ~/.ulybka_relay/url) раз в 2 минуты объявляется в MQTT с подписью ECDSA —
# страница принимает только подписанный адрес *.trycloudflare.com.
# Запуск: relay/run.sh (сервер + cloudflared с автоперезапуском).
import asyncio, base64, json, os, re, threading, time
import websockets
from websockets.asyncio.server import serve
from urllib.parse import urlparse, parse_qs

PORT = int(os.environ.get('PORT', '8787'))
D = os.path.expanduser('~/.ulybka_relay')
MAX = 300_000                     # кадр 320 px в JPEG — 15–30 КБ
rooms = {}                        # код -> {id: ws}


async def handler(ws):
    q = parse_qs(urlparse(ws.request.path).query)
    room = re.sub(r'[^A-Z]', '', (q.get('room') or [''])[0])[:4]
    me = re.sub(r'[^a-z0-9]', '', (q.get('id') or [''])[0])[:16]
    if len(room) != 4 or not me:
        await ws.close(1008, 'room/id')
        return
    peers = rooms.setdefault(room, {})
    peers[me] = ws
    try:
        async for msg in ws:
            if not isinstance(msg, str) or len(msg) > MAX or not msg.startswith('{'):
                continue
            out = '{"from":"' + me + '",' + msg[1:]
            websockets.broadcast([p for pid, p in peers.items() if pid != me], out)
    finally:
        if peers.get(me) is ws:
            del peers[me]
        if not peers:
            rooms.pop(room, None)


def health(conn, req):
    if req.headers.get('Upgrade', '').lower() != 'websocket':
        return conn.respond(200, 'ne-ulybaysya relay ok\n')


def announcer():
    import paho.mqtt.client as mqtt
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
    key = serialization.load_pem_private_key(open(os.path.join(D, 'key.pem'), 'rb').read(), None)
    brokers = [('broker.emqx.io', 8883), ('broker.hivemq.com', 8883)]
    last, last_t = '', 0
    while True:
        time.sleep(5)
        try:
            url = open(os.path.join(D, 'url')).read().strip().replace('https://', 'wss://')
            if url == last and time.time() - last_t < 120:
                continue
            if re.fullmatch(r'wss://[a-z0-9-]+\.trycloudflare\.com', url):
                last, last_t = url, time.time()
                t = int(time.time())
                r, s = decode_dss_signature(key.sign(f'{url}|{t}'.encode(), ec.ECDSA(hashes.SHA256())))
                sig = base64.b64encode(r.to_bytes(32, 'big') + s.to_bytes(32, 'big')).decode()
                payload = json.dumps({'url': url, 't': t, 'sig': sig})
                for host, port in brokers:
                    try:
                        c = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
                        c.tls_set()
                        c.connect(host, port, 20)
                        c.loop_start()
                        c.publish('ne-ulybaysya/v2/relay', payload, qos=1, retain=True).wait_for_publish(10)
                        c.loop_stop(); c.disconnect()
                        print('announced', url, host, flush=True)
                    except Exception as e:
                        print('announce', host, e, flush=True)
        except FileNotFoundError:
            pass
        except Exception as e:
            print('announce', e, flush=True)


async def main():
    threading.Thread(target=announcer, daemon=True).start()
    async with serve(handler, '127.0.0.1', PORT, process_request=health, max_size=MAX + 1000, ping_interval=20):
        print('relay on', PORT, flush=True)
        await asyncio.Future()

if __name__ == '__main__':
    asyncio.run(main())
