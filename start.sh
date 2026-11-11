#!/usr/bin/env bash
# 站点由 systemd 服务 ljw-web 托管，本脚本是它的快捷入口。
# 用法：./start.sh [start|stop|restart|status|logs]
set -euo pipefail

UNIT="ljw-web.service"
CMD="${1:-start}"

case "$CMD" in
  start)   sudo systemctl start "$UNIT" ;;
  stop)    sudo systemctl stop "$UNIT" ;;
  restart) sudo systemctl restart "$UNIT" ;;
  status)  systemctl status "$UNIT" ;;
  logs)    sudo journalctl -u "$UNIT" -n 50 --no-pager ;;
  *)
    echo "未知命令：$CMD"
    echo "用法：./start.sh [start|stop|restart|status|logs]"
    exit 1
    ;;
esac

if [[ "$CMD" == "status" || "$CMD" == "logs" ]]; then
  exit 0
fi

if systemctl is-active --quiet "$UNIT"; then
  echo "运行中（systemd: $UNIT）"
  echo "  本机      http://127.0.0.1:5268/"
  echo "  公网      https://THEA.fhir.press/   （nginx 反代，证书在 nginx 侧）"
  echo "  开机自启  $(systemctl is-enabled "$UNIT")"
else
  echo "未能运行，最近日志："
  sudo journalctl -u "$UNIT" -n 10 --no-pager
  exit 1
fi
