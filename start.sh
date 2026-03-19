#!/usr/bin/env bash
# Cortex — start all servers
# Usage: ./start.sh
# Stops both servers on Ctrl+C

set -e

# Load nvm so we use the non-snap Node.js installation
export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_DIR="$ROOT_DIR/apps/api"
WEB_DIR="$ROOT_DIR/apps/web"
JAR="$API_DIR/target/cortex-api-0.0.1-SNAPSHOT.jar"

# Colours
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[cortex]${NC} $*"; }
warn() { echo -e "${YELLOW}[cortex]${NC} $*"; }
err()  { echo -e "${RED}[cortex]${NC} $*"; }

# Cleanup handler — kill both child processes on exit
cleanup() {
  echo ""
  warn "Shutting down all servers..."
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null && log "Backend stopped."
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null && log "Frontend stopped."
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── 1. Build Java backend if JAR is missing or source is newer ──────────────
if [[ ! -f "$JAR" ]]; then
  log "JAR not found — building backend (this may take a minute)..."
  (cd "$API_DIR" && mvn clean package -DskipTests -q)
  log "Backend build complete."
else
  warn "Using existing JAR. Run 'mvn clean package -DskipTests' in apps/api to rebuild."
fi

# Free port 8080 if something is already using it
if lsof -ti:8080 &>/dev/null; then
  warn "Port 8080 in use — killing existing process..."
  lsof -ti:8080 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# ── 2. Start Java backend ────────────────────────────────────────────────────
# Load backend environment variables
if [ -f "$API_DIR/.env" ]; then
  log "Loading backend environment variables from .env"
  set -a
  source "$API_DIR/.env"
  set +a
fi

log "Starting backend on http://localhost:8080 ..."
java -jar "$JAR" &
API_PID=$!

# ── 3. Install web dependencies if node_modules is missing ──────────────────
if [[ ! -d "$WEB_DIR/node_modules" ]]; then
  warn "node_modules not found — running pnpm install..."
  (cd "$ROOT_DIR" && pnpm install)
fi

# Free port 3000 if something is already using it
if lsof -ti:3000 &>/dev/null; then
  warn "Port 3000 in use — killing existing process..."
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# ── 4. Start Next.js frontend ────────────────────────────────────────────────
log "Starting frontend on http://localhost:3000 ..."
(cd "$WEB_DIR" && pnpm next dev -p 3000) &
WEB_PID=$!

log "Both servers are running. Press Ctrl+C to stop all."
echo ""
echo "  Backend  → http://localhost:8080"
echo "  Frontend → http://localhost:3000"
echo ""

# Wait for both processes — exit if either dies
wait "$API_PID" "$WEB_PID"
