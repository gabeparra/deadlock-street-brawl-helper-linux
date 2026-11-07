#!/usr/bin/env bash
# Upstream's Electron e2e harness (scripts/win/e2e-main.cjs) on Linux, against test mode's dummy window: builds with the
# dev tooling compiled in (the harness hooks), computes the expected verdicts, runs it under XWayland and leaves the
# report in logs/win-e2e.json. Known on Linux: the "platform" check expects win32 and fails by design; "first-run-shown"
# can race the page reload it triggers (the panel shows, the check reads too early).
set -euo pipefail
cd "$(dirname "$0")/../.."
BRAWL_DEVTOOLS=1 npm run build:electron >/dev/null
npx tsx scripts/win/compute-verdicts.ts >/dev/null
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
export DISPLAY=${DISPLAY:-:0}
if [[ -z "${XAUTHORITY:-}" ]]; then XAUTHORITY=$(ls "$XDG_RUNTIME_DIR"/xauth_* 2>/dev/null | head -1 || true); export XAUTHORITY; fi
status=0
./node_modules/electron/dist/electron --ozone-platform=x11 scripts/win/e2e-main.cjs "$@" | grep -E '^\[(PASS|FAIL|INFO)\]' || status=$?
echo "rebuild without BRAWL_DEVTOOLS (npm run build:electron) before using the app normally"
exit $status
