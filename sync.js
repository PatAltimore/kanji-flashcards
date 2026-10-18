/*
 * Device sync for Kanji Flash.
 *
 * Two pieces:
 *   1. mergeState(): a pure merge of two devices' progress that is safe to run
 *      over and over (merging identical states changes nothing). Counters are
 *      merged three-way against the state both devices had after their last
 *      sync, so nothing is double counted.
 *   2. A peer-to-peer transport on PeerJS (WebRTC). Devices are paired once
 *      with a short code; after that, opening the sync screen on both devices
 *      connects them directly and they exchange state. Nothing is stored on a
 *      server: PeerJS's public broker only introduces the two devices.
 */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------- merge

  const SRS_FIELDS = ["box", "due", "lastSeen", "streak"];

  function isObj(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function num(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  }

  // Both devices apply this with the same inputs swapped, so it must give the
  // same answer either way round: counters are base + both devices' changes.
  function threeWay(local, remote, base) {
    return Math.max(0, num(local) + num(remote) - num(base));
  }

  function srsRank(entry) {
    return [(entry && entry.lastSeen) || "", num(entry && entry.box), (entry && entry.due) || ""];
  }

  // The entry reviewed more recently wins; ties fall back to box then due date
  // so the result doesn't depend on which device is "local".
  function newerSrs(a, b) {
    const ra = srsRank(a);
    const rb = srsRank(b);
    for (let i = 0; i < ra.length; i++) {
      if (ra[i] > rb[i]) return a;
      if (ra[i] < rb[i]) return b;
    }
    return a;
  }

  function mergeStats(local, remote, base) {
    const l = isObj(local) ? local : {};
    const r = isObj(remote) ? remote : {};
    const b = isObj(base) ? base : {};

    const daily = {};
    const dayKeys = new Set([
      ...Object.keys(l.daily || {}),
      ...Object.keys(r.daily || {}),
    ]);
    dayKeys.forEach((day) => {
      const ld = (l.daily && l.daily[day]) || {};
      const rd = (r.daily && r.daily[day]) || {};
      const bd = (b.daily && b.daily[day]) || {};
      daily[day] = {
        completed: threeWay(ld.completed, rd.completed, bd.completed),
        right: threeWay(ld.right, rd.right, bd.right),
        wrong: threeWay(ld.wrong, rd.wrong, bd.wrong),
      };
    });

    const perCard = {};
    const cardKeys = new Set([
      ...Object.keys(l.perCard || {}),
      ...Object.keys(r.perCard || {}),
    ]);
    cardKeys.forEach((key) => {
      const lc = l.perCard && l.perCard[key];
      const rc = r.perCard && r.perCard[key];
      const bc = (b.perCard && b.perCard[key]) || {};
      const entry = {
        right: threeWay(lc && lc.right, rc && rc.right, bc.right),
        wrong: threeWay(lc && lc.wrong, rc && rc.wrong, bc.wrong),
      };
      const winner = lc && rc ? newerSrs(lc, rc) : lc || rc;
      SRS_FIELDS.forEach((field) => {
        if (winner && winner[field] !== undefined) entry[field] = winner[field];
      });
      perCard[key] = entry;
    });

    return { daily, perCard };
  }

  function sortedUnion(a, b, compare) {
    return Array.from(new Set([...(a || []), ...(b || [])])).sort(compare);
  }

  function mergeCustomAnswers(local, remote) {
    const out = {};
    const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
    keys.forEach((key) => {
      const a = (local && local[key]) || {};
      const b = (remote && remote[key]) || {};
      out[key] = {
        meaning: sortedUnion(a.meaning, b.meaning),
        onyomi: sortedUnion(a.onyomi, b.onyomi),
        kunyomi: sortedUnion(a.kunyomi, b.kunyomi),
      };
    });
    return out;
  }

  function mergeLessons(local, remote) {
    const l = isObj(local) ? local : {};
    const r = isObj(remote) ? remote : {};
    const byNumber = (x, y) => x - y;

    const completed = {};
    new Set([...Object.keys(l.completed || {}), ...Object.keys(r.completed || {})]).forEach((date) => {
      completed[date] = sortedUnion(l.completed && l.completed[date], r.completed && r.completed[date], byNumber);
    });

    // A kanji either device still wants to learn stays "learn".
    const placement = {};
    new Set([...Object.keys(l.placement || {}), ...Object.keys(r.placement || {})]).forEach((key) => {
      const a = l.placement && l.placement[key];
      const b = r.placement && r.placement[key];
      placement[key] = a === "learn" || b === "learn" ? "learn" : a || b;
    });

    let today = l.today || r.today || null;
    if (l.today && r.today) {
      if (l.today.date === r.today.date) {
        today = { date: l.today.date, nums: sortedUnion(l.today.nums, r.today.nums, byNumber) };
      } else {
        today = l.today.date > r.today.date ? l.today : r.today;
      }
    }

    const epochs = [l.epoch, r.epoch].filter(Boolean).sort();
    const merged = { completed, placement, today };
    if (epochs.length) merged.epoch = epochs[0];
    return merged;
  }

  function mergeDeckPair(a, b) {
    const ua = a.updatedAt || "";
    const ub = b.updatedAt || "";
    const base = ua > ub ? a : ub > ua ? b : JSON.stringify(a) >= JSON.stringify(b) ? a : b;
    const srs = {};
    new Set([...Object.keys(a.srs || {}), ...Object.keys(b.srs || {})]).forEach((front) => {
      const ea = a.srs && a.srs[front];
      const eb = b.srs && b.srs[front];
      srs[front] = ea && eb ? newerSrs(ea, eb) : ea || eb;
    });
    return { ...base, srs, updatedAt: ua > ub ? ua : ub };
  }

  // Decks are matched by id. A deck deleted on one device stays deleted unless
  // it was changed after the deletion (`deleted` maps id -> ISO time).
  function mergeCustomDecks(local, remote, deletedLocal, deletedRemote) {
    const deleted = {};
    new Set([...Object.keys(deletedLocal || {}), ...Object.keys(deletedRemote || {})]).forEach((id) => {
      const a = (deletedLocal && deletedLocal[id]) || "";
      const b = (deletedRemote && deletedRemote[id]) || "";
      deleted[id] = a > b ? a : b;
    });

    const byId = new Map();
    (local || []).forEach((deck) => byId.set(deck.id, deck));
    (remote || []).forEach((deck) => {
      const existing = byId.get(deck.id);
      byId.set(deck.id, existing ? mergeDeckPair(existing, deck) : deck);
    });

    const decks = Array.from(byId.values())
      .filter((deck) => !(deleted[deck.id] && deleted[deck.id] >= (deck.updatedAt || "")))
      .sort((a, b) => {
        const ca = a.createdAt || "";
        const cb = b.createdAt || "";
        return ca < cb ? -1 : ca > cb ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
    return { decks, deleted };
  }

  /*
   * state shape (what each device sends):
   *   { stats: {daily, perCard}, customAnswers, lessons, customDecks, deletedDecks }
   * `base` is the stats both devices had after their last sync (or null).
   */
  function mergeState(local, remote, base) {
    const decks = mergeCustomDecks(
      local.customDecks,
      remote.customDecks,
      local.deletedDecks,
      remote.deletedDecks
    );
    return {
      stats: mergeStats(local.stats, remote.stats, base),
      customAnswers: mergeCustomAnswers(local.customAnswers, remote.customAnswers),
      lessons: mergeLessons(local.lessons, remote.lessons),
      customDecks: decks.decks,
      deletedDecks: decks.deleted,
    };
  }

  // ------------------------------------------------------------ transport

  const PEER_PREFIX = "kanjiflash-";
  const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CODE_LENGTH = 8;
  const CHUNK_SIZE = 12000;
  const RETRY_MS = 3000;
  const PAIR_TIMEOUT_MS = 45000;

  function randomString(alphabet, length) {
    const bytes = new Uint8Array(length);
    root.crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
  }

  function generateCode() {
    return randomString(CODE_ALPHABET, CODE_LENGTH);
  }

  function formatCode(code) {
    return code.slice(0, 4) + "-" + code.slice(4);
  }

  function normalizeCode(text) {
    return String(text || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  async function sha256Hex(text) {
    const digest = await root.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  // Data channels have message size limits, so long payloads go in chunks.
  function sendJson(conn, payload) {
    const text = JSON.stringify(payload);
    const id = randomString("abcdefghijklmnopqrstuvwxyz", 8);
    const total = Math.max(1, Math.ceil(text.length / CHUNK_SIZE));
    for (let i = 0; i < total; i++) {
      conn.send(JSON.stringify({ t: "chunk", id, i, n: total, d: text.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) }));
    }
  }

  function makeReceiver(onMessage) {
    const buffers = new Map();
    return (raw) => {
      let message;
      try {
        message = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (err) {
        return;
      }
      if (!message || message.t !== "chunk") return;
      const buf = buffers.get(message.id) || { parts: [], seen: 0 };
      buf.parts[message.i] = message.d;
      buf.seen++;
      buffers.set(message.id, buf);
      if (buf.seen < message.n) return;
      buffers.delete(message.id);
      try {
        onMessage(JSON.parse(buf.parts.join("")));
      } catch (err) {
        /* malformed payload; ignore */
      }
    };
  }

  const CONN_OPTIONS = { serialization: "raw", reliable: true };

  // Show a code on this device; the other device enters it. `onRequest`
  // resolves true/false to accept the other device. On accept both sides end
  // up holding the same random pair key.
  function hostPairing(handlers) {
    let peer = null;
    let cancelled = false;
    let busy = false;

    function open() {
      const code = generateCode();
      peer = new root.Peer(PEER_PREFIX + "pair-" + code);
      peer.on("open", () => handlers.onCode(code));
      peer.on("error", (err) => {
        if (cancelled) return;
        if (err.type === "unavailable-id") {
          peer.destroy();
          open();
        } else {
          handlers.onError(err);
        }
      });
      peer.on("connection", (conn) => {
        if (busy) {
          conn.close();
          return;
        }
        const receive = makeReceiver((message) => {
          if (message.t !== "hello" || busy) return;
          busy = true;
          Promise.resolve(handlers.onRequest()).then((ok) => {
            if (!ok) {
              sendJson(conn, { t: "denied" });
              busy = false;
              return;
            }
            const key = randomString("0123456789abcdef", 32);
            sendJson(conn, { t: "paired", key });
            handlers.onPaired(key, "a");
            root.setTimeout(() => cancel(), 800);
          });
        });
        conn.on("data", receive);
      });
    }

    function cancel() {
      cancelled = true;
      if (peer) peer.destroy();
    }

    open();
    return { cancel };
  }

  function joinPairing(rawCode, handlers) {
    const code = normalizeCode(rawCode);
    let peer = null;
    let finished = false;
    let timer = null;

    function finish() {
      finished = true;
      root.clearTimeout(timer);
    }
    function fail(reason) {
      if (finished) return;
      finish();
      if (peer) peer.destroy();
      handlers.onError(reason);
    }

    peer = new root.Peer();
    timer = root.setTimeout(() => fail("timeout"), PAIR_TIMEOUT_MS);
    peer.on("error", (err) => fail(err.type === "peer-unavailable" ? "not-found" : err.type || "error"));
    peer.on("open", () => {
      const conn = peer.connect(PEER_PREFIX + "pair-" + code, CONN_OPTIONS);
      const receive = makeReceiver((message) => {
        if (message.t === "paired" && message.key) {
          finish();
          handlers.onPaired(message.key, "b");
          root.setTimeout(() => peer.destroy(), 500);
        } else if (message.t === "denied") {
          fail("denied");
        }
      });
      conn.on("data", receive);
      conn.on("open", () => sendJson(conn, { t: "hello" }));
      conn.on("error", () => fail("error"));
    });

    return {
      cancel() {
        finished = true;
        root.clearTimeout(timer);
        if (peer) peer.destroy();
      },
    };
  }

  // Once paired: role "a" listens, role "b" keeps trying to reach it. When the
  // two connect, each sends its state and merges the other's.
  async function startSync(options) {
    const hash = (await sha256Hex(options.key)).slice(0, 32);
    const myId = PEER_PREFIX + "sync-" + hash + "-" + options.role;
    const partnerId = PEER_PREFIX + "sync-" + hash + "-" + (options.role === "a" ? "b" : "a");
    let peer = null;
    let stopped = false;
    let connected = false;
    let retryTimer = null;

    function wire(conn) {
      connected = true;
      let sent = false;
      let received = false;
      const finishIfDone = () => {
        if (sent && received) {
          options.onDone();
          root.setTimeout(() => stop(), 600);
        }
      };
      const receive = makeReceiver((message) => {
        if (message.t !== "state" || received) return;
        received = true;
        try {
          options.onRemoteState(message.state);
        } catch (err) {
          options.onError(err);
        }
        finishIfDone();
      });
      conn.on("data", receive);
      const sendOwn = () => {
        options.onStatus("connected");
        sendJson(conn, { t: "state", state: options.getState() });
        sent = true;
        finishIfDone();
      };
      if (conn.open) sendOwn();
      else conn.on("open", sendOwn);
      conn.on("close", () => {
        if (!(sent && received)) {
          connected = false;
          options.onStatus("waiting");
        }
      });
    }

    function tryConnect() {
      if (stopped || connected || options.role !== "b") return;
      const conn = peer.connect(partnerId, CONN_OPTIONS);
      conn.on("open", () => wire(conn));
      conn.on("error", () => {});
      retryTimer = root.setTimeout(() => {
        if (!connected) {
          conn.close();
          tryConnect();
        }
      }, RETRY_MS);
    }

    function open() {
      peer = new root.Peer(myId);
      peer.on("open", () => {
        options.onStatus("waiting");
        tryConnect();
      });
      peer.on("connection", (conn) => {
        if (connected) {
          conn.close();
          return;
        }
        wire(conn);
      });
      peer.on("error", (err) => {
        if (stopped) return;
        if (err.type === "peer-unavailable") return; // partner not open yet; retry loop continues
        if (err.type === "unavailable-id") {
          // This device's id is still registered from a moment ago; retry shortly.
          peer.destroy();
          retryTimer = root.setTimeout(open, RETRY_MS);
          return;
        }
        options.onError(err);
      });
    }

    function stop() {
      stopped = true;
      root.clearTimeout(retryTimer);
      if (peer) peer.destroy();
    }

    open();
    return { stop };
  }

  const api = {
    mergeState,
    mergeStats,
    generateCode,
    formatCode,
    normalizeCode,
    hostPairing,
    joinPairing,
    startSync,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KanjiFlashSync = api;
})(typeof window !== "undefined" ? window : globalThis);
