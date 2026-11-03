#!/usr/bin/env bash
# Starts Postgres (if needed), the API server, and the client dev server.
# Safe to re-run: it won't double-start anything already running.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
LOG_DIR="$ROOT_DIR/logs"
SERVER_PORT=4000
CLIENT_PORT=5173

mkdir -p "$RUN_DIR" "$LOG_DIR"

log() { echo "[start] $*"; }

port_listener_pid() {
  lsof -ti ":$1" -sTCP:LISTEN 2>/dev/null || true
}

wait_for_http() {
  local url=$1 name=$2 tries=${3:-30}
  for _ in $(seq 1 "$tries"); do
    curl -sf "$url" >/dev/null 2>&1 && return 0
    sleep 1
  done
  log "ERROR: $name did not become ready at $url"
  return 1
}

# ---- 1. PostgreSQL ---------------------------------------------------------

if command -v docker >/dev/null 2>&1 && [ -f "$ROOT_DIR/docker-compose.yml" ] && docker info >/dev/null 2>&1; then
  log "Starting PostgreSQL via docker compose..."
  (cd "$ROOT_DIR" && docker compose up -d)
elif command -v pg_isready >/dev/null 2>&1; then
  if pg_isready >/dev/null 2>&1; then
    log "PostgreSQL already running."
  elif command -v brew >/dev/null 2>&1 && brew list --formula 2>/dev/null | grep -q '^postgresql@16$'; then
    log "Starting PostgreSQL via Homebrew (postgresql@16)..."
    brew services start postgresql@16 >/dev/null
    for _ in $(seq 1 15); do pg_isready >/dev/null 2>&1 && break; sleep 1; done
  else
    log "WARNING: could not confirm PostgreSQL is running. Start it yourself, then re-run this script."
  fi
else
  export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
  if command -v pg_isready >/dev/null 2>&1 && pg_isready >/dev/null 2>&1; then
    log "PostgreSQL already running."
  else
    log "WARNING: could not find/verify PostgreSQL. Start it yourself, then re-run this script."
  fi
fi

# ---- 2. Env file ------------------------------------------------------------

if [ ! -f "$ROOT_DIR/server/.env" ]; then
  log "server/.env missing, copying from server/.env.example"
  cp "$ROOT_DIR/server/.env.example" "$ROOT_DIR/server/.env"
fi

# ---- 3. Dependencies --------------------------------------------------------

if [ ! -d "$ROOT_DIR/node_modules" ]; then
  log "Installing dependencies (first run)..."
  (cd "$ROOT_DIR" && npm install)
fi

# ---- 4. Server ---------------------------------------------------------------

existing_server_pid=$(port_listener_pid "$SERVER_PORT")
if [ -n "$existing_server_pid" ]; then
  log "Server already running on :$SERVER_PORT (pid $existing_server_pid)."
else
  log "Starting API server on :$SERVER_PORT..."
  (cd "$ROOT_DIR/server" && nohup npx tsx watch src/index.ts >"$LOG_DIR/server.log" 2>&1 &
    echo $! >"$RUN_DIR/server.pid")
fi

# ---- 5. Client ---------------------------------------------------------------

existing_client_pid=$(port_listener_pid "$CLIENT_PORT")
if [ -n "$existing_client_pid" ]; then
  log "Client already running on :$CLIENT_PORT (pid $existing_client_pid)."
else
  log "Starting client dev server on :$CLIENT_PORT..."
  (cd "$ROOT_DIR/client" && nohup npx vite --port "$CLIENT_PORT" >"$LOG_DIR/client.log" 2>&1 &
    echo $! >"$RUN_DIR/client.pid")
fi

# ---- 6. Wait for both to answer ----------------------------------------------

wait_for_http "http://localhost:$SERVER_PORT/api/health" "API server" \
  && log "API server ready:    http://localhost:$SERVER_PORT"
wait_for_http "http://localhost:$CLIENT_PORT" "Client" \
  && log "Client ready:        http://localhost:$CLIENT_PORT"

log "Logs: $LOG_DIR/server.log, $LOG_DIR/client.log"
log "Stop with: ./scripts/stop.sh"
