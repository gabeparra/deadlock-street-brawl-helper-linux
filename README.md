# Deadlock Street Brawl Helper (Linux / Arch) 🃏

<p align="center">
  <img alt="One real Street Brawl draft at normal speed: it shows the Reading sign, then score plates on the cards with the advised one marked in teal" src="docs/brawl-overlay.gif">
</p>

A draft advisor for [Deadlock](https://store.steampowered.com/app/1422450/Deadlock/)'s Street Brawl mode. It reads the draft screen while you play, ranks the three cards you're offered, and says whether the set is worth a re-roll. The advice is drawn over the draft screen. Scores are built from Street Brawl matches since the 2026-10-30 patch from [deadlock-api.com](https://deadlock-api.com), for all 44 heroes.

This is a Linux fork of [Gidntsquia/deadlock-street-brawl-helper](https://github.com/Gidntsquia/deadlock-street-brawl-helper) (MIT).

## Status 📌

**Scoped public release: working on Arch Linux. Further development continues privately.**

- This public repository only carries the part that works on Arch Linux (tested on KDE Plasma 6 on Wayland, Deadlock through Steam and Proton).
- It is kept as a snapshot of that working release. Other distros, desktops and new features are not tracked here, and requests for them won't be acted on.
- Anything beyond this scope is developed privately and is not published.
- For the Windows app, use the [upstream project](https://github.com/Gidntsquia/deadlock-street-brawl-helper).

## Quickstart 🚀

Requires Arch Linux with Steam and Deadlock running through Proton. Proton runs the game as an XWayland window, so the app runs under XWayland too: it finds the game window over X11, reads it with X11 window capture, and reads card names with [tesseract.js](https://github.com/naptha/tesseract.js). Like the upstream app, it only reads the screen and draws its own window. It never touches game files or game memory, and it makes no network requests.

**AppImage:** download `deadlock-street-brawl-helper-<version>-x86_64.AppImage` from [Releases](https://github.com/gabeparra/deadlock-street-brawl-helper-linux/releases), `chmod +x` it and run it. It needs FUSE 2 (`sudo pacman -S fuse2`); without it, run it with `--appimage-extract-and-run`.

**From source** (Node.js 20 or newer):

```bash
git clone https://github.com/gabeparra/deadlock-street-brawl-helper-linux
cd deadlock-street-brawl-helper-linux
npm ci
node node_modules/electron/install.js   # only needed if your npm has ignore-scripts on
npm run build:electron
scripts/linux/run.sh
```

`scripts/linux/install.sh` (or `scripts/linux/install.sh path/to.AppImage`) adds an app-menu entry and desktop icon, and a systemd user unit that starts the overlay when Deadlock starts and stops it when the game exits (it watches Steam's `logs/gameprocess_log.txt`, flatpak or native Steam). `--uninstall` removes it all.

`npm run dist` builds the AppImage into `release/`. `scripts/linux/e2e.sh` runs upstream's Electron test harness against test mode's dummy window. `npm run check` runs lint, typecheck, formatting and tests.

### Notes

- **Overlay:** an override-redirect X11 window, so it sits above the fullscreen game without any window manager setup. If your setup needs it managed instead, start with `BRAWL_X11_MANAGED=1`; on KDE that also needs `scripts/linux/kwin-rule.sh` (`--remove` takes it out again).
- The app always runs under XWayland. If it starts without `--ozone-platform=x11` (or with `ELECTRON_OZONE_PLATFORM_HINT=wayland` set), it restarts itself once with it.
- **Mouse leaves the game on a multi-monitor setup:** that's Proton, not this app. With the game closed, add this to `steamapps/compatdata/1422450/pfx/user.reg`:
  ```
  [Software\\Wine\\X11 Driver]
  "GrabFullscreen"="Y"
  ```
- A native Wayland game (`PROTON_ENABLE_WAYLAND=1`) isn't supported, since the app can't see Wayland windows.
- Press F8 to read the draft right away if the app hasn't picked it up. With no game running, pick First-run check in the tray menu to try the overlay on a real draft screenshot.

## Features 🔬

- Reads the three cards, the round, the enemy team and the items you've already picked from the screen. Nothing is sent to the game.
- Ranks the cards for your hero using pick rate, win rate and how well each item scales that hero's abilities, and shifts the ranking toward items that do well against the enemy heroes.
- Says when a re-roll is the better call and moves the box to the Use Re-Roll button.
- Reads your hero from the loading screen and keeps it for the whole match. If the app starts mid-match it guesses from the scoreboard, marks the guess, and lets you pick the hero by hand.
- Shows a picture of the ability points panel for about 15 seconds after the draft closes, with this round's points highlighted.
- Lets you set your own ability upgrade order per hero by clicking a copy of that panel.
- Grades every hero and draftable item S, A, B or C on a second tab.
- Tells you to switch to Borderless Windowed if the capture has been black for 10 seconds.
- Has a test mode that opens a dummy Deadlock window with a real draft screenshot.

## Documentation 📚

Background on how the advisor works is in the [upstream wiki](https://github.com/Gidntsquia/deadlock-street-brawl-helper/wiki) (the Windows-specific pages don't apply here).

## License 📄

[MIT](LICENSE). Match data and item art come from [deadlock-api.com](https://deadlock-api.com); Deadlock is Valve's.
