// Run with: node tools/sync-merge.test.cjs
const assert = require("node:assert/strict");
const {
  mergeState,
  mergeCounts,
  totalCounts,
  expandIPv6,
  networkKeyFromAddresses,
  fingerprintFromSdp,
  verificationNumber,
} = require("../sync.js");

const empty = (deviceId = "a") => ({
  deviceId,
  members: { [deviceId]: "2026-10-18T00:00:00Z" },
  counts: { epoch: 0, devices: { [deviceId]: { daily: {}, perCard: {} } } },
  srs: {},
  customAnswers: {},
  lessons: { completed: {}, placement: {}, today: null },
  customDecks: [],
  deletedDecks: {},
});

const clone = (x) => JSON.parse(JSON.stringify(x));
const own = (state) => state.counts.devices[state.deviceId];
const day = (completed, right = completed, wrong = 0) => ({ completed, right, wrong });
const total = (state) => totalCounts(state.counts);

let passed = 0;
const queue = [];
function test(name, fn) {
  queue.push({ name, fn });
}

// ---------------------------------------------------------------- counters

test("merging identical states changes nothing (idempotent)", () => {
  const s = empty();
  own(s).daily["2026-10-18"] = day(5, 4, 1);
  own(s).perCard["1"] = { right: 3, wrong: 1 };
  s.srs["1"] = { box: 2, due: "2026-10-20", lastSeen: "2026-10-18", streak: 2 };
  const once = mergeState(clone(s), clone(s));
  assert.deepEqual(once, mergeState(clone(once), clone(once)));
  assert.deepEqual(total(once).daily["2026-10-18"], day(5, 4, 1));
});

test("two devices' counters add, and re-syncing never counts anything twice", () => {
  const a = empty("a");
  const b = empty("b");
  own(a).daily["d"] = day(10, 8, 2);
  own(b).daily["d"] = day(4, 3, 1);
  let merged = mergeState(a, b);
  assert.deepEqual(total(merged).daily.d, day(14, 11, 3));
  // sync again and again, in both directions
  for (let i = 0; i < 3; i++) {
    merged = mergeState(merged, clone(b));
    merged = mergeState(merged, clone(a));
  }
  assert.deepEqual(total(merged).daily.d, day(14, 11, 3));
});

test("later work adds only the new work; unpairing and re-pairing is harmless", () => {
  const a = empty("a");
  const b = empty("b");
  own(a).daily["d"] = day(10);
  own(b).daily["d"] = day(4);
  const synced = mergeState(a, b);
  // each device keeps studying
  const a2 = clone(synced);
  const b2 = mergeState(clone(b), synced);
  b2.deviceId = "b";
  own(a2).daily["d"].completed += 2;
  own(a2).daily["d"].right += 2;
  own(b2).daily["d"].completed += 1;
  own(b2).daily["d"].right += 1;
  const afterA = mergeState(a2, b2);
  assert.equal(total(afterA).daily.d.completed, 17);
  const afterB = mergeState(b2, a2);
  assert.deepEqual(total(afterA), total(afterB));
});

