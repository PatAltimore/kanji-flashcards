// Run with: node tools/sync-merge.test.cjs
const assert = require("node:assert/strict");
const { mergeState, expandIPv6, networkKeyFromAddresses, fingerprintFromSdp, verificationNumber } = require("../sync.js");

const empty = () => ({
  stats: { daily: {}, perCard: {} },
  customAnswers: {},
  lessons: { completed: {}, placement: {}, today: null },
  customDecks: [],
  deletedDecks: {},
});

const clone = (x) => JSON.parse(JSON.stringify(x));
let passed = 0;
const queue = [];
function test(name, fn) {
  queue.push({ name, fn });
}

test("merging identical states changes nothing (idempotent)", () => {
  const s = empty();
  s.stats.daily["2026-10-18"] = { completed: 5, right: 4, wrong: 1 };
  s.stats.perCard["1"] = { right: 3, wrong: 1, box: 2, due: "2026-10-20", lastSeen: "2026-10-18", streak: 2 };
  const once = mergeState(clone(s), clone(s), s.stats);
  assert.deepEqual(once.stats, s.stats);
  const twice = mergeState(clone(once), clone(once), once.stats);
  assert.deepEqual(twice, once);
});

test("first sync of different devices adds counters (no shared base)", () => {
  const a = empty();
  const b = empty();
  a.stats.daily["d"] = { completed: 2, right: 2, wrong: 0 };
  b.stats.daily["d"] = { completed: 3, right: 1, wrong: 2 };
  const m = mergeState(a, b, null);
  assert.deepEqual(m.stats.daily.d, { completed: 5, right: 3, wrong: 2 });
});

test("later syncs only add each device's new work", () => {
  const base = empty();
  base.stats.daily["d"] = { completed: 10, right: 8, wrong: 2 };
  base.stats.perCard["7"] = { right: 4, wrong: 1, box: 1, due: "x", lastSeen: "2026-10-10", streak: 1 };
  const a = clone(base);
  const b = clone(base);
  a.stats.daily["d"] = { completed: 12, right: 10, wrong: 2 }; // +2 right
  b.stats.daily["d"] = { completed: 11, right: 8, wrong: 3 }; // +1 wrong
  a.stats.perCard["7"].right = 5;
  b.stats.perCard["7"].wrong = 2;
  const m = mergeState(a, b, base.stats);
  assert.deepEqual(m.stats.daily.d, { completed: 13, right: 10, wrong: 3 });
  assert.equal(m.stats.perCard["7"].right, 5);
  assert.equal(m.stats.perCard["7"].wrong, 2);
});

test("symmetric: same result from either device's point of view", () => {
  const base = empty();
  base.stats.daily["d"] = { completed: 1, right: 1, wrong: 0 };
  const a = clone(base);
  const b = clone(base);
  a.stats.daily["d"].right = 4;
  b.stats.daily["d"].wrong = 2;
  a.stats.perCard["3"] = { right: 1, wrong: 0, box: 2, due: "2026-10-21", lastSeen: "2026-10-18", streak: 1 };
  b.stats.perCard["3"] = { right: 0, wrong: 1, box: 0, due: "2026-10-18", lastSeen: "2026-10-17", streak: 0 };
  a.customAnswers["3"] = { meaning: ["z", "a"], onyomi: [], kunyomi: [] };
  b.customAnswers["3"] = { meaning: ["a", "m"], onyomi: ["ト"], kunyomi: [] };
  a.lessons.placement = { 3: "known", 4: "known" };
  b.lessons.placement = { 3: "learn" };
  const ab = mergeState(a, b, base.stats);
  const ba = mergeState(b, a, base.stats);
  assert.deepEqual(ab, ba);
});

test("review schedule comes from whichever device reviewed most recently", () => {
  const a = empty();
  const b = empty();
  a.stats.perCard["9"] = { right: 1, wrong: 0, box: 3, due: "2026-10-25", lastSeen: "2026-10-18", streak: 3 };
  b.stats.perCard["9"] = { right: 1, wrong: 0, box: 1, due: "2026-10-19", lastSeen: "2026-10-16", streak: 1 };
  const m = mergeState(a, b, null);
  assert.equal(m.stats.perCard["9"].box, 3);
  assert.equal(m.stats.perCard["9"].lastSeen, "2026-10-18");
  assert.equal(m.stats.perCard["9"].right, 2);
});

