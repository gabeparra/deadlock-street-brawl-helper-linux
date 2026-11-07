#!/usr/bin/env bash
# KWin (Plasma 6) rule for the Linux overlay: Deadlock is an *active fullscreen* window, which KWin stacks above
# keep-above windows, so the overlay window (title "Brawl Overlay") is forced to the On-Screen-Display type, whose layer
# sits above fullscreen. User config only (~/.config/kwinrulesrc). `--remove` deletes the rule again.
set -euo pipefail
G=brawl-overlay-osd
cfg() { kwriteconfig6 --file kwinrulesrc "$@"; }
rules=$(kreadconfig6 --file kwinrulesrc --group General --key rules || true)
if [[ "${1:-}" == --remove ]]; then
  kwriteconfig6 --file kwinrulesrc --group "$G" --delete-group 2>/dev/null || sed -i "/^\[$G\]/,/^\[/{/^\[$G\]/d;/^\[/!d}" ~/.config/kwinrulesrc
  rules=$(tr ',' '\n' <<<"$rules" | grep -vx "$G" | paste -sd, -)
else
  cfg --group "$G" --key Description "Brawl overlay above fullscreen Deadlock"
  cfg --group "$G" --key wmclass "deadlock-street-brawl-helper"
  cfg --group "$G" --key wmclassmatch 1
  cfg --group "$G" --key title "Brawl Overlay"
  cfg --group "$G" --key titlematch 1
  cfg --group "$G" --key type 16        # NET::OnScreenDisplay
  cfg --group "$G" --key typerule 2     # force
  cfg --group "$G" --key above true
  cfg --group "$G" --key aboverule 2
  cfg --group "$G" --key skiptaskbar true
  cfg --group "$G" --key skiptaskbarrule 2
  cfg --group "$G" --key skipswitcher true
  cfg --group "$G" --key skipswitcherrule 2
  cfg --group "$G" --key acceptfocus false
  cfg --group "$G" --key acceptfocusrule 2
  grep -qx "$G" <<<"$(tr ',' '\n' <<<"$rules")" || rules=${rules:+$rules,}$G
fi
n=$(tr ',' '\n' <<<"$rules" | grep -c . || true)
kwriteconfig6 --file kwinrulesrc --group General --key rules "$rules"
kwriteconfig6 --file kwinrulesrc --group General --key count "$n"
(qdbus6 org.kde.KWin /KWin reconfigure 2>/dev/null || qdbus org.kde.KWin /KWin reconfigure) && echo "kwin reconfigured (rules: $rules)"