test("three devices converge to the same totals in every merge order", () => {
  const devices = ["a", "b", "c"].map((id, i) => {
    const s = empty(id);
    own(s).daily["d"] = day(i + 1, i + 1, 0);
    own(s).perCard["7"] = { right: i + 1, wrong: i };
    s.srs["7"] = { box: i, due: "2026-10-2" + i, lastSeen: "2026-10-1" + (5 + i), streak: i };
    s.customAnswers["7"] = { meaning: ["m" + i], onyomi: [], kunyomi: [] };
    s.members["z" + i] = "2026-10-18T0" + i + ":00:00Z";
    return s;
  });
  const orders = [
    [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
  ];
  const results = orders.map((order) => {
    // each device merges the others in this order, then all merge once more
    // with each other (as a mesh would) so everyone ends up with everything
    const state = devices.map(clone);
    order.forEach((from) => {
      order.forEach((to) => {
        if (from !== to) state[to] = mergeState(state[to], state[from]);
      });
    });
    order.forEach((from) => {
      order.forEach((to) => {
        if (from !== to) state[to] = mergeState(state[to], state[from]);
      });
    });
    return state;
  });
  const first = results[0];
  assert.deepEqual(total(first[0]).daily.d, day(6, 6, 0)); // 1 + 2 + 3
  assert.deepEqual(total(first[0]).perCard["7"], { right: 6, wrong: 3 });
  assert.equal(first[0].srs["7"].box, 2); // the most recent review wins
  assert.deepEqual(first[0].customAnswers["7"].meaning, ["m0", "m1", "m2"]);
  results.forEach((state) => {
    // every device agrees on everything except which id is "mine"
    const view = (s) => ({ ...s, deviceId: undefined });
    assert.deepEqual(view(state[0]), view(first[0]));
    assert.deepEqual(view(state[1]), view(first[0]));
    assert.deepEqual(view(state[2]), view(first[0]));
  });
});

test("a device that starts empty adds history instead of removing it", () => {
  const pc = empty("pc");
  own(pc).daily["d"] = day(17);
  const fresh = empty("new-phone");
  assert.equal(total(mergeState(pc, fresh)).daily.d.completed, 17);
  assert.equal(total(mergeState(fresh, pc)).daily.d.completed, 17);
});

test("a statistics reset spreads to every device and sticks", () => {
  const a = empty("a");
  const b = empty("b");
  own(a).daily["d"] = day(10);
  own(b).daily["d"] = day(4);
  a.srs["1"] = { box: 3, due: "x", lastSeen: "2026-10-18", streak: 3 };
  const synced = mergeState(a, b);
  const syncedB = mergeState(b, a);
  // b resets everything
  const reset = { ...syncedB, counts: { epoch: 1700000000000, devices: { b: { daily: {}, perCard: {} } } }, srs: {} };
  // a hasn't heard yet; when they sync, a adopts the reset
  const afterA = mergeState(synced, reset);
  assert.equal(afterA.counts.epoch, 1700000000000);
  assert.deepEqual(total(afterA).daily, {});
  assert.deepEqual(afterA.srs, {});
  // and a's old counts can't come back by syncing with something stale
  const stale = mergeState(afterA, synced);
  assert.deepEqual(total(stale).daily, {});
  // work done after the reset is counted normally (the app recreates a device's
  // own counter entry on demand)
  afterA.counts.devices.a = { daily: {}, perCard: {} };
  own(afterA).daily["d2"] = day(2);
  assert.equal(total(mergeState(afterA, reset)).daily.d2.completed, 2);
});

test("totals sum every device", () => {
  const counts = {
    epoch: 0,
    devices: {
      a: { daily: { d: day(1) }, perCard: { 1: { right: 1, wrong: 0 } } },
      b: { daily: { d: day(2, 1, 1), e: day(1) }, perCard: { 1: { right: 0, wrong: 2 } } },
    },
  };
  const t = totalCounts(counts);
  assert.deepEqual(t.daily.d, day(3, 2, 1));
  assert.deepEqual(t.perCard["1"], { right: 1, wrong: 2 });
  // merging counts never lowers a device's own number
  const lower = { epoch: 0, devices: { a: { daily: { d: day(0) }, perCard: {} } } };
  assert.equal(mergeCounts(counts, lower, "a").devices.a.daily.d.completed, 1);
});

// ------------------------------------------------------ schedule and the rest

test("review schedule comes from whichever device reviewed most recently", () => {
  const a = empty("a");
  const b = empty("b");
  a.srs["9"] = { box: 3, due: "2026-10-25", lastSeen: "2026-10-18", streak: 3 };
  b.srs["9"] = { box: 1, due: "2026-10-19", lastSeen: "2026-10-16", streak: 1 };
  assert.equal(mergeState(a, b).srs["9"].box, 3);
  assert.equal(mergeState(b, a).srs["9"].box, 3);
});

test("placement: learn beats known; known and lessons carry over", () => {
  const a = empty();
  const b = empty("b");
  a.lessons.placement = { 1: "known", 2: "known" };
  b.lessons.placement = { 1: "learn", 3: "known" };
  a.lessons.today = { date: "2026-10-18", nums: [5, 6] };
  b.lessons.today = { date: "2026-10-18", nums: [6, 7] };
  a.lessons.completed = { "2026-10-17": [1, 2] };
  b.lessons.completed = { "2026-10-17": [2, 3], "2026-10-18": [9] };
  const m = mergeState(a, b);
  assert.deepEqual(m.lessons.placement, { 1: "learn", 2: "known", 3: "known" });
  assert.deepEqual(m.lessons.today.nums, [5, 6, 7]);
  assert.deepEqual(m.lessons.completed, { "2026-10-17": [1, 2, 3], "2026-10-18": [9] });
  b.lessons.today = { date: "2026-10-19", nums: [8] };
  assert.equal(mergeState(a, b).lessons.today.date, "2026-10-19");
});

test("custom decks: merged by id, reviews combined, deletions stick", () => {
  const deck = (id, name, updatedAt, srs) => ({
    id, name, cards: [{ front: "x", sections: [] }], columns: [], answers: {}, srs: srs || {},
    createdAt: "2026-01-01T00:00:00Z", updatedAt,
  });
  const a = empty("a");
  const b = empty("b");
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
  const m = mergeState(a, b);
  assert.deepEqual(m.customDecks.map((d) => d.id).sort(), ["d1", "d2", "d4"]);
  const d1 = m.customDecks.find((d) => d.id === "d1");
  assert.equal(d1.name, "A name"); // newer edit wins
  assert.equal(d1.srs.x.lastSeen, "2026-10-18"); // newer review wins
  assert.ok(d1.srs.y); // review only on B is kept
  assert.deepEqual(mergeState(b, a).customDecks, m.customDecks);
  assert.deepEqual(mergeState(clone(m), clone(m)), m);
});

test("a deck changed after it was deleted elsewhere comes back", () => {
  const a = empty("a");
  const b = empty("b");
  a.customDecks = [{ id: "d9", name: "n", cards: [], columns: [], answers: {}, srs: {}, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-10-20T00:00:00Z" }];
  b.deletedDecks = { d9: "2026-10-10T00:00:00Z" };
  assert.equal(mergeState(a, b).customDecks.length, 1);
});

test("group members are combined", () => {
  const a = empty("a");
  const b = empty("b");
  b.members = { b: "2026-10-18T05:00:00Z", c: "2026-10-18T06:00:00Z" };
  const m = mergeState(a, b);
  assert.deepEqual(Object.keys(m.members).sort(), ["a", "b", "c"]);
  assert.deepEqual(m.members, mergeState(b, a).members);
});

// ---------------------------------------------------------- nearby helpers

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
