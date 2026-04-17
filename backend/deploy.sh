#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Deploy trailer-handover-api to a remote Ubuntu server via SSH
#
# Run from YOUR machine (not the server).
#
# Usage:
#   ./deploy.sh --init                    # First time: system deps + full deploy (incl. web)
#   ./deploy.sh                           # Update: sync → install → build → restart (incl. web)
#   ./deploy.sh --host 10.0.0.5 --init    # Override target IP
#   ./deploy.sh --env                     # Push local .env to server
#   ./deploy.sh --web                     # Build mobile web app and upload to /var/www/html/odbiory
#   ./deploy.sh --db-pull                 # Download DB from server → local data/
#   ./deploy.sh --db-push                 # Upload local DB → server (stops app!)
#   ./deploy.sh --db-migrate OLD_IP NEW_IP # Transfer DB: old server → new server
#   ./deploy.sh --redirect NEW_IP         # Stop app, set up 301 redirect → NEW_IP
#   ./deploy.sh --redirect-stop           # Remove redirect, restore normal app
#   ./deploy.sh --logs                    # Tail PM2 logs live
#   ./deploy.sh --status                  # Show PM2 status
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

NODE_MAJOR=20
PM2_APP="trailer-handover-api"
DB_NAME="app.db"
MOBILE_DIR="${SCRIPT_DIR}/../mobile"
WEB_REMOTE_PATH_DEFAULT="/var/www/html/odbiory"

# ─── Parse .env for DEPLOY_* vars ────────────────────────────────────────────
if [ -f .env ]; then
    export $(grep -E '^DEPLOY_' .env | xargs)
fi

: "${DEPLOY_USER:?Set DEPLOY_USER in .env}"
: "${DEPLOY_HOST:?Set DEPLOY_HOST in .env}"
: "${DEPLOY_PATH:?Set DEPLOY_PATH in .env}"
PM2_APP="${DEPLOY_PM2_APP:-$PM2_APP}"
WEB_REMOTE_PATH="${DEPLOY_WEB_PATH:-$WEB_REMOTE_PATH_DEFAULT}"
# Base URL the web app is served from (e.g. /odbiory). Derived from WEB_REMOTE_PATH
# basename unless explicitly set via DEPLOY_WEB_BASE_URL in .env. Set to "/" or empty
# if you serve the app at the web server root.
WEB_BASE_URL="${DEPLOY_WEB_BASE_URL-/$(basename "${WEB_REMOTE_PATH}")}"
[ "$WEB_BASE_URL" = "/" ] && WEB_BASE_URL=""

# ─── Parse flags ─────────────────────────────────────────────────────────────
ACTION="update"
CLI_HOST=""
REDIRECT_TARGET=""
MIGRATE_FROM=""
MIGRATE_TO=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --host)
            CLI_HOST="$2"
            shift 2
            ;;
        --redirect)
            ACTION="redirect"
            REDIRECT_TARGET="$2"
            shift 2
            ;;
        --db-migrate)
            ACTION="db-migrate"
            MIGRATE_FROM="$2"
            MIGRATE_TO="$3"
            shift 3
            ;;
        --redirect-stop) ACTION="redirect-stop"; shift ;;
        --init)    ACTION="init";     shift ;;
        --env)     ACTION="push-env"; shift ;;
        --web)     ACTION="web";      shift ;;
        --db-pull) ACTION="db-pull";  shift ;;
        --db-push) ACTION="db-push";  shift ;;
        --logs)    ACTION="logs";     shift ;;
        --status)  ACTION="status";   shift ;;
        --help|-h)
            echo "Usage: ./deploy.sh [--host IP] [ACTION]"
            echo ""
            echo "  --host IP              Override DEPLOY_HOST (target server IP)"
            echo ""
            echo "Actions:"
            echo "  (no flag)              Sync code, install deps, build, restart PM2"
            echo "  --init                 First-time setup: system deps + full deploy"
            echo "  --env                  Push local .env to server"
            echo "  --web                  Build mobile web app and upload to ${WEB_REMOTE_PATH_DEFAULT}"
            echo "  --db-pull              Download DB from server → local data/"
            echo "  --db-push              Upload local DB → server (stops app!)"
            echo "  --db-migrate OLD NEW   Transfer DB directly: OLD server → NEW server"
            echo "  --redirect NEW_IP      Stop app, 301 redirect all traffic → NEW_IP"
            echo "  --redirect-stop        Remove redirect, restart normal app"
            echo "  --logs                 Tail PM2 logs"
            echo "  --status               Show PM2 status"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

