#!/usr/bin/env bash
# Tone Zone for Raspberry Pi: installer.
#
#   curl -fsSL https://github.com/goglesquirmintontheiii/tone-zone/releases/latest/download/install.sh | sudo bash
#
# or copy a bundle over and install it from the file:
#   scp pi-bundle-0.9.0-arm64.tar.gz install.sh pi@tonezone.local:
#   ssh pi@tonezone.local sudo bash install.sh --bundle pi-bundle-0.9.0-arm64.tar.gz
#
# Options:
#   --bundle FILE    install this bundle instead of downloading the latest release
#   --version V      download release V instead of the latest
#   --screen         show the on-device UI on a connected screen (installs cage + a kiosk browser)
#   --pwm            enable hardware PWM on GPIO 12 / 13 for dimmable LEDs (not with the 3.5 mm jack as output)
#   --no-tuning      skip CPU governor, Wi-Fi power save and direct cable network setup
#   --allow-unsigned accept an unsigned bundle (development builds)
#   --force          install on a board or OS that is not supported
set -euo pipefail

REPO="goglesquirmintontheiii/tone-zone"
H=/opt/tonezone
DATA=/var/lib/tonezone
BUNDLE="" VERSION="" SCREEN=0 PWM=0 TUNING=1 UNSIGNED=0 FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --bundle) BUNDLE="$2"; shift ;;
    --version) VERSION="$2"; shift ;;
    --screen) SCREEN=1 ;;
    --pwm) PWM=1 ;;
    --no-tuning) TUNING=0 ;;
    --allow-unsigned) UNSIGNED=1 ;;
    --force) FORCE=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown option $1"; exit 2 ;;
  esac
  shift
done

say() { printf '\033[1m==> %s\033[0m\n' "$*"; }
die() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
[ "$(id -u)" = 0 ] || die "run as root: curl -fsSL ... | sudo bash"

# ---------------------------------------------------------------- board and OS
MODEL=$(tr -d '\0' < /proc/device-tree/model 2>/dev/null || echo unknown)
case "$MODEL" in
  *"Raspberry Pi 5"*|*"Compute Module 5"*) BOARD=pi5 ;;
  *"Raspberry Pi 4"*|*"Compute Module 4"*|*"Raspberry Pi 400"*) BOARD=pi4 ;;
  *"Raspberry Pi 3 Model B Plus"*|*"Raspberry Pi 3 Model A Plus"*) BOARD=pi3bp ;;
  *"Raspberry Pi 3"*) BOARD=pi3b ;;
  *) BOARD=unknown ;;
esac
ARCH=$(uname -m)
# read the OS name in a subshell: /etc/os-release sets VERSION too, which would clobber our --version
osr() { (. /etc/os-release 2>/dev/null && eval "printf '%s' \"\${$1:-}\""); }
PRETTY_NAME=$(osr PRETTY_NAME)
VERSION_CODENAME=$(osr VERSION_CODENAME)
say "Board: $MODEL ($ARCH), OS: ${PRETTY_NAME:-unknown}"
if [ "$BOARD" = unknown ] && [ $FORCE = 0 ]; then die "this is not a Raspberry Pi 3, 4 or 5 (use --force to try anyway)"; fi
if [ "$ARCH" != aarch64 ]; then
  [ "$ARCH" = armv7l ] && die "this is the 32-bit Raspberry Pi OS. Tone Zone needs the 64-bit one: flash 'Raspberry Pi OS Lite (64-bit)' with Raspberry Pi Imager (it works on Pi 3B / 3B+ too)."
  [ $FORCE = 1 ] || die "unsupported CPU $ARCH (needs aarch64)"
fi
case "${VERSION_CODENAME:-}" in bookworm|trixie|forky) ;; *) [ $FORCE = 1 ] || die "needs Raspberry Pi OS Bookworm or newer (found ${VERSION_CODENAME:-unknown})" ;; esac
FREE=$(df -Pm / | awk 'NR==2 {print $4}')
[ "${FREE:-0}" -gt 400 ] || die "less than 400 MB free on the SD card"

# ---------------------------------------------------------------- packages
say "Installing packages (this takes a few minutes on a Pi 3)"
export DEBIAN_FRONTEND=noninteractive
echo "jackd2 jackd/tweak_rt_limits boolean true" | debconf-set-selections
apt-get update -qq
PKGS="jackd2 zita-ajbridge alsa-utils avahi-daemon libnss-mdns gpiod curl ca-certificates openssl tar"
# a Pi with a desktop runs PipeWire: the engine joins it through PipeWire's JACK library (acl lets it reach the
# desktop user's PipeWire socket)
PKGS="$PKGS acl"
if pgrep -x pipewire >/dev/null 2>&1 || dpkg -s pipewire >/dev/null 2>&1; then PKGS="$PKGS pipewire-jack"; fi
[ $SCREEN = 1 ] && PKGS="$PKGS cage"
# shellcheck disable=SC2086
apt-get install -y -qq --no-install-recommends $PKGS
if [ $SCREEN = 1 ]; then
  apt-get install -y -qq --no-install-recommends cog || apt-get install -y -qq --no-install-recommends chromium-browser || apt-get install -y -qq --no-install-recommends chromium || say "no kiosk browser found, the screen stays off"
