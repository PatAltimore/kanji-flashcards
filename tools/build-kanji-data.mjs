// Builds data/n2-kanji.json from two openly licensed sources:
//   - the JLPT N2 kanji list (CC BY, Jonathan Waller / tanos.co.uk), as CSV
//     with a "Kanji" header, e.g. Bluskyo/JLPT_Vocabulary n2_kanji.csv
//   - KANJIDIC2 (CC BY-SA 4.0, EDRDG) for readings and English meanings
//
// Usage (needs `npm i wanakana@5.3.1` somewhere Node can resolve it):
//   node tools/build-kanji-data.mjs n2_kanji.csv kanjidic2.xml.gz > data/n2-kanji.json
//
// `num` is the character's Unicode code point so progress keyed by it stays
// valid if the list membership or order changes later.
import fs from "node:fs";
import zlib from "node:zlib";
import { toRomaji } from "wanakana";

const [listPath, dicPath] = process.argv.slice(2);
const MAX_MEANINGS = 5;

const list = fs
  .readFileSync(listPath, "utf8")
  .split(/\r?\n/)
  .slice(1)
  .map((l) => l.trim())
  .filter(Boolean);
const xml = zlib.gunzipSync(fs.readFileSync(dicPath)).toString("utf8");

const entries = new Map();
for (const m of xml.matchAll(/<character>([\s\S]*?)<\/character>/g)) {
  const lit = /<literal>(.*?)<\/literal>/.exec(m[1]);
  if (lit) entries.set(lit[1], m[1]);
}

const all = (re, s) => [...s.matchAll(re)].map((x) => x[1]);
// KANJIDIC2 marks okurigana with "." and affixes with "-": す.べる -> す(べる)
const kunToDisplay = (k) =>
  k.replace(/-/g, "").replace(/^([^.]*)\.(.*)$/, "$1($2)");

const out = [];
const missing = [];
for (const kanji of list) {
  const body = entries.get(kanji);
  if (!body) {
    missing.push(kanji);
    continue;
  }
  const on = all(/<reading r_type="ja_on">(.*?)<\/reading>/g, body);
  const kun = all(/<reading r_type="ja_kun">(.*?)<\/reading>/g, body).map(kunToDisplay);
  const meanings = all(/<meaning>(.*?)<\/meaning>/g, body)
    .map((s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"))
    .slice(0, MAX_MEANINGS);
  out.push({
    num: kanji.codePointAt(0),
    kanji,
    onyomi: on.join("、 "),
    onyomiRomaji: on.map((r) => toRomaji(r)).join(", "),
    kunyomi: kun.join("、 "),
    kunyomiRomaji: kun.map((r) => toRomaji(r)).join(", "),
    meaning: meanings.join(", "),
  });
}
if (missing.length) console.error("Not found in KANJIDIC2:", missing.join(""));
console.error(`Wrote ${out.length} kanji`);
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
