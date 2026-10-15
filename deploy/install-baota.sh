#!/usr/bin/env bash
# First install into an inspected BT Panel Nginx host. Existing sites are not replaced.
set -euo pipefail
umask 027
[[ ${EUID} -eq 0 ]] || { echo 'Run this installer as root.'; exit 1; }
PACKAGE_ROOT=$(cd "$(dirname "$0")/.." && pwd)
SOURCE_DATA=${1:?Pass the private migration snapshot directory}
SITE_HOST=${2:-43.128.69.6}
APP_PORT=${3:-8010}
BASE=/var/www/donghan
DATA=/var/lib/donghan
NGINX=/www/server/nginx/sbin/nginx
CONF=/www/server/panel/vhost/nginx/$SITE_HOST.conf
SERVICE=/etc/systemd/system/donghan.service
NODE=/opt/donghan/node-24.21.0/bin/node
[[ "$SITE_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]+$ && "$APP_PORT" =~ ^[0-9]+$ && "$APP_PORT" -ge 1024 && "$APP_PORT" -le 65535 ]] || exit 1
[[ -x "$NGINX" && -x "$NODE" && -f "$CONF" ]] || { echo 'Install BT Nginx, the verified Node runtime, and register the intended site first.'; exit 1; }
[[ ! -e "$SERVICE" && ! -e "$BASE/current" ]] || { echo 'Use update.sh for an existing Donghan installation.'; exit 1; }
[[ -f "$SOURCE_DATA/admin.json" && -f "$SOURCE_DATA/content.sqlite" ]] || { echo 'Migration snapshot is incomplete.'; exit 1; }
if ss -ltnH | awk '{print $4}' | grep -qE ":${APP_PORT}$"; then echo 'Backend port is already in use.'; exit 1; fi
for item in dist/client worker server drizzle node_modules package.json; do [[ -e "$PACKAGE_ROOT/$item" ]] || { echo "Missing: $item"; exit 1; }; done
# The target vhost was deliberately registered by the owner for this application.
grep -Eq "server_name[[:space:]]+$SITE_HOST[[:space:]]*;" "$CONF" || { echo 'Unexpected target virtual host.'; exit 1; }
"$NGINX" -t
STAMP=$(date -u +%Y%m%dT%H%M%S)-baota
DEST="$BASE/releases/$STAMP"
BACKUP="$BASE/backups/$STAMP"
install -d -m 755 "$BASE" "$BASE/releases" "$BASE/backups"
install -d -m 700 "$BACKUP"
cp -a "$CONF" "$BACKUP/nginx.before.conf"
if ! id donghan >/dev/null 2>&1; then useradd --system --home-dir "$DATA" --shell /sbin/nologin donghan; fi
install -d -m 700 "$DATA"
if [[ -f "$DATA/admin.json" ]]; then
 cmp -s "$DATA/admin.json" "$SOURCE_DATA/admin.json" || { echo 'An unrelated administrator already exists; nothing replaced.'; exit 1; }
else
 cp -a "$SOURCE_DATA/." "$DATA/"
fi
chown -R donghan:donghan "$DATA"
chmod 700 "$DATA"
find "$DATA" -type f -exec chmod 600 {} +
install -d -m 755 "$DEST"
cp -a "$PACKAGE_ROOT/dist" "$PACKAGE_ROOT/worker" "$PACKAGE_ROOT/server" "$PACKAGE_ROOT/drizzle" "$PACKAGE_ROOT/node_modules" "$PACKAGE_ROOT/package.json" "$DEST/"
for item in docs deploy scripts README.md AGENTS.md; do [[ ! -e "$PACKAGE_ROOT/$item" ]] || cp -a "$PACKAGE_ROOT/$item" "$DEST/"; done
[[ ! -f "$PACKAGE_ROOT/REVISION" ]] || cp "$PACKAGE_ROOT/REVISION" "$DEST/REVISION"
chown -R root:root "$DEST"
chmod -R a+rX "$DEST"
"$NODE" --check "$DEST/server/runtime.mjs"
rollback() {
 trap - ERR
 cp -a "$BACKUP/nginx.before.conf" "$CONF"
 systemctl stop donghan || true
 systemctl disable donghan || true
 # The private imported data and complete failed release remain recoverable.
 [[ ! -f "$SERVICE" ]] || mv "$SERVICE" "$BACKUP/donghan.failed.service"
 if [[ -L "$BASE/current" ]]; then mv "$BASE/current" "$BACKUP/failed-current"; fi
 systemctl daemon-reload
 "$NGINX" -t && "$NGINX" -s reload
 echo "Installation failed; original vhost restored. Recovery files: $BACKUP"
 exit 1
}
trap rollback ERR
cat > "$SERVICE" <<UNIT
[Unit]
Description=Donghan website on BT Panel
After=network.target
[Service]
Type=simple
User=donghan
Group=donghan
WorkingDirectory=$BASE/current
Environment=NODE_ENV=production
Environment=PORT=$APP_PORT
Environment=DATA_ROOT=$DATA
Environment=PUBLIC_URL=http://$SITE_HOST
Environment=BASE_PATH=/donghan
Environment=ADMIN_PATH=/uguest
ExecStart=$NODE $BASE/current/server/runtime.mjs
Restart=on-failure
RestartSec=3
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA
[Install]
WantedBy=multi-user.target
UNIT
ln -s "$DEST" "$BASE/current"
systemctl daemon-reload
systemctl enable --now donghan
READY=0
for attempt in $(seq 1 30); do
 if curl -fsS "http://127.0.0.1:$APP_PORT/donghan/healthz" >/dev/null 2>&1; then READY=1; break; fi
 sleep 1
done
[[ "$READY" -eq 1 ]] || rollback
cat > "$CONF" <<NGINX
# Donghan: BT Panel registered reverse proxy. Keep /donghan and /uguest paths.
server {
    listen 80;
    server_name $SITE_HOST;
    root /www/wwwroot/donghan;
    index index.html;
    access_log /www/wwwlogs/$SITE_HOST.log;
    error_log /www/wwwlogs/$SITE_HOST.error.log;
    client_max_body_size 9m;
    location = / { return 308 /donghan/; }
    location = /donghan { return 308 /donghan/\$is_args\$args; }
    location = /robots.txt {
        proxy_pass http://127.0.0.1:$APP_PORT/donghan/robots.txt;
        proxy_set_header Host \$host;
    }
    location ^~ /donghan/ {
        proxy_pass http://127.0.0.1:$APP_PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        proxy_hide_header X-Powered-By;
    }
    location / { return 404; }
}
NGINX
"$NGINX" -t
"$NGINX" -s reload
READY=0
for attempt in $(seq 1 15); do
 if curl -fsS -H "Host: $SITE_HOST" http://127.0.0.1/donghan/guide/ | grep -q 'canonical'; then READY=1; break; fi
 sleep 1
done
[[ "$READY" -eq 1 ]] || rollback
trap - ERR
printf 'Frontend: http://%s/donghan/\nAdmin: http://%s/donghan/uguest/\nRelease: %s\nBackup: %s\n' "$SITE_HOST" "$SITE_HOST" "$DEST" "$BACKUP"
