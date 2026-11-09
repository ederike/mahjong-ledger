#!/usr/bin/env sh
# 仅启动服务，不做任何其他事情。需 Node >= 22.5。
cd "$(dirname "$0")" || exit 1
exec npm start
