#!/usr/bin/env bash
set -euo pipefail
umask 027
if [[ ${EUID} -ne 0 ]]; then exec sudo bash "$0" "$@"; fi
PACKAGE_ROOT=$(cd "$(dirname "$0")/.." && pwd)
BASE=/var/www/donghan
DATA=/var/lib/donghan
SERVICE=/etc/systemd/system/donghan.service
[[ -f "$SERVICE" && -f "$DATA/admin.json" && -L "$BASE/current" ]] || { echo 'An existing donghan installation is required.'; exit 1; }
OLD_RELEASE=$(readlink -e "$BASE/current")
[[ -n "$OLD_RELEASE" ]] || { echo 'Current release is invalid.'; exit 1; }
NODE=$(awk -F= '/^ExecStart=/{print $2;exit}' "$SERVICE" | awk '{print $1}')
APP_PORT=$(sed -n 's/^Environment=PORT=//p' "$SERVICE")
MOUNT_PATH=$(sed -n 's/^Environment=BASE_PATH=//p' "$SERVICE")
[[ -x "$NODE" && "$APP_PORT" =~ ^[0-9]+$ ]] || { echo 'Invalid existing runtime configuration.'; exit 1; }
[[ -z "$MOUNT_PATH" || "$MOUNT_PATH" =~ ^/[a-zA-Z0-9_/-]+$ ]] || { echo 'Invalid existing mount path.'; exit 1; }
for item in dist/client worker server drizzle node_modules package.json; do [[ -e "$PACKAGE_ROOT/$item" ]] || { echo "Missing package component: $item"; exit 1; }; done
[[ "$PACKAGE_ROOT" != "$OLD_RELEASE" ]] || { echo 'Build the new source in a separate directory.'; exit 1; }
RELEASE=$(date -u +%Y%m%dT%H%M%S)-update-$$
DEST="$BASE/releases/$RELEASE"
BACKUP="$BASE/backups/$RELEASE"
mkdir -p "$DEST" "$BACKUP"
chmod 755 "$BASE" "$BASE/releases"
cp -a "$SERVICE" "$BACKUP/donghan.service"
printf '%s\n' "$OLD_RELEASE" > "$BACKUP/previous-release.txt"
env DATA_ROOT="$DATA" "$NODE" "$OLD_RELEASE/server/backup.mjs" "$BACKUP/content.sqlite"
cp -a "$PACKAGE_ROOT/dist" "$PACKAGE_ROOT/worker" "$PACKAGE_ROOT/server" "$PACKAGE_ROOT/drizzle" "$PACKAGE_ROOT/node_modules" "$PACKAGE_ROOT/package.json" "$DEST/"
for item in docs deploy README.md AGENTS.md; do [[ ! -e "$PACKAGE_ROOT/$item" ]] || cp -a "$PACKAGE_ROOT/$item" "$DEST/"; done
if command -v git >/dev/null && git -C "$PACKAGE_ROOT" rev-parse HEAD >/dev/null 2>&1; then
 git -C "$PACKAGE_ROOT" rev-parse HEAD > "$DEST/REVISION"
fi
chown -R root:root "$DEST"
chmod -R a+rX "$DEST"
"$NODE" --check "$DEST/server/runtime.mjs"
rollback() {
 trap - ERR
 echo 'Update failed; restoring the previous release.'
 ln -sfn "$OLD_RELEASE" "$BASE/current.rollback"
 mv -Tf "$BASE/current.rollback" "$BASE/current"
 systemctl restart donghan || true
 exit 1
}
trap rollback ERR
# A running daily job must not continue against a different release during a switch.
if systemctl is-active --quiet donghan-seo.service; then systemctl stop donghan-seo.service; fi
ln -sfn "$DEST" "$BASE/current.next"
mv -Tf "$BASE/current.next" "$BASE/current"
systemctl restart donghan
READY=0
for attempt in $(seq 1 30); do
 if curl -fsS "http://127.0.0.1:$APP_PORT$MOUNT_PATH/healthz" >/dev/null 2>&1; then READY=1; break; fi
 sleep 1
done
[[ "$READY" -eq 1 ]] || rollback
trap - ERR
echo "Updated release: $DEST"
echo "Backup: $BACKUP"
echo 'Existing PUBLIC_URL, BASE_PATH, ADMIN_PATH, nginx configuration and administrator credentials were preserved.'
