#!/usr/bin/env bash
# Start the built app on Linux under XWayland (Deadlock under Proton is an XWayland window; see electron/linux/).
# Works from a Plasma session or from tmux/ssh (fills in the session's display env when it is missing).
set -euo pipefail
cd "$(dirname "$0")/../.."
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}
export DISPLAY=${DISPLAY:-:0}
export WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-wayland-0}
export DBUS_SESSION_BUS_ADDRESS=${DBUS_SESSION_BUS_ADDRESS:-unix:path=$XDG_RUNTIME_DIR/bus}
if [[ -z "${XAUTHORITY:-}" ]]; then XAUTHORITY=$(ls "$XDG_RUNTIME_DIR"/xauth_* 2>/dev/null | head -1 || true); export XAUTHORITY; fi
exec ./node_modules/electron/dist/electron --ozone-platform=x11 . "$@"