if [ -n "$CLI_HOST" ]; then
    DEPLOY_HOST="$CLI_HOST"
fi

REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
step() { echo -e "\n${CYAN}[$1]${NC} $2"; }
ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $*"; }

# ─── Helpers ─────────────────────────────────────────────────────────────────
remote()      { ssh -o ConnectTimeout=10 "${REMOTE}" "$@"; }
remote_sudo() { ssh -o ConnectTimeout=10 -t "${REMOTE}" "sudo bash -c '$*'"; }

sync_code() {
    rsync -azP --delete \
        --exclude node_modules \
        --exclude dist \
        --exclude data \
        --exclude uploads \
        --exclude .env \
        --exclude '*.log' \
        --exclude .git \
        ./ "${REMOTE}:${DEPLOY_PATH}/"
}

deploy_web() {
    if [ ! -d "$MOBILE_DIR" ]; then
        echo -e "${RED}  ✗ Mobile dir not found: ${MOBILE_DIR}${NC}"
        return 1
    fi

    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Web deploy → ${REMOTE}:${WEB_REMOTE_PATH}${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

    step "web 1/4" "Installing mobile dependencies..."
    (cd "$MOBILE_DIR" && npm install --no-audit --no-fund)
    ok "Dependencies installed"

    step "web 2/4" "Building web bundle (expo export --platform web, baseUrl='${WEB_BASE_URL:-/}')..."
    (cd "$MOBILE_DIR" && rm -rf dist && EXPO_BASE_URL="${WEB_BASE_URL}" npx expo export --platform web)

    if [ ! -f "${MOBILE_DIR}/dist/index.html" ]; then
        echo -e "${RED}  ✗ Web build failed: dist/index.html missing${NC}"
        return 1
    fi
    ok "Web build successful"

    # Apache .htaccess: SPA fallback for Expo Router + correct MIME for .ttf fonts.
    # RewriteBase uses the same prefix the bundle was built with so deep links work
    # whether the app is mounted at "/" or under a sub-path like "/odbiory".
    HTACCESS_BASE="${WEB_BASE_URL:-/}"
    [[ "$HTACCESS_BASE" != */ ]] && HTACCESS_BASE="${HTACCESS_BASE}/"
    cat > "${MOBILE_DIR}/dist/.htaccess" <<HTACCESS
# Auto-generated by deploy.sh — do not edit manually.
Options -MultiViews
DirectoryIndex index.html

<IfModule mod_mime.c>
    AddType font/ttf            .ttf
    AddType font/woff           .woff
    AddType font/woff2          .woff2
    AddType application/json    .json
    AddType image/svg+xml       .svg
</IfModule>

<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase ${HTACCESS_BASE}
    # Don't rewrite real files / directories
    RewriteCond %{REQUEST_FILENAME} -f [OR]
    RewriteCond %{REQUEST_FILENAME} -d
    RewriteRule ^ - [L]
    # Everything else → index.html (client-side router takes over)
    RewriteRule ^ index.html [L]
</IfModule>

<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/html text/css application/javascript application/json image/svg+xml
</IfModule>

<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType text/html "access plus 0 seconds"
    ExpiresByType text/css "access plus 7 days"
    ExpiresByType application/javascript "access plus 7 days"
    ExpiresByType image/png "access plus 30 days"
    ExpiresByType image/jpeg "access plus 30 days"
    ExpiresByType image/svg+xml "access plus 30 days"
    ExpiresByType font/ttf "access plus 30 days"
    ExpiresByType font/woff2 "access plus 30 days"
</IfModule>
HTACCESS
    ok ".htaccess generated (RewriteBase ${HTACCESS_BASE})"

    step "web 3/4" "Ensuring remote dir ${WEB_REMOTE_PATH} exists & is writable by ${DEPLOY_USER}..."
    remote_sudo "mkdir -p ${WEB_REMOTE_PATH} && chown -R ${DEPLOY_USER}:${DEPLOY_USER} ${WEB_REMOTE_PATH}"
    ok "Remote dir ready"

    step "web 4/4" "Uploading web bundle (rsync)..."
    rsync -azP --delete \
        "${MOBILE_DIR}/dist/" "${REMOTE}:${WEB_REMOTE_PATH}/"
    remote_sudo "chown -R www-data:www-data ${WEB_REMOTE_PATH} 2>/dev/null || true"
    ok "Web app deployed → ${WEB_REMOTE_PATH}"
}

# ─── Quick commands ──────────────────────────────────────────────────────────
if [ "$ACTION" = "logs" ]; then
    remote "pm2 logs ${PM2_APP} --lines 100"
    exit 0
fi
if [ "$ACTION" = "status" ]; then
    remote "pm2 show ${PM2_APP}"
    exit 0
fi
if [ "$ACTION" = "push-env" ]; then
    echo "Pushing .env to ${REMOTE}:${DEPLOY_PATH}/.env ..."
    scp .env "${REMOTE}:${DEPLOY_PATH}/.env"
    ok ".env pushed. Restart with: ./deploy.sh (or pm2 restart on server)"
    exit 0
fi
if [ "$ACTION" = "web" ]; then
    deploy_web
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Web deploy complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "  Path: ${CYAN}${REMOTE}:${WEB_REMOTE_PATH}${NC}"
    exit 0
fi

# ─── DB pull: server → local ─────────────────────────────────────────────────
if [ "$ACTION" = "db-pull" ]; then
    REMOTE_DB="${DEPLOY_PATH}/data/${DB_NAME}"
    LOCAL_DIR="data"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)

    mkdir -p "$LOCAL_DIR"

    if [ -f "${LOCAL_DIR}/${DB_NAME}" ]; then
        BACKUP="${LOCAL_DIR}/${DB_NAME}.backup-${TIMESTAMP}"
        cp "${LOCAL_DIR}/${DB_NAME}" "$BACKUP"
        ok "Local backup → ${BACKUP}"
    fi

    step "1/2" "Creating safe snapshot on server (WAL checkpoint)..."
    remote "cd ${DEPLOY_PATH} && sqlite3 data/${DB_NAME} 'PRAGMA wal_checkpoint(TRUNCATE);'" 2>/dev/null \
        || warn "sqlite3 not on server — copying raw file (safe if app uses WAL)"

    step "2/2" "Downloading database..."
    scp "${REMOTE}:${REMOTE_DB}" "${LOCAL_DIR}/${DB_NAME}"
    remote "test -f ${REMOTE_DB}-wal && echo wal_exists" | grep -q wal_exists \
        && scp "${REMOTE}:${REMOTE_DB}-wal" "${LOCAL_DIR}/${DB_NAME}-wal" \
        || true

    DB_SIZE=$(du -h "${LOCAL_DIR}/${DB_NAME}" | cut -f1)
    ok "Downloaded ${DB_SIZE} → ${LOCAL_DIR}/${DB_NAME}"
    exit 0
