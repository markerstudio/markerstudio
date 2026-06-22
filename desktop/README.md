# Marker Admin — macOS app

A small native macOS wrapper around the **Marker Studio admin portal**
(`https://marker.ps/admin`). It's a [Tauri](https://tauri.app) shell: a real
`.app` / `.dmg` with the Marker icon and native menus, opening the **hosted**
admin in its own window.

It does **not** bundle the database, secrets, or the Next.js server — those stay
server-side on your deployment. The app just points a window at the live portal,
so logins, the session cookie, Meta data, and AI reading all work exactly as in
the browser.

## What URL it opens

`https://marker.ps/admin` — your production domain (set in
`src-tauri/tauri.conf.json` → `app.windows[0].url`). To point it at a staging
deploy instead, change that one value.

## Build a .dmg

### The easy way — GitHub Actions (recommended)

The repo ships a workflow at `.github/workflows/desktop-release.yml` that builds
a universal `.dmg` (Intel + Apple Silicon) on a macOS runner and attaches it to a
**GitHub Release**. To cut a release:

```bash
# from the repo root
git tag desktop-v0.1.0
git push origin desktop-v0.1.0
```

…or run it manually from the **Actions** tab → *Desktop release (.dmg)* → *Run
workflow*. The `.dmg` lands as a **draft Release**; publish it and share the link
(see "Where people download it").

### Locally (requires a Mac)

Prereqs: macOS, [Rust](https://rustup.rs), Node 18+, and Xcode command-line
tools (`xcode-select --install`).

```bash
cd desktop
npm install
npm run icons        # generates app icons from ../public/assets/logo-favicon.png
npm run build:dmg    # outputs the universal .dmg
```

The `.dmg` is written to:

```
desktop/src-tauri/target/universal-apple-darwin/release/bundle/dmg/
```

For day-to-day development, `npm run dev` opens the app window with hot-reload.

## Where people download it

The build publishes the `.dmg` to **GitHub Releases**
(`github.com/markerstudio/markerstudio/releases`). For an internal team tool
that's usually all you need — releases on a private repo require a GitHub login,
so it's access-controlled for free.

Alternatives if you want a friendlier link:

- **A short link on your own site**, e.g. `marker.ps/download`, that redirects to
  the latest Release asset.
- **Vercel Blob** (already a dependency here) — upload the `.dmg` and serve it
  behind the existing admin auth.

## Code signing & notarization (optional)

The default build is **unsigned**: it works, but on first launch macOS Gatekeeper
shows a warning, so users must right-click the app → **Open** once. Fine for a
small internal team.

For a clean, warning-free install you need an **Apple Developer ID** ($99/yr).
Add these as repo secrets and the workflow signs + notarizes automatically:

| Secret | What it is |
|---|---|
| `APPLE_CERTIFICATE` | base64 of your `Developer ID Application` `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | password for that `.p12` |
| `APPLE_SIGNING_IDENTITY` | e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID` | your Apple ID email |
| `APPLE_PASSWORD` | an app-specific password for that Apple ID |
| `APPLE_TEAM_ID` | your 10-char Apple Team ID |
