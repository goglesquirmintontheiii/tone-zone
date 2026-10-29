#!/usr/bin/env bash
# Builds the realtime DSP engine for x86-64-v2 (baseline) and x86-64-v3 (AVX2/FMA) into engine/dist.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
JOBS="${JOBS:-$(nproc)}"
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