fi

# ─── DB push: local → server ─────────────────────────────────────────────────
if [ "$ACTION" = "db-push" ]; then
    LOCAL_DB="data/${DB_NAME}"
    REMOTE_DB="${DEPLOY_PATH}/data/${DB_NAME}"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)

    if [ ! -f "$LOCAL_DB" ]; then
        echo -e "${RED}  ✗ Local database not found: ${LOCAL_DB}${NC}"
        exit 1
    fi

    echo -e "${YELLOW}This will REPLACE the database on ${DEPLOY_HOST}.${NC}"
    echo -e "${YELLOW}The app will be stopped during transfer.${NC}"
    read -rp "Continue? [y/N] " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi

    step "1/4" "Stopping app on server..."
    remote "pm2 stop ${PM2_APP}" 2>/dev/null || true

    step "2/4" "Backing up remote DB..."
    remote "cp ${REMOTE_DB} ${REMOTE_DB}.backup-${TIMESTAMP} 2>/dev/null" || true
    remote "rm -f ${REMOTE_DB}-wal ${REMOTE_DB}-shm 2>/dev/null" || true
    ok "Remote backup → ${REMOTE_DB}.backup-${TIMESTAMP}"

    step "3/4" "Uploading database..."
    scp "$LOCAL_DB" "${REMOTE}:${REMOTE_DB}"
    DB_SIZE=$(du -h "$LOCAL_DB" | cut -f1)
    ok "Uploaded ${DB_SIZE}"

    step "4/4" "Starting app..."
    remote "pm2 restart ${PM2_APP}"
    ok "App restarted"
    exit 0
fi

