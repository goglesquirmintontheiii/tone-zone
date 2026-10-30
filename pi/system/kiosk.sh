#!/bin/sh
# The on-device screen: the agent's web UI in a kiosk browser, under cage (a one-window Wayland compositor).
# cog (WPE WebKit) is used when installed (lightest), else Chromium.
ROT=$(sed -n 's/^rotation=//p' /var/lib/tonezone/kiosk.conf 2>/dev/null)
R=""
case "$ROT" in 90) R="-r" ;; 180) R="-r -r" ;; 270) R="-r -r -r" ;; esac
URL="http://127.0.0.1:7650/"
# wait for the agent
i=0; while [ $i -lt 30 ] && ! curl -fs -o /dev/null "$URL"; do sleep 1; i=$((i+1)); done
if command -v cog >/dev/null; then
  exec cage -d -s $R -- cog --platform=wl "$URL"
fi
B=$(command -v chromium-browser || command -v chromium)
exec cage -d -s $R -- "$B" --kiosk --noerrdialogs --disable-infobars --no-first-run --ozone-platform=wayland \
  --disable-features=Translate --disable-pinch --overscroll-history-navigation=0 --enable-low-end-device-mode \
  --user-data-dir=/var/lib/tonezone/kiosk-profile "$URL"
