#!/bin/bash
# usage: run.sh graph.json in.wav out.wav
exec "$(dirname "$0")/../build/tonezone-engine" --offline "$@"
