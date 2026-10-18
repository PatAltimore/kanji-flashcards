/*
 * Device sync for Kanji Flash.
 *
 * Two pieces:
 *   1. mergeState(): a pure merge of two devices' progress that is safe to run
 *      over and over (merging identical states changes nothing). Counters are
 *      merged three-way against the state both devices had after their last
 *      sync, so nothing is double counted.
 *   2. A peer-to-peer transport on PeerJS (WebRTC). Devices on the same
 *      network find each other and are paired once by confirming a
 *      verification number; after that, opening the sync screen on both
 *      devices connects them directly and they exchange state. Nothing is stored on a
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
  const CHUNK_SIZE = 12000;
  const RETRY_MS = 3000;

  function randomString(alphabet, length) {
    const bytes = new Uint8Array(length);
    root.crypto.getRandomValues(bytes);
    let out = "";
    for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
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

  // Stage reports let the UI show where a connection attempt stops.
  function reporter(handlers) {
    return (text) => {
      if (handlers && typeof handlers.onStage === "function") handlers.onStage(text);
    };
  }

  // WebRTC connection state changes (PeerJS relays them on the connection).
  function watchIce(conn, label, stage, onFailed) {
    conn.on("iceStateChanged", (state) => {
      stage(label + " ice " + state);
      if (state === "failed" && onFailed) onFailed();
    });
  }

  // ------------------------------------------------ nearby device pairing
  //
  // No code to type: devices on the same network find each other through a
  // shared "room" id derived from their public network address (learned from a
  // STUN request). The first device claims the room id on the PeerJS broker
  // and waits; the next one connects to it. Anyone else behind the same
  // address could connect too, so both screens then show a verification
  // number computed from the two connection fingerprints and the user confirms
  // that they match on both devices before anything is paired.

  const NEARBY_SALT = "kanjiflash-nearby-v1|";
  const STUN_URL = "stun:stun.l.google.com:19302";
  const STUN_TIMEOUT_MS = 6000;
  const NEARBY_RETRY_MS = 2500;

  function expandIPv6(address) {
    const clean = address.split("%")[0].toLowerCase();
    const halves = clean.split("::");
    const head = halves[0] ? halves[0].split(":") : [];
    const tail = halves.length > 1 && halves[1] ? halves[1].split(":") : [];
    const missing = Math.max(0, 8 - head.length - tail.length);
    const groups = halves.length > 1 ? [...head, ...Array(missing).fill("0"), ...tail] : head;
    return groups.map((g) => g.replace(/^0+(?=.)/, "") || "0");
  }

  // Devices on one network share an IPv4 address behind the router, or an IPv6
  // /64 prefix. Prefer IPv4 when there is one.
  function networkKeyFromAddresses(addresses) {
    const v4 = addresses.find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a));
    if (v4) return "v4:" + v4;
    const v6 = addresses.find((a) => a.includes(":"));
    if (v6) return "v6:" + expandIPv6(v6).slice(0, 4).join(":");
    return null;
  }

  function findPublicAddresses(timeoutMs) {
    return new Promise((resolve) => {
      const addresses = [];
      let done = false;
      let pc = null;
      const finish = () => {
        if (done) return;
        done = true;
        try {
          if (pc) pc.close();
        } catch (err) {
          /* ignore */
        }
        resolve(addresses);
      };
      try {
        pc = new root.RTCPeerConnection({ iceServers: [{ urls: STUN_URL }] });
        pc.createDataChannel("probe");
        pc.onicecandidate = (event) => {
          if (!event.candidate) {
            finish();
            return;
          }
          const parts = event.candidate.candidate.trim().split(/\s+/);
          if (parts.length > 7 && parts[6] === "typ" && parts[7] === "srflx") addresses.push(parts[4]);
        };
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .catch(finish);
        root.setTimeout(finish, timeoutMs);
      } catch (err) {
        finish();
      }
    });
  }

  async function nearbyRoomId() {
    const key = networkKeyFromAddresses(await findPublicAddresses(STUN_TIMEOUT_MS));
    if (!key) return null;
    return PEER_PREFIX + "near-" + (await sha256Hex(NEARBY_SALT + key)).slice(0, 24);
  }

  function fingerprintFromSdp(sdp) {
    const match = /a=fingerprint:sha-256\s+([0-9A-Fa-f:]+)/.exec(sdp || "");
    return match ? match[1].toUpperCase() : null;
  }

  // The same number on both devices; a device that is relaying between two
  // others would have a different fingerprint on each leg.
  async function verificationNumber(fingerprintA, fingerprintB) {
    const hex = await sha256Hex([fingerprintA, fingerprintB].sort().join("|"));
    const digits = String(parseInt(hex.slice(0, 8), 16) % 1000000).padStart(6, "0");
    return digits.slice(0, 3) + " " + digits.slice(3);
  }

  async function connectionVerificationNumber(conn) {
    for (let i = 0; i < 20; i++) {
      const pc = conn.peerConnection;
      const local = pc && pc.localDescription && fingerprintFromSdp(pc.localDescription.sdp);
      const remote = pc && pc.remoteDescription && fingerprintFromSdp(pc.remoteDescription.sdp);
      if (local && remote) return verificationNumber(local, remote);
      await new Promise((resolve) => root.setTimeout(resolve, 150));
    }
    return null;
  }

  function nearbyPairing(handlers) {
    const stage = reporter(handlers);
    let stopped = false;
    let done = false;
    let peer = null;
    let conn = null;
    let timer = null;
    let verifying = false;
    let roomId = null;

    function release() {
      if (conn) {
        try {
          conn.close();
        } catch (err) {
          /* ignore */
        }
        conn = null;
      }
      if (peer) {
        try {
          peer.destroy();
        } catch (err) {
          /* ignore */
        }
        peer = null;
      }
      verifying = false;
    }

    function retry(delay) {
      if (stopped || done) return;
      release();
      handlers.onWaiting();
      timer = root.setTimeout(claim, delay === undefined ? NEARBY_RETRY_MS : delay);
    }

    // Runs once a data connection to the other device is open (role "a" is the
    // device that claimed the room, "b" the one that joined it).
    async function verify(c, role) {
      verifying = true;
      let localOk = false;
      let remoteOk = false;
      let finished = false;

      const maybeFinish = () => {
        if (finished || role !== "a" || !localOk || !remoteOk) return;
        finished = true;
        done = true;
        const key = randomString("0123456789abcdef", 32);
        sendJson(c, { t: "paired", key });
        handlers.onPaired(key, "a");
        root.setTimeout(cancel, 800);
      };

      c.on(
        "data",
        makeReceiver((message) => {
          if (stopped || finished) return;
          if (message.t === "confirm") {
            remoteOk = true;
            maybeFinish();
          } else if (message.t === "reject") {
            finished = true;
            handlers.onVerifyCancelled();
            handlers.onRejected("remote");
            retry();
          } else if (message.t === "paired" && message.key && role === "b" && localOk) {
            finished = true;
            done = true;
            handlers.onPaired(message.key, "b");
            root.setTimeout(cancel, 800);
          }
        })
      );
      c.on("close", () => {
        if (!finished && !stopped && !done) {
          finished = true;
          handlers.onVerifyCancelled();
          retry();
        }
      });

      stage("comparing numbers");
      const number = await connectionVerificationNumber(c);
      if (stopped || finished) return;
      if (!number) {
        finished = true;
        handlers.onError("no-fingerprint");
        retry(5000);
        return;
      }
      const same = await handlers.onVerify(number);
      if (stopped || finished) return;
      if (!same) {
        finished = true;
        sendJson(c, { t: "reject" });
        handlers.onRejected("local");
        retry(1500);
        return;
      }
      localOk = true;
      sendJson(c, { t: "confirm" });
      maybeFinish();
    }

    function guest() {
      if (stopped) return;
      peer = new root.Peer();
      peer.on("open", () => {
        stage("nearby device found");
        const c = peer.connect(roomId, CONN_OPTIONS);
        conn = c;
        watchIce(c, "nearby", stage);
        c.on("open", () => verify(c, "b"));
        c.on("error", () => retry());
      });
      peer.on("error", (err) => {
        if (stopped) return;
        if (err.type === "peer-unavailable") retry(1500);
        else handlers.onError(err);
      });
    }

    function claim() {
      if (stopped) return;
      peer = new root.Peer(roomId);
      peer.on("open", () => stage("waiting for nearby device"));
      peer.on("connection", (c) => {
        if (verifying) {
          c.close();
          return;
        }
        conn = c;
        stage("nearby device connecting");
        watchIce(c, "nearby", stage);
        if (c.open) verify(c, "a");
        else c.on("open", () => verify(c, "a"));
      });
      peer.on("error", (err) => {
        if (stopped) return;
        if (err.type === "unavailable-id") {
          // Another device already holds the room: join it instead.
          peer.destroy();
          peer = null;
          guest();
        } else {
          handlers.onError(err);
        }
      });
    }

    function cancel() {
      stopped = true;
      root.clearTimeout(timer);
      release();
    }

    stage("finding your network");
    nearbyRoomId()
      .catch(() => null)
      .then((id) => {
        if (stopped) return;
        if (!id) {
          handlers.onError("no-network-id");
          return;
        }
        roomId = id;
        stage("network found");
        handlers.onWaiting();
        claim();
      });

    return { cancel };
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
    const stage = reporter(options);

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
      stage("contacting other device");
      watchIce(conn, "sync", stage);
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
        stage("server reached");
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
    nearbyPairing,
    startSync,
    // exposed for tests
    expandIPv6,
    networkKeyFromAddresses,
    fingerprintFromSdp,
    verificationNumber,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KanjiFlashSync = api;
})(typeof window !== "undefined" ? window : globalThis);
