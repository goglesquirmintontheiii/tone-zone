#!/bin/sh
# Removes Tone Zone from the Pi.  sudo tonezone uninstall [--keep-data]
#   --keep-data   keep /var/lib/tonezone (presets, models, pairing) for a later reinstall
set -e
[ "$(id -u)" = 0 ] || { echo "run as root (sudo tonezone uninstall)"; exit 1; }
KEEP=0
[ "$1" = "--keep-data" ] && KEEP=1
systemctl disable --now tonezone-kiosk.service 2>/dev/null || true
systemctl disable --now tonezone.service 2>/dev/null || true
rm -f /etc/systemd/system/tonezone.service /etc/systemd/system/tonezone-kiosk.service
systemctl daemon-reload
rm -f /usr/local/sbin/tonezone-root /usr/local/bin/tonezone /etc/sudoers.d/tonezone \
  /etc/avahi/services/tonezone.service /etc/security/limits.d/tonezone.conf \
  /etc/NetworkManager/conf.d/tonezone-wifi.conf /etc/default/tonezone
command -v nmcli >/dev/null && nmcli connection delete tonezone-direct >/dev/null 2>&1 || true
systemctl reload avahi-daemon 2>/dev/null || true
rm -rf /opt/tonezone
if [ $KEEP = 0 ]; then
  rm -rf /var/lib/tonezone
  userdel tonezone 2>/dev/null || true
  echo "Tone Zone removed (presets and models deleted)."
else
  echo "Tone Zone removed. Presets and models kept in /var/lib/tonezone."
fi
echo "Packages installed for it (jackd2, zita-ajbridge, avahi-daemon, gpiod, cage) were left in place."
echo "A dtoverlay=pwm-2chan line added with --pwm stays in config.txt; remove it by hand if you like."
