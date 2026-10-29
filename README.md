# Kanji Flash

A dependency-free, mobile-friendly flashcard app for studying the 367 kanji in the JLPT N2 deck.

## Features

- **Labels on terms**: an uploaded deck can include a `Common` column (`Common word` or `Uncommon`) and a `JLPT` column (`N3`), as exported by cave-story-assist. A `Part of speech` column is read the same way. They are shown as Jisho-style badges on the lesson buttons and in 編集, are not asked as questions, and the lesson chart can be filtered by them (common word, JLPT level, part of speech).
- **Review All (すべて復習)**: pick a deck and answer every reading and meaning question for every term in it once, typed; a report card at the end lists what was wrong, with your answer and the right one.
- **Daily Challenge**: review as many cards as possible before the selected time limit expires.
- **Type Answer**: enter an onyomi reading or English meaning and receive immediate feedback.
- **Lessons**: pick a deck (the N2 kanji or any custom deck) and choose the terms to study from a chart of every term, with the reading above and the meaning below; selected terms light up. The lesson itself is typed questions on those terms (every reading and meaning, shuffled; for N2 kanji with a verb or adjective, also that word's reading and meaning); completion is tracked on a monthly calendar, and due terms can be reviewed the same way.
- **Custom Decks Quiz**: a typed-answer placement quiz for an uploaded deck, played in fixed-size rounds (Quiz Questions setting). Unreviewed cards come first (shuffled), each answer is saved immediately so you can stop at any time, and correct cards are placed ahead in the review schedule.
- **Statistics**: view a seven-day activity summary, overall accuracy, and per-card results.
- **Settings**: change kanji typography, scale the interface text, set the review and quiz question counts, or reset statistics.
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
|- tools/build-kanji-words.mjs    Adds each kanji's verb/adjective (from JMdict) to the deck
|- LICENSE                        MIT license (code)
|- NOTICE.md                      Data sources, attribution, and data license
`- .github/workflows/pages.yml    GitHub Pages deployment workflow
```

## Data and Persistence

Each deck entry in `data/n2-kanji.json` includes a kanji character, onyomi and kunyomi readings (including romaji), and English meanings. The app stores the active deck, result history, and settings in `localStorage`; clearing site data resets this information. There is no server or account: use Settings > Backup > Export to download a JSON file and Import on another device, choosing to merge with or replace that device's data.

## Deployment

The included GitHub Actions workflow publishes the repository root to GitHub Pages whenever changes are pushed to `main`. In the repository settings, set Pages > Source to "GitHub Actions". The app uses only relative paths, so it works under the `/kanji-flashcards/` project URL.

## License

The code is released under the [MIT License](LICENSE). The kanji data in `data/n2-kanji.json` is derived from KANJIDIC2 and JMdict and is licensed separately under CC BY-SA 4.0; see [NOTICE.md](NOTICE.md) for sources and attribution.

## Syncing between devices

Settings > Device sync links any number of devices (phones, PCs, tablets) into a sync group over direct WebRTC connections using [PeerJS](https://peerjs.com/). To add a device, open the screen on it while another device is on the same network: they find each other, both show a number, and once you confirm the numbers match the new device joins the group (two separate groups merge the same way). From then on, devices in the group connect to each other whenever the sync screen is open, on any network, and merge progress (statistics, review schedule, lessons, custom answers, custom decks). Nothing is stored on a server: PeerJS's free public broker only introduces devices, and the data travels between them encrypted. Devices need to be online with the sync screen open at the same time (they pass changes along, so every device you open it on catches up), and connections can fail across some mobile networks without a relay. Settings and marathon progress stay per device.

Counters are kept per device and totalled across the group, so syncing in any order, any number of times, never double counts. "Reset statistics" is spread to every device the next time it syncs. Importing a backup that has lower counts than the group's totals won't lower them.

`sync.js` holds the merge logic; its tests run with `node tools/sync-merge.test.cjs`.