fi
# Node.js 18 or newer: the distro's (Bookworm has 18, Trixie 20), else the official build
NODE=""
if ! command -v node >/dev/null; then apt-get install -y -qq --no-install-recommends nodejs || true; fi
if command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]; then
  NODE=$(command -v node)
else
  say "Downloading Node.js 20 (the distro's is missing or too old)"
  NV=v20.18.1
  curl -fsSL "https://nodejs.org/dist/$NV/node-$NV-linux-arm64.tar.xz" -o /tmp/node.tar.xz
  mkdir -p "$H/nodejs" && tar -xJf /tmp/node.tar.xz -C "$H/nodejs" --strip-components=1 && rm -f /tmp/node.tar.xz
  NODE="$H/nodejs/bin/node"
fi

# ---------------------------------------------------------------- bundle
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
if [ -z "$BUNDLE" ]; then
  if [ -n "$VERSION" ]; then BASE="https://github.com/$REPO/releases/download/v$VERSION"; else BASE="https://github.com/$REPO/releases/latest/download"; fi
  say "Downloading the latest Tone Zone Pi bundle"
  curl -fsSL "$BASE/pi-latest.json" -o "$TMP/latest.json" || die "could not reach GitHub releases ($BASE)"
  NAME=$("$NODE" -p "require('$TMP/latest.json').bundle")
  SHA=$("$NODE" -p "require('$TMP/latest.json').sha256 || ''")
  curl -fsSL "$BASE/$NAME" -o "$TMP/bundle.tar.gz" || die "download failed: $NAME"
  curl -fsSL "$BASE/$NAME.sig" -o "$TMP/bundle.tar.gz.sig" 2>/dev/null || rm -f "$TMP/bundle.tar.gz.sig"
  if [ -n "$SHA" ]; then echo "$SHA  $TMP/bundle.tar.gz" | sha256sum -c --quiet - || die "download damaged (checksum mismatch)"; fi
else
  [ -f "$BUNDLE" ] || die "no such file: $BUNDLE"
  cp "$BUNDLE" "$TMP/bundle.tar.gz"
  [ -f "$BUNDLE.sig" ] && cp "$BUNDLE.sig" "$TMP/bundle.tar.gz.sig"
fi
# signature (Ed25519, same key as the agent checks for updates)
cat > "$TMP/key.pem" <<'KEY'
-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAkgjrdx+47Z++gSDbDm9BrD/R4djJC4w9JY0fO65TBuo=
-----END PUBLIC KEY-----
KEY
SIGNED=0
if [ -f "$TMP/bundle.tar.gz.sig" ]; then
  base64 -d "$TMP/bundle.tar.gz.sig" > "$TMP/sig.bin"
  if openssl pkeyutl -verify -pubin -inkey "$TMP/key.pem" -rawin -in "$TMP/bundle.tar.gz" -sigfile "$TMP/sig.bin" >/dev/null 2>&1; then SIGNED=1; else die "bad signature: this bundle was not made by Tone Zone, or it was changed"; fi
fi
if [ $SIGNED = 0 ]; then
  if [ $UNSIGNED = 1 ] || [ -z "$BUNDLE" ]; then
    # a release download is still checked by HTTPS and its checksum; updates later must be signed
    say "warning: the bundle is not signed"
  else
    die "the bundle is not signed (add --allow-unsigned for a development build)"
  fi
