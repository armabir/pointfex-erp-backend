#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Starting PostgreSQL container..."
docker start pointfex-erp-postgres >/dev/null 2>&1 || \
  docker run -d --name pointfex-erp-postgres \
    -e POSTGRES_USER=pointfex \
    -e POSTGRES_PASSWORD=pointfex \
    -e POSTGRES_DB=pointfex_erp \
    -p 5432:5432 postgres:15-alpine >/dev/null

echo "Starting NestJS Backend on http://localhost:3000/api ..."
(cd "$ROOT_DIR/backend" && npm run start:dev) &
BACKEND_PID=$!

echo "Starting Vite Frontend on http://127.0.0.1:5173 ..."
(cd "$ROOT_DIR/frontend" && npm run dev -- --host 0.0.0.0 --port 5173) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT INT TERM
wait
