# Deadlock Street Brawl Helper (Linux / Arch)

> A draft advisor for [Deadlock](https://store.steampowered.com/app/1422450/Deadlock/)'s Street Brawl mode: it reads the draft screen, ranks the three cards you're offered and says whether a re-roll is worth it.

**Status:** `Maintained` - this public repo covers the working Arch Linux release only; further development is private.

![Status: Maintained](https://img.shields.io/badge/status-Maintained-blue)

## Quickstart

### Prerequisites

- Arch Linux, with Deadlock running through Steam and Proton (tested on KDE Plasma 6 on Wayland)
- Node.js 22.22.2 or newer on the 22 line, or 24.15 or newer, plus npm and git
- FUSE 2 if you run it as an AppImage: `sudo pacman -S fuse2`

### Setup & Run

In Deadlock's Video settings, set Display Mode to Borderless Windowed. Then:

```bash
git clone https://github.com/gabeparra/deadlock-street-brawl-helper-linux
cd deadlock-street-brawl-helper-linux
npm ci                   # install
npm run build:electron   # build
scripts/linux/run.sh     # run
npm run check            # lint, typecheck, formatting and tests
```

Play a Street Brawl draft and the advice shows up over the draft screen. Press F8 to read the draft right away if the app hasn't picked it up. With no game running, pick First-run check in the tray menu to try the overlay on a real draft screenshot.

### Optional

- **AppImage:** `npm run dist` builds one into `release/`. Without FUSE 2, run it with `--appimage-extract-and-run`.
- **Start with the game:** `scripts/linux/install.sh` (or `scripts/linux/install.sh path/to.AppImage`) adds an app-menu entry, a desktop icon and a systemd user unit that starts the overlay when Deadlock starts and stops it when the game exits (it watches Steam's `logs/gameprocess_log.txt`, flatpak or native Steam). `--uninstall` removes it all.
- **End-to-end test:** `scripts/linux/e2e.sh` runs upstream's Electron harness against test mode's dummy window. It needs a desktop session, and its `platform` check expects Windows, so that one fails on Linux.

### Troubleshooting

- **Overlay:** it's an override-redirect X11 window, so it sits above the fullscreen game without any window manager setup. If your setup needs it managed instead, start with `BRAWL_X11_MANAGED=1`. On KDE that also needs `scripts/linux/kwin-rule.sh` (`--remove` takes it out again).
- **XWayland:** the app always runs under XWayland. If it starts without `--ozone-platform=x11` (or with `ELECTRON_OZONE_PLATFORM_HINT=wayland` set), it restarts itself once with it.
- **Native Wayland:** a native Wayland game (`PROTON_ENABLE_WAYLAND=1`) isn't supported, since the app can't see Wayland windows.
- **Mouse leaves the game on a multi-monitor setup:** that's Proton, not this app. With the game closed, add this to `steamapps/compatdata/1422450/pfx/user.reg`:
  ```
  [Software\\Wine\\X11 Driver]
  "GrabFullscreen"="Y"
  ```

## Stack & Architecture

- **Stack:** TypeScript, React, Vite, Electron, [tesseract.js](https://github.com/naptha/tesseract.js) for reading card names, and [koffi](https://koffi.dev) for the X11 calls. Tests run on Vitest.
- **Layout:** `electron/` is the app shell, overlay window and screen capture (X11 code in `electron/linux/`), `src/` is the UI and the advisor, `public/data/` is the match data snapshot and `scripts/` holds the data, test and Linux helper tools.
- **How it works:** Proton runs the game as an XWayland window, so the app runs under XWayland too. It finds the game window over X11, captures it, reads the cards and draws its advice in its own window. It never touches game files or game memory, and it makes no network requests while running.
- **Data:** scores are built from Street Brawl matches since the 2026-10-30 patch from [deadlock-api.com](https://deadlock-api.com), for all 44 heroes.
- **Upstream:** a Linux fork of [Gidntsquia/deadlock-street-brawl-helper](https://github.com/Gidntsquia/deadlock-street-brawl-helper). Its [wiki](https://github.com/Gidntsquia/deadlock-street-brawl-helper/wiki) explains how the advisor works (the Windows pages don't apply here). For the Windows app, use upstream.
- **Scope:** other distros, desktops and new features aren't tracked here. The default branch is `linux`, so it stays apart from upstream's `main`.

### Features

- Reads the three cards, the round, the enemy team and the items you've already picked from the screen. Nothing is sent to the game.
- Ranks the cards for your hero using pick rate, win rate and how well each item scales that hero's abilities, and shifts the ranking toward items that do well against the enemy heroes.
- Says when a re-roll is the better call and moves the box to the Use Re-Roll button.
- Reads your hero from the loading screen and keeps it for the whole match. If the app starts mid-match it guesses from the scoreboard, marks the guess, and lets you pick the hero by hand.
- Shows a picture of the ability points panel for about 15 seconds after the draft closes, with this round's points highlighted.
- Lets you set your own ability upgrade order per hero by clicking a copy of that panel, with the abilities labelled 1 to 4.
- Grades every hero and draftable item S, A, B or C on a second tab.
- Tells you to switch to Borderless Windowed if the capture has been black for 10 seconds.
- Has a test mode that opens a dummy Deadlock window with a real draft screenshot.

## Screenshots / Demo

<p align="center">
  <img alt="One real Street Brawl draft at normal speed: it shows the Reading sign, then score plates on the cards with the advised one marked in teal" src="docs/brawl-overlay.gif">
</p>

## License

MIT - see [LICENSE](./LICENSE). The license and copyright are upstream's. Match data and item art come from [deadlock-api.com](https://deadlock-api.com); Deadlock is Valve's.
