# Data Sources and Licensing

The application code is licensed under the MIT License (see `LICENSE`).
The generated deck `data/n2-kanji.json` is a separate work derived from the
sources below and is licensed under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) because it
incorporates KANJIDIC2 and JMdict material.

## KANJIDIC2

Readings (on'yomi, kun'yomi) and English meanings come from the
[KANJIDIC2](https://www.edrdg.org/wiki/index.php/KANJIDIC_Project) file,
copyright the [Electronic Dictionary Research and Development Group](https://www.edrdg.org/),
used under the [Creative Commons Attribution-ShareAlike Licence (V4.0)](https://creativecommons.org/licenses/by-sa/4.0/).
See the EDRDG [licence statement](https://www.edrdg.org/edrdg/licence.html).
Romaji forms were generated from the kana readings. Kun'yomi okurigana were
reformatted from KANJIDIC2's `.` notation to parentheses, and at most five
meanings are kept per kanji.

## JMdict

The verb or adjective shown for many kanji (`word`, `wordReading`,
`wordMeaning`) comes from [JMdict](https://www.edrdg.org/wiki/index.php/JMdict-EDICT_Dictionary_Project),
copyright the [Electronic Dictionary Research and Development Group](https://www.edrdg.org/),
used under the same [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) licence
(see the EDRDG [licence statement](https://www.edrdg.org/edrdg/licence.html)). The data was
read from the [jmdict-simplified](https://github.com/scriptin/jmdict-simplified) JSON conversion.
Each word is the kanji plus one of its kun'yomi okurigana forms, kept only when JMdict
lists it as a verb or i-adjective with that written form and reading; up to three
English glosses are kept.

## JLPT N2 kanji list

Which kanji belong to N2 comes from the JLPT N2 kanji list published at
[tanos.co.uk/jlpt](https://www.tanos.co.uk/jlpt/) by Jonathan Waller, licensed
[Creative Commons Attribution](https://creativecommons.org/share-your-work/cclicenses/). The list was obtained
from the CSV conversion in
[Bluskyo/JLPT_Vocabulary](https://github.com/Bluskyo/JLPT_Vocabulary)
(`data/kanji/parsedData/n2_kanji.csv`). The JLPT has not published official
kanji lists since 2010, so this list is a community reconstruction.

## Regenerating the deck

```text
npm i wanakana@5.3.1
node tools/build-kanji-data.mjs n2_kanji.csv kanjidic2.xml.gz > data/n2-kanji.json
node tools/build-kanji-words.mjs data/n2-kanji.json jmdict-eng.json > words.json && mv words.json data/n2-kanji.json
```
