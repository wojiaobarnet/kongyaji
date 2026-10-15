#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ $EUID -eq 0 ]] || { echo 'Run as root.'; exit 1; }
ROOT=$(readlink -e /var/www/donghan/current)
[[ -f "$ROOT/server/seo-daily.mjs" && -f /var/lib/donghan/admin.json ]] || { echo 'Deploy the SEO center release first.'; exit 1; }
[[ $(systemctl show donghan -p User --value) == donghan ]] || { echo 'This template requires the primary Donghan service user.'; exit 1; }
systemctl is-active --quiet donghan
BACKUP=/var/www/donghan/backups/$(date -u +%Y%m%dT%H%M%S)-seo-timer
mkdir -m 700 "$BACKUP"
for FILE in /etc/systemd/system/donghan-seo.service /etc/systemd/system/donghan-seo.timer /var/lib/donghan/seo-schedule.json; do
 [[ ! -f "$FILE" ]] || cp -a "$FILE" "$BACKUP/"
done
install -m 644 "$ROOT/deploy/donghan-seo.service" /etc/systemd/system/donghan-seo.service
install -m 644 "$ROOT/deploy/donghan-seo.timer" /etc/systemd/system/donghan-seo.timer
systemd-analyze verify /etc/systemd/system/donghan-seo.service /etc/systemd/system/donghan-seo.timer
systemctl daemon-reload
systemctl enable --now donghan-seo.timer
systemctl is-active --quiet donghan-seo.timer
printf '%s\n' '{"enabled":true,"time":"03:30","timezone":"Asia/Shanghai","persistent":true,"unit":"donghan-seo.timer","installedBy":"deploy/install-seo.sh"}' > /var/lib/donghan/seo-schedule.json
chown donghan:donghan /var/lib/donghan/seo-schedule.json
chmod 600 /var/lib/donghan/seo-schedule.json
echo "Timer installed; backup: $BACKUP"
systemctl list-timers donghan-seo.timer --no-pager
echo 'Run systemctl start donghan-seo.service for the first check; inspect failures in the SEO center and journalctl -u donghan-seo.service.'
