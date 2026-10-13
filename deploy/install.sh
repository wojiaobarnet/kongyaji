#!/usr/bin/env bash
set -euo pipefail
umask 027
if [[ ${EUID} -ne 0 ]]; then exec sudo bash "$0" "$@"; fi
SITE_HOST=${1:-donghan.159-75-67-132.sslip.io}
APP_PORT=${2:-8010}
[[ "$SITE_HOST" =~ ^[a-z0-9][a-z0-9.-]+$ && "$APP_PORT" =~ ^[0-9]+$ && "$APP_PORT" -ge 1024 && "$APP_PORT" -le 65535 ]] || { echo 'Invalid hostname or backend port'; exit 1; }
PACKAGE_ROOT=$(cd "$(dirname "$0")/.." && pwd)
BASE=/var/www/donghan
DATA=/var/lib/donghan
RELEASE=$(date -u +%Y%m%dT%H%M%S)-$$
DEST="$BASE/releases/$RELEASE"
NGINX=/etc/nginx/sites-available/donghan
SERVICE=/etc/systemd/system/donghan.service
command -v nginx >/dev/null
command -v curl >/dev/null
if ss -ltnH | awk '{print $4}' | grep -qE ":${APP_PORT}$" && ! systemctl is-active --quiet donghan; then
 echo "Port $APP_PORT is already used by another service; select an unused loopback port."; exit 1
fi
python3 - "$SITE_HOST" "$NGINX" <<'PY'
import pathlib,re,sys
host,target=sys.argv[1],pathlib.Path(sys.argv[2]).resolve()
for root in ['/etc/nginx/sites-enabled','/etc/nginx/conf.d']:
 for p in pathlib.Path(root).glob('*'):
  if not p.is_file() or p.resolve()==target:continue
  for names in re.findall(r'\bserver_name\s+([^;]+);',p.read_text()):
   if host in names.split():raise SystemExit('Hostname is already configured in '+str(p))
PY
mkdir -p "$DEST" "$DATA" "$BASE/backups" /opt/donghan
chmod 700 "$DATA"
cp -a "$PACKAGE_ROOT/dist" "$PACKAGE_ROOT/worker" "$PACKAGE_ROOT/server" "$PACKAGE_ROOT/drizzle" "$PACKAGE_ROOT/node_modules" "$PACKAGE_ROOT/package.json" "$DEST/"
if [[ -x "$PACKAGE_ROOT/runtime/bin/node" ]]; then
 RUNTIME_VERSION=$("$PACKAGE_ROOT/runtime/bin/node" -p 'process.versions.node')
 RUNTIME_DEST="/opt/donghan/node-$RUNTIME_VERSION"
 if [[ ! -x "$RUNTIME_DEST/bin/node" ]]; then mkdir -p "$RUNTIME_DEST"; cp -a "$PACKAGE_ROOT/runtime/." "$RUNTIME_DEST/"; fi
 NODE="$RUNTIME_DEST/bin/node"
elif command -v node >/dev/null && node -e 'process.exit(Number(process.versions.node.split(".")[0])>=24?0:1)'; then
 NODE=$(command -v node)
else
 echo 'Node 24 runtime was not included and no compatible runtime is installed.'; exit 1
fi
chown -R root:root "$DEST"
chmod -R a+rX "$DEST"
chown -R www-data:www-data "$DATA"
sudo -u www-data env DATA_ROOT="$DATA" "$NODE" "$DEST/server/setup.mjs"
OLD_RELEASE=$(readlink -f "$BASE/current" 2>/dev/null || true)
BACKUP="$BASE/backups/$RELEASE"
mkdir -p "$BACKUP"
[[ ! -f "$NGINX" ]] || cp -a "$NGINX" "$BACKUP/nginx.conf"
[[ ! -f "$SERVICE" ]] || cp -a "$SERVICE" "$BACKUP/donghan.service"
if [[ -f "$DATA/content.sqlite" ]]; then
 env DATA_ROOT="$DATA" "$NODE" "$DEST/server/backup.mjs" "$BACKUP/content.sqlite"
fi
rollback() {
 trap - ERR
 echo 'Verification failed. Restoring previous donghan configuration.'
 if [[ -n "$OLD_RELEASE" ]]; then ln -sfn "$OLD_RELEASE" "$BASE/current"; fi
 if [[ -f "$BACKUP/nginx.conf" ]]; then cp -a "$BACKUP/nginx.conf" "$NGINX"; else rm -f /etc/nginx/sites-enabled/donghan "$NGINX"; fi
 if [[ -f "$BACKUP/donghan.service" ]]; then cp -a "$BACKUP/donghan.service" "$SERVICE"; systemctl daemon-reload; systemctl restart donghan; else systemctl stop donghan || true; rm -f "$SERVICE"; systemctl daemon-reload; fi
 nginx -t && systemctl reload nginx
 exit 1
}
trap rollback ERR
ln -sfn "$DEST" "$BASE/current.next"
mv -Tf "$BASE/current.next" "$BASE/current"
cat > "$SERVICE" <<EOF
[Unit]
Description=Donghan website and content management
After=network.target
[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$BASE/current
Environment=NODE_ENV=production
Environment=PORT=$APP_PORT
Environment=DATA_ROOT=$DATA
Environment=PUBLIC_URL=http://$SITE_HOST
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
EOF
cat > "$NGINX" <<EOF
server {
 listen 80;
 server_name $SITE_HOST;
 client_max_body_size 9m;
 location / {
  proxy_pass http://127.0.0.1:$APP_PORT;
  proxy_set_header Host \$host;
  proxy_set_header X-Real-IP \$remote_addr;
  proxy_set_header X-Forwarded-For \$remote_addr;
  proxy_set_header X-Forwarded-Proto \$scheme;
  proxy_read_timeout 120s;
  proxy_hide_header X-Powered-By;
 }
}
EOF
ln -sfn "$NGINX" /etc/nginx/sites-enabled/donghan
nginx -t || rollback
systemctl daemon-reload
systemctl enable donghan
systemctl restart donghan
READY=0
for attempt in $(seq 1 20); do
 if curl -fsS "http://127.0.0.1:$APP_PORT/healthz" >/dev/null; then READY=1; break; fi
 sleep 1
done
[[ "$READY" -eq 1 ]] || rollback
systemctl reload nginx
CHECK_FILE=$(mktemp)
curl -fsS -H "Host: $SITE_HOST" http://127.0.0.1/ -o "$CHECK_FILE" || rollback
grep -q '東悍' "$CHECK_FILE" || rollback
rm -f "$CHECK_FILE"
trap - ERR
echo "Frontend: http://$SITE_HOST/"
echo "Admin: http://$SITE_HOST/admin/"
echo "Initial login file: $DATA/initial-login.txt"
echo "Backup: $BACKUP"