test("placement: learn beats known; known and lessons carry over", () => {
  const a = empty();
  const b = empty();
  a.lessons.placement = { 1: "known", 2: "known" };
  b.lessons.placement = { 1: "learn", 3: "known" };
  a.lessons.today = { date: "2026-10-18", nums: [5, 6] };
  b.lessons.today = { date: "2026-10-18", nums: [6, 7] };
  a.lessons.completed = { "2026-10-17": [1, 2] };
  b.lessons.completed = { "2026-10-17": [2, 3], "2026-10-18": [9] };
  const m = mergeState(a, b, null);
  assert.deepEqual(m.lessons.placement, { 1: "learn", 2: "known", 3: "known" });
  assert.deepEqual(m.lessons.today.nums, [5, 6, 7]);
  assert.deepEqual(m.lessons.completed, { "2026-10-17": [1, 2, 3], "2026-10-18": [9] });
  b.lessons.today = { date: "2026-10-19", nums: [8] };
  assert.equal(mergeState(a, b, null).lessons.today.date, "2026-10-19");
});

test("custom decks: merged by id, reviews combined, deletions stick", () => {
  const deck = (id, name, updatedAt, srs) => ({
    id, name, cards: [{ front: "x", sections: [] }], columns: [], answers: {}, srs: srs || {},
    createdAt: "2026-01-01T00:00:00Z", updatedAt,
  });
  const a = empty();
  const b = empty();
  a.customDecks = [
    deck("d1", "A name", "2026-10-18T10:00:00Z", { x: { box: 1, due: "q", lastSeen: "2026-10-18", streak: 1 } }),
    deck("d2", "Only on A", "2026-10-01T00:00:00Z"),
    deck("d3", "Deleted on B", "2026-09-01T00:00:00Z"),
  ];
  b.customDecks = [
    deck("d1", "B name", "2026-10-17T10:00:00Z", { x: { box: 2, due: "q", lastSeen: "2026-10-17", streak: 2 }, y: { box: 1, due: "q", lastSeen: "2026-10-17", streak: 1 } }),
    deck("d4", "Only on B", "2026-10-02T00:00:00Z"),
  ];
  b.deletedDecks = { d3: "2026-10-10T00:00:00Z" };
  const m = mergeState(a, b, null);
  const ids = m.customDecks.map((d) => d.id).sort();
  assert.deepEqual(ids, ["d1", "d2", "d4"]);
  const d1 = m.customDecks.find((d) => d.id === "d1");
  assert.equal(d1.name, "A name"); // newer edit wins
  assert.equal(d1.srs.x.lastSeen, "2026-10-18"); // newer review wins
  assert.ok(d1.srs.y); // review only on B is kept
  assert.deepEqual(mergeState(b, a, null), mergeState(a, b, null));
  // merging the result again is stable
  const again = mergeState(clone(m), clone(m), m.stats);
  assert.deepEqual(again, m);
});

test("a deck changed after it was deleted elsewhere comes back", () => {
  const a = empty();
  const b = empty();
  a.customDecks = [{ id: "d9", name: "n", cards: [], columns: [], answers: {}, srs: {}, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z" }];
  b.deletedDecks = { d9: "2026-10-10T00:00:00Z" };
  assert.equal(mergeState(a, b, null).customDecks.length, 1);
});

test("network key: IPv4 preferred, IPv6 uses the /64 prefix", () => {
  assert.equal(networkKeyFromAddresses(["2001:db8:1:2:aaaa:bbbb:cccc:dddd", "203.0.113.7"]), "v4:203.0.113.7");
  assert.equal(networkKeyFromAddresses(["2001:db8:1:2:aaaa:bbbb:cccc:dddd"]), "v6:2001:db8:1:2");
  // two devices on one LAN differ in the host bits but share the /64
  assert.equal(
    networkKeyFromAddresses(["2001:db8:1:2:1111:2222:3333:4444"]),
    networkKeyFromAddresses(["2001:0db8:0001:0002::9"])
  );
  assert.equal(networkKeyFromAddresses([]), null);
  assert.deepEqual(expandIPv6("2001:db8::1"), ["2001", "db8", "0", "0", "0", "0", "0", "1"]);
});

test("verification number: same on both devices, different for different connections", async () => {
  const a = "AA:BB:CC";
  const b = "11:22:33";
  const forward = await verificationNumber(a, b);
  const backward = await verificationNumber(b, a);
  assert.equal(forward, backward);
  assert.match(forward, /^\d{3} \d{3}$/);
  assert.notEqual(await verificationNumber(a, "99:99:99"), forward);
  assert.equal(fingerprintFromSdp("v=0\r\na=fingerprint:sha-256 aa:bb:CC:01\r\na=setup:actpass"), "AA:BB:CC:01");
  assert.equal(fingerprintFromSdp("v=0"), null);
});

(async () => {
  for (const { name, fn } of queue) {
    await fn();
    passed++;
    console.log("ok -", name);
  }
  console.log(`\n${passed} tests passed`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
