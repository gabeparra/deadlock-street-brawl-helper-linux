#!/usr/bin/env bash
# Installs the Linux app for the current user: an app-menu entry and desktop icon, and a systemd user unit that starts
# the overlay whenever Deadlock starts (Steam's gameprocess_log changes) and stops it when the game exits.
#   scripts/linux/install.sh                  run from this checkout (build it first: npm run build:electron)
#   scripts/linux/install.sh path/to.AppImage run an AppImage instead
#   scripts/linux/install.sh --uninstall      remove all of it
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/../.." && pwd)
units=${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user
apps=${XDG_DATA_HOME:-$HOME/.local/share}/applications
desk=$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")
name=deadlock-street-brawl-helper

if [[ "${1:-}" == --uninstall ]]; then
  systemctl --user disable --now brawl-overlay-game.path 2>/dev/null || true
  systemctl --user stop brawl-overlay.service brawl-overlay-game.service 2>/dev/null || true
  rm -f "$units"/brawl-overlay{,-game}.service "$units"/brawl-overlay-game.path "$apps/$name.desktop" "$desk/$name.desktop"
  systemctl --user daemon-reload
  echo "removed"
  exit 0
fi

if [[ -n "${1:-}" ]]; then
  app=$(realpath "$1")
  exec_start="$app --ozone-platform=x11"
else
  [[ -f "$repo/electron-dist/main.js" ]] || { echo "build first: npm run build:electron" >&2; exit 1; }
  exec_start="$repo/scripts/linux/run.sh"
fi

# Steam's game lifecycle log: flatpak Steam, then the usual native locations.
log=
for d in "$HOME/.var/app/com.valvesoftware.Steam/.local/share/Steam" "$HOME/.local/share/Steam" "$HOME/.steam/steam"; do
  if [[ -f "$d/logs/gameprocess_log.txt" ]]; then log="$d/logs/gameprocess_log.txt"; break; fi
done
[[ -n "$log" ]] || { echo "Steam's logs/gameprocess_log.txt not found: start a game once through Steam, then rerun" >&2; exit 1; }

mkdir -p "$units" "$apps"
cat >"$units/brawl-overlay.service" <<UNIT
[Unit]
Description=Deadlock Street Brawl Helper (overlay)

[Service]
ExecStart=$exec_start
UNIT
cat >"$units/brawl-overlay-game.service" <<UNIT
[Unit]
Description=Run the Street Brawl overlay while Deadlock runs

[Service]
ExecStart=$repo/scripts/linux/with-game.sh
UNIT
cat >"$units/brawl-overlay-game.path" <<UNIT
[Unit]
Description=Watch Steam for Deadlock starting (Street Brawl overlay)

[Path]
PathModified=$log
Unit=brawl-overlay-game.service

[Install]
WantedBy=default.target
UNIT
cat >"$apps/$name.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=Deadlock Street Brawl Helper
Comment=Street Brawl draft overlay for Deadlock
Exec=systemctl --user start brawl-overlay.service
Icon=$repo/build/icon.png
Categories=Game;
Terminal=false
DESK
if [[ -d "$desk" ]]; then
  install -m 755 "$apps/$name.desktop" "$desk/$name.desktop"
fi
systemctl --user daemon-reload
systemctl --user enable --now brawl-overlay-game.path
echo "installed: app menu + desktop icon, and auto-start with Deadlock (watching $log)"
