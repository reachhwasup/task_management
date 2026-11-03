#!/usr/bin/env bash
# Stops the API server and client dev server started by start.sh.
# PostgreSQL is left running by default (it's a shared local service);
# pass --with-db to also stop it.
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"
SERVER_PORT=4000
CLIENT_PORT=5173
WITH_DB=false

for arg in "$@"; do
  [ "$arg" = "--with-db" ] && WITH_DB=true
done

log() { echo "[stop] $*"; }

stop_by_pidfile_or_port() {
  local name=$1 pidfile=$2 port=$3

  # The PID file holds npx's PID, not the tsx/vite child it spawns — npm/npx
  # don't forward signals to their child, so killing that PID alone leaves
  # the real process holding the port. The port's actual listener is what
  # must die; the PID file is only killed alongside it as cleanup.
  local pidfile_pid=""
  if [ -f "$pidfile" ]; then
    pidfile_pid=$(cat "$pidfile")
  fi
  local port_pids
  port_pids=$(lsof -ti ":$port" -sTCP:LISTEN 2>/dev/null || true)

  local all_pids
  all_pids=$(printf '%s\n%s\n' "$pidfile_pid" "$port_pids" | grep -E '^[0-9]+$' | sort -u || true)

  if [ -z "$all_pids" ]; then
    log "$name not running."
  else
    for pid in $all_pids; do
      log "Stopping $name (pid $pid)..."
      kill "$pid" 2>/dev/null || true
    done
    for _ in $(seq 1 10); do
      lsof -ti ":$port" -sTCP:LISTEN >/dev/null 2>&1 || break
      sleep 0.5
    done
    for pid in $(lsof -ti ":$port" -sTCP:LISTEN 2>/dev/null || true); do
      kill -9 "$pid" 2>/dev/null || true
    done
  fi

  rm -f "$pidfile"
}

stop_by_pidfile_or_port "API server" "$RUN_DIR/server.pid" "$SERVER_PORT"
stop_by_pidfile_or_port "Client"     "$RUN_DIR/client.pid" "$CLIENT_PORT"

if $WITH_DB; then
  if command -v docker >/dev/null 2>&1 && [ -f "$ROOT_DIR/docker-compose.yml" ] && docker compose -f "$ROOT_DIR/docker-compose.yml" ps -q 2>/dev/null | grep -q .; then
    log "Stopping PostgreSQL (docker compose)..."
    (cd "$ROOT_DIR" && docker compose down)
  elif command -v brew >/dev/null 2>&1 && brew services list 2>/dev/null | grep -q '^postgresql@16 .*started'; then
    log "Stopping PostgreSQL (Homebrew)..."
    brew services stop postgresql@16 >/dev/null
  else
    log "No managed PostgreSQL instance found to stop."
  fi
else
  log "Leaving PostgreSQL running (pass --with-db to stop it too)."
fi

log "Done."
