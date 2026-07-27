# Cycle — local-first period tracker

A period-tracking PWA with predictions, a calendar, insights charts, daily logging, PIN lock and reminders — **with every byte of data staying on your device**. No accounts, no backend, no analytics, no external network calls. Everything runs from static files and stores data in your browser's IndexedDB.

## Run it

Requirements: Python 3 on your PATH (any static file server works).

```
run.bat
```

Then open http://localhost:5610.

Note: opening `index.html` directly from the file system will not work — ES modules and service workers need an HTTP origin, so use the server.

## Install on iPhone

1. Make sure your phone and PC are on the same Wi-Fi.
2. Run `run.bat` — it prints your PC's LAN IP.
3. On the iPhone, open Safari and go to `http://YOUR-LAN-IP:5610`.
4. Tap the **Share** button (square with arrow).
5. Tap **Add to Home Screen**, then **Add**.
6. Launch "Cycle" from the home screen — it runs full-screen and works offline from then on.

## Back up your data — regularly

Your data lives only in this browser's IndexedDB. **iOS can evict a web app's storage** if the app is unused for a while or the device is low on space — and that would silently delete your history. Protect yourself:

- Go to **Settings → Data → Export backup** regularly. It downloads a `period-backup-YYYY-MM-DD.json` file.
- Store the file somewhere safe (Files app, private cloud folder — your choice).
- Restore any backup via **Settings → Data → Import** (this replaces all current data).

## Notification limitations (honest version)

Reminders (period due, fertile window, ovulation, pill) are computed and shown **when you open the app**. On iOS, an installed web app cannot wake itself up in the background to push a notification — true push requires a server, and this app deliberately has none. So treat reminders as "shown at launch", and open the app daily (or enable the daily log reminder) for best results.

## Privacy

- 100% local. Data never leaves this device unless you export it yourself.
- No accounts, no cloud, no analytics, no third-party requests of any kind.
- Optional 4-digit PIN lock (Settings → Privacy) — stored as a salted SHA-256 hash.
- "Delete all data" in Settings wipes everything instantly.

## Development

Static files, vanilla ES modules, no build step. `tests.html` runs the unit tests for the cycle model and predictions — open http://localhost:5610/tests.html.
