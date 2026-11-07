# Deadlock Street Brawl Helper 🃏

<p align="center">
  <img alt="One real Street Brawl draft at normal speed: it shows the Reading sign, then score plates on the cards with the advised one marked in teal" src="docs/brawl-overlay.gif">
</p>

A draft advisor for [Deadlock](https://store.steampowered.com/app/1422450/Deadlock/)'s Street Brawl mode. It reads the draft screen while you play, ranks the three cards you're offered, and says whether the set is worth a re-roll. The advice is drawn over the draft screen. Scores are built from Street Brawl matches since the 2026-10-30 patch from [deadlock-api.com](https://deadlock-api.com), for all 44 heroes.

## Quickstart 🚀

Requires Windows. Get the app from the [latest release](https://github.com/Gidntsquia/deadlock-street-brawl-helper/releases/latest): a portable `.exe` and an installer.

1. In Deadlock's Video settings, set Display Mode to Borderless Windowed.
2. Run the app. It finds the Deadlock window on its own.
3. Play a Street Brawl draft. The advice shows up over the draft screen.

IMPORTANT: the files aren't code-signed, so Windows SmartScreen will warn you. Click More info, then Run anyway.

Press F8 to read the draft right away if the app hasn't picked it up. With no game running, pick First-run check in the tray menu and press Show me to try the overlay on a real draft screenshot. The debug panel (Ctrl+Shift+D) is in development and release-candidate builds only.

To work on it (needs [Node.js](https://nodejs.org) 20 or newer):

```
npm install
npm run dev                                # Browser version, for development only
npm run brawl -- --hero 1 --round 2 --set "Improved Spirit,Enchanter's Emblem,Swift Striker"   # Advice without the screen reader
npm run fetch-data -- --since 2026-10-30   # Refreshes the Street Brawl snapshot (~1400 requests, ~9 min)
npm run win:dev                            # From WSL: runs the Windows app from a synced copy
npm run check                              # Lint, typecheck, formatting and tests
```

## Linux 🐧

This fork adds Linux support (tested on KDE Plasma 6 on Wayland, Deadlock through Steam and Proton). Proton runs the game
as an XWayland window, so the app runs under XWayland too: it finds the game window over X11, reads it with X11 window
capture, and reads card names with [tesseract.js](https://github.com/naptha/tesseract.js) instead of Windows OCR. The
scoring and data are upstream's, unchanged. Like the Windows app, it only reads the screen and draws its own window. It
never touches game files or game memory, and it makes no network requests.

**AppImage** (any x86_64 distro): download `deadlock-street-brawl-helper-<version>-x86_64.AppImage` from Releases,
`chmod +x` it and run it. AppImages need FUSE 2 (`sudo apt install libfuse2t64` on Ubuntu 24.04 and newer,
`sudo pacman -S fuse2` on Arch); without it, run it with `--appimage-extract-and-run`.

**From source** (Node 20 or newer):

```bash
git clone https://github.com/gabeparra/deadlock-street-brawl-helper-linux
cd deadlock-street-brawl-helper-linux
npm ci
node node_modules/electron/install.js   # only needed if your npm has ignore-scripts on
npm run build:electron
scripts/linux/run.sh
```

`npm run dist` builds the AppImage into `release/`. `scripts/linux/e2e.sh` runs upstream's Electron test harness against
test mode's dummy window.

- **Desktops:** the overlay is an override-redirect X11 window, so it sits above the fullscreen game without any window
  manager setup. If your setup needs it managed instead, start with `BRAWL_X11_MANAGED=1`; on KDE that also needs
  `scripts/linux/kwin-rule.sh`, which lifts the overlay above fullscreen windows (`--remove` takes it out again).
- The app always runs under XWayland. If it starts without `--ozone-platform=x11` (or with
  `ELECTRON_OZONE_PLATFORM_HINT=wayland` set), it restarts itself once with it.
- **Mouse leaves the game on a multi-monitor setup:** that's Proton, not this app. With the game closed, add this to
  `steamapps/compatdata/1422450/pfx/user.reg` to keep the cursor in the fullscreen game:
  ```
  [Software\\Wine\\X11 Driver]
  "GrabFullscreen"="Y"
  ```
- Tested on KDE Plasma 6. GNOME, Hyprland and Sway should work the same way (XWayland), but haven't been tried yet. A
  native Wayland game (`PROTON_ENABLE_WAYLAND=1`) isn't supported, since the app can't see Wayland windows.

## Features 🔬

- Reads the three cards, the round, the enemy team and the items you've already picked from the screen. Nothing is sent to the game.
- Ranks the cards for your hero using pick rate, win rate and how well each item scales that hero's abilities, and shifts the ranking toward items that do well against the enemy heroes.
- Says when a re-roll is the better call and moves the box to the Use Re-Roll button.
- Reads your hero from the loading screen and keeps it for the whole match. If the app starts mid-match it guesses from the scoreboard, marks the guess, and lets you pick the hero by hand.
- Shows a picture of the ability points panel for about 15 seconds after the draft closes, with this round's points highlighted.
- Lets you set your own ability upgrade order per hero by clicking a copy of that panel, with the abilities labelled 1 to 4.
- Grades every hero and draftable item S, A, B or C on a second tab.
- Tells you to switch to Borderless Windowed if the capture has been black for 10 seconds.
- Has a test mode that opens a dummy Deadlock window with a real draft screenshot.

## Documentation 📚

More details in the
[wiki](https://github.com/Gidntsquia/deadlock-street-brawl-helper/wiki):

- [Street Brawl Advisor](https://github.com/Gidntsquia/deadlock-street-brawl-helper/wiki/Street-Brawl-Advisor) — the mode's rules, card scoring, re-roll maths
- [Screen Reader](https://github.com/Gidntsquia/deadlock-street-brawl-helper/wiki/Screen-Reader) — how cards, tiers, labels, your picks and your hero are recognised
- [Name Reader](https://github.com/Gidntsquia/deadlock-street-brawl-helper/wiki/Name-Reader) — how card names are read with Windows OCR
- [Overlay](https://github.com/Gidntsquia/deadlock-street-brawl-helper/wiki/Overlay) — screen capture and the always-on-top window
- [Windows App](https://github.com/Gidntsquia/deadlock-street-brawl-helper/wiki/Windows-App) — the packaged app, first run, test mode, developing from WSL
- [Tier List](https://github.com/Gidntsquia/deadlock-street-brawl-helper/wiki/Tier-List) — how the S/A/B/C grades are worked out
- [Data Pipeline](https://github.com/Gidntsquia/deadlock-street-brawl-helper/wiki/Data-Pipeline) — what fetch-data downloads and the data window
- [Development](https://github.com/Gidntsquia/deadlock-street-brawl-helper/wiki/Development) — code layout, scripts, checks

## License 📄

[MIT](LICENSE). Match data and item art come from [deadlock-api.com](https://deadlock-api.com);
Deadlock is Valve's.
