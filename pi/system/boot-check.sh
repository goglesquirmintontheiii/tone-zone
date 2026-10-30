#!/bin/sh
# Runs before the agent starts (ExecStartPre). If a freshly installed version keeps crashing before it could
# check itself, go back to the previous slot after 3 tries. The agent itself handles a failed health check.
H="${TZ_HOME:-/opt/tonezone}"
S="$H/update.state"
[ -f "$S" ] || exit 0
get() { sed -n "s/^$1=//p" "$S" | head -n 1; }
pending=$(get pending)
[ -n "$pending" ] || exit 0
prev=$(get previous)
attempts=$(get attempts)
attempts=$(( ${attempts:-0} + 1 ))
if [ "$attempts" -gt 3 ] && [ -n "$prev" ] && [ -d "$H/$prev/agent" ]; then
  ln -sfn "$H/$prev" "$H/current.new" && mv -Tf "$H/current.new" "$H/current"
  printf 'failed=%s\nfailedVersion=%s\n' "$pending" "$(get version)" > "$S.tmp" && mv -f "$S.tmp" "$S"
  echo "tonezone: version in slot $pending did not start, rolled back to slot $prev"
  exit 0
fi
sed "s/^attempts=.*/attempts=$attempts/" "$S" > "$S.tmp" && mv -f "$S.tmp" "$S"
exit 0
