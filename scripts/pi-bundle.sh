#!/usr/bin/env bash
# Builds the Raspberry Pi bundle: dist-pi/pi-bundle-<version>-arm64.tar.gz with the engine, the GPIO helper,
# tz-agent, the screen UI, install / uninstall scripts and systemd units, plus SHA256SUMS and pi-latest.json.
# Signs it when TZ_PI_SIGNING_KEY is set (CI secret). Needs engine/dist-pi/tonezone-engine-arm64
# (scripts/build-engine.sh arm64) and a C compiler for aarch64 (cross or native).
#   scripts/pi-bundle.sh [version]   (default: app/package.json version)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
V="${1:-$(node -p "require('$ROOT/app/package.json').version")}"
ARCH=arm64
OUT="${TZ_PI_OUT:-$ROOT/dist-pi}"
ENGINE="${TZ_PI_ENGINE:-$ROOT/engine/dist-pi/tonezone-engine-arm64}"
[ -f "$ENGINE" ] || { echo "missing $ENGINE: run scripts/build-engine.sh arm64" >&2; exit 1; }
if [ "$(uname -m)" = aarch64 ]; then CC=${CC:-gcc}; STRIP=strip; else CC=${CC:-aarch64-linux-gnu-gcc}; STRIP=aarch64-linux-gnu-strip; fi
W=$(mktemp -d)
trap 'rm -rf "$W"' EXIT
B="$W/tonezone"
mkdir -p "$B"/{engine,bin,system} "$OUT"
cp -r "${TZ_PI_AGENT_DIR:-$ROOT/pi/agent}" "$B/agent"
rm -rf "$B/agent/node_modules"
node -e "const f='$B/agent/package.json',j=require(f);j.version='$V';require('fs').writeFileSync(f,JSON.stringify(j,null,2)+'\n')"
cp -r "$ROOT/pi/ui" "$B/ui"
cp "$ENGINE" "$B/engine/tonezone-engine-arm64"
$CC -O2 -Wall -o "$B/bin/tz-gpio" "$ROOT/pi/gpio/tz-gpio.c" -lpthread
$STRIP "$B/bin/tz-gpio" || true
cp "$ROOT"/pi/system/* "$B/system/"
cp "$ROOT/pi/install.sh" "$ROOT/pi/uninstall.sh" "$ROOT/pi/release-key.pub.pem" "$B/"
cp "$ROOT/THIRD_PARTY.md" "$B/" 2>/dev/null || true
echo "$V" > "$B/VERSION"
chmod 755 "$B"/engine/* "$B"/bin/* "$B"/install.sh "$B"/uninstall.sh "$B"/system/*.sh "$B"/system/tonezone "$B"/system/tonezone-root
# manifest: SHA-256 of every file (checked again on the Pi after unpacking)
(cd "$B" && node -e "
  const fs=require('fs'),path=require('path'),c=require('crypto');
  const walk=(d,p='')=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name),p+e.name+'/'):[p+e.name]);
  const files={};for(const f of walk('.').sort())files[f]=c.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  fs.writeFileSync('manifest.json',JSON.stringify({name:'tonezone-pi',version:'$V',arch:'$ARCH',created:new Date().toISOString(),files},null,1));")
NAME="pi-bundle-$V-$ARCH.tar.gz"
tar --owner=0 --group=0 --sort=name -czf "$OUT/$NAME" -C "$W" tonezone
cp "$ROOT/pi/install.sh" "$OUT/install.sh"
SHA=$(sha256sum "$OUT/$NAME" | cut -d' ' -f1)
SIG=""
if [ -n "${TZ_PI_SIGNING_KEY:-}" ]; then
  node "$ROOT/scripts/pi-sign.js" "$OUT/$NAME"
  SIG="$NAME.sig"
else
  rm -f "$OUT/$NAME.sig"
  echo "note: TZ_PI_SIGNING_KEY not set, the bundle is unsigned (Pis only accept it with dev bundles allowed)"
fi
NOTES="$ROOT/docs/releases/v$V.md"
node -e "
  const fs=require('fs');const n=fs.existsSync('$NOTES')?fs.readFileSync('$NOTES','utf8').split('\n').filter(l=>/^[-*] /.test(l)).map(l=>l.slice(2).trim()).slice(0,12):[];
  fs.writeFileSync('$OUT/pi-latest.json',JSON.stringify({version:'$V',arch:'$ARCH',bundle:'$NAME',sha256:'$SHA',sig:'$SIG'||null,notes:n},null,1)+'\n');"
(cd "$OUT" && sha256sum "$NAME" install.sh pi-latest.json > SHA256SUMS)
ls -la "$OUT"
