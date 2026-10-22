# dsh-session-color

Right-click a session row in the DeepSeek Harness sidebar to **color-tag** it. Red is the default; ten palette colors plus a custom picker; tags persist locally.

## What you get

- **Right-click a session row** in the sidebar → the palette opens (the host's native context menu is replaced on session rows only; messages, composer and every other surface keep their behavior).
- Quick row: **Mark red** (default) / **Clear color**.
- 10-color palette — red, orange, yellow, green, cyan, blue, violet, pink, gray, black — the current color gets a ring.
- **Custom…** opens the system color picker for any hex color.
- A tag paints the row with a translucent tint plus a solid 3px bar on the left, so selected/hover backgrounds still show through.
- Colors are stored per `sessionId` in `localStorage` (`dsh-session-colors-v1`) — survives refresh and restart.
- The menu closes on outside click, `Esc`, window blur or resize.

## How it works

- Host half (`lib/index.js`):
  - pushes one **inline script row** into `webserver/index-inject` as the first thing in `apply()` (the desktop shell collects that table once at boot), wrapped so a missing route fails silently and never blocks startup;
  - registers `GET /dsh-session-color/session-color.js` once the web server is up, cached by mtime — **edit the client script and hard-refresh the page, no restart needed**.
- Client half (`assets/session-color.js`): plain DOM, no dependencies, fully wrapped in try/catch.
  - Rows are found through the stable attribute `[data-row-key^="session:"]` written by `dsh-client-ui-workspace`'s `SessionNodeItem` — deliberately avoiding hashed CSS-module class names.
  - Tagging never touches React's inline styles: one `<style>` element carries generated
    `[data-row-key="session:<id>"]` rules, so re-renders and list recycling keep the color.

## Install

```sh
dsh plugin --profile desktop add dsh-session-color
```

then add `"dsh-session-color"` to `dsh.profile.bundles` in your profile `package.json` and restart the desktop app.

Local development: point `DSH_SESSION_COLOR_SCRIPT` at your working copy of `assets/session-color.js`; the route re-reads it by mtime, so a hard refresh is enough.

## Uninstall

1. Remove the entry from `cordis.patch.yml` / `dsh.profile.bundles`.
2. `dsh plugin --profile desktop remove dsh-session-color`.
3. Restart. Optionally clear the leftover `dsh-session-colors-v1` key.

## Limits

- Only the sidebar's session rows are handled. Search-result rows have no `data-row-key`, so right-click keeps the host behavior there.
- Colors live in the browser's `localStorage`: not synced across devices, not part of session metadata, lost if site data is cleared.
- Tagging is purely visual; it never touches archived/pinned state.
