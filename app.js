(function () {
  "use strict";

  const STORAGE_KEY = "kanjiFlashN2.v1";
  const STATS_KEY = "kanjiFlashN2.stats.v1";
  const SETTINGS_KEY = "kanjiFlashN2.settings.v1";
  const LESSONS_KEY = "kanjiFlashN2.lessons.v1";
  const CUSTOM_ANSWERS_KEY = "kanjiFlashN2.customAnswers.v1";
  const CUSTOM_DECKS_KEY = "kanjiFlashN2.customDecks.v1";
  // How long the "Correct!" confirmation shows before a right typed answer
  // moves on to the next card by itself.
  const AUTO_ADVANCE_MS = 700;
  const EXPORT_APP_ID = "kanji-flash";
  const EXPORT_VERSION = 1;
  const MIN_MINUTES = 1;
  const MAX_MINUTES = 30;
  const DEFAULT_MINUTES = 3;
  const MIN_QUESTIONS = 5;
  const MAX_QUESTIONS = 30;
  const DEFAULT_QUESTIONS = 10;
  // Leitner-box spaced repetition: box index -> days until next due date.
  // A correct answer advances a card to the next box (longer interval); a
  // miss drops it back a box and makes it due again immediately.
  const BOX_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30, 90];
  const MAX_BOX = BOX_INTERVALS_DAYS.length - 1;
  const KNOWN_BOX_THRESHOLD = 4;
  // Placement quiz: a never-reviewed card the player says they know starts in
  // this box (due in a few days) instead of box 1, so the quiz actually
  // shortens their review queue; "don't know" starts it at box 0, due today.
  const QUIZ_KNOWN_BOX = 2;

  const els = {
    // screens
    screenHome: document.getElementById("screen-home"),
    screenDailySetup: document.getElementById("screen-daily-setup"),
    screenPlay: document.getElementById("screen-play"),
    screenDailyResults: document.getElementById("screen-daily-results"),
    screenLessonResults: document.getElementById("screen-lesson-results"),
    screenStats: document.getElementById("screen-stats"),
    screenSettings: document.getElementById("screen-settings"),
    screenLessons: document.getElementById("screen-lessons"),
    // home
    modeMarathonBtn: document.getElementById("modeMarathonBtn"),
    modeDailyBtn: document.getElementById("modeDailyBtn"),
    modeStatsBtn: document.getElementById("modeStatsBtn"),
    modeLessonsBtn: document.getElementById("modeLessonsBtn"),
    settingsBtn: document.getElementById("settingsBtn"),
    // daily setup
    timeValue: document.getElementById("timeValue"),
    timeUpBtn: document.getElementById("timeUpBtn"),
    timeDownBtn: document.getElementById("timeDownBtn"),
    startDailyBtn: document.getElementById("startDailyBtn"),
    // play
    card: document.getElementById("card"),
    kanji: document.getElementById("kanjiChar"),
    kanjiBack: document.getElementById("kanjiCharBack"),
    onyomi: document.getElementById("onyomi"),
    kunyomi: document.getElementById("kunyomi"),
    meaning: document.getElementById("meaning"),
    progress: document.getElementById("progress"),
    timerDisplay: document.getElementById("timerDisplay"),
    againBtn: document.getElementById("againBtn"),
    gotItBtn: document.getElementById("gotItBtn"),
    frontHint: document.getElementById("frontHint"),
    congratsMsg: document.getElementById("congratsMsg"),
    newDeckBtn: document.getElementById("newDeckBtn"),
    cardStatsRight: document.getElementById("cardStatsRight"),
    cardStatsWrong: document.getElementById("cardStatsWrong"),
    cardCustomAnswers: document.getElementById("cardCustomAnswers"),
    cardCustomAnswersList: document.getElementById("cardCustomAnswersList"),
    // daily results
    resultSeen: document.getElementById("resultSeen"),
    resultRight: document.getElementById("resultRight"),
    resultWrong: document.getElementById("resultWrong"),
    resultAccuracy: document.getElementById("resultAccuracy"),
    dailyAgainBtn: document.getElementById("dailyAgainBtn"),
    dailyHomeBtn: document.getElementById("dailyHomeBtn"),
    lessonResultTitle: document.getElementById("lessonResultTitle"),
    lessonResultSeen: document.getElementById("lessonResultSeen"),
    lessonResultRight: document.getElementById("lessonResultRight"),
    lessonResultWrong: document.getElementById("lessonResultWrong"),
    lessonResultAccuracy: document.getElementById("lessonResultAccuracy"),
    lessonResultsLessonsBtn: document.getElementById("lessonResultsLessonsBtn"),
    // stats
    statsBody: document.getElementById("statsBody"),
    resetStatsBtn: document.getElementById("resetStatsBtn"),
    // settings
    themeOptions: document.getElementById("themeOptions"),
    stylizedFontToggle: document.getElementById("stylizedFontToggle"),
    fontSizeSlider: document.getElementById("fontSizeSlider"),
    fontSizeValue: document.getElementById("fontSizeValue"),
    defaultMinutesDownBtn: document.getElementById("defaultMinutesDownBtn"),
    defaultMinutesUpBtn: document.getElementById("defaultMinutesUpBtn"),
    defaultMinutesValue: document.getElementById("defaultMinutesValue"),
    reshuffleDeckBtn: document.getElementById("reshuffleDeckBtn"),
    dataStatus: document.getElementById("dataStatus"),
    customDecksSub: document.getElementById("customDecksSub"),
    customDecksDue: document.getElementById("customDecksDue"),
    customDecksDueNum: document.getElementById("customDecksDueNum"),
    exportDataBtn: document.getElementById("exportDataBtn"),
    importDataBtn: document.getElementById("importDataBtn"),
    importFileInput: document.getElementById("importFileInput"),
    screenImportChoice: document.getElementById("screen-import-choice"),
    importMergeBtn: document.getElementById("importMergeBtn"),
    importReplaceBtn: document.getElementById("importReplaceBtn"),
    importCancelBtn: document.getElementById("importCancelBtn"),
    lessonQuestionsDownBtn: document.getElementById("lessonQuestionsDownBtn"),
    lessonQuestionsUpBtn: document.getElementById("lessonQuestionsUpBtn"),
    lessonQuestionsValue: document.getElementById("lessonQuestionsValue"),
    reviewQuestionsDownBtn: document.getElementById("reviewQuestionsDownBtn"),
    reviewQuestionsUpBtn: document.getElementById("reviewQuestionsUpBtn"),
    reviewQuestionsValue: document.getElementById("reviewQuestionsValue"),
    quizQuestionsDownBtn: document.getElementById("quizQuestionsDownBtn"),
    quizQuestionsUpBtn: document.getElementById("quizQuestionsUpBtn"),
    quizQuestionsValue: document.getElementById("quizQuestionsValue"),
    lessonMonthLabel: document.getElementById("lessonMonthLabel"),
    lessonTitle: document.getElementById("lessonTitle"),
    lessonSubtitle: document.getElementById("lessonSubtitle"),
    lessonCalendar: document.getElementById("lessonCalendar"),
    startLessonBtn: document.getElementById("startLessonBtn"),
    lessonPlacementStatus: document.getElementById("lessonPlacementStatus"),
    lessonResultNote: document.getElementById("lessonResultNote"),
    startReviewBtn: document.getElementById("startReviewBtn"),
    lessonStatus: document.getElementById("lessonStatus"),
    // type answer
    screenType: document.getElementById("screen-type"),
    modeTypeBtn: document.getElementById("modeTypeBtn"),
    typeProgress: document.getElementById("typeProgress"),
    typeCard: document.getElementById("typeCard"),
    questionTypeBadge: document.getElementById("questionTypeBadge"),
    typeKanji: document.getElementById("typeKanji"),
    typeForm: document.getElementById("typeForm"),
    typeInput: document.getElementById("typeInput"),
    typeSubmitBtn: document.getElementById("typeSubmitBtn"),
    typeFeedback: document.getElementById("typeFeedback"),
    typeFeedbackResult: document.getElementById("typeFeedbackResult"),
    typeOnyomi: document.getElementById("typeOnyomi"),
    typeKunyomi: document.getElementById("typeKunyomi"),
    typeMeaning: document.getElementById("typeMeaning"),
    typeCongratsMsg: document.getElementById("typeCongratsMsg"),
    typeNewDeckBtn: document.getElementById("typeNewDeckBtn"),
    typeCardStatsRight: document.getElementById("typeCardStatsRight"),
    typeCardStatsWrong: document.getElementById("typeCardStatsWrong"),
    addAnswerBtn: document.getElementById("addAnswerBtn"),
    addAnswerBtnText: document.getElementById("addAnswerBtnText"),
    typeCustomAnswers: document.getElementById("typeCustomAnswers"),
    typeCustomAnswersList: document.getElementById("typeCustomAnswersList"),
    // custom decks
    screenCustomDecks: document.getElementById("screen-custom-decks"),
    screenCustomDeckSave: document.getElementById("screen-custom-deck-save"),
    screenCustomStudy: document.getElementById("screen-custom-study"),
    screenCustomType: document.getElementById("screen-custom-type"),
    screenCustomComplete: document.getElementById("screen-custom-complete"),
    modeCustomDecksBtn: document.getElementById("modeCustomDecksBtn"),
    uploadCsvBtn: document.getElementById("uploadCsvBtn"),
    csvFileInput: document.getElementById("csvFileInput"),
    customDecksList: document.getElementById("customDecksList"),
    customDecksEmpty: document.getElementById("customDecksEmpty"),
    downloadTemplateBtn: document.getElementById("downloadTemplateBtn"),
    customSaveTitle: document.getElementById("customSaveTitle"),
    customSaveCancelBtn: document.getElementById("customSaveCancelBtn"),
    customDeckNameInput: document.getElementById("customDeckNameInput"),
    customSaveInfo: document.getElementById("customSaveInfo"),
    customSaveWarning: document.getElementById("customSaveWarning"),
    customSaveConfirmBtn: document.getElementById("customSaveConfirmBtn"),
    customStudyCard: document.getElementById("customStudyCard"),
    customStudyProgress: document.getElementById("customStudyProgress"),
    customStudyFront: document.getElementById("customStudyFront"),
    customStudyBackSections: document.getElementById("customStudyBackSections"),
    customFlashAgainBtn: document.getElementById("customFlashAgainBtn"),
    customFlashGotItBtn: document.getElementById("customFlashGotItBtn"),
    customStudyBackBtn: document.getElementById("customStudyBackBtn"),
    customCompleteStat: document.getElementById("customCompleteStat"),
    customStudyAgainBtn: document.getElementById("customStudyAgainBtn"),
    customBackToListBtn: document.getElementById("customBackToListBtn"),
    customTypeCard: document.getElementById("customTypeCard"),
    customTypeProgress: document.getElementById("customTypeProgress"),
    customTypeBadge: document.getElementById("customTypeBadge"),
    customTypeFront: document.getElementById("customTypeFront"),
    customTypeForm: document.getElementById("customTypeForm"),
    customTypeInput: document.getElementById("customTypeInput"),
    customTypeSubmitBtn: document.getElementById("customTypeSubmitBtn"),
    customTypeFeedback: document.getElementById("customTypeFeedback"),
    customTypeFeedbackResult: document.getElementById("customTypeFeedbackResult"),
    customAddAnswerBtn: document.getElementById("customAddAnswerBtn"),
    customAddAnswerBtnText: document.getElementById("customAddAnswerBtnText"),
    customTypeSections: document.getElementById("customTypeSections"),
    customTypeBackBtn: document.getElementById("customTypeBackBtn"),
  };

  const screens = {
    home: els.screenHome,
    dailySetup: els.screenDailySetup,
    play: els.screenPlay,
    dailyResults: els.screenDailyResults,
    lessonResults: els.screenLessonResults,
    stats: els.screenStats,
    type: els.screenType,
    settings: els.screenSettings,
    lessons: els.screenLessons,
    importChoice: els.screenImportChoice,
    customDecks: els.screenCustomDecks,
    customDeckSave: els.screenCustomDeckSave,
    customStudy: els.screenCustomStudy,
    customType: els.screenCustomType,
    customComplete: els.screenCustomComplete,
  };

  let allKanji = [];
  let kanjiByNum = new Map();
  let queue = []; // working stack for the current session; queue[0] is the card on top
  let totalCount = 0;
  let masteredCount = 0;
  let flipped = false;
  let animating = false;
  let stats = { daily: {}, perCard: {} };
  const THEMES = ["dark", "hanafuda", "hyakunin"];
  const DEFAULT_THEME = "dark";

  let settings = { stylizedFont: true, fontScale: 1, defaultDailyMinutes: DEFAULT_MINUTES, lessonQuestions: DEFAULT_QUESTIONS, reviewQuestions: DEFAULT_QUESTIONS, quizQuestions: DEFAULT_QUESTIONS, theme: DEFAULT_THEME };
  let lessonHistory = { completed: {}, placement: {}, today: null };
  let lessonSession = null;
  let lessonQuestionTypes = [];
  let lessonTermState = new Map();
  let savedMainSession = null;
  let customAnswers = {};
  let customDecks = [];
  let pendingReplaceId = null;
  let pendingCsvParse = null;
  let customStudyDeck = null;
  let customStudyCards = [];
  let customQuizKnown = 0;
  let customTypeCards = [];
  let customTypeAsked = [];
  let customTermState = new Map();
  let customTypeMode = "type"; // "type" | "quiz" | "review"
  let customStudyMode = "cards"; // flashcards only; typed review runs through the custom type screen
  let customStudyIndex = 0;
  let customStudyFlipped = false;
  let customTypeDeck = null;
  let customTypeIndex = 0;
  let customTypeAnswering = true;
  let customTypeCurrentSection = null;
  let pendingCustomTypeCorrect = false;
  let pendingCustomTypeRawAnswer = "";
  let customCompleteDeck = null;
  let customCompleteMode = "cards";
  let pendingImport = null;

  let mode = null; // "marathon" | "daily" | "type" | "lesson-type"
  let dailyMinutes = DEFAULT_MINUTES;
  let dailyTimeLeft = 0;
  let dailyIntervalId = null;
  let dailyTally = { seen: 0, right: 0, wrong: 0 };

  let typeAnswering = true;
  let typeAutoAdvanceTimer = null;
  let customTypeAutoAdvanceTimer = null;
  let pendingTypeCorrect = false;
  let pendingTypeRawAnswer = "";
  let currentQuestionType = "meaning";

  // Shuffles questions, then picks them one at a time, skipping any whose
  // group (the term it asks about) matches the previous pick, so a term's
  // questions don't come back to back unless only that term's are left.
  function spreadQuestions(questions, groupOf) {
    const pool = shuffle(questions);
    const ordered = [];
    while (pool.length) {
      const last = ordered.length ? groupOf(ordered[ordered.length - 1]) : null;
      let k = pool.findIndex((q) => groupOf(q) !== last);
      if (k === -1) k = 0;
      ordered.push(pool.splice(k, 1)[0]);
    }
    return ordered;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }

  function showScreen(name) {
    Object.keys(screens).forEach((key) => {
      screens[key].hidden = key !== name;
    });
    if (name === "home") updateHomeInfo();
  }

  // The Custom Decks tile on the home screen shows how many reviews are due
  // across all of the player's decks.
  function updateHomeInfo() {
    let due = 0;
    customDecks.forEach((deck) => {
      due += getDueCustomCards(deck).length;
    });
    els.customDecksSub.textContent = customDecks.length
      ? `${customDecks.length}個のデッキ`
      : "自分のカードで学習";
    els.customDecksDueNum.textContent = String(due);
    els.customDecksDue.classList.toggle("has-due", due > 0);
  }

  // ---------- shared deck persistence (all modes) ----------

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          queueNums: queue.map((item) => item.num),
          masteredCount,
          totalCount,
        })
      );
    } catch (err) {
      /* localStorage unavailable (private mode, quota, etc.) */
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.queueNums)) return null;
      return parsed;
    } catch (err) {
      return null;
    }
  }

  function reshuffleDeck() {
    queue = shuffle(allKanji);
    totalCount = allKanji.length;
    masteredCount = 0;
    flipped = false;
    saveState();
  }

  // ---------- stats ----------

  function dateKey(d) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  function loadStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (!raw) return { daily: {}, perCard: {} };
      const parsed = JSON.parse(raw);
      return {
        daily: parsed.daily || {},
        perCard: parsed.perCard || {},
      };
    } catch (err) {
      return { daily: {}, perCard: {} };
    }
  }

  function saveStats() {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (err) {
      /* localStorage unavailable (private mode, quota, etc.) */
    }
  }

  // ---------- spaced repetition (Leitner boxes) ----------
  //
  // Shared by the built-in deck (stats.perCard, keyed by kanji num) and
  // custom decks (deck.srs, keyed by card front text) — both store the same
  // { box, due, lastSeen, streak } shape, so grading logic only needs to be
  // written once.

  function isDue(entry, todayKeyStr) {
    if (!entry || !entry.due) return true;
    return entry.due <= todayKeyStr;
  }

  function applySrsResult(entry, correct, todayKeyStr) {
    const box = entry && typeof entry.box === "number" ? entry.box : 0;
    const streak = entry && typeof entry.streak === "number" ? entry.streak : 0;
    let nextBox;
    let due;
    if (correct) {
      nextBox = Math.min(box + 1, MAX_BOX);
      const [y, m, d] = todayKeyStr.split("-").map(Number);
      const dueDate = new Date(y, m - 1, d + BOX_INTERVALS_DAYS[nextBox]);
      due = dateKey(dueDate);
    } else {
      nextBox = Math.max(box - 1, 0);
      due = todayKeyStr;
    }
    return {
      box: nextBox,
      due,
      lastSeen: todayKeyStr,
      streak: correct ? streak + 1 : 0,
    };
  }

  function srsTier(entry) {
    if (!entry || (entry.right === 0 && entry.wrong === 0 && !entry.lastSeen)) return "new";
    const box = entry.box || 0;
    return box >= KNOWN_BOX_THRESHOLD ? "known" : "learning";
  }

  // Picks whichever of two SRS entries reflects the more recent review, for
  // merging local vs. imported state (box/due/streak are state, not
  // counters, so they can't just be summed the way right/wrong are).
  function pickNewerSrs(a, b) {
    const aSeen = (a && a.lastSeen) || "";
    const bSeen = (b && b.lastSeen) || "";
    const newer = bSeen > aSeen ? b : a;
    return {
      box: (newer && newer.box) || 0,
      due: (newer && newer.due) || null,
      lastSeen: (newer && newer.lastSeen) || null,
      streak: (newer && newer.streak) || 0,
    };
  }

  // Records one answer in the daily and per-card counters. The review schedule
  // is updated here too unless `gradeSrs` is false (lessons grade each kanji
  // once, however many questions it had; see gradeLessonTerm).
  function recordResult(kanjiNum, correct, gradeSrs = true) {
    const day = dateKey(new Date());
    if (!stats.daily[day]) {
      stats.daily[day] = { completed: 0, right: 0, wrong: 0 };
    }
    stats.daily[day].completed++;
    if (correct) {
      stats.daily[day].right++;
    } else {
      stats.daily[day].wrong++;
    }

    const cardKey = String(kanjiNum);
    if (!stats.perCard[cardKey]) {
      stats.perCard[cardKey] = { right: 0, wrong: 0 };
    }
    if (correct) {
      stats.perCard[cardKey].right++;
    } else {
      stats.perCard[cardKey].wrong++;
    }
    if (gradeSrs) {
      Object.assign(stats.perCard[cardKey], applySrsResult(stats.perCard[cardKey], correct, day));
    }

    saveStats();
  }

  function gradeBuiltinSrs(kanjiNum, correct) {
    const cardKey = String(kanjiNum);
    if (!stats.perCard[cardKey]) {
      stats.perCard[cardKey] = { right: 0, wrong: 0 };
    }
    Object.assign(
      stats.perCard[cardKey],
      applySrsResult(stats.perCard[cardKey], correct, dateKey(new Date()))
    );
    saveStats();
  }

  function getCardStats(kanjiNum) {
    return stats.perCard[String(kanjiNum)] || { right: 0, wrong: 0 };
  }

  // ---------- custom (user-added) answers ----------
  // Stored per kanji as { meaning: string[], onyomi: string[], kunyomi: string[] }.
  // Answers were originally a flat string[] per kanji (before question types
  // were split out); normalizeCustomAnswersShape migrates that old shape by
  // sorting each answer into a bucket based on its script (katakana ->
  // onyomi, hiragana -> kunyomi, else -> meaning).

  const HIRAGANA_RANGE = /[぀-ゟ]/;
  const KATAKANA_RANGE = /[゠-ヿ]/;

  function normalizeCustomAnswersShape(raw) {
    const result = {};
    Object.keys(raw || {}).forEach((key) => {
      const val = raw[key];
      if (Array.isArray(val)) {
        const migrated = { meaning: [], onyomi: [], kunyomi: [] };
        val.forEach((ans) => {
          if (KATAKANA_RANGE.test(ans)) migrated.onyomi.push(ans);
          else if (HIRAGANA_RANGE.test(ans)) migrated.kunyomi.push(ans);
          else migrated.meaning.push(ans);
        });
        result[key] = migrated;
      } else if (val && typeof val === "object") {
        result[key] = {
          meaning: Array.isArray(val.meaning) ? val.meaning : [],
          onyomi: Array.isArray(val.onyomi) ? val.onyomi : [],
          kunyomi: Array.isArray(val.kunyomi) ? val.kunyomi : [],
        };
      }
    });
    return result;
  }

  function loadCustomAnswers() {
    try {
      const raw = localStorage.getItem(CUSTOM_ANSWERS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (err) {
      return {};
    }
  }

  function saveCustomAnswers() {
    try {
      localStorage.setItem(CUSTOM_ANSWERS_KEY, JSON.stringify(customAnswers));
    } catch (err) {
      /* localStorage unavailable (private mode, quota, etc.) */
    }
  }

  function getCustomAnswers(kanjiNum, type) {
    const entry = customAnswers[String(kanjiNum)];
    return (entry && entry[type]) || [];
  }

  function getAllCustomAnswers(kanjiNum) {
    return customAnswers[String(kanjiNum)] || null;
  }

  function addCustomAnswer(kanjiNum, type, rawAnswer) {
    const trimmed = rawAnswer.trim();
    if (!trimmed) return;
    const key = String(kanjiNum);
    const entry = customAnswers[key] || { meaning: [], onyomi: [], kunyomi: [] };
    const norm = normalize(trimmed);
    const list = entry[type] || [];
    if (list.some((a) => normalize(a) === norm)) return;
    customAnswers[key] = { ...entry, [type]: [...list, trimmed] };
    saveCustomAnswers();
  }

  function formatCustomAnswersSummary(kanjiNum) {
    const entry = getAllCustomAnswers(kanjiNum);
    if (!entry) return "";
    const parts = [];
    if (entry.kunyomi && entry.kunyomi.length) {
      parts.push(`Kunyomi: ${entry.kunyomi.join(", ")}`);
    }
    if (entry.onyomi && entry.onyomi.length) {
      parts.push(`Onyomi: ${entry.onyomi.join(", ")}`);
    }
    if (entry.meaning && entry.meaning.length) {
      parts.push(`Meaning: ${entry.meaning.join(", ")}`);
    }
    return parts.join(" · ");
  }

  // ---------- custom decks (user-uploaded CSV flashcard sets) ----------
  // Each deck: { id, name, createdAt, updatedAt, cards: [{ front, sections: [{label, value}] }] }.
  // The first CSV column is the card front (no label shown); the header text
  // of every later column becomes a section label on the back, paired with
  // that row's value in the same column.

  function parseCsvText(text) {
    const clean = String(text).replace(/^\uFEFF/, "");
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    let i = 0;
    const n = clean.length;
    while (i < n) {
      const c = clean[i];
      if (inQuotes) {
        if (c === '"') {
          if (clean[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i++;
          continue;
        }
        field += c;
        i++;
        continue;
      }
      if (c === '"') {
        inQuotes = true;
        i++;
        continue;
      }
      if (c === ",") {
        row.push(field);
        field = "";
        i++;
        continue;
      }
      if (c === "\r") {
        i++;
        continue;
      }
      if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
        i++;
        continue;
      }
      field += c;
      i++;
    }
    row.push(field);
    rows.push(row);
    return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
  }

  // A header named "<Label> (extra answers)" carries added-answer data
  // (see addCustomDeckAnswer) rather than display content — deckToCsvText
  // emits one of these per column that has any, so re-uploading a deck you
  // exported restores your added answers instead of showing them as a
  // bogus extra flashcard section.
  const EXTRA_ANSWERS_SUFFIX = " (extra answers)";

  // Returns { columns, cards, answers }. `columns` is the full ordered
  // header list of regular content columns (kept at the deck level, not
  // just implied by each card's sections) so a column that's blank on
  // every row still round-trips correctly on export — a card's `sections`
  // only lists its non-empty cells. `answers` mirrors deck.answers' shape,
  // parsed out of any "(extra answers)" columns present.
  function buildCustomDeckCards(rows) {
    if (!rows.length) return { columns: [], cards: [], answers: {} };
    const header = rows[0];
    const rawLabels = header.slice(1).map((h, idx) => (h || "").trim() || `Column ${idx + 2}`);
    const columns = [];
    // Parallel to rawLabels: null for a regular column, or the label it
    // supplies extra answers for.
    const extraAnswerTarget = rawLabels.map((label) => {
      if (label.endsWith(EXTRA_ANSWERS_SUFFIX)) {
        return label.slice(0, -EXTRA_ANSWERS_SUFFIX.length);
      }
      columns.push(label);
      return null;
    });

    const cards = [];
    const answers = {};
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const front = (row[0] || "").trim();
      if (!front) continue;
      const sections = [];
      rawLabels.forEach((label, idx) => {
        const value = (row[idx + 1] || "").trim();
        if (!value) return;
        const targetLabel = extraAnswerTarget[idx];
        if (targetLabel) {
          const list = value.split(";").map((s) => s.trim()).filter(Boolean);
          if (!list.length) return;
          const existing = (answers[front] && answers[front][targetLabel]) || [];
          answers[front] = {
            ...(answers[front] || {}),
            [targetLabel]: Array.from(new Set([...existing, ...list])),
          };
        } else {
          sections.push({ label, value });
        }
      });
      cards.push({ front, sections });
    }
    return { columns, cards, answers };
  }

  function csvEscapeField(value) {
    const str = String(value != null ? value : "");
    if (/[",\r\n]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  // Older decks saved before `columns` was tracked at the deck level don't
  // have it; fall back to the union of section labels actually present
  // across their cards (in first-seen order) so export still works.
  function deckColumns(deck) {
    if (Array.isArray(deck.columns) && deck.columns.length) return deck.columns;
    const seen = [];
    const seenSet = new Set();
    (deck.cards || []).forEach((card) => {
      (card.sections || []).forEach((s) => {
        if (!seenSet.has(s.label)) {
          seenSet.add(s.label);
          seen.push(s.label);
        }
      });
    });
    return seen;
  }

  function deckToCsvText(deck) {
    const columns = deckColumns(deck);
    const answers = deck.answers || {};
    // Only emit an "(extra answers)" column for labels that actually have
    // at least one added answer somewhere in the deck, so decks that never
    // used the feature export exactly as before.
    const extraColumns = columns.filter((label) =>
      deck.cards.some((card) => ((answers[card.front] && answers[card.front][label]) || []).length)
    );
    const header = [
      "Front",
      ...columns,
      ...extraColumns.map((label) => `${label}${EXTRA_ANSWERS_SUFFIX}`),
    ];
    const lines = [header.map(csvEscapeField).join(",")];
    deck.cards.forEach((card) => {
      const valueByLabel = new Map(card.sections.map((s) => [s.label, s.value]));
      const mainCells = columns.map((label) => valueByLabel.get(label) || "");
      const extraCells = extraColumns.map((label) =>
        ((answers[card.front] && answers[card.front][label]) || []).join("; ")
      );
      const row = [card.front, ...mainCells, ...extraCells];
      lines.push(row.map(csvEscapeField).join(","));
    });
    return lines.join("\r\n");
  }

  function sanitizeFilename(name) {
    const cleaned = String(name || "").trim().replace(/[\\/:*?"<>|]+/g, "_");
    return cleaned || "deck";
  }

  function downloadTextFile(filename, text, mimeType) {
    const blob = new Blob([text], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const CUSTOM_DECK_TEMPLATE_CSV =
    "Front,Reading,Meaning\r\n" +
    '舞台,ぶたい,"stage, setting (of a story)"\r\n' +
    '幕,まく,"curtain, act (of a play)"\r\n' +
    "猫,ねこ,cat\r\n";

  function loadCustomDecks() {
    try {
      const raw = localStorage.getItem(CUSTOM_DECKS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveCustomDecks() {
    try {
      localStorage.setItem(CUSTOM_DECKS_KEY, JSON.stringify(customDecks));
    } catch (err) {
      /* localStorage unavailable (private mode, quota, etc.) */
    }
  }

  function jsonByteSize(value) {
    try {
      return new Blob([JSON.stringify(value)]).size;
    } catch (err) {
      return JSON.stringify(value).length;
    }
  }

  function makeDeckId() {
    if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  // Unions added-answer data from a re-uploaded file (parsed "(extra
  // answers)" columns) into a deck's existing answers, deduping by
  // normalized text — never lets a replace/re-import lose answers that
  // were already recorded locally.
  function mergeDeckAnswers(existing, incoming) {
    const merged = { ...(existing || {}) };
    Object.keys(incoming || {}).forEach((front) => {
      const existingEntry = merged[front] || {};
      const combinedEntry = { ...existingEntry };
      Object.keys(incoming[front]).forEach((label) => {
        const existingList = existingEntry[label] || [];
        const seen = new Set(existingList.map((a) => normalize(a)));
        const combinedList = [...existingList];
        incoming[front][label].forEach((a) => {
          const norm = normalize(a);
          if (!seen.has(norm)) {
            seen.add(norm);
            combinedList.push(a);
          }
        });
        combinedEntry[label] = combinedList;
      });
      merged[front] = combinedEntry;
    });
    return merged;
  }

  function upsertCustomDeck(name, cards, columns, parsedAnswers, replaceId) {
    const now = new Date().toISOString();
    let deck = null;
    if (replaceId) {
      const idx = customDecks.findIndex((d) => d.id === replaceId);
      if (idx !== -1) {
        const answers = mergeDeckAnswers(customDecks[idx].answers, parsedAnswers);
        customDecks[idx] = { ...customDecks[idx], name, cards, columns, answers, updatedAt: now };
        deck = customDecks[idx];
      }
    }
    if (!deck) {
      deck = { id: makeDeckId(), name, cards, columns, answers: parsedAnswers || {}, srs: {}, createdAt: now, updatedAt: now };
      customDecks.push(deck);
    }
    saveCustomDecks();
    return deck;
  }

  function deleteCustomDeckById(id) {
    customDecks = customDecks.filter((d) => d.id !== id);
    saveCustomDecks();
  }

  function renderCustomDecksList() {
    els.customDecksEmpty.hidden = customDecks.length > 0;
    if (!customDecks.length) {
      els.customDecksList.innerHTML = "";
      return;
    }
    els.customDecksList.innerHTML = customDecks
      .map((deck) => {
        const safeName = escapeHtml(deck.name);
        const dueCount = getDueCustomCards(deck).length;
        const unreviewedCount = getUnreviewedCustomCards(deck).length;
        return `
      <div class="custom-deck-row" data-deck-id="${escapeHtml(deck.id)}">
        <div class="custom-deck-header">
          <div class="custom-deck-info">
            <span class="custom-deck-name">${safeName}</span>
            <span class="custom-deck-meta">${deck.cards.length}枚</span>
          </div>
          <div class="custom-deck-actions">
            <button class="custom-deck-action-btn" data-action="download" type="button" aria-label="${safeName}をCSVでダウンロード">↓</button>
            <button class="custom-deck-action-btn" data-action="replace" type="button" aria-label="${safeName}を置き換え">↻</button>
            <button class="custom-deck-action-btn custom-deck-action-delete" data-action="delete" type="button" aria-label="${safeName}を削除">✕</button>
          </div>
        </div>
        <div class="custom-deck-modes">
          <button class="custom-deck-mode-btn" data-action="study-cards" type="button">フラッシュカード</button>
          <button class="custom-deck-mode-btn" data-action="study-type" type="button">入力テスト</button>
          <button class="custom-deck-mode-btn" data-action="study-review" type="button"${dueCount ? "" : " disabled"}>復習${dueCount ? ` (${dueCount})` : ""}</button>
          <button class="custom-deck-mode-btn" data-action="study-quiz" type="button">クイズ${unreviewedCount ? ` (新規${unreviewedCount})` : ""}</button>
        </div>
      </div>`;
      })
      .join("");
  }

  els.customDecksList.addEventListener("click", (event) => {
    const actionBtn = event.target.closest("[data-action]");
    if (!actionBtn) return;
    const row = actionBtn.closest(".custom-deck-row");
    const deckId = row && row.dataset.deckId;
    const deck = customDecks.find((d) => d.id === deckId);
    if (!deck) return;
    const action = actionBtn.dataset.action;
    if (action === "study-cards") {
      startCustomDeckStudy(deck);
    } else if (action === "study-type" || action === "study-quiz") {
      if (!deck.cards.some((c) => c.sections.length)) {
        window.alert(
          "このデッキには入力で答えられるデータがなく、表面の内容のみです。代わりにフラッシュカードをお試しください。"
        );
        return;
      }
      if (action === "study-quiz") {
        startCustomDeckQuiz(deck);
      } else {
        startCustomDeckType(deck);
      }
    } else if (action === "study-review") {
      startCustomDeckReview(deck);
    } else if (action === "download") {
      downloadTextFile(`${sanitizeFilename(deck.name)}.csv`, deckToCsvText(deck), "text/csv;charset=utf-8");
    } else if (action === "replace") {
      pendingReplaceId = deck.id;
      els.csvFileInput.value = "";
      els.csvFileInput.click();
    } else if (action === "delete") {
      const ok = window.confirm(`「${deck.name}」を削除しますか？この操作は元に戻せません。`);
      if (!ok) return;
      deleteCustomDeckById(deck.id);
      renderCustomDecksList();
    }
  });

  if (els.downloadTemplateBtn) {
    els.downloadTemplateBtn.addEventListener("click", () => {
      downloadTextFile("deck-template.csv", CUSTOM_DECK_TEMPLATE_CSV, "text/csv;charset=utf-8");
    });
  }

  els.modeCustomDecksBtn.addEventListener("click", () => {
    renderCustomDecksList();
    showScreen("customDecks");
  });

  els.uploadCsvBtn.addEventListener("click", () => {
    pendingReplaceId = null;
    els.csvFileInput.value = "";
    els.csvFileInput.click();
  });

  function isExcelFile(file) {
    return /\.(xlsx|xls)$/i.test(file.name);
  }

  // SheetJS is only needed for the (less common) Excel path, so it's loaded
  // on demand rather than unconditionally on every page load — this is a
  // mobile-first app and most uploads will be plain CSV. The "mini" build
  // (~245KB) covers reading modern .xlsx/.xls; it's cached by the browser
  // after the first load.
  let xlsxLoadPromise = null;
  function ensureXlsxLoaded() {
    if (window.XLSX) return Promise.resolve();
    if (xlsxLoadPromise) return xlsxLoadPromise;
    xlsxLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.mini.min.js";
      script.onload = () => resolve();
      script.onerror = () => {
        xlsxLoadPromise = null;
        reject(new Error("Failed to load Excel support"));
      };
      document.head.appendChild(script);
    });
    return xlsxLoadPromise;
  }

  function excelFileToRows(arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    return rows.map((row) => row.map((cell) => String(cell != null ? cell : "")));
  }

  function handleParsedDeckRows(rows, file) {
    const { columns, cards, answers } = buildCustomDeckCards(rows);
    if (!cards.length) {
      window.alert(
        "ファイルにフラッシュカードが見つかりませんでした。1行目に見出しがあり、各行の1列目に内容があることを確認してください。"
      );
      return;
    }
    const replaceId = pendingReplaceId;
    const existing = replaceId ? customDecks.find((d) => d.id === replaceId) : null;
    const defaultName = existing ? existing.name : file.name.replace(/\.(csv|xlsx|xls)$/i, "");
    pendingCsvParse = { cards, columns, answers, replaceId };
    els.customSaveTitle.textContent = existing ? "デッキを置き換え" : "新しいデッキ";
    els.customDeckNameInput.value = defaultName;
    els.customSaveInfo.textContent = `${cards.length}枚を読み込み`;
    els.customSaveWarning.hidden = true;
    showScreen("customDeckSave");
  }

  els.csvFileInput.addEventListener("change", () => {
    const file = els.csvFileInput.files && els.csvFileInput.files[0];
    if (!file) return;

    if (isExcelFile(file)) {
      ensureXlsxLoaded()
        .then(() => {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const rows = excelFileToRows(reader.result);
              handleParsedDeckRows(rows, file);
            } catch (err) {
              window.alert("Excelファイルを読み込めませんでした。有効な.xlsxまたは.xlsファイルか確認してください。");
            }
          };
          reader.onerror = () => {
            window.alert("ファイルを読み込めませんでした。もう一度お試しください。");
          };
          reader.readAsArrayBuffer(file);
        })
        .catch(() => {
          window.alert(
            "Excelのサポートを読み込めませんでした。接続を確認してもう一度お試しいただくか、CSVをアップロードしてください。"
          );
        });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCsvText(String(reader.result || ""));
      handleParsedDeckRows(rows, file);
    };
    reader.onerror = () => {
      window.alert("ファイルを読み込めませんでした。もう一度お試しください。");
    };
    reader.readAsText(file, "UTF-8");
  });

  els.customSaveConfirmBtn.addEventListener("click", () => {
    if (!pendingCsvParse) return;
    const name = els.customDeckNameInput.value.trim() || "Untitled Deck";
    upsertCustomDeck(
      name,
      pendingCsvParse.cards,
      pendingCsvParse.columns,
      pendingCsvParse.answers,
      pendingCsvParse.replaceId
    );
    pendingCsvParse = null;
    renderCustomDecksList();
    showScreen("customDecks");
  });

  els.customSaveCancelBtn.addEventListener("click", () => {
    pendingCsvParse = null;
    showScreen("customDecks");
  });

  // ---------- shared helpers for both custom study modes ----------

  function sectionsToHtml(sections) {
    return sections.length
      ? sections
          .map(
            (s) => `
        <div class="reading-block">
          <div class="reading-label">${escapeHtml(s.label)}</div>
          <div class="reading-value">${escapeHtml(s.value)}</div>
        </div>`
          )
          .join("")
      : `<div class="reading-block"><div class="reading-value">—</div></div>`;
  }

  // Deterministic label -> one of the existing themed badge colors, so
  // different columns in the same deck read as visually distinct without
  // needing to know their names ahead of time.
  const CUSTOM_BADGE_CLASSES = ["", "qt-kunyomi", "qt-onyomi"];
  function badgeClassForLabel(label) {
    let hash = 0;
    for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
    return CUSTOM_BADGE_CLASSES[hash % CUSTOM_BADGE_CLASSES.length];
  }

  // Per-deck user-added accepted answers, keyed by card front text (stable
  // across reorders/edits as long as the front text itself doesn't change)
  // and section label. Stored on the deck object itself so it travels
  // through the same local save (and export/import) as everything else.
  function getCustomDeckAnswers(deck, front, label) {
    const entry = (deck.answers && deck.answers[front]) || {};
    return entry[label] || [];
  }

  function addCustomDeckAnswer(deck, front, label, rawAnswer) {
    const trimmed = rawAnswer.trim();
    if (!trimmed) return;
    const norm = normalize(trimmed);
    const entry = (deck.answers && deck.answers[front]) || {};
    const list = entry[label] || [];
    if (list.some((a) => normalize(a) === norm)) return;
    deck.answers = { ...(deck.answers || {}), [front]: { ...entry, [label]: [...list, trimmed] } };
    saveCustomDecks();
  }

  // Per-card SRS state for a custom deck, keyed by front text (same stable
  // key deck.answers already uses). Reuses the same Leitner-box logic as the
  // built-in deck's recordResult via applySrsResult.
  function applyCustomSrsResult(deck, front, correct) {
    const today = dateKey(new Date());
    const srs = deck.srs || {};
    srs[front] = applySrsResult(srs[front], correct, today);
    deck.srs = srs;
    deck.updatedAt = new Date().toISOString();
    saveCustomDecks();
  }

  // Cards previously graded at least once whose SRS box has come due,
  // weakest/most-overdue first — mirrors getReviewCards() for the built-in
  // deck. Never-studied cards aren't included; a first pass through
  // Flashcards or Type Answer is what starts tracking them.
  function getDueCustomCards(deck) {
    const today = dateKey(new Date());
    const srs = deck.srs || {};
    const due = [];
    deck.cards.forEach((card) => {
      const entry = srs[card.front];
      if (!entry || !entry.lastSeen) return;
      if (!isDue(entry, today)) return;
      due.push({ card, box: entry.box || 0, dueDate: entry.due || "" });
    });
    due.sort((a, b) => a.box - b.box || (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
    return due.map((d) => d.card);
  }

  // A card counts as reviewed once any mode (Flashcards, Type Answer, Review
  // or Quiz) has graded it, i.e. it has an SRS entry with a lastSeen date.
  function isCustomCardReviewed(deck, card) {
    const entry = deck.srs && deck.srs[card.front];
    return Boolean(entry && entry.lastSeen);
  }

  // Only cards with answer data count: the quiz is typed, so a front-only card
  // can't be asked.
  function getUnreviewedCustomCards(deck) {
    return deck.cards.filter((card) => card.sections.length && !isCustomCardReviewed(deck, card));
  }

  // Quiz order: never-reviewed cards first (shuffled, so a partial quiz
  // samples the whole deck rather than just its start), then already-reviewed
  // cards that have gone longest without being seen.
  function buildQuizQueue(deck) {
    const srs = deck.srs || {};
    const seen = deck.cards
      .filter((card) => card.sections.length && isCustomCardReviewed(deck, card))
      .sort((a, b) => (srs[a.front].lastSeen < srs[b.front].lastSeen ? -1 : 1));
    return [...shuffle(getUnreviewedCustomCards(deck)), ...seen];
  }

  // Grades a quiz answer. First-time cards are placed directly into a box
  // based on the self-assessment; already-reviewed cards get a normal grade.
  function applyCustomQuizResult(deck, card, known) {
    if (isCustomCardReviewed(deck, card)) {
      applyCustomSrsResult(deck, card.front, known);
      return;
    }
    const today = dateKey(new Date());
    const box = known ? QUIZ_KNOWN_BOX : 0;
    const [y, m, d] = today.split("-").map(Number);
    const srs = deck.srs || {};
    srs[card.front] = {
      box,
      due: dateKey(new Date(y, m - 1, d + BOX_INTERVALS_DAYS[box])),
      lastSeen: today,
      streak: known ? 1 : 0,
    };
    deck.srs = srs;
    deck.updatedAt = new Date().toISOString();
    saveCustomDecks();
  }

  // Same convention the built-in meaning-matching uses: split on ;/, so a
  // multi-definition value ("stage, setting (of a story)") accepts any one
  // part, plus the whole value verbatim; each candidate also gets plural
  // variants. matchAnswer() itself still requires an exact match for any
  // kana/kanji candidate regardless, so this is safe for non-English data.
  function buildCustomAcceptedAnswers(value, extra) {
    const set = new Set();
    const addWithPlurals = (t) => {
      if (!t) return;
      set.add(t);
      pluralVariants(t).forEach((v) => set.add(v));
    };
    addWithPlurals(normalize(value));
    value.split(/[;,]/).forEach((part) => addWithPlurals(normalize(part)));
    (extra || []).forEach((a) => {
      const t = normalize(a);
      if (t) set.add(t);
    });
    return set;
  }

  function showCustomDeckComplete(deck, mode, count) {
    customCompleteDeck = deck;
    customCompleteMode = mode;
    const shown = typeof count === "number" ? count : deck.cards.length;
    if (mode === "quiz") {
      const left = getUnreviewedCustomCards(deck).length;
      els.customCompleteStat.textContent =
        `${shown}枚中${customQuizKnown}枚正解 · 未復習${left}枚`;
    } else {
      els.customCompleteStat.textContent = `${shown}枚を復習しました`;
    }
    els.customStudyAgainBtn.textContent = mode === "quiz" ? "次のラウンド" : "もう一度学習";
    showScreen("customComplete");
  }

  els.customStudyAgainBtn.addEventListener("click", () => {
    if (!customCompleteDeck) {
      showScreen("customDecks");
      return;
    }
    if (customCompleteMode === "type") {
      startCustomDeckType(customCompleteDeck);
    } else if (customCompleteMode === "review") {
      startCustomDeckReview(customCompleteDeck);
    } else if (customCompleteMode === "quiz") {
      startCustomDeckQuiz(customCompleteDeck);
    } else {
      startCustomDeckStudy(customCompleteDeck);
    }
  });

  els.customBackToListBtn.addEventListener("click", () => {
    customCompleteDeck = null;
    renderCustomDecksList();
    showScreen("customDecks");
  });

  // ---------- custom deck study: flashcards (tap-to-reveal, Again/Got it grading) ----------

  function startCustomDeckStudy(deck) {
    customStudyDeck = deck;
    customStudyCards = deck.cards;
    customStudyMode = "cards";
    customStudyIndex = 0;
    customStudyFlipped = false;
    showScreen("customStudy");
    renderCustomStudy();
  }

  // Typed-answer review of just this deck's due cards (cards with no answer
  // data can't be typed against, so they're skipped).
  function startCustomDeckReview(deck) {
    const due = getDueCustomCards(deck).filter((c) => c.sections.length);
    if (!due.length) {
      renderCustomDecksList();
      showScreen("customDecks");
      window.alert("このデッキには現在復習するカードがありません。");
      return;
    }
    startCustomTypeSession(deck, buildTypedQuestions(due), "review");
  }

  function renderCustomStudy() {
    const cards = customStudyCards;
    const card = cards[customStudyIndex];
    els.customStudyProgress.textContent = `${customStudyIndex + 1} / ${cards.length}`;
    els.customStudyFront.textContent = card.front;
    els.customStudyBackSections.innerHTML = sectionsToHtml(card.sections);
    els.customStudyCard.classList.toggle("flipped", customStudyFlipped);
    els.customFlashAgainBtn.disabled = !customStudyFlipped;
    els.customFlashGotItBtn.disabled = !customStudyFlipped;
  }

  function flipCustomCard() {
    if (customStudyFlipped) return;
    customStudyFlipped = true;
    renderCustomStudy();
  }

  function resolveCustomCard(correct) {
    if (!customStudyFlipped) return;
    const card = customStudyCards[customStudyIndex];
    applyCustomSrsResult(customStudyDeck, card.front, correct);
    const nextIndex = customStudyIndex + 1;
    if (nextIndex >= customStudyCards.length) {
      showCustomDeckComplete(customStudyDeck, customStudyMode, customStudyCards.length);
      return;
    }
    customStudyIndex = nextIndex;
    customStudyFlipped = false;
    renderCustomStudy();
  }

  els.customStudyCard.addEventListener("click", () => {
    if (!customStudyFlipped) flipCustomCard();
  });

  els.customStudyCard.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (!customStudyFlipped) flipCustomCard();
    } else if (e.code === "ArrowLeft" && customStudyFlipped) {
      resolveCustomCard(false);
    } else if (e.code === "ArrowRight" && customStudyFlipped) {
      resolveCustomCard(true);
    }
  });

  els.customFlashAgainBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resolveCustomCard(false);
  });

  els.customFlashGotItBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resolveCustomCard(true);
  });

  els.customStudyBackBtn.addEventListener("click", () => {
    customStudyDeck = null;
    customStudyCards = [];
    renderCustomDecksList();
    showScreen("customDecks");
  });

  // ---------- custom deck study: type answer (sequential, typo + plural tolerant) ----------

  // Typed modes (Type Answer, Quiz, Review) ask every section (reading,
  // meaning, ...) of each card as its own question, shuffled with a term's
  // questions kept apart where possible.
  function buildTypedQuestions(cards) {
    return spreadQuestions(
      cards.flatMap((card) => card.sections.map((section) => ({ card, section }))),
      (q) => q.card
    );
  }

  function startCustomTypeSession(deck, questions, mode) {
    customTypeDeck = deck;
    customTypeCards = questions.map((q) => q.card);
    customTypeAsked = questions.map((q) => q.section);
    // A term is graded once per session however many questions it has.
    customTermState = new Map();
    questions.forEach((q) => {
      const state = customTermState.get(q.card.front);
      if (state) state.left++;
      else customTermState.set(q.card.front, { left: 1, wrongs: 0, graded: null });
    });
    customTypeMode = mode;
    customTypeIndex = 0;
    customQuizKnown = 0;
    showScreen("customType");
    renderCustomType();
  }

  function startCustomDeckType(deck) {
    startCustomTypeSession(
      deck,
      buildTypedQuestions(deck.cards.filter((c) => c.sections.length)),
      "type"
    );
  }

  // Typed-answer placement quiz, played in fixed-size rounds (the Quiz
  // Questions setting). Each round draws whole cards, never-reviewed ones
  // first, until it has at least that many questions. Answers are saved as
  // they happen (a miss immediately, a pass once all of a card's questions
  // are right), so quitting mid-round loses nothing and the next round
  // continues with whatever is still unreviewed.
  function startCustomDeckQuiz(deck) {
    const cards = [];
    let questionCount = 0;
    for (const card of buildQuizQueue(deck)) {
      if (questionCount >= settings.quizQuestions) break;
      cards.push(card);
      questionCount += card.sections.length;
    }
    startCustomTypeSession(deck, buildTypedQuestions(cards), "quiz");
  }

  function gradeCustomTerm(deck, card, correct) {
    if (customTypeMode === "quiz") applyCustomQuizResult(deck, card, correct);
    else applyCustomSrsResult(deck, card.front, correct);
  }

  function renderCustomType() {
    const deck = customTypeDeck;
    const idx = customTypeIndex;
    if (idx >= customTypeCards.length) {
      showCustomDeckComplete(deck, customTypeMode, customTermState.size);
      return;
    }
    const card = customTypeCards[idx];
    customTypeCurrentSection = customTypeAsked[idx];
    customTypeAnswering = true;
    els.customTypeCard.classList.remove("answer-wrong", "answer-right");
    els.customTypeInput.disabled = false;
    els.customTypeInput.value = "";
    els.customTypeFeedback.hidden = true;
    els.customTypeSubmitBtn.textContent = "確認";
    els.customTypeBadge.textContent = customTypeCurrentSection.label;
    const badgeClass = badgeClassForLabel(customTypeCurrentSection.label);
    els.customTypeBadge.className = "question-type-badge" + (badgeClass ? ` ${badgeClass}` : "");
    els.customTypeFront.textContent = card.front;
    els.customTypeProgress.textContent =
      customTypeMode === "quiz"
        ? `${idx + 1} / ${customTypeCards.length} · 新規${getUnreviewedCustomCards(deck).length}`
        : `${idx + 1} / ${customTypeCards.length}`;
    els.customTypeInput.focus();
  }

  function updateCustomTypeFeedbackResult(correct, raw, fuzzy) {
    els.customTypeCard.classList.toggle("answer-wrong", !correct);
    els.customTypeCard.classList.toggle("answer-right", correct);
    els.customTypeFeedbackResult.textContent = correct
      ? fuzzy
        ? "✓ 正解！（ほぼ一致 — 軽いタイプミス）"
        : "✓ 正解！"
      : raw
      ? `✕ 惜しい — 入力: 「${raw}」`
      : "✕ 未回答";
    els.customTypeFeedbackResult.className =
      "type-feedback-result " + (correct ? "feedback-good" : "feedback-bad");
  }

  function updateCustomAddAnswerButton() {
    const canAdd = !pendingCustomTypeCorrect && Boolean(pendingCustomTypeRawAnswer);
    els.customAddAnswerBtn.hidden = !canAdd;
    if (canAdd) {
      els.customAddAnswerBtnText.textContent = `「${pendingCustomTypeRawAnswer}」を${customTypeCurrentSection.label}として追加`;
    }
  }

  function checkCustomTypeAnswer() {
    const deck = customTypeDeck;
    const card = customTypeCards[customTypeIndex];
    const section = customTypeCurrentSection;
    const raw = els.customTypeInput.value;
    const extra = getCustomDeckAnswers(deck, card.front, section.label);
    const accepted = buildCustomAcceptedAnswers(section.value, extra);
    const { correct, fuzzy } = matchAnswer(raw, accepted, true);
    const state = customTermState.get(card.front);
    state.left--;
    if (!correct) {
      state.wrongs++;
      if (!state.graded) {
        gradeCustomTerm(deck, card, false);
        state.graded = "wrong";
      }
    }
    if (state.left === 0 && state.wrongs === 0 && !state.graded) {
      gradeCustomTerm(deck, card, true);
      state.graded = "right";
      if (customTypeMode === "quiz") customQuizKnown++;
    }

    customTypeAnswering = false;
    pendingCustomTypeCorrect = correct;
    pendingCustomTypeRawAnswer = raw.trim();
    els.customTypeInput.disabled = true;
    els.customTypeSubmitBtn.textContent = "次へ";

    els.customTypeFeedback.hidden = false;
    els.customTypeFeedback.classList.toggle("quick", correct);
    updateCustomTypeFeedbackResult(correct, pendingCustomTypeRawAnswer, fuzzy);
    els.customTypeSections.innerHTML = sectionsToHtml(card.sections);
    updateCustomAddAnswerButton();

    if (correct) {
      customTypeAutoAdvanceTimer = window.setTimeout(() => {
        customTypeAutoAdvanceTimer = null;
        if (!customTypeAnswering && pendingCustomTypeCorrect) advanceCustomTypeCard();
      }, AUTO_ADVANCE_MS);
    } else {
      els.customTypeSubmitBtn.focus();
    }
  }

  function advanceCustomTypeCard() {
    window.clearTimeout(customTypeAutoAdvanceTimer);
    customTypeAutoAdvanceTimer = null;
    customTypeIndex++;
    renderCustomType();
  }

  els.customTypeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (customTypeAnswering) {
      checkCustomTypeAnswer();
    } else {
      advanceCustomTypeCard();
    }
  });

  els.customAddAnswerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (customTypeAnswering || !pendingCustomTypeRawAnswer) return;
    const deck = customTypeDeck;
    const card = customTypeCards[customTypeIndex];
    addCustomDeckAnswer(deck, card.front, customTypeCurrentSection.label, pendingCustomTypeRawAnswer);
    const state = customTermState.get(card.front);
    state.wrongs--;
    if (customTypeMode === "quiz" && state.wrongs === 0 && state.graded === "wrong") {
      // The miss was already saved as this card's first placement; now that
      // the player's answer has been accepted, undo it and place the card as
      // right once all of its questions are done.
      delete deck.srs[card.front];
      state.graded = null;
      if (state.left === 0) {
        applyCustomQuizResult(deck, card, true);
        state.graded = "right";
        customQuizKnown++;
      }
    }
    pendingCustomTypeCorrect = true;
    updateCustomTypeFeedbackResult(true, pendingCustomTypeRawAnswer, false);
    els.customAddAnswerBtn.hidden = true;
  });

  els.customTypeBackBtn.addEventListener("click", () => {
    window.clearTimeout(customTypeAutoAdvanceTimer);
    customTypeAutoAdvanceTimer = null;
    customTypeDeck = null;
    renderCustomDecksList();
    showScreen("customDecks");
  });

  // ---------- settings ----------

  function loadSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return null;
      return {
        stylizedFont:
          typeof parsed.stylizedFont === "boolean" ? parsed.stylizedFont : true,
        fontScale:
          typeof parsed.fontScale === "number" && parsed.fontScale > 0
            ? parsed.fontScale
            : 1,
        defaultDailyMinutes:
          Number.isFinite(parsed.defaultDailyMinutes) &&
          parsed.defaultDailyMinutes >= MIN_MINUTES &&
          parsed.defaultDailyMinutes <= MAX_MINUTES
            ? parsed.defaultDailyMinutes
            : DEFAULT_MINUTES,
        lessonQuestions: Number.isFinite(parsed.lessonQuestions)
          ? Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, parsed.lessonQuestions))
          : DEFAULT_QUESTIONS,
        reviewQuestions: Number.isFinite(parsed.reviewQuestions)
          ? Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, parsed.reviewQuestions))
          : DEFAULT_QUESTIONS,
        quizQuestions: Number.isFinite(parsed.quizQuestions)
          ? Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, parsed.quizQuestions))
          : DEFAULT_QUESTIONS,
        theme: THEMES.includes(parsed.theme) ? parsed.theme : DEFAULT_THEME,
      };
    } catch (err) {
      return null;
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (err) {
      /* localStorage unavailable (private mode, quota, etc.) */
    }
  }

  function applySettings() {
    document.documentElement.style.setProperty(
      "--font-scale",
      String(settings.fontScale)
    );
    document.body.classList.toggle("no-stylized-font", !settings.stylizedFont);
    document.documentElement.setAttribute("data-theme", settings.theme);
  }

  function refreshSettingsUI() {
    els.stylizedFontToggle.checked = settings.stylizedFont;
    const pct = Math.round(settings.fontScale * 100);
    els.fontSizeSlider.value = String(pct);
    els.fontSizeValue.textContent = `${pct}%`;
    els.defaultMinutesValue.textContent = String(settings.defaultDailyMinutes);
    els.lessonQuestionsValue.textContent = String(settings.lessonQuestions);
    els.reviewQuestionsValue.textContent = String(settings.reviewQuestions);
    els.quizQuestionsValue.textContent = String(settings.quizQuestions);
    if (els.themeOptions) {
      els.themeOptions.querySelectorAll(".theme-option").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.themeValue === settings.theme);
      });
    }
  }

  els.settingsBtn.addEventListener("click", () => {
    refreshSettingsUI();
    showScreen("settings");
  });

  if (els.themeOptions) {
    els.themeOptions.addEventListener("click", (event) => {
      const btn = event.target.closest(".theme-option");
      if (!btn || !els.themeOptions.contains(btn)) return;
      const value = btn.dataset.themeValue;
      if (!THEMES.includes(value) || value === settings.theme) return;
      settings.theme = value;
      applySettings();
      refreshSettingsUI();
      saveSettings();
    });
  }

  els.stylizedFontToggle.addEventListener("change", () => {
    settings.stylizedFont = els.stylizedFontToggle.checked;
    applySettings();
    saveSettings();
  });

  els.fontSizeSlider.addEventListener("input", () => {
    const pct = Number(els.fontSizeSlider.value);
    settings.fontScale = pct / 100;
    els.fontSizeValue.textContent = `${pct}%`;
    applySettings();
    saveSettings();
  });

  els.defaultMinutesDownBtn.addEventListener("click", () => {
    settings.defaultDailyMinutes = Math.max(
      MIN_MINUTES,
      settings.defaultDailyMinutes - 1
    );
    dailyMinutes = settings.defaultDailyMinutes;
    els.defaultMinutesValue.textContent = String(settings.defaultDailyMinutes);
    saveSettings();
  });

  els.defaultMinutesUpBtn.addEventListener("click", () => {
    settings.defaultDailyMinutes = Math.min(
      MAX_MINUTES,
      settings.defaultDailyMinutes + 1
    );
    dailyMinutes = settings.defaultDailyMinutes;
    els.defaultMinutesValue.textContent = String(settings.defaultDailyMinutes);
    saveSettings();
  });

  function changeQuestionSetting(name, amount) {
    settings[name] = Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, settings[name] + amount));
    refreshSettingsUI();
    saveSettings();
  }

  els.lessonQuestionsDownBtn.addEventListener("click", () => changeQuestionSetting("lessonQuestions", -1));
  els.lessonQuestionsUpBtn.addEventListener("click", () => changeQuestionSetting("lessonQuestions", 1));
  els.reviewQuestionsDownBtn.addEventListener("click", () => changeQuestionSetting("reviewQuestions", -1));
  els.reviewQuestionsUpBtn.addEventListener("click", () => changeQuestionSetting("reviewQuestions", 1));
  els.quizQuestionsDownBtn.addEventListener("click", () => changeQuestionSetting("quizQuestions", -1));
  els.quizQuestionsUpBtn.addEventListener("click", () => changeQuestionSetting("quizQuestions", 1));

  els.reshuffleDeckBtn.addEventListener("click", () => {
    reshuffleDeck();
    const original = els.reshuffleDeckBtn.textContent;
    els.reshuffleDeckBtn.textContent = "リセットしました ✓";
    els.reshuffleDeckBtn.disabled = true;
    window.setTimeout(() => {
      els.reshuffleDeckBtn.textContent = original;
      els.reshuffleDeckBtn.disabled = false;
    }, 1400);
  });

  // ---------- shared flashcard engine ----------

  function render() {
    if (queue.length === 0) {
      if (mode === "daily") {
        endDailyChallenge();
        return;
      }
      els.kanji.textContent = "完";
      els.frontHint.hidden = true;
      els.congratsMsg.hidden = false;
      els.newDeckBtn.hidden = false;
      els.card.classList.add("complete");
      els.card.classList.remove("flipped");
      els.progress.textContent = `${masteredCount} / ${totalCount} · 完了！`;
      els.againBtn.disabled = true;
      els.gotItBtn.disabled = true;
      if (mode === "marathon") saveState();
      return;
    }
    const item = queue[0];
    els.kanji.textContent = item.kanji;
    els.frontHint.hidden = false;
    els.frontHint.textContent = "タップして答えを見る";
    els.congratsMsg.hidden = true;
    els.newDeckBtn.hidden = true;
    els.card.classList.remove("complete");
    els.kanjiBack.textContent = item.kanji;
    els.onyomi.textContent = item.onyomi || "—";
    els.kunyomi.textContent = item.kunyomi || "—";
    els.meaning.textContent = item.meaning || "—";
    const cardStats = getCardStats(item.num);
    els.cardStatsRight.textContent = String(cardStats.right);
    els.cardStatsWrong.textContent = String(cardStats.wrong);
    const customSummary = formatCustomAnswersSummary(item.num);
    if (customSummary) {
      els.cardCustomAnswersList.textContent = customSummary;
      els.cardCustomAnswers.hidden = false;
    } else {
      els.cardCustomAnswers.hidden = true;
    }
    if (mode === "marathon") {
      els.progress.textContent = `${masteredCount} / ${totalCount} · 残り${queue.length}`;
    }
    els.card.classList.toggle("flipped", flipped);
    els.againBtn.disabled = !flipped;
    els.gotItBtn.disabled = !flipped;
    if (mode === "marathon" || mode === "daily") saveState();
  }

  function flipCard() {
    if (queue.length === 0 || flipped || animating) return;
    flipped = true;
    render();
  }

  function resolveCard(correct) {
    if (queue.length === 0 || !flipped || animating) return;
    animating = true;
    els.card.classList.add(correct ? "fly-right" : "fly-left");
    window.setTimeout(() => {
      const item = queue.shift();
      if (correct) {
        masteredCount++;
      }
      recordResult(item.num, correct);
      if (mode === "daily") {
        dailyTally.seen++;
        if (correct) dailyTally.right++;
        else dailyTally.wrong++;
      }
      flipped = false;
      els.card.style.transition = "none";
      els.card.classList.remove("fly-right", "fly-left");
      render();
      void els.card.offsetWidth;
      els.card.style.transition = "";
      animating = false;
    }, 240);
  }

  els.card.addEventListener("click", () => {
    if (animating) return;
    if (queue.length === 0) {
      if (mode === "lesson-type") {
        finishLesson();
        return;
      }
      if (mode === "marathon") {
        reshuffleDeck();
        render();
      }
      return;
    }
    if (!flipped) flipCard();
  });

  els.card.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "Enter") {
      e.preventDefault();
      if (queue.length === 0) {
        if (mode === "marathon") {
          reshuffleDeck();
          render();
        }
      } else if (!flipped) {
        flipCard();
      }
    } else if (e.code === "ArrowLeft" && flipped) {
      resolveCard(false);
    } else if (e.code === "ArrowRight" && flipped) {
      resolveCard(true);
    }
  });

  els.againBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resolveCard(false);
  });

  els.gotItBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    resolveCard(true);
  });

  els.newDeckBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    reshuffleDeck();
    render();
  });

  // ---------- marathon mode ----------

  function startMarathon() {
    mode = "marathon";
    els.progress.hidden = false;
    els.timerDisplay.hidden = true;
    flipped = false;
    showScreen("play");
    render();
  }

  els.modeMarathonBtn.addEventListener("click", () => {
    if (!allKanji.length) return;
    startMarathon();
  });

  // ---------- lessons ----------

  // `placement` maps a kanji number to the preliminary test's verdict:
  // "known" (answered everything right, kept out of lessons) or "learn".
  // `today` is the day's lesson: the kanji the test caught (see below).
  function normalizeLessonHistory(raw) {
    const history = raw && typeof raw === "object" && raw.completed ? raw : { completed: {} };
    if (!history.placement || typeof history.placement !== "object") history.placement = {};
    const today = history.today;
    history.today =
      today && typeof today.date === "string" && Array.isArray(today.nums)
        ? { date: today.date, nums: today.nums.filter((n) => Number.isFinite(n)) }
        : null;
    return history;
  }

  function loadLessonHistory() {
    try {
      return normalizeLessonHistory(JSON.parse(localStorage.getItem(LESSONS_KEY) || "null"));
    } catch (err) {
      return normalizeLessonHistory(null);
    }
  }

  function saveLessonHistory() {
    try {
      localStorage.setItem(LESSONS_KEY, JSON.stringify(lessonHistory));
    } catch (err) {
      /* localStorage unavailable */
    }
  }

  function isKanjiStudied(kanjiNum) {
    const entry = stats.perCard[String(kanjiNum)];
    return Boolean(entry && (entry.right > 0 || entry.wrong > 0));
  }

  // Today's lesson is the kanji the preliminary test caught: it keeps asking
  // untested kanji until `settings.lessonQuestions` of them have been missed,
  // and those become the lesson. A new day starts from any kanji caught earlier
  // but never lessoned, then the test tops the list up.
  function ensureTodaysLesson() {
    const today = dateKey(new Date());
    if (!lessonHistory.today || lessonHistory.today.date !== today) {
      const carried = allKanji
        .filter((item) => lessonHistory.placement[item.num] === "learn" && !isKanjiStudied(item.num))
        .slice(0, settings.lessonQuestions)
        .map((item) => item.num);
      lessonHistory.today = { date: today, nums: carried };
      saveLessonHistory();
    }
    return lessonHistory.today;
  }

  function todaysLessonCards() {
    return ensureTodaysLesson()
      .nums.map((num) => kanjiByNum.get(num))
      .filter(Boolean)
      .slice(0, settings.lessonQuestions);
  }

  // Kanji not yet judged by the test and not already studied through lessons.
  function unassessedKanji() {
    return allKanji.filter(
      (item) => !lessonHistory.placement[item.num] && !isKanjiStudied(item.num)
    );
  }


  // Spaced-repetition review queue: any previously-attempted kanji whose SRS
  // box has come due, weakest/most-overdue first. Brand-new kanji are
  // introduced via Lessons instead, not here.
  function getReviewCards() {
    const today = dateKey(new Date());
    const due = [];
    Object.keys(stats.perCard).forEach((key) => {
      const entry = stats.perCard[key];
      if (!entry || (entry.right === 0 && entry.wrong === 0)) return;
      if (!isDue(entry, today)) return;
      const item = kanjiByNum.get(Number(key));
      if (item) due.push({ item, box: entry.box || 0, dueDate: entry.due || "" });
    });
    due.sort((a, b) => a.box - b.box || (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
    return due.map((d) => d.item);
  }

  function renderLessons() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const todayKey = dateKey(today);
    const todaysCards = todaysLessonCards();
    const untestedCount = unassessedKanji().length;
    const wanted = settings.lessonQuestions;
    const testing = todaysCards.length < wanted && untestedCount > 0;
    els.lessonMonthLabel.textContent = today.toLocaleDateString("ja-JP", { year: "numeric", month: "long" });
    els.lessonTitle.textContent =
      todaysCards.length || testing ? "今日のレッスン" : "すべて習得済み";
    els.lessonSubtitle.textContent = testing
      ? `事前テストで間違えた漢字が今日のレッスンになります（${todaysCards.length} / ${wanted}字）。`
      : todaysCards.length
      ? `今日の重点漢字は${todaysCards.length}字。入力テストを完了すると日付に印が付きます。`
      : "すべての漢字が既習です。復習で定着させましょう。";
    els.startLessonBtn.textContent = testing
      ? todaysCards.length
        ? "事前テストを続ける"
        : "事前テストを始める"
      : "今日のレッスンを始める";
    els.startLessonBtn.disabled = !testing && todaysCards.length === 0;
    const headings = ["日", "月", "火", "水", "木", "金", "土"];
    let html = headings.map((day) => `<span class="calendar-heading">${day}</span>`).join("");
    for (let i = 0; i < firstDay.getDay(); i++) html += `<span class="calendar-day calendar-empty"></span>`;
    for (let day = 1; day <= daysInMonth; day++) {
      const key = dateKey(new Date(today.getFullYear(), today.getMonth(), day));
      const completed = Boolean(lessonHistory.completed[key]);
      html += `<span class="calendar-day${key === todayKey ? " calendar-today" : ""}${completed ? " calendar-complete" : ""}">${day}${completed ? `<span class="calendar-check" aria-label="レッスン完了">✓</span>` : ""}</span>`;
    }
    els.lessonCalendar.innerHTML = html;
    const reviewCount = getReviewCards().length;
    els.startReviewBtn.disabled = reviewCount === 0;
    els.lessonStatus.textContent = reviewCount
      ? `${reviewCount}枚の復習カードがあります。`
      : "現在復習するカードはありません。お疲れさまです。";

    const verdicts = allKanji.map((item) => lessonHistory.placement[item.num]);
    const known = verdicts.filter((v) => v === "known").length;
    const learn = verdicts.filter((v) => v === "learn").length;
    els.lessonPlacementStatus.textContent = `事前テスト: 既習${known}字 · 要学習${learn}字 · 未判定${untestedCount}字`;
  }

  // Lessons are typed: every kanji gets a question per available answer type
  // (meaning and onyomi reading), all shuffled together.
  function buildLessonQuestions(cards) {
    return spreadQuestions(
      cards.flatMap((item) =>
        availableQuestionTypes(item).map((type) => ({ item, type }))
      ),
      (q) => q.item
    );
  }

  // Placement runs until today's lesson is full: when the current batch is
  // used up, the next batch of untested kanji is queued. A batch is never
  // larger than the number of kanji still needed, so the lesson can't overshoot.
  function refillPlacement() {
    const needed = settings.lessonQuestions - ensureTodaysLesson().nums.length;
    if (needed <= 0) return false;
    const batch = unassessedKanji().slice(0, needed);
    if (!batch.length) return false;
    const questions = buildLessonQuestions(batch);
    questions.forEach((q) => {
      const state = lessonTermState.get(q.item.num);
      if (state) state.left++;
      else lessonTermState.set(q.item.num, { left: 1, wrongs: 0, graded: null });
    });
    queue = questions.map((q) => q.item);
    lessonQuestionTypes = questions.map((q) => q.type);
    lessonSession.total += questions.length;
    lessonSession.cards = lessonSession.cards.concat(batch);
    return true;
  }

  function beginLesson(cards, kind) {
    savedMainSession = { queue, totalCount, masteredCount };
    const questions = buildLessonQuestions(cards);
    lessonSession = {
      date: dateKey(new Date()),
      kind,
      cards,
      total: questions.length,
      seen: 0,
      right: 0,
      wrong: 0,
      placed: { known: 0, learn: 0 },
    };
    // A kanji is graded once per lesson: wrong as soon as any of its
    // questions is missed, right after all of them are answered correctly.
    lessonTermState = new Map();
    questions.forEach((q) => {
      const state = lessonTermState.get(q.item.num);
      if (state) state.left++;
      else lessonTermState.set(q.item.num, { left: 1, wrongs: 0, graded: null });
    });
    queue = questions.map((q) => q.item);
    lessonQuestionTypes = questions.map((q) => q.type);
    totalCount = questions.length;
    masteredCount = 0;
    mode = "lesson-type";
    showScreen("type");
    renderType();
  }

  // Records the preliminary test's verdict for a kanji. Known kanji also get a
  // starting spot in the review schedule so they come back for review later.
  function markPlacement(kanjiNum, verdict) {
    lessonHistory.placement[kanjiNum] = verdict;
    lessonSession.placed[verdict]++;
    if (verdict === "learn") {
      const todays = ensureTodaysLesson();
      if (!todays.nums.includes(kanjiNum) && todays.nums.length < settings.lessonQuestions) {
        todays.nums.push(kanjiNum);
      }
    }
    saveLessonHistory();
    if (verdict !== "known") return;
    const today = dateKey(new Date());
    const [y, m, d] = today.split("-").map(Number);
    const key = String(kanjiNum);
    const previous = stats.perCard[key] || { right: 0, wrong: 0 };
    stats.perCard[key] = {
      ...previous,
      right: Math.max(previous.right, 1),
      box: QUIZ_KNOWN_BOX,
      due: dateKey(new Date(y, m - 1, d + BOX_INTERVALS_DAYS[QUIZ_KNOWN_BOX])),
      lastSeen: today,
      streak: 1,
    };
    saveStats();
  }

  function gradeLessonTerm(item, correct) {
    const placement = lessonSession.kind === "placement";
    const state = lessonTermState.get(item.num);
    state.left--;
    if (!correct) {
      state.wrongs++;
      if (!state.graded) {
        if (placement) markPlacement(item.num, "learn");
        else gradeBuiltinSrs(item.num, false);
        state.graded = "wrong";
      }
    }
    if (state.left === 0 && state.wrongs === 0 && !state.graded) {
      if (placement) markPlacement(item.num, "known");
      else gradeBuiltinSrs(item.num, true);
      state.graded = "right";
    }
  }

  function finishLesson() {
    const placement = lessonSession.kind === "placement";
    if (!placement) {
      lessonHistory.completed[lessonSession.date] = lessonSession.cards.map((item) => item.num);
      saveLessonHistory();
    }
    if (savedMainSession) {
      queue = savedMainSession.queue;
      totalCount = savedMainSession.totalCount;
      masteredCount = savedMainSession.masteredCount;
    }
    savedMainSession = null;
    els.lessonResultTitle.textContent = placement
      ? "事前テスト完了"
      : lessonSession.kind === "review"
      ? "復習完了"
      : "レッスン完了";
    els.lessonResultNote.hidden = !placement;
    if (placement) {
      els.lessonResultNote.textContent =
        `既習 ${lessonSession.placed.known}字 · 要学習 ${lessonSession.placed.learn}字 · 今日のレッスン ${ensureTodaysLesson().nums.length} / ${settings.lessonQuestions}字`;
    }
    els.lessonResultSeen.textContent = String(lessonSession.seen);
    els.lessonResultRight.textContent = String(lessonSession.right);
    els.lessonResultWrong.textContent = String(lessonSession.wrong);
    const accuracy = lessonSession.seen
      ? Math.round((lessonSession.right / lessonSession.seen) * 100)
      : 0;
    els.lessonResultAccuracy.textContent = `正答率 ${accuracy}%`;
    lessonSession = null;
    mode = null;
    showScreen("lessonResults");
  }

  els.modeLessonsBtn.addEventListener("click", () => {
    if (!allKanji.length) return;
    renderLessons();
    showScreen("lessons");
  });
  // Starts the preliminary test while today's lesson still needs kanji;
  // otherwise starts the lesson itself.
  els.startLessonBtn.addEventListener("click", () => {
    const todays = todaysLessonCards();
    const untested = unassessedKanji();
    if (todays.length < settings.lessonQuestions && untested.length) {
      beginLesson(untested.slice(0, settings.lessonQuestions - todays.length), "placement");
    } else if (todays.length) {
      beginLesson(todays, "lesson");
    }
  });
  els.startReviewBtn.addEventListener("click", () => {
    const cards = getReviewCards();
    if (cards.length) beginLesson(cards.slice(0, settings.reviewQuestions), "review");
  });

  els.lessonResultsLessonsBtn.addEventListener("click", () => {
    renderLessons();
    showScreen("lessons");
  });

  // ---------- daily challenge mode ----------

  function formatTimer(totalSeconds) {
    const s = Math.max(0, totalSeconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, "0")}`;
  }

  function updateTimeValue() {
    els.timeValue.textContent = String(dailyMinutes);
  }

  els.timeUpBtn.addEventListener("click", () => {
    dailyMinutes = Math.min(MAX_MINUTES, dailyMinutes + 1);
    updateTimeValue();
  });

  els.timeDownBtn.addEventListener("click", () => {
    dailyMinutes = Math.max(MIN_MINUTES, dailyMinutes - 1);
    updateTimeValue();
  });

  els.modeDailyBtn.addEventListener("click", () => {
    if (!allKanji.length) return;
    updateTimeValue();
    showScreen("dailySetup");
  });

  els.startDailyBtn.addEventListener("click", () => {
    startDailyChallenge();
  });

  function clearDailyInterval() {
    if (dailyIntervalId !== null) {
      window.clearInterval(dailyIntervalId);
      dailyIntervalId = null;
    }
  }

  function startDailyChallenge() {
    mode = "daily";
    els.progress.hidden = true;
    els.timerDisplay.hidden = false;

    dailyTimeLeft = dailyMinutes * 60;
    dailyTally = { seen: 0, right: 0, wrong: 0 };
    flipped = false;

    showScreen("play");
    render();
    els.timerDisplay.textContent = formatTimer(dailyTimeLeft);

    clearDailyInterval();
    dailyIntervalId = window.setInterval(() => {
      dailyTimeLeft--;
      els.timerDisplay.textContent = formatTimer(dailyTimeLeft);
      if (dailyTimeLeft <= 0) {
        clearDailyInterval();
        endDailyChallenge();
      }
    }, 1000);
  }

  function endDailyChallenge() {
    clearDailyInterval();
    els.resultSeen.textContent = String(dailyTally.seen);
    els.resultRight.textContent = String(dailyTally.right);
    els.resultWrong.textContent = String(dailyTally.wrong);
    const accuracy = dailyTally.seen
      ? Math.round((dailyTally.right / dailyTally.seen) * 100)
      : 0;
    els.resultAccuracy.textContent = `正答率 ${accuracy}%`;
    showScreen("dailyResults");
  }

  els.dailyAgainBtn.addEventListener("click", () => {
    updateTimeValue();
    showScreen("dailySetup");
  });

  els.dailyHomeBtn.addEventListener("click", () => {
    mode = null;
    showScreen("home");
  });

  // ---------- back navigation ----------

  document.querySelectorAll("[data-back]").forEach((btn) => {
    btn.addEventListener("click", () => {
      clearDailyInterval();
      if (lessonSession) {
        if (savedMainSession) {
          queue = savedMainSession.queue;
          totalCount = savedMainSession.totalCount;
          masteredCount = savedMainSession.masteredCount;
        }
        savedMainSession = null;
        lessonSession = null;
      }
      mode = null;
      showScreen("home");
    });
  });

  // ---------- statistics ----------

  function formatDayLabel(d, isToday) {
    if (isToday) return "今日";
    return d.toLocaleDateString("ja-JP", { weekday: "short" });
  }

  function renderStats() {
    const rows = [];
    const today = new Date();
    for (let i = 0; i <= 6; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const key = dateKey(d);
      const entry = stats.daily[key] || { completed: 0, right: 0, wrong: 0 };
      rows.push({ label: formatDayLabel(d, i === 0), ...entry });
    }

    const rowsHtml = rows
      .map(
        (r) => `
      <div class="stats-row">
        <span class="stats-cell stats-cell-date">${r.label}</span>
        <span class="stats-cell stats-cell-num">${r.completed}</span>
        <span class="stats-cell stats-cell-right">${r.right}</span>
        <span class="stats-cell stats-cell-wrong">${r.wrong}</span>
      </div>`
      )
      .join("");

    let totalCompleted = 0;
    let totalRight = 0;
    let totalWrong = 0;
    Object.keys(stats.daily).forEach((key) => {
      const v = stats.daily[key];
      totalCompleted += v.completed;
      totalRight += v.right;
      totalWrong += v.wrong;
    });
    const overallAccuracy = totalCompleted
      ? Math.round((totalRight / totalCompleted) * 100)
      : 0;
    const cardsAttempted = Object.keys(stats.perCard).length;

    let known = 0;
    let learning = 0;
    Object.keys(stats.perCard).forEach((key) => {
      if (srsTier(stats.perCard[key]) === "known") known++;
      else learning++;
    });
    const totalKanji = allKanji.length || 367;
    const newCount = Math.max(totalKanji - cardsAttempted, 0);
    const dueCount = getReviewCards().length;

    els.statsBody.innerHTML = `
      <div class="stats-section-title">過去7日間</div>
      <div class="stats-table">
        <div class="stats-row stats-header">
          <span class="stats-cell stats-cell-date">日</span>
          <span class="stats-cell stats-cell-num">合計</span>
          <span class="stats-cell stats-cell-right">覚えた</span>
          <span class="stats-cell stats-cell-wrong">もう一度</span>
        </div>
        ${rowsHtml}
      </div>
      <div class="stats-section-title">全体</div>
      <div class="stats-overall">
        <div class="overall-tile">
          <div class="overall-num">${totalCompleted}</div>
          <div class="overall-label">復習数</div>
        </div>
        <div class="overall-tile">
          <div class="overall-num">${totalRight}</div>
          <div class="overall-label">覚えた</div>
        </div>
        <div class="overall-tile">
          <div class="overall-num">${totalWrong}</div>
          <div class="overall-label">もう一度</div>
        </div>
        <div class="overall-tile">
          <div class="overall-num">${overallAccuracy}%</div>
          <div class="overall-label">正答率</div>
        </div>
      </div>
      <div class="stats-section-title">習熟度</div>
      <div class="stats-overall">
        <div class="overall-tile">
          <div class="overall-num">${newCount}</div>
          <div class="overall-label">新規</div>
        </div>
        <div class="overall-tile">
          <div class="overall-num">${learning}</div>
          <div class="overall-label">学習中</div>
        </div>
        <div class="overall-tile">
          <div class="overall-num">${known}</div>
          <div class="overall-label">習得済み</div>
        </div>
      </div>
      ${
        dueCount
          ? `<button class="secondary-btn stats-review-btn" type="button" data-action="review-now">${dueCount}枚が復習待ち — 今すぐ復習</button>`
          : `<div class="stats-footnote">現在復習するカードはありません。</div>`
      }
    `;
  }

  els.statsBody.addEventListener("click", (event) => {
    if (!event.target.closest("[data-action='review-now']")) return;
    const cards = getReviewCards();
    if (cards.length) beginLesson(cards.slice(0, settings.reviewQuestions), "review");
  });

  els.modeStatsBtn.addEventListener("click", () => {
    renderStats();
    showScreen("stats");
  });

  els.resetStatsBtn.addEventListener("click", () => {
    const ok = window.confirm(
      "すべての統計をリセットしますか？日ごとの履歴とカードごとの正解・不正解数が消去されます。この操作は元に戻せません。"
    );
    if (!ok) return;
    stats = { daily: {}, perCard: {} };
    saveStats();
    renderStats();
  });

  // ---------- type answer mode ----------

  function normalize(s) {
    return s.trim().toLowerCase();
  }

  function splitReading(str) {
    return str
      .split(/[,、]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function expandParenVariants(token) {
    const variants = new Set([token]);
    if (token.includes("(") && token.includes(")")) {
      variants.add(token.replace(/[()]/g, ""));
      variants.add(token.replace(/\([^)]*\)/g, "").trim());
    }
    return variants;
  }

  function pluralVariants(word) {
    const variants = new Set();
    if (!word) return variants;
    if (/[^aeiou]y$/.test(word)) {
      variants.add(word.slice(0, -1) + "ies");
    } else if (/(s|x|z|ch|sh)$/.test(word)) {
      variants.add(word + "es");
    } else if (!word.endsWith("s")) {
      variants.add(word + "s");
    }
    if (word.endsWith("ies") && word.length > 3) {
      variants.add(word.slice(0, -3) + "y");
    } else if (/(ses|xes|zes|ches|shes)$/.test(word)) {
      variants.add(word.slice(0, -2));
    } else if (word.endsWith("s") && !word.endsWith("ss")) {
      variants.add(word.slice(0, -1));
    }
    return variants;
  }

  function levenshtein(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0) return n;
    if (n === 0) return m;
    let prev = new Array(n + 1);
    let curr = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      curr[0] = i;
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
      }
      [prev, curr] = [curr, prev];
    }
    return prev[n];
  }

  function typoThreshold(len) {
    if (len <= 3) return 0;
    if (len <= 7) return 1;
    return 2;
  }

  function isKanaOrKanji(str) {
    return /[぀-ヿ一-鿿]/.test(str);
  }

  // Exact match first; otherwise allow a small typo (bounded edit distance
  // that grows with word length) against Latin-script answers only. Kana
  // readings must match exactly — allowFuzzy is false for onyomi/kunyomi
  // questions since the input is auto-converted kana, not free-typed prose.
  function matchAnswer(raw, accepted, allowFuzzy) {
    const norm = normalize(raw);
    if (!norm) return { correct: false, fuzzy: false };
    if (accepted.has(norm)) return { correct: true, fuzzy: false };
    if (!allowFuzzy || isKanaOrKanji(norm)) return { correct: false, fuzzy: false };
    for (const candidate of accepted) {
      if (isKanaOrKanji(candidate)) continue;
      const maxLen = Math.max(norm.length, candidate.length);
      const threshold = typoThreshold(maxLen);
      if (threshold === 0) continue;
      if (Math.abs(norm.length - candidate.length) > threshold) continue;
      if (levenshtein(norm, candidate) <= threshold) {
        return { correct: true, fuzzy: true, matched: candidate };
      }
    }
    return { correct: false, fuzzy: false };
  }

  // Type Answer questions come in three flavors, each checked against only
  // the matching field on the kanji (plus any custom answers saved for that
  // same field) rather than one combined pool of everything.
  const QUESTION_TYPES = {
    meaning: {
      label: "意味",
      badgeClass: "",
      placeholder: "Answer",
    },
    onyomi: {
      label: "読み",
      badgeClass: "qt-onyomi",
      placeholder: "答え",
    },
  };

  function availableQuestionTypes(item) {
    const types = ["meaning"];
    if (item.onyomi) types.push("onyomi");
    return types;
  }

  function pickQuestionType(item) {
    const types = availableQuestionTypes(item);
    return types[Math.floor(Math.random() * types.length)];
  }

  function setTypeInputMode(type) {
    if (typeof wanakana === "undefined") return;
    try {
      wanakana.unbind(els.typeInput);
    } catch (err) {
      /* wasn't bound; ignore */
    }
    if (type === "onyomi") {
      wanakana.bind(els.typeInput, { IMEMode: "toKatakana" });
    }
  }

  function buildAnswersForType(item, type) {
    const set = new Set();
    if (type === "meaning") {
      item.meaning.split(/[;,]/).forEach((part) => {
        const t = normalize(part);
        if (t) {
          set.add(t);
          pluralVariants(t).forEach((v) => set.add(v));
        }
      });
    } else {
      [item[`${type}Romaji`], item[type]].forEach((field) => {
        if (!field) return;
        splitReading(field).forEach((token) => {
          expandParenVariants(token).forEach((v) => {
            const t = normalize(v);
            if (t) set.add(t);
          });
        });
      });
    }
    getCustomAnswers(item.num, type).forEach((a) => {
      const t = normalize(a);
      if (t) set.add(t);
    });
    return set;
  }

  function startTypeMode() {
    mode = "type";
    showScreen("type");
    renderType();
  }

  function renderType() {
    typeAnswering = true;
    els.typeCard.classList.remove("answer-wrong", "answer-right");
    els.typeInput.disabled = false;
    els.typeInput.value = "";
    els.typeFeedback.hidden = true;
    els.typeSubmitBtn.textContent = "確認";

    if (queue.length === 0 && mode === "lesson-type" && lessonSession.kind === "placement") {
      refillPlacement();
    }
    if (queue.length === 0) {
      if (mode === "lesson-type") {
        finishLesson();
        return;
      }
      els.questionTypeBadge.hidden = true;
      setTypeInputMode("meaning");
      els.typeKanji.textContent = "完";
      els.typeForm.hidden = true;
      els.typeCongratsMsg.hidden = false;
      els.typeNewDeckBtn.hidden = false;
      els.typeProgress.textContent = `${masteredCount} / ${totalCount} · 完了！`;
      if (mode === "type") saveState();
      return;
    }

    const item = queue[0];
    currentQuestionType =
      mode === "lesson-type" ? lessonQuestionTypes[0] : pickQuestionType(item);
    const config = QUESTION_TYPES[currentQuestionType];

    els.questionTypeBadge.hidden = false;
    els.questionTypeBadge.textContent = config.label;
    els.questionTypeBadge.className =
      "question-type-badge" + (config.badgeClass ? ` ${config.badgeClass}` : "");
    els.typeInput.placeholder = config.placeholder;
    setTypeInputMode(currentQuestionType);

    els.typeForm.hidden = false;
    els.typeCongratsMsg.hidden = true;
    els.typeNewDeckBtn.hidden = true;
    els.typeKanji.textContent = item.kanji;
    els.typeProgress.textContent =
      mode === "lesson-type" && lessonSession.kind === "placement"
        ? `今日のレッスン ${ensureTodaysLesson().nums.length} / ${settings.lessonQuestions}字`
        : mode === "lesson-type"
        ? `${lessonSession.seen} / ${lessonSession.total}`
        : `${masteredCount} / ${totalCount} · 残り${queue.length}`;
    els.typeInput.focus();
    if (mode === "type") saveState();
  }

  function updateTypeFeedbackResult(correct, raw, fuzzy) {
    els.typeCard.classList.toggle("answer-wrong", !correct);
    els.typeCard.classList.toggle("answer-right", correct);
    els.typeFeedbackResult.textContent = correct
      ? fuzzy
        ? "✓ 正解！（ほぼ一致 — 軽いタイプミス）"
        : "✓ 正解！"
      : raw
      ? `✕ 惜しい — 入力: 「${raw}」`
      : "✕ 未回答";
    els.typeFeedbackResult.className =
      "type-feedback-result " + (correct ? "feedback-good" : "feedback-bad");
  }

  function renderTypeCustomAnswers(kanjiNum, type) {
    const list = getCustomAnswers(kanjiNum, type);
    if (list.length) {
      els.typeCustomAnswersList.textContent = list.join(", ");
      els.typeCustomAnswers.hidden = false;
    } else {
      els.typeCustomAnswers.hidden = true;
    }
  }

  function updateAddAnswerButton() {
    const canAdd = !pendingTypeCorrect && Boolean(pendingTypeRawAnswer);
    els.addAnswerBtn.hidden = !canAdd;
    if (canAdd) {
      const label = QUESTION_TYPES[currentQuestionType].label;
      els.addAnswerBtnText.textContent = `「${pendingTypeRawAnswer}」を${label}として追加`;
    }
  }

  function checkTypeAnswer() {
    if (queue.length === 0) return;
    const item = queue[0];
    const raw = els.typeInput.value;
    const accepted = buildAnswersForType(item, currentQuestionType);
    const { correct, fuzzy } = matchAnswer(raw, accepted, currentQuestionType === "meaning");

    typeAnswering = false;
    pendingTypeCorrect = correct;
    pendingTypeRawAnswer = raw.trim();
    els.typeInput.disabled = true;
    els.typeSubmitBtn.textContent = "次へ";

    els.typeFeedback.hidden = false;
    els.typeFeedback.classList.toggle("quick", correct);
    updateTypeFeedbackResult(correct, pendingTypeRawAnswer, fuzzy);
    els.typeOnyomi.textContent = item.onyomi || "—";
    els.typeKunyomi.textContent = item.kunyomi || "—";
    els.typeMeaning.textContent = item.meaning || "—";
    renderTypeCustomAnswers(item.num, currentQuestionType);
    updateAddAnswerButton();
    const cardStats = getCardStats(item.num);
    els.typeCardStatsRight.textContent = String(cardStats.right);
    els.typeCardStatsWrong.textContent = String(cardStats.wrong);

    if (correct) {
      typeAutoAdvanceTimer = window.setTimeout(() => {
        typeAutoAdvanceTimer = null;
        if (!typeAnswering && pendingTypeCorrect) advanceTypeCard();
      }, AUTO_ADVANCE_MS);
    } else {
      // The disabled input drops focus; park it on Next so Enter continues.
      els.typeSubmitBtn.focus();
    }
  }

  function advanceTypeCard() {
    window.clearTimeout(typeAutoAdvanceTimer);
    typeAutoAdvanceTimer = null;
    const item = queue.shift();
    if (pendingTypeCorrect) {
      masteredCount++;
    }
    if (mode === "lesson-type") {
      lessonQuestionTypes.shift();
      if (lessonSession.kind !== "placement") {
        recordResult(item.num, pendingTypeCorrect, false);
      }
      gradeLessonTerm(item, pendingTypeCorrect);
      lessonSession.seen++;
      if (pendingTypeCorrect) lessonSession.right++;
      else lessonSession.wrong++;
    } else {
      recordResult(item.num, pendingTypeCorrect);
    }
    renderType();
  }

  els.typeForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (queue.length === 0) return;
    if (typeAnswering) {
      checkTypeAnswer();
    } else {
      advanceTypeCard();
    }
  });

  els.addAnswerBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (queue.length === 0 || typeAnswering || !pendingTypeRawAnswer) return;
    const item = queue[0];
    addCustomAnswer(item.num, currentQuestionType, pendingTypeRawAnswer);
    pendingTypeCorrect = true;
    updateTypeFeedbackResult(true, pendingTypeRawAnswer);
    renderTypeCustomAnswers(item.num, currentQuestionType);
    els.addAnswerBtn.hidden = true;
  });

  els.typeNewDeckBtn.addEventListener("click", () => {
    reshuffleDeck();
    renderType();
  });

  els.modeTypeBtn.addEventListener("click", () => {
    if (!allKanji.length) return;
    startTypeMode();
  });

  // ---------- export / import ----------

  function buildLocalProfileSnapshot() {
    return {
      settings,
      customAnswers,
      stats,
      lessons: lessonHistory,
      deck: {
        queueNums: queue.map((item) => item.num),
        masteredCount,
        totalCount,
      },
    };
  }

  // Applies a profile snapshot (from an import, or a merge result) to local
  // state. Uses the existing save*() functions so persistence stays in one
  // place.
  function applyProfileSnapshot(profile) {
    if (!profile) return;
    if (profile.settings) {
      settings = { ...settings, ...profile.settings };
      applySettings();
      refreshSettingsUI();
      saveSettings();
    }
    if (profile.customAnswers) {
      customAnswers = normalizeCustomAnswersShape(profile.customAnswers);
      saveCustomAnswers();
    }
    if (profile.stats) {
      stats = profile.stats;
      saveStats();
    }
    if (profile.lessons) {
      lessonHistory = normalizeLessonHistory(profile.lessons);
      saveLessonHistory();
    }
    if (profile.deck && Array.isArray(profile.deck.queueNums)) {
      const nums = profile.deck.queueNums.filter((n) => kanjiByNum.has(n));
      if (nums.length) {
        queue = nums.map((n) => kanjiByNum.get(n));
        totalCount = profile.deck.totalCount || allKanji.length;
        masteredCount = profile.deck.masteredCount || 0;
        saveState();
      }
    }
  }

  // Custom decks are keyed by id; on conflict (same deck edited on two
  // devices before syncing) the most recently updated copy wins, matching
  // how a replace/rename should behave rather than trying to merge card lists.
  function mergeCustomDecksLists(a, b) {
    const byId = new Map();
    (a || []).forEach((d) => byId.set(d.id, d));
    (b || []).forEach((d) => {
      const existing = byId.get(d.id);
      if (!existing || (d.updatedAt || "") > (existing.updatedAt || "")) {
        byId.set(d.id, d);
      }
    });
    return Array.from(byId.values());
  }

  function mergeAnswerLists(a, b) {
    const seen = new Set();
    const merged = [];
    [...a, ...b].forEach((answer) => {
      const norm = normalize(answer);
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        merged.push(answer);
      }
    });
    return merged;
  }

  function mergeCustomAnswerEntries(a, b) {
    return {
      meaning: mergeAnswerLists((a && a.meaning) || [], (b && b.meaning) || []),
      onyomi: mergeAnswerLists((a && a.onyomi) || [], (b && b.onyomi) || []),
      kunyomi: mergeAnswerLists((a && a.kunyomi) || [], (b && b.kunyomi) || []),
    };
  }

  function mergeProfiles(local, incoming) {
    const localAnswers = normalizeCustomAnswersShape(local.customAnswers || {});
    const incomingAnswers = normalizeCustomAnswersShape(incoming.customAnswers || {});
    const customAnswersMerged = {};
    new Set([
      ...Object.keys(localAnswers),
      ...Object.keys(incomingAnswers),
    ]).forEach((key) => {
      customAnswersMerged[key] = mergeCustomAnswerEntries(
        localAnswers[key],
        incomingAnswers[key]
      );
    });

    const daily = {};
    new Set([
      ...Object.keys((local.stats && local.stats.daily) || {}),
      ...Object.keys((incoming.stats && incoming.stats.daily) || {}),
    ]).forEach((key) => {
      const a = (local.stats && local.stats.daily && local.stats.daily[key]) || {
        completed: 0,
        right: 0,
        wrong: 0,
      };
      const b = (incoming.stats && incoming.stats.daily && incoming.stats.daily[key]) || {
        completed: 0,
        right: 0,
        wrong: 0,
      };
      daily[key] = {
        completed: a.completed + b.completed,
        right: a.right + b.right,
        wrong: a.wrong + b.wrong,
      };
    });

    const perCard = {};
    new Set([
      ...Object.keys((local.stats && local.stats.perCard) || {}),
      ...Object.keys((incoming.stats && incoming.stats.perCard) || {}),
    ]).forEach((key) => {
      const a = (local.stats && local.stats.perCard && local.stats.perCard[key]) || {
        right: 0,
        wrong: 0,
      };
      const b = (incoming.stats && incoming.stats.perCard && incoming.stats.perCard[key]) || {
        right: 0,
        wrong: 0,
      };
      // right/wrong are lifetime counters, safe to sum; box/due/streak are
      // point-in-time state, so the more recently-graded side wins instead.
      perCard[key] = {
        right: a.right + b.right,
        wrong: a.wrong + b.wrong,
        ...pickNewerSrs(a, b),
      };
    });

    const completed = {};
    new Set([
      ...Object.keys((local.lessons && local.lessons.completed) || {}),
      ...Object.keys((incoming.lessons && incoming.lessons.completed) || {}),
    ]).forEach((key) => {
      const a = (local.lessons && local.lessons.completed && local.lessons.completed[key]) || [];
      const b = (incoming.lessons && incoming.lessons.completed && incoming.lessons.completed[key]) || [];
      completed[key] = Array.from(new Set([...a, ...b]));
    });
    const localEpoch = local.lessons && local.lessons.epoch;
    const incomingEpoch = incoming.lessons && incoming.lessons.epoch;
    const epoch =
      localEpoch && incomingEpoch
        ? localEpoch < incomingEpoch
          ? localEpoch
          : incomingEpoch
        : localEpoch || incomingEpoch;

    // A kanji either side wants to learn stays "learn"; otherwise known wins.
    const placement = {};
    new Set([
      ...Object.keys((local.lessons && local.lessons.placement) || {}),
      ...Object.keys((incoming.lessons && incoming.lessons.placement) || {}),
    ]).forEach((key) => {
      const a = local.lessons && local.lessons.placement && local.lessons.placement[key];
      const b = incoming.lessons && incoming.lessons.placement && incoming.lessons.placement[key];
      placement[key] = a === "learn" || b === "learn" ? "learn" : a || b;
    });

    const todayA = local.lessons && local.lessons.today;
    const todayB = incoming.lessons && incoming.lessons.today;
    let today = todayA || todayB || null;
    if (todayA && todayB) {
      if (todayA.date === todayB.date) {
        today = { date: todayA.date, nums: Array.from(new Set([...todayA.nums, ...todayB.nums])) };
      } else {
        today = todayA.date > todayB.date ? todayA : todayB;
      }
    }

    return {
      customAnswers: customAnswersMerged,
      stats: { daily, perCard },
      lessons: { completed, epoch, placement, today },
      settings: incoming.settings || local.settings,
      deck: incoming.deck || local.deck,
    };
  }

  // ---------- export / import ----------

  function buildExportData() {
    return {
      app: EXPORT_APP_ID,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      profile: buildLocalProfileSnapshot(),
      customDecks,
    };
  }

  function setDataStatus(message) {
    els.dataStatus.textContent = message;
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(buildExportData())], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `kanji-flash-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDataStatus("バックアップファイルをダウンロードしました。");
  }

  function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  // Returns { profile, decks } or null if the file isn't a Kanji Flash backup.
  function parseImportText(text) {
    // Keys like __proto__ have no business in a backup and would be unsafe
    // as object keys in the merge below.
    if (text.includes('"__proto__"')) return null;
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      return null;
    }
    if (!isPlainObject(data) || data.app !== EXPORT_APP_ID) return null;
    if (data.version !== EXPORT_VERSION || !isPlainObject(data.profile)) return null;
    const decks = (Array.isArray(data.customDecks) ? data.customDecks : []).filter(
      (d) =>
        isPlainObject(d) &&
        typeof d.id === "string" &&
        typeof d.name === "string" &&
        Array.isArray(d.cards)
    );
    return { profile: data.profile, decks };
  }

  function finishImport(profile, decks) {
    applyProfileSnapshot(profile);
    customDecks = decks;
    saveCustomDecks();
    pendingImport = null;
    setDataStatus("バックアップをインポートしました。");
    showScreen("home");
  }

  els.exportDataBtn.addEventListener("click", exportData);
  els.importDataBtn.addEventListener("click", () => els.importFileInput.click());

  els.importFileInput.addEventListener("change", () => {
    const file = els.importFileInput.files && els.importFileInput.files[0];
    els.importFileInput.value = "";
    if (!file) return;
    file
      .text()
      .then((text) => {
        const parsed = parseImportText(text);
        if (!parsed) {
          setDataStatus("このファイルは有効な漢字フラッシュのバックアップではありません。");
          return;
        }
        pendingImport = parsed;
        showScreen("importChoice");
      })
      .catch(() => setDataStatus("ファイルを読み込めませんでした。"));
  });

  els.importMergeBtn.addEventListener("click", () => {
    if (!pendingImport) return;
    const local = buildLocalProfileSnapshot();
    finishImport(
      mergeProfiles(local, pendingImport.profile),
      mergeCustomDecksLists(customDecks, pendingImport.decks)
    );
  });

  els.importReplaceBtn.addEventListener("click", () => {
    if (!pendingImport) return;
    finishImport(pendingImport.profile, pendingImport.decks);
  });

  els.importCancelBtn.addEventListener("click", () => {
    pendingImport = null;
    showScreen("settings");
  });

  // ---------- boot ----------

  stats = loadStats();
  settings = loadSettings() || settings;
  lessonHistory = loadLessonHistory();
  customAnswers = normalizeCustomAnswersShape(loadCustomAnswers());
  saveCustomAnswers();
  customDecks = loadCustomDecks();
  applySettings();
  dailyMinutes = settings.defaultDailyMinutes;

  fetch("data/n2-kanji.json")
    .then((res) => res.json())
    .then((data) => {
      allKanji = data;
      kanjiByNum = new Map(data.map((item) => [item.num, item]));

      const saved = loadState();
      if (
        saved &&
        saved.totalCount === allKanji.length &&
        saved.queueNums.every((n) => kanjiByNum.has(n))
      ) {
        queue = saved.queueNums.map((n) => kanjiByNum.get(n));
        totalCount = saved.totalCount;
        masteredCount = saved.masteredCount;
      } else {
        queue = shuffle(allKanji);
        totalCount = allKanji.length;
        masteredCount = 0;
        saveState();
      }

      showScreen("home");
    })
    .catch((err) => {
      console.error("Failed to load kanji data", err);
    });
})();
