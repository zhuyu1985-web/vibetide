#!/bin/bash
# 北京广播电视台 · 智能交互工作台原型 — 一键启动（macOS 双击运行）
cd "$(dirname "$0")"
PORT=8848
echo "================================================="
echo "  BRTV 智能交互工作台 · 三端原型"
echo "  正在启动本地服务 …"
echo "================================================="
# 若端口被占用则换一个
if lsof -i :$PORT >/dev/null 2>&1; then PORT=8849; fi
python3 -m http.server $PORT >/dev/null 2>&1 &
SERVER_PID=$!
sleep 1
URL="http://127.0.0.1:$PORT/index.html"
open "$URL"
echo ""
echo "  已在浏览器打开：$URL"
echo "  关闭此窗口即停止服务。"
echo ""
trap "kill $SERVER_PID 2>/dev/null" EXIT
wait $SERVER_PID