fi
mkdir -p "$TMP/x"
tar -xzf "$TMP/bundle.tar.gz" -C "$TMP/x" --no-same-owner
[ -f "$TMP/x/tonezone/manifest.json" ] || die "not a Tone Zone Pi bundle"
(cd "$TMP/x/tonezone" && "$NODE" -e "
  const m=require('./manifest.json'),fs=require('fs'),c=require('crypto');
  for (const [f,h] of Object.entries(m.files)) if (c.createHash('sha256').update(fs.readFileSync(f)).digest('hex')!==h) { console.error('damaged: '+f); process.exit(1); }
  console.log('Tone Zone '+m.version+' ('+m.arch+')');") || die "bundle check failed"
NEWV=$(cat "$TMP/x/tonezone/VERSION")

# ---------------------------------------------------------------- user, slots, files
say "Installing Tone Zone $NEWV"
id tonezone >/dev/null 2>&1 || useradd --system --home-dir "$DATA" --shell /usr/sbin/nologin tonezone
for g in audio gpio video input render plugdev; do getent group $g >/dev/null && usermod -aG $g tonezone; done
mkdir -p "$H" "$DATA"
systemctl stop tonezone 2>/dev/null || true
CUR=""
[ -L "$H/current" ] && CUR=$(basename "$(readlink -f "$H/current")")
SLOT=a; [ "$CUR" = a ] && SLOT=b
rm -rf "${H:?}/$SLOT"
mv "$TMP/x/tonezone" "$H/$SLOT"
chmod 755 "$H/$SLOT"/engine/* "$H/$SLOT"/bin/* 2>/dev/null || true
ln -sfn "$H/$SLOT" "$H/current.new" && mv -Tf "$H/current.new" "$H/current"
if [ -n "$CUR" ]; then printf 'previous=%s\n' "$CUR" > "$H/update.state"; else rm -f "$H/update.state"; fi
ln -sfn "$NODE" "$H/node"
S="$H/$SLOT/system"
install -m 755 "$S/boot-check.sh" "$H/boot-check.sh"
install -m 755 "$S/kiosk.sh" "$H/kiosk.sh"
install -m 755 -o root -g root "$S/tonezone-root" /usr/local/sbin/tonezone-root
install -m 755 "$S/tonezone" /usr/local/bin/tonezone
install -m 440 -o root -g root "$S/tonezone.sudoers" /etc/sudoers.d/tonezone
visudo -cf /etc/sudoers.d/tonezone >/dev/null || { rm -f /etc/sudoers.d/tonezone; die "sudoers check failed"; }
install -m 644 "$S/tonezone.avahi.service" /etc/avahi/services/tonezone.service
install -m 644 "$S/tonezone-limits.conf" /etc/security/limits.d/tonezone.conf
install -m 644 "$S/tonezone.service" /etc/systemd/system/tonezone.service
install -m 644 "$S/tonezone-kiosk.service" /etc/systemd/system/tonezone-kiosk.service
[ -f /etc/default/tonezone ] || echo "# extra environment for tz-agent (TZ_PORT=7650 ...)" > /etc/default/tonezone
chown -R tonezone:tonezone "$H" "$DATA"
chown root:root /usr/local/sbin/tonezone-root

# ---------------------------------------------------------------- tuning
if [ $TUNING = 1 ]; then
  say "Tuning: performance CPU governor, Wi-Fi power save off, direct cable fallback"
  /usr/local/sbin/tonezone-root governor performance || true
  if [ -d /etc/NetworkManager/conf.d ]; then
    printf '[connection]\nwifi.powersave = 2\n' > /etc/NetworkManager/conf.d/tonezone-wifi.conf
    # a cable straight to a computer (no DHCP): fall back to a link-local address so tonezone.local still works
    if command -v nmcli >/dev/null && ! nmcli -t -f NAME connection show | grep -qx 'tonezone-direct'; then
      nmcli connection add type ethernet ifname eth0 con-name tonezone-direct ipv4.method link-local ipv6.method link-local connection.autoconnect-priority -10 >/dev/null 2>&1 || true
    fi
  fi
  command -v iw >/dev/null && iw dev wlan0 set power_save off 2>/dev/null || true
fi
if [ $PWM = 1 ]; then
  CFG=/boot/firmware/config.txt; [ -f $CFG ] || CFG=/boot/config.txt
  if ! grep -q '^dtoverlay=pwm-2chan' $CFG; then
    if [ "$BOARD" = pi5 ]; then say "Pi 5: hardware PWM is not set up by the installer yet, LEDs use software PWM"
    else echo 'dtoverlay=pwm-2chan,pin=12,func=4,pin2=13,func2=4' >> $CFG; say "Hardware PWM on GPIO 12 / 13 turns on after a reboot"; fi
  fi
fi

# ---------------------------------------------------------------- start
systemctl daemon-reload
systemctl enable avahi-daemon >/dev/null 2>&1 || true
systemctl restart avahi-daemon 2>/dev/null || true
systemctl enable tonezone >/dev/null
systemctl restart tonezone
if [ $SCREEN = 1 ]; then /usr/local/sbin/tonezone-root kiosk on 0 || true; fi
say "Waiting for Tone Zone to start"
CODE=""
for _ in $(seq 1 40); do
  CODE=$(curl -fs http://127.0.0.1:7650/api/pair/code 2>/dev/null | "$NODE" -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).code)}catch{}})" || true)
  [ -n "$CODE" ] && break
  sleep 1
done
IPS=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9.]+$' | tr '\n' ' ')
echo
echo "  Tone Zone $NEWV is running."
echo "  Address:       $(hostname).local   ($IPS)"
if [ -n "$CODE" ]; then echo "  Pairing code:  $CODE"; else echo "  Pairing code:  run 'tonezone pair' in a moment (see 'tonezone logs' if it does not start)"; fi
echo
echo "  In Tone Zone on your computer: open the Pi tab, Add a Pi, and type the code."
echo "  Useful: tonezone status | tonezone logs | tonezone pair | tonezone uninstall"
