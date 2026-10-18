# Kanji Flash

A dependency-free, mobile-friendly flashcard app for studying the 367 kanji in the JLPT N2 deck.

## Features

- **Marathon**: work through the complete deck, marking cards as `Got it` or `Again`.
- **Daily Challenge**: review as many cards as possible before the selected time limit expires.
- **Type Answer**: enter an onyomi reading or English meaning and receive immediate feedback.
- **Lessons**: today's lesson is built by a preliminary test (事前テスト). It keeps quizzing kanji you have not studied yet (meaning and reading for each) until you have missed as many as the lesson size (10 by default); those missed kanji become the lesson, and kanji you answer fully correctly are marked known and skipped. The lesson itself is typed questions on those kanji; completion is tracked on a monthly calendar, and due kanji can be reviewed the same way.
- **Custom Decks Quiz**: a typed-answer placement quiz for an uploaded deck, played in fixed-size rounds (Quiz Questions setting). Unreviewed cards come first (shuffled), each answer is saved immediately so you can stop at any time, and correct cards are placed ahead in the review schedule.
- **Statistics**: view a seven-day activity summary, overall accuracy, and per-card results.
- **Settings**: change kanji typography, scale the interface text, set Daily Challenge and lesson question counts, reshuffle the main deck, or reset statistics.
- Persistent progress, statistics, and settings stored locally in the browser, with Export/Import (Settings > Backup) to move them to another device.
- Automatic light and dark color schemes with mobile safe-area support.

## Run Locally

This project has no build step or package dependencies. Serve the project directory with any static HTTP server so the app can load its JSON deck:

```powershell
py -m http.server 8000
```

Open <http://localhost:8000> in a browser. Do not open `index.html` directly from the file system, because the app fetches `data/n2-kanji.json` at startup.

## Project Structure

```text
.
|- index.html                     App markup and screens
|- styles.css                     Responsive visual design
|- app.js                         Flashcard behavior and browser persistence
|- data/n2-kanji.json             JLPT N2 kanji deck (generated)
|- tools/build-kanji-data.mjs     Script that generates the deck from open sources
|- LICENSE                        MIT license (code)
|- NOTICE.md                      Data sources, attribution, and data license
`- .github/workflows/pages.yml    GitHub Pages deployment workflow
```

## Data and Persistence

Each deck entry in `data/n2-kanji.json` includes a kanji character, onyomi and kunyomi readings (including romaji), and English meanings. The app stores the active deck, result history, and settings in `localStorage`; clearing site data resets this information. There is no server or account: use Settings > Backup > Export to download a JSON file and Import on another device, choosing to merge with or replace that device's data.

## Deployment

The included GitHub Actions workflow publishes the repository root to GitHub Pages whenever changes are pushed to `main`. In the repository settings, set Pages > Source to "GitHub Actions". The app uses only relative paths, so it works under the `/kanji-flashcards/` project URL.

## License

The code is released under the [MIT License](LICENSE). The kanji data in `data/n2-kanji.json` is derived from KANJIDIC2 and is licensed separately under CC BY-SA 4.0; see [NOTICE.md](NOTICE.md) for sources and attribution.

## Syncing between devices

Settings > Device sync pairs two devices (for example a phone and a PC) over a direct WebRTC connection using [PeerJS](https://peerjs.com/). Open the screen on both devices on the same network: they find each other and you confirm that both show the same number. After that, open the sync screen on both and they connect and merge progress automatically (statistics, review schedule, lessons, custom answers, custom decks). Nothing is stored on a server: PeerJS's free public broker only introduces the devices, and the data travels between them encrypted. Both devices need to be online and on the sync screen at the same time, and connections can fail across some mobile networks without a relay, in which case use the same Wi-Fi. Settings and marathon progress stay per device. Only two devices are supported per pairing. To switch to a new phone or PC, open Device sync on it: the device you already use notices the newcomer and asks whether to pair with it instead (after the same number check), which replaces the old pairing.

`sync.js` holds the merge logic; its tests run with `node tools/sync-merge.test.cjs`.
