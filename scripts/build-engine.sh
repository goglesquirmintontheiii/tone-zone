#!/usr/bin/env bash
# Builds the realtime DSP engine.
#   build-engine.sh          x86-64-v2 (baseline) and x86-64-v3 (AVX2/FMA) into engine/dist (desktop app)
#   build-engine.sh arm64    aarch64 for Raspberry Pi 3B / 3B+ / 4 / 5 (64-bit Pi OS) into engine/dist-pi
#   build-engine.sh armhf    32-bit Pi OS, best effort, into engine/dist-pi
# ARM builds cross compile when the host is not ARM (needs g++-aarch64-linux-gnu / g++-arm-linux-gnueabihf).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JOBS="${JOBS:-$(nproc)}"
TARGET="${1:-x86}"

if [ "$TARGET" = "arm64" ] || [ "$TARGET" = "armhf" ]; then
  B="$ROOT/engine/build-$TARGET"
  ARGS=(-DCMAKE_BUILD_TYPE=Release)
  HOSTARCH="$(uname -m)"
  if [ "$TARGET" = "arm64" ] && [ "$HOSTARCH" != "aarch64" ]; then
    ARGS+=(-DCMAKE_TOOLCHAIN_FILE="$ROOT/engine/cmake/aarch64-linux-gnu.cmake")
    STRIP=aarch64-linux-gnu-strip
  elif [ "$TARGET" = "armhf" ] && [ "${HOSTARCH#arm}" = "$HOSTARCH" ]; then
    ARGS+=(-DCMAKE_TOOLCHAIN_FILE="$ROOT/engine/cmake/arm-linux-gnueabihf.cmake")
    STRIP=arm-linux-gnueabihf-strip
  else
    STRIP=strip
  fi
  [ "$TARGET" = "armhf" ] && ARGS+=(-DTZ_CPU=cortex-a53)
  mkdir -p "$ROOT/engine/dist-pi"
  cmake -S "$ROOT/engine" -B "$B" "${ARGS[@]}" > /dev/null
  cmake --build "$B" -j "$JOBS"
  OUT="$ROOT/engine/dist-pi/tonezone-engine-$TARGET"
  cp "$B/tonezone-engine" "$OUT.new"
  $STRIP "$OUT.new" || true
  mv -f "$OUT.new" "$OUT"
  # Pi OS Bookworm ships glibc 2.36: report the newest glibc symbol the binary needs
  NEED=$(objdump -T "$OUT" 2>/dev/null | grep -o 'GLIBC_[0-9.]*' | sort -uV | tail -1 || true)
  echo "built $OUT (needs ${NEED:-unknown})"
  if [ -n "${TZ_MAX_GLIBC:-}" ] && [ -n "$NEED" ]; then
    if [ "$(printf '%s\n%s\n' "GLIBC_$TZ_MAX_GLIBC" "$NEED" | sort -V | tail -1)" != "GLIBC_$TZ_MAX_GLIBC" ]; then
      echo "error: $NEED is newer than GLIBC_$TZ_MAX_GLIBC (build on an older distro)" >&2
      exit 1
    fi
  fi
  exit 0
fi

mkdir -p "$ROOT/engine/dist"
for ARCH in v2 v3; do
  B="$ROOT/engine/build-$ARCH"
  cmake -S "$ROOT/engine" -B "$B" -DCMAKE_BUILD_TYPE=Release -DTZ_ARCH="x86-64-$ARCH" > /dev/null
  cmake --build "$B" -j "$JOBS"
  # copy + rename so a running engine (busy binary) doesn't block the update
  cp "$B/tonezone-engine" "$ROOT/engine/dist/.tonezone-engine-$ARCH.new"
  strip "$ROOT/engine/dist/.tonezone-engine-$ARCH.new" || true
  mv -f "$ROOT/engine/dist/.tonezone-engine-$ARCH.new" "$ROOT/engine/dist/tonezone-engine-$ARCH"
done
ls -la "$ROOT/engine/dist"
