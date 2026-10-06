#!/bin/bash
# Перезапускает локальный сервер для тестов: ./scripts/dev.sh
cd "$(dirname "$0")/.."
[ -f /tmp/detective.pid ] && kill "$(cat /tmp/detective.pid)" 2>/dev/null
sleep 0.5
DISCORD_SERVER_URL=${DISCORD_SERVER_URL:-https://discord.gg/hfWsKkGVH} HTTP_PER_IP=${HTTP_PER_IP:-100000} ROOMS_PER_IP=${ROOMS_PER_IP:-1000} ROOMS_NEW_PER_IP=${ROOMS_NEW_PER_IP:-1000} ADMIN_KEY=${ADMIN_KEY:-noir-test} PORT=${PORT:-3000} nohup node server/index.js > /tmp/server.log 2>&1 &
echo $! > /tmp/detective.pid
sleep 1.5
cat /tmp/server.log
