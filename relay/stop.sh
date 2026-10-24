#!/bin/zsh
# Остановить ретранслятор и туннель
pkill -f 'ulybka/relay/run.sh'; pkill -f 'ulybka/relay/server.py'; pkill -f 'cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8787'
rm -f ~/.ulybka_relay/url