# ─── DB migrate: old server → new server (one command) ────────────────────────
if [ "$ACTION" = "db-migrate" ]; then
    if [ -z "$MIGRATE_FROM" ] || [ -z "$MIGRATE_TO" ]; then
        echo -e "${RED}  ✗ Usage: ./deploy.sh --db-migrate OLD_IP NEW_IP${NC}"
        exit 1
    fi

    REMOTE_FROM="${DEPLOY_USER}@${MIGRATE_FROM}"
    REMOTE_TO="${DEPLOY_USER}@${MIGRATE_TO}"
    REMOTE_DB="${DEPLOY_PATH}/data/${DB_NAME}"
    LOCAL_DIR="data"
    LOCAL_DB="${LOCAL_DIR}/${DB_NAME}"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)

    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  DB migrate: ${MIGRATE_FROM} → ${MIGRATE_TO}${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

    echo -e "${YELLOW}This will download DB from ${MIGRATE_FROM} and upload to ${MIGRATE_TO}.${NC}"
    echo -e "${YELLOW}The app on ${MIGRATE_TO} will be stopped during transfer.${NC}"
    read -rp "Continue? [y/N] " confirm
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi

    mkdir -p "$LOCAL_DIR"

    if [ -f "$LOCAL_DB" ]; then
        cp "$LOCAL_DB" "${LOCAL_DB}.backup-${TIMESTAMP}"
        ok "Local backup → ${LOCAL_DB}.backup-${TIMESTAMP}"
    fi

    step "1/5" "WAL checkpoint on source (${MIGRATE_FROM})..."
    ssh -o ConnectTimeout=10 "${REMOTE_FROM}" \
        "cd ${DEPLOY_PATH} && sqlite3 data/${DB_NAME} 'PRAGMA wal_checkpoint(TRUNCATE);'" 2>/dev/null \
        || warn "sqlite3 not on source — copying raw file"

    step "2/5" "Downloading DB from ${MIGRATE_FROM}..."
    scp "${REMOTE_FROM}:${REMOTE_DB}" "$LOCAL_DB"
    ssh -o ConnectTimeout=10 "${REMOTE_FROM}" "test -f ${REMOTE_DB}-wal && echo wal_exists" | grep -q wal_exists \
        && scp "${REMOTE_FROM}:${REMOTE_DB}-wal" "${LOCAL_DB}-wal" \
        || true
    DB_SIZE=$(du -h "$LOCAL_DB" | cut -f1)
    ok "Downloaded ${DB_SIZE}"

    step "3/5" "Stopping app on ${MIGRATE_TO}..."
    ssh -o ConnectTimeout=10 "${REMOTE_TO}" "pm2 stop ${PM2_APP}" 2>/dev/null || true

    step "4/5" "Uploading DB to ${MIGRATE_TO}..."
    ssh -o ConnectTimeout=10 "${REMOTE_TO}" \
        "cp ${REMOTE_DB} ${REMOTE_DB}.backup-${TIMESTAMP} 2>/dev/null; rm -f ${REMOTE_DB}-wal ${REMOTE_DB}-shm" 2>/dev/null || true
    scp "$LOCAL_DB" "${REMOTE_TO}:${REMOTE_DB}"
    [ -f "${LOCAL_DB}-wal" ] && scp "${LOCAL_DB}-wal" "${REMOTE_TO}:${REMOTE_DB}-wal" || true
    ok "Uploaded ${DB_SIZE}"

    step "5/5" "Restarting app on ${MIGRATE_TO}..."
    ssh -o ConnectTimeout=10 "${REMOTE_TO}" "pm2 restart ${PM2_APP}"
    ok "App restarted on ${MIGRATE_TO}"

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  DB migrated: ${MIGRATE_FROM} → ${MIGRATE_TO}${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Local copy kept at: ${CYAN}${LOCAL_DB}${NC}"
    echo ""
    exit 0
fi

# ─── Redirect: old server → new server ────────────────────────────────────────
REDIRECT_PM2_NAME="${PM2_APP}-redirect"
REDIRECT_SCRIPT="${DEPLOY_PATH}/redirect-server.cjs"

if [ "$ACTION" = "redirect" ]; then
    if [ -z "$REDIRECT_TARGET" ]; then
        echo -e "${RED}  ✗ Usage: ./deploy.sh --host OLD_IP --redirect NEW_IP${NC}"
        exit 1
    fi

    PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 || echo "3001")
    PORT="${PORT:-3001}"

    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  301 Redirect: ${DEPLOY_HOST}:${PORT} → ${REDIRECT_TARGET}:${PORT}${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

    step "1/3" "Stopping app on ${DEPLOY_HOST}..."
    remote "pm2 stop ${PM2_APP} 2>/dev/null; pm2 delete ${REDIRECT_PM2_NAME} 2>/dev/null" || true
    ok "App stopped"

    step "2/3" "Creating redirect server..."
    remote "cat > ${REDIRECT_SCRIPT}" <<NODEEOF
const http = require('http');
const TARGET = 'http://${REDIRECT_TARGET}:${PORT}';
const PORT = ${PORT};
const server = http.createServer((req, res) => {
    const location = TARGET + req.url;
    console.log('[redirect] 301 ' + req.method + ' ' + req.url + ' → ' + location);
    res.writeHead(301, { 'Location': location, 'Cache-Control': 'no-cache' });
    res.end();
});
server.listen(PORT, () => {
    console.log('[redirect] Listening on :' + PORT + ' → ' + TARGET);
});
NODEEOF
    ok "Redirect script created"

    step "3/3" "Starting redirect with PM2..."
    remote "cd ${DEPLOY_PATH} && pm2 start ${REDIRECT_SCRIPT} --name ${REDIRECT_PM2_NAME} && pm2 save"
    ok "Redirect active"

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Redirect active!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${CYAN}http://${DEPLOY_HOST}:${PORT}/*${NC}  →  ${CYAN}http://${REDIRECT_TARGET}:${PORT}/*${NC}"
    echo ""
    echo -e "  To remove:  ${YELLOW}./deploy.sh --host ${DEPLOY_HOST} --redirect-stop${NC}"
    echo ""
    exit 0
fi

if [ "$ACTION" = "redirect-stop" ]; then
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Removing redirect on ${DEPLOY_HOST}${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

    step "1/2" "Stopping redirect server..."
    remote "pm2 delete ${REDIRECT_PM2_NAME} 2>/dev/null; rm -f ${REDIRECT_SCRIPT}" || true
    ok "Redirect removed"

    step "2/2" "Restarting app..."
    remote "cd ${DEPLOY_PATH} && pm2 restart ${PM2_APP} || pm2 start ecosystem.config.cjs" || true
    remote "pm2 save" || true
    ok "App restarted"

    echo ""
    echo -e "${GREEN}  Redirect removed. App is back on ${DEPLOY_HOST}.${NC}"
    echo ""
    exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
#  --init : Full first-time setup
# ══════════════════════════════════════════════════════════════════════════════
if [ "$ACTION" = "init" ]; then
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Fresh deploy → ${REMOTE}:${DEPLOY_PATH}${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

    # ── 1. System packages ────────────────────────────────────────────────
    step "1/7" "Installing system packages..."
    remote_sudo "
        apt-get update -qq && \
        apt-get install -y -qq \
            curl wget gnupg ca-certificates lsb-release \
            build-essential python3 git rsync sqlite3
    "
    ok "Base packages (incl. sqlite3)"

    # ── 2. Node.js ────────────────────────────────────────────────────────
    step "2/7" "Installing Node.js ${NODE_MAJOR}.x..."
    HAS_NODE=$(remote "node -v 2>/dev/null | sed 's/v//' | cut -d. -f1" || echo "0")
    if [ "${HAS_NODE:-0}" -lt "$NODE_MAJOR" ]; then
        remote_sudo "curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash - && apt-get install -y -qq nodejs"
        ok "Node.js installed"
    else
        ok "Node.js v${HAS_NODE} already present"
    fi

    # ── 3. PM2 + logrotate ───────────────────────────────────────────────
    step "3/7" "Installing PM2 + logrotate..."
    if ! remote "command -v pm2" &>/dev/null; then
        remote_sudo "npm install -g pm2"
        ok "PM2 installed"
    else
        ok "PM2 already present (other apps untouched)"
    fi
    # Only configure logrotate if not already installed (shared server safety)
    if ! remote "pm2 describe pm2-logrotate >/dev/null 2>&1"; then
        remote "pm2 install pm2-logrotate && \
            pm2 set pm2-logrotate:max_size 500M && \
            pm2 set pm2-logrotate:retain 7 && \
            pm2 set pm2-logrotate:compress true && \
            pm2 set pm2-logrotate:rotateInterval '0 0 * * *' && \
            pm2 set pm2-logrotate:rotateModule true"
        ok "pm2-logrotate configured (7-day retention, 500M max, daily rotate)"
    else
        ok "pm2-logrotate already present — skipping (keeping existing settings)"
    fi

    # ── 4. Sync code ──────────────────────────────────────────────────────
    step "4/7" "Syncing project files..."
    remote "mkdir -p ${DEPLOY_PATH}/{data,uploads}"
    sync_code
    ok "Files synced"

    # ── 5. Push .env ──────────────────────────────────────────────────────
    step "5/7" "Pushing .env..."
    if [ -f .env ]; then
        scp .env "${REMOTE}:${DEPLOY_PATH}/.env"
        ok ".env pushed from local"
    else
        warn "No local .env — copying .env.example on server"
        remote "cd ${DEPLOY_PATH} && cp .env.example .env"
    fi

    # ── 6. npm install + build ────────────────────────────────────────────
    step "6/7" "Installing dependencies & building..."
    remote "cd ${DEPLOY_PATH} && npm install --production=false && npm run build"

    if remote "test -f ${DEPLOY_PATH}/dist/index.js"; then
        ok "Build successful (dist/index.js exists)"
    else
        echo -e "${RED}  ✗ Build failed: dist/index.js missing${NC}"
        exit 1
    fi

    # ── 7. PM2 start + autostart ──────────────────────────────────────────
    step "7/8" "Starting with PM2..."
    remote "cd ${DEPLOY_PATH} && pm2 delete ${PM2_APP} 2>/dev/null; pm2 start ecosystem.config.cjs && pm2 save"

    remote_sudo "env PATH=\$PATH:/usr/bin pm2 startup systemd -u ${DEPLOY_USER} --hp /home/${DEPLOY_USER}" || true
    remote "pm2 save" || true

    # ── 8. Build + deploy web app to /var/www/html/odbiory ────────────────
    step "8/8" "Building & deploying mobile web app..."
    deploy_web || warn "Web deploy step failed (skip with: re-run later via ./deploy.sh --web)"

    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Deploy complete!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  API:   ${CYAN}http://${DEPLOY_HOST}:3001${NC}"
    echo -e "  SSH:   ${CYAN}ssh ${REMOTE}${NC}"
    echo ""
    echo -e "  ${YELLOW}Commands:${NC}"
    echo -e "    ./deploy.sh            — push code update"
    echo -e "    ./deploy.sh --logs     — tail logs"
    echo -e "    ./deploy.sh --status   — PM2 status"
    echo -e "    ./deploy.sh --env      — push .env"
    echo -e "    ./deploy.sh --web      — build & deploy web app → ${WEB_REMOTE_PATH}"
    echo -e "    ./deploy.sh --db-pull  — download DB"
    echo -e "    ./deploy.sh --db-push  — upload DB"
    echo ""

    remote "pm2 show ${PM2_APP} 2>/dev/null | head -20" || true
    exit 0
fi

# ══════════════════════════════════════════════════════════════════════════════
#  Default: code update deploy
# ══════════════════════════════════════════════════════════════════════════════
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  Update deploy → ${REMOTE}:${DEPLOY_PATH}${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"

step "1/6" "Syncing code..."
sync_code
ok "Files synced"

step "2/6" "Installing dependencies..."
remote "cd ${DEPLOY_PATH} && npm install --production=false"
ok "npm install done"

step "3/6" "Building..."
remote "cd ${DEPLOY_PATH} && rm -rf dist && npm run build"

if remote "test -f ${DEPLOY_PATH}/dist/index.js"; then
    ok "Build successful"
else
    echo -e "${RED}  ✗ Build failed: dist/index.js missing${NC}"
    exit 1
fi

step "4/6" "Ensuring pm2-logrotate..."
remote "pm2 describe pm2-logrotate >/dev/null 2>&1 || (pm2 install pm2-logrotate && \
    pm2 set pm2-logrotate:max_size 500M && \
    pm2 set pm2-logrotate:retain 7 && \
    pm2 set pm2-logrotate:compress true && \
    pm2 set pm2-logrotate:rotateInterval '0 0 * * *' && \
    pm2 set pm2-logrotate:rotateModule true)"
ok "Logrotate OK"

step "5/6" "Restarting PM2..."
remote "cd ${DEPLOY_PATH} && pm2 restart ${PM2_APP} || pm2 start ecosystem.config.cjs"
ok "Restarted"

step "6/6" "Building & deploying mobile web app..."
deploy_web || warn "Web deploy step failed (run later with: ./deploy.sh --web)"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deploy complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"

remote "pm2 show ${PM2_APP} 2>/dev/null | head -20" || true
