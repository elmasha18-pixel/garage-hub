#!/bin/bash
# Запуск GarageHub одной командой: туннель для Mini App + бот.
# Пока работает — Мак не уходит в сон (caffeinate). Остановить: Ctrl+C.
cd "$(dirname "$0")" || exit 1
source venv/bin/activate

python3 tunnel.py &
TUNNEL_PID=$!
trap 'kill $TUNNEL_PID 2>/dev/null; wait $TUNNEL_PID 2>/dev/null' EXIT INT TERM

caffeinate -is python3 bot.py
