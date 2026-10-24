#!/bin/zsh
# Ретранслятор «Не улыбайся» на этом Маке: сервер + быстрый туннель Cloudflare, оба с автоперезапуском.
# Адрес туннеля пишется в ~/.ulybka_relay/url, сервер сам объявляет его игре (подписано ключом ~/.ulybka_relay/key.pem).
# Запуск в фоне: nohup relay/run.sh >/dev/null 2>&1 &     Остановка: relay/stop.sh
D=~/.ulybka_relay; mkdir -p $D; cd "${0:A:h}"
echo $$ > $D/run.pid
( while true; do python3 "${0:A:h}/server.py" >> $D/server.log 2>&1; sleep 2; done ) &
while true; do
  /opt/homebrew/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8787 2>&1 | while IFS= read -r l; do
    print -r -- "$l" >> $D/tunnel.log
    u=$(print -r -- "$l" | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | grep -v 'api\.' | head -1)
    [ -n "$u" ] && print -r -- "$u" > $D/url
  done
  sleep 3
done
