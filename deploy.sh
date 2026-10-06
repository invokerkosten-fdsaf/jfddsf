#!/usr/bin/env bash
#
# client-134 — one-command deploy for Ubuntu VPS.
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh
#
# What it does (safe to re-run any time = restart/redeploy):
#   1. Pulls latest code from git (hard reset to origin/BRANCH)
#   2. Ensures local PostgreSQL + database/user exist
#   3. Creates server/.env on first run (never overwrites yours)
#   4. Installs deps, builds the frontend (API URL baked in)
#   5. Stops old pm2 processes, starts API + web, saves process list
#      (pm2 resurrects them after a VPS reboot once `pm2 startup` is done)
#
# Knobs (edit below or export as env vars before running):
#   BRANCH         git branch to deploy            (default: main)
#   API_PORT       backend port                    (default: 4000)
#   WEB_PORT       frontend static port            (default: 8080)
#   PUBLIC_HOST    public IP/hostname of this VPS   (default: auto-detected)
#   API_PUBLIC_URL backend URL baked into frontend  (default: http://PUBLIC_HOST:API_PORT)
#   DB_NAME/DB_USER/DB_PASS  local Postgres creds  (defaults below)
#
set -euo pipefail

# ---------------- config ----------------
BRANCH="${BRANCH:-main}"
API_PORT="${API_PORT:-4000}"
WEB_PORT="${WEB_PORT:-8080}"
DB_NAME="${DB_NAME:-client134}"
DB_USER="${DB_USER:-client134}"
DB_PASS="${DB_PASS:-change-me-to-a-strong-password}"
PUBLIC_HOST="${PUBLIC_HOST:-$(curl -s --max-time 5 ifconfig.me || echo 127.0.0.1)}"
API_PUBLIC_URL="${API_PUBLIC_URL:-http://${PUBLIC_HOST}:${API_PORT}}"

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_NAME="client134-api"
WEB_NAME="client134-web"

log()  { echo -e "\033[1;32m[deploy]\033[0m $*"; }
warn() { echo -e "\033[1;33m[deploy]\033[0m $*"; }
die()  { echo -e "\033[1;31m[deploy] ERROR:\033[0m $*" >&2; exit 1; }

command -v git >/dev/null || die "git not found. Run: sudo apt-get install -y git"
command -v node >/dev/null || die "node not found. Install Node 20: https://nodejs.org (or via nvm)"
command -v npm >/dev/null || die "npm not found with node."
node -e "process.exit(Number(process.versions.node.split('.')[0]) < 20 ? 1 : 0)" \
  || die "node 20+ required (found $(node -v))"

if ! command -v pm2 >/dev/null; then
  log "installing pm2..."
  npm install -g pm2 2>/dev/null || sudo npm install -g pm2 \
    || die "could not install pm2 (try: sudo npm install -g pm2)"
fi

# ---------------- 1. postgres ----------------
if ! command -v psql >/dev/null; then
  warn "postgresql not found, installing..."
  sudo apt-get update && sudo apt-get install -y postgresql postgresql-contrib \
    || die "postgres install failed"
fi
sudo systemctl enable --now postgresql 2>/dev/null \
  || sudo service postgresql start 2>/dev/null \
  || true

log "ensuring database '${DB_NAME}' + user '${DB_USER}' exist..."
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';" \
    || die "could not create db user (run as a sudoer)"
else
  sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};" \
    || die "could not create database"
fi

# ---------------- 2. server/.env (first run only) ----------------
if [ ! -f "${APP_DIR}/server/.env" ]; then
  log "creating server/.env (default creds — change ADMIN_PASS!)..."
  cat > "${APP_DIR}/server/.env" <<EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}
PG_SSL=disable
ADMIN_USER=admin
ADMIN_PASS=admin123
ADMIN_TOKEN=$(node -e "console.log(require('crypto').randomBytes(24).toString('hex'))")
PORT=${API_PORT}
EOF
else
  log "server/.env exists — keeping yours (update PORT=${API_PORT} if you changed ports)."
fi

# ---------------- 3. pull latest code ----------------
log "pulling latest code (origin/${BRANCH})..."
cd "${APP_DIR}"
git fetch origin \
  || die "git fetch failed (check network / repo access)"
git reset --hard "origin/${BRANCH}" \
  || die "git reset failed (is '${BRANCH}' pushed to origin?)"

# ---------------- 4. install + build ----------------
log "installing dependencies..."
(npm ci --no-audit --no-fund || npm install --no-audit --no-fund)
(cd server && (npm ci --no-audit --no-fund || npm install --no-audit --no-fund))

log "building frontend with VITE_API_URL=${API_PUBLIC_URL} ..."
VITE_API_URL="${API_PUBLIC_URL}" npm run build

# ---------------- 5. restart under pm2 ----------------
log "stopping old processes (if any)..."
pm2 delete "${API_NAME}" 2>/dev/null || true
pm2 delete "${WEB_NAME}" 2>/dev/null || true

log "starting API on :${API_PORT} ..."
pm2 start "${APP_DIR}/server/index.js" --name "${API_NAME}" --cwd "${APP_DIR}/server" --update-env
log "serving frontend (dist/) on :${WEB_PORT} ..."
pm2 serve "${APP_DIR}/dist" "${WEB_PORT}" --spa --name "${WEB_NAME}"

pm2 save

# Survive VPS reboot: install systemd hook (needs sudo once).
if ! systemctl is-enabled pm2-"$(whoami)" >/dev/null 2>&1; then
  warn "enabling pm2 startup on boot (needs sudo once)..."
  STARTUP_CMD="$(pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>/dev/null | grep -E '^sudo ' | tail -1 || true)"
  if [ -n "${STARTUP_CMD}" ]; then
    eval "${STARTUP_CMD}" || warn "pm2 startup hook failed — after reboot run: pm2 resurrect"
  else
    warn "could not derive startup command — after reboot run: pm2 resurrect"
  fi
fi

# ---------------- 6. health checks ----------------
sleep 3
log "health checks..."
curl -sf "http://127.0.0.1:${API_PORT}/api/health" \
  && echo && log "API OK on :${API_PORT}" \
  || die "API health check failed — run: pm2 logs ${API_NAME}"
curl -sf -o /dev/null "http://127.0.0.1:${WEB_PORT}/" \
  && log "WEB OK on :${WEB_PORT}" \
  || die "WEB check failed — run: pm2 logs ${WEB_NAME}"

pm2 status
echo
log "LIVE:"
echo "    site :  http://${PUBLIC_HOST}:${WEB_PORT}/"
echo "    api  :  http://${PUBLIC_HOST}:${API_PORT}/api/health"
echo "    admin:  http://${PUBLIC_HOST}:${WEB_PORT}/#/admin"
echo
warn "Next: open firewall  (sudo ufw allow ${API_PORT},${WEB_PORT}/tcp)"
warn "Change default admin password in server/.env (ADMIN_PASS) + re-run ./deploy.sh"
warn "Re-run this script any time to update + restart. Reboot-safe via pm2."
