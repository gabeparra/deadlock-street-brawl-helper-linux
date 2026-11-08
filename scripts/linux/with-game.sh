#!/usr/bin/env bash
# Run by brawl-overlay-game.service each time Steam's gameprocess_log changes (scripts/linux/install.sh). If Deadlock
# (AppId 1422450) is running: start the overlay, wait for the game to exit, stop the overlay. Otherwise do nothing.
set -uo pipefail
pid=$(pgrep -of 'AppId=1422450') || exit 0 # Steam's reaper for the game: lives exactly as long as the game
systemctl --user start brawl-overlay.service
tail --pid="$pid" -f /dev/null
systemctl --user stop brawl-overlay.service
