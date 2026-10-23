// Adds a verb or adjective that uses each N2 kanji to data/n2-kanji.json, with
// its reading and English meaning, from JMdict (CC BY-SA 4.0, EDRDG) in the
// jmdict-simplified JSON form (jmdict-eng-*.json).
//
// The kanji's kunyomi readings mark okurigana in parentheses (改 あらた(める)),
// so each such reading gives a candidate word (改める, あらためる). The first
// candidate that JMdict lists as a verb or an i-adjective with that written
// form and reading becomes the kanji's word. Readings without okurigana are
// skipped (they are mostly nouns and names).
//
// Usage:
//   node tools/build-kanji-words.mjs data/n2-kanji.json jmdict-eng.json > out.json
//
// The output is the same list with `word`, `wordReading` and `wordMeaning`
// added where a word was found; any existing word fields are replaced.
import fs from "node:fs";

const [kanjiPath, dictPath] = process.argv.slice(2);
const MAX_SENSES = 2;
const MAX_GLOSSES = 3;
const MAX_GLOSS_LENGTH = 40;

const kanjiList = JSON.parse(fs.readFileSync(kanjiPath, "utf8"));
const dict = JSON.parse(fs.readFileSync(dictPath, "utf8"));

const isVerbOrAdjective = (pos) => pos.some((p) => p.startsWith("v") || p === "adj-i");

// "writtenForm|reading" -> entries that are verbs or i-adjectives.
const byPair = new Map();
for (const entry of dict.words) {
  if (!entry.sense.some((s) => isVerbOrAdjective(s.partOfSpeech))) continue;
  for (const kanji of entry.kanji) {
    for (const kana of entry.kana) {
      if (!kana.appliesToKanji.includes("*") && !kana.appliesToKanji.includes(kanji.text)) continue;
      const key = `${kanji.text}|${kana.text}`;
      if (!byPair.has(key)) byPair.set(key, []);
      byPair.get(key).push(entry);
    }
  }
}

function meaningOf(entry) {
  const glosses = [];
  for (const sense of entry.sense.filter((s) => isVerbOrAdjective(s.partOfSpeech)).slice(0, MAX_SENSES)) {
    for (const g of sense.gloss) {
      if (glosses.length >= MAX_GLOSSES) break;
      const text = g.text.replace(/\s*[;,]\s*/g, " / ");
      if (text.length > MAX_GLOSS_LENGTH && glosses.length) continue;
      if (!glosses.includes(text)) glosses.push(text);
    }
  }
  return glosses.join(", ");
}

// "あらた(める)、 あらた(まる)" -> [{ stem: "あらた", okurigana: "める" }, ...]
function candidates(kunyomi) {
  return kunyomi
    .split("、")
    .map((t) => t.trim())
    .map((t) => /^([^()]+)\(([^()]+)\)$/.exec(t))
    .filter(Boolean)
    .map((m) => ({ stem: m[1], okurigana: m[2] }));
}

let found = 0;
const out = kanjiList.map((item) => {
  const { word, wordReading, wordMeaning, ...rest } = item;
  for (const { stem, okurigana } of candidates(item.kunyomi)) {
    const w = item.kanji + okurigana;
    const r = stem + okurigana;
    const entry = (byPair.get(`${w}|${r}`) || [])[0];
    if (!entry) continue;
    const m = meaningOf(entry);
    if (!m) continue;
    found++;
    return { ...rest, word: w, wordReading: r, wordMeaning: m };
  }
  return rest;
});
console.error(`Found a word for ${found} of ${out.length} kanji`);
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
