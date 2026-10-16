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
#   6. If DOMAIN is set: installs nginx + Let's Encrypt cert, proxies
#      DOMAIN (and www.DOMAIN) to the app over HTTPS
#
# Knobs (edit below or export as env vars before running):
#   BRANCH         git branch to deploy            (default: main)
#   API_PORT       backend port                    (default: 4000)
#   WEB_PORT       frontend static port            (default: 8080)
#   DOMAIN         public domain, e.g. lu-trust.com (default: empty = IP mode)
#                  when set: frontend is baked with https://DOMAIN and nginx
#                  + certbot are configured automatically
#   WWW            also serve www.DOMAIN            (default: 1)
#   CERTBOT_EMAIL  contact for Let's Encrypt        (default: admin@DOMAIN)
#   PUBLIC_HOST    public IP of this VPS            (default: auto-detected, IP mode only)
#   API_PUBLIC_URL backend URL baked into frontend  (default: https://DOMAIN, or http://PUBLIC_HOST:API_PORT)
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
DOMAIN="${DOMAIN:-}"
WWW="${WWW:-1}"
if [ -n "${DOMAIN}" ]; then
  API_PUBLIC_URL="${API_PUBLIC_URL:-https://${DOMAIN}}"
else
  PUBLIC_HOST="${PUBLIC_HOST:-$(curl -s --max-time 5 ifconfig.me || echo 127.0.0.1)}"
  API_PUBLIC_URL="${API_PUBLIC_URL:-http://${PUBLIC_HOST}:${API_PORT}}"
fi

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_NAME="client134-api"
WEB_NAME="client134-web"

log()  { echo -e "\033[1;32m[deploy]\033[0m $*"; }
warn() { echo -e "\033[1;33m[deploy]\033[0m $*"; }
die()  { echo -e "\033[1;31m[deploy] ERROR:\033[0m $*" >&2; exit 1; }

if ! command -v git >/dev/null; then
  log "installing git + curl..."
  (apt-get update && apt-get install -y git curl) \
    || die "could not install git/curl (run: sudo apt-get install -y git curl)"
fi
command -v curl >/dev/null || die "curl not found. Run: sudo apt-get install -y curl"
if ! command -v node >/dev/null || ! node -e "process.exit(Number(process.versions.node.split('.')[0]) < 20 ? 1 : 0)" 2>/dev/null; then
  log "installing node 20 via NodeSource..."
  (curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs) \
    || die "node install failed (install Node 20 manually: https://nodejs.org)"
fi
command -v npm >/dev/null || die "npm not found with node."

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

# ---------------- 6. nginx + HTTPS (only when DOMAIN is set) ----------------
if [ -n "${DOMAIN}" ]; then
  log "setting up nginx for ${DOMAIN} ..."
  if ! command -v nginx >/dev/null; then
    (apt-get update && apt-get install -y nginx certbot python3-certbot-nginx) 2>/dev/null \
      || (sudo apt-get update && sudo apt-get install -y nginx certbot python3-certbot-nginx) \
      || warn "nginx install failed — app stays on :${API_PORT}/:${WEB_PORT}"
  fi
  if command -v nginx >/dev/null; then
    SERVER_NAMES="${DOMAIN}"
    if [ "${WWW}" = "1" ]; then SERVER_NAMES="${DOMAIN} www.${DOMAIN}"; fi
    cat > /etc/nginx/sites-available/client134 <<NGINX_EOF
server {
  listen 80;
  server_name ${SERVER_NAMES};
  client_max_body_size 20m;
  location /api/ {
    proxy_pass http://127.0.0.1:${API_PORT};
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
  }
  location / {
    proxy_pass http://127.0.0.1:${WEB_PORT};
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
  }
}
NGINX_EOF
    ln -sf /etc/nginx/sites-available/client134 /etc/nginx/sites-enabled/client134
    rm -f /etc/nginx/sites-enabled/default
    nginx -t && (systemctl reload nginx 2>/dev/null || service nginx reload 2>/dev/null || nginx -s reload) \
      || warn "nginx reload failed — check: nginx -t"
    if command -v certbot >/dev/null; then
      CERTBOT_DOMAINS="-d ${DOMAIN}"
      if [ "${WWW}" = "1" ]; then CERTBOT_DOMAINS="${CERTBOT_DOMAINS} -d www.${DOMAIN}"; fi
      # shellcheck disable=SC2086
      certbot --nginx ${CERTBOT_DOMAINS} --non-interactive --agree-tos \
        -m "${CERTBOT_EMAIL:-admin@${DOMAIN}}" --redirect \
        || warn "certbot failed (DNS for ${DOMAIN} may not point here yet) — re-run script after DNS propagates"
    fi
  fi
  if command -v ufw >/dev/null; then
    ufw allow 22,80,443/tcp 2>/dev/null || true
  fi
fi

# ---------------- 7. health checks ----------------
sleep 3
log "health checks..."
curl -sf "http://127.0.0.1:${API_PORT}/api/health" \
  && echo && log "API OK on :${API_PORT}" \
  || die "API health check failed — run: pm2 logs ${API_NAME}"
curl -sf -o /dev/null "http://127.0.0.1:${WEB_PORT}/" \
  && log "WEB OK on :${WEB_PORT}" \
  || die "WEB check failed — run: pm2 logs ${WEB_NAME}"
if [ -n "${DOMAIN}" ]; then
  curl -sf "https://${DOMAIN}/api/health" \
    && echo && log "HTTPS OK on ${DOMAIN}" \
    || warn "https://${DOMAIN} not reachable yet (DNS/cert?) — direct ports still work"
fi

pm2 status
echo
if [ -n "${DOMAIN}" ]; then
  log "LIVE:"
  echo "    site :  https://${DOMAIN}/"
  echo "    admin:  https://${DOMAIN}/#/admin"
  echo "    api  :  https://${DOMAIN}/api/health"
else
  log "LIVE:"
  echo "    site :  http://${PUBLIC_HOST}:${WEB_PORT}/"
  echo "    api  :  http://${PUBLIC_HOST}:${API_PORT}/api/health"
  echo "    admin:  http://${PUBLIC_HOST}:${WEB_PORT}/#/admin"
fi
echo
warn "Re-run this script any time to update + restart. Reboot-safe via pm2."
