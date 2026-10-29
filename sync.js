/*
 * Device sync for Kanji Flash.
 *
 * Devices form a group (any number of them) that shares a secret key.
 *
 *   1. mergeState(): a pure merge of two devices' progress that is safe to run
 *      in any order, any number of times, with any number of devices.
 *        - Counters are kept per device (each device only ever increases its
 *          own) and a total is the sum over devices, so nothing is double
 *          counted. A "reset statistics" bumps an epoch that spreads to every
 *          device.
 *        - Everything else is merged by taking the newest change or combining.
 *   2. A peer-to-peer transport on PeerJS (WebRTC):
 *        - Joining: a new device meets a member of the group on the same
 *          network and both confirm a verification number; the member then
 *          shares the group key.
 *        - Syncing: members connect to each other by id, prove they hold the
 *          group key, exchange state, and forward changes to the other members
 *          they are connected to.
 *      Nothing is stored on a server: PeerJS's public broker only introduces
 *      devices to each other.
 */
(function (root) {
  "use strict";

  // ---------------------------------------------------------------- merge

  const SRS_FIELDS = ["box", "due", "lastSeen", "streak"];
  const DAILY_FIELDS = ["completed", "right", "wrong", "reviews"];
  const CARD_FIELDS = ["right", "wrong"];

  function isObj(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  function num(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

  // ---- counters --------------------------------------------------------

  function emptyDeviceCounts() {
    return { daily: {}, perCard: {} };
  }

  function maxFields(a, b, fields) {
    const out = {};
    fields.forEach((field) => {
      out[field] = Math.max(num(a && a[field]), num(b && b[field]));
    });
    return out;
  }

  // One device's counters only ever grow, so merging two copies of them is
  // the larger value of each field.
  function maxDeviceCounts(a, b) {
    const out = emptyDeviceCounts();
    new Set([...Object.keys((a && a.daily) || {}), ...Object.keys((b && b.daily) || {})]).forEach((day) => {
      out.daily[day] = maxFields(a && a.daily && a.daily[day], b && b.daily && b.daily[day], DAILY_FIELDS);
    });
    new Set([...Object.keys((a && a.perCard) || {}), ...Object.keys((b && b.perCard) || {})]).forEach((key) => {
      out.perCard[key] = maxFields(a && a.perCard && a.perCard[key], b && b.perCard && b.perCard[key], CARD_FIELDS);
    });
    return out;
  }

  // counts = { epoch, devices: { [deviceId]: { daily, perCard } } }
  function normalizeCounts(counts) {
    const devices = {};
    const source = counts && isObj(counts.devices) ? counts.devices : {};
    Object.keys(source).forEach((id) => {
      devices[id] = maxDeviceCounts(source[id], null);
    });
    return { epoch: num(counts && counts.epoch), devices };
  }

  // A reset (higher epoch) wins outright: counts from before it are dropped,
  // including this device's own. Within one epoch, per-device maximums merge.
  function mergeCounts(local, remote, myId) {
    const l = normalizeCounts(local);
    const r = normalizeCounts(remote);
    if (r.epoch > l.epoch) {
      const devices = { ...r.devices };
      delete devices[myId]; // anything of ours the remote has predates the reset
      return { epoch: r.epoch, devices };
    }
    if (r.epoch < l.epoch) return l;
    const devices = {};
    new Set([...Object.keys(l.devices), ...Object.keys(r.devices)]).forEach((id) => {
      devices[id] = maxDeviceCounts(l.devices[id], r.devices[id]);
    });
    return { epoch: l.epoch, devices };
  }

  // The totals everyone sees: the sum over all devices.
  function totalCounts(counts) {
    const total = { daily: {}, perCard: {} };
    const devices = (counts && counts.devices) || {};
    Object.keys(devices).forEach((id) => {
      const device = devices[id];
      Object.keys(device.daily || {}).forEach((day) => {
        const sum = total.daily[day] || { completed: 0, right: 0, wrong: 0, reviews: 0 };
        DAILY_FIELDS.forEach((field) => {
          sum[field] += num(device.daily[day][field]);
        });
        total.daily[day] = sum;
      });
      Object.keys(device.perCard || {}).forEach((key) => {
        const sum = total.perCard[key] || { right: 0, wrong: 0 };
        CARD_FIELDS.forEach((field) => {
          sum[field] += num(device.perCard[key][field]);
        });
        total.perCard[key] = sum;
      });
    });
    return total;
  }

  // ---- review schedule -------------------------------------------------

  // `srs` maps a kanji number to its review fields. It follows the counters'
  // epoch: after a reset, schedules from before the reset are discarded too.
  function mergeSrs(local, remote, localEpoch, remoteEpoch) {
    if (remoteEpoch > localEpoch) return { ...(remote || {}) };
    if (remoteEpoch < localEpoch) return { ...(local || {}) };
    const out = {};
    new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]).forEach((key) => {
      const a = local && local[key];
      const b = remote && remote[key];
      const winner = a && b ? newerSrs(a, b) : a || b;
      const entry = {};
      SRS_FIELDS.forEach((field) => {
        if (winner && winner[field] !== undefined) entry[field] = winner[field];
      });
      out[key] = entry;
    });
    return out;
  }

  // ---- everything else -------------------------------------------------

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
        wordMeaning: sortedUnion(a.wordMeaning, b.wordMeaning),
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

    // A kanji any device still wants to learn stays "learn".
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

  // Which N2 kanji were removed from (or restored to) the built-in deck: per
  // kanji the most recent change wins, so an undo on one device isn't undone
  // again by another device's older removal.
  function mergeKanjiRemovals(local, remote) {
    const out = {};
    const l = isObj(local) ? local : {};
    const r = isObj(remote) ? remote : {};
    new Set([...Object.keys(l), ...Object.keys(r)]).forEach((key) => {
      const a = isObj(l[key]) ? l[key] : null;
      const b = isObj(r[key]) ? r[key] : null;
      const pick = b && (!a || num(b.at) > num(a.at)) ? b : a;
      if (pick && typeof pick.removed === "boolean") out[key] = { at: num(pick.at), removed: pick.removed };
    });
    return out;
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

  // The devices in the group, with when each was last seen (ISO time).
  function mergeMembers(local, remote) {
    const out = {};
    new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]).forEach((id) => {
      const a = (local && local[id]) || "";
      const b = (remote && remote[id]) || "";
      out[id] = a > b ? a : b;
    });
    return out;
  }

  /*
   * state shape (what devices send each other):
   *   {
   *     deviceId,
   *     members: { [deviceId]: lastSeenISO },
   *     counts: { epoch, devices: { [deviceId]: { daily, perCard } } },
   *     srs: { [kanjiNumber]: { box, due, lastSeen, streak } },
   *     customAnswers, lessons, customDecks, deletedDecks
   *   }
   * mergeState() is symmetric, idempotent and order-independent, so any number
   * of devices converge however they exchange state.
   */
  function mergeState(local, remote) {
    const decks = mergeCustomDecks(
      local.customDecks,
      remote.customDecks,
      local.deletedDecks,
      remote.deletedDecks
    );
    const counts = mergeCounts(local.counts, remote.counts, local.deviceId);
    return {
      deviceId: local.deviceId,
      members: mergeMembers(local.members, remote.members),
      counts,
      srs: mergeSrs(local.srs, remote.srs, num(local.counts && local.counts.epoch), num(remote.counts && remote.counts.epoch)),
      customAnswers: mergeCustomAnswers(local.customAnswers, remote.customAnswers),
      lessons: mergeLessons(local.lessons, remote.lessons),
      customDecks: decks.decks,
      deletedDecks: decks.deleted,
      kanjiRemovals: mergeKanjiRemovals(local.kanjiRemovals, remote.kanjiRemovals),
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

  // Keyed proof that the other device holds the group key, without sending
  // the key: it answers a fresh random challenge with an HMAC of it.
  async function hmacHex(keyHex, text) {
    const bytes = new Uint8Array((keyHex.match(/../g) || []).map((pair) => parseInt(pair, 16)));
    const key = await root.crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signature = await root.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(text));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function generateGroupKey() {
    return randomString("0123456789abcdef", 32);
  }

  // ---------------------------------------- joining: nearby device pairing
  //
  // No code to type: devices on the same network find each other through a
  // shared "room" id derived from their public network address (learned from a
  // STUN request). The first device claims the room id on the PeerJS broker
  // and waits; the next one connects to it. Anyone else behind the same
  // address could connect too, so both screens then show a verification
  // number computed from the two connection fingerprints and the user confirms
  // that they match on both devices before anything is shared.

  const NEARBY_SALT = "kanjiflash-nearby-v1|";
  const STUN_URL = "stun:stun.l.google.com:19302";
  const STUN_TIMEOUT_MS = 6000;
  const NEARBY_RETRY_MS = 2500;
  const MEMBER_RECHECK_MS = 30000;
  const NEARBY_OPEN_TIMEOUT_MS = 12000;

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

  // `roomSalt` is for testing only: it gives a test its own room so it can't
  // meet real devices on the same network.
  async function nearbyRoomId(roomSalt) {
    const key = networkKeyFromAddresses(await findPublicAddresses(STUN_TIMEOUT_MS));
    if (!key) return null;
    return PEER_PREFIX + "near-" + (await sha256Hex(NEARBY_SALT + (roomSalt || "") + key)).slice(0, 24);
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

  /*
   * options: { key, deviceId, getMembers }
   *   key        the group key if this device is in a group (else undefined)
   *   getMembers () => { [deviceId]: lastSeenISO } for this device's group
   * handlers: onWaiting, onVerify(number, { hasMine, hasTheirs }) -> Promise<bool>,
   *   onVerifyCancelled, onRejected(who), onJoined({ key, members }),
   *   onMemberSeen(deviceId), onError, onStage
   *
   * Two devices that already share a group key recognise each other silently.
   * Otherwise, after both people confirm the number, the group is formed or
   * joined: if one side has a group the other adopts it, if both have one the
   * room's host's group wins (the groups merge), if neither does a new one is
   * created.
   */
  function nearbyPairing(handlers, options) {
    const groupKey = options && options.key;
    const myId = options && options.deviceId;
    const myMembers = () => (options && options.getMembers ? options.getMembers() : {});
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
      let theirHasGroup = false;
      let theirId = null;
      const myNonce = randomString("0123456789abcdef", 16);
      let resolveMember = null;
      const memberPromise = new Promise((resolve) => {
        resolveMember = resolve;
      });

      const finishJoined = (key, members) => {
        finished = true;
        done = true;
        handlers.onJoined({ key, members });
        root.setTimeout(cancel, 800);
      };

      // Host: once both people confirmed, ask the guest what it has.
      const maybeAskForOffer = () => {
        if (finished || role !== "a" || !localOk || !remoteOk) return;
        sendJson(c, { t: "ready" });
      };

      c.on(
        "data",
        makeReceiver((message) => {
          if (stopped || finished) return;
          if (message.t === "hello") {
            theirHasGroup = Boolean(message.hasGroup);
            theirId = typeof message.deviceId === "string" ? message.deviceId : null;
            // Answer the other device's challenge (empty if we have no key).
            const mac = groupKey && typeof message.nonce === "string" ? hmacHex(groupKey, "kf-room|" + message.nonce) : Promise.resolve(null);
            mac.then((value) => sendJson(c, { t: "proof", mac: value })).catch(() => {});
          } else if (message.t === "proof") {
            if (groupKey && typeof message.mac === "string") {
              hmacHex(groupKey, "kf-room|" + myNonce)
                .then((expected) => resolveMember(expected === message.mac))
                .catch(() => resolveMember(false));
            } else {
              resolveMember(false);
            }
          } else if (message.t === "confirm") {
            remoteOk = true;
            maybeAskForOffer();
          } else if (message.t === "reject") {
            finished = true;
            handlers.onVerifyCancelled();
            handlers.onRejected("remote");
            retry();
          } else if (message.t === "ready" && role === "b" && localOk) {
            // Both confirmed: tell the host what this device has.
            sendJson(c, { t: "offer", deviceId: myId, key: groupKey || null, members: myMembers() });
          } else if (message.t === "offer" && role === "a" && localOk && remoteOk) {
            const key = groupKey || (typeof message.key === "string" ? message.key : null) || generateGroupKey();
            const now = new Date().toISOString();
            const members = mergeMembers(mergeMembers(myMembers(), isObj(message.members) ? message.members : {}), {
              ...(myId ? { [myId]: now } : {}),
              ...(typeof message.deviceId === "string" ? { [message.deviceId]: now } : {}),
            });
            sendJson(c, { t: "group", key, members });
            finishJoined(key, members);
          } else if (message.t === "group" && role === "b" && localOk && typeof message.key === "string") {
            finishJoined(message.key, isObj(message.members) ? message.members : {});
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

      sendJson(c, { t: "hello", nonce: myNonce, hasGroup: Boolean(groupKey), deviceId: myId });
      const isMember = await Promise.race([
        memberPromise,
        new Promise((resolve) => root.setTimeout(() => resolve(false), 6000)),
      ]);
      if (stopped || finished) return;
      if (isMember) {
        // Already in the same group: normal sync handles it, nothing to join.
        // The device holding the room keeps listening for a new device; the one
        // that joined only looks again now and then.
        finished = true;
        stage("group member recognised");
        if (handlers.onMemberSeen) handlers.onMemberSeen(theirId);
        if (role === "a") {
          try {
            c.close();
          } catch (err) {
            /* ignore */
          }
          conn = null;
          verifying = false;
        } else {
          retry(MEMBER_RECHECK_MS);
        }
        return;
      }

      stage("comparing numbers");
      const number = await connectionVerificationNumber(c);
      if (stopped || finished) return;
      if (!number) {
        finished = true;
        handlers.onError("no-fingerprint");
        retry(5000);
        return;
      }
      const same = await handlers.onVerify(number, { hasMine: Boolean(groupKey), hasTheirs: theirHasGroup });
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
      maybeAskForOffer();
    }

    function guest() {
      if (stopped) return;
      peer = new root.Peer();
      peer.on("open", () => {
        stage("nearby device found");
        const c = peer.connect(roomId, CONN_OPTIONS);
        conn = c;
        watchIce(c, "nearby", stage);
        // The room's id can briefly belong to a device that has gone away; if
        // nothing answers, start over (which tries to claim the room again).
        let opened = false;
        const noAnswer = root.setTimeout(() => {
          if (!opened && !stopped && !done) {
            stage("no answer, trying again");
            retry();
          }
        }, NEARBY_OPEN_TIMEOUT_MS);
        c.on("open", () => {
          opened = true;
          root.clearTimeout(noAnswer);
          verify(c, "b");
        });
        c.on("close", () => {
          if (!opened) {
            root.clearTimeout(noAnswer);
            retry();
          }
        });
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
    nearbyRoomId(options && options.roomSalt)
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

  // ------------------------------------------------------- syncing: group mesh
  //
  // Every member registers a peer id derived from the group key and its own
  // device id. Each member connects to the other members it knows about whose
  // id sorts higher (so a pair never connects in both directions) and accepts
  // connections from the rest. A connection is accepted only after the other
  // side proves it holds the group key. Each side then sends its state; when a
  // received state changes ours we pass the result on to our other connections,
  // so a change reaches devices we are not directly connected to.
  //
  // options: { key, deviceId, getMembers, getState, onRemoteState, onMember,
  //            onStatus, onSynced, onStage, onError }
  //   onMember(deviceId) is called for each device that proves it holds the key.
  //   onRemoteState(state) merges and returns true if it changed this device.
  async function startGroupSync(options) {
    const hash = (await sha256Hex(options.key)).slice(0, 24);
    const peerIdFor = (deviceId) => PEER_PREFIX + "g-" + hash + "-" + deviceId;
    const stage = reporter(options);
    const links = new Map(); // remote device id -> { conn, authed }
    let peer = null;
    let stopped = false;
    let retryTimer = null;
    let connectTimer = null;

    function connectedCount() {
      let count = 0;
      links.forEach((link) => {
        if (link.authed) count++;
      });
      return count;
    }

    function report() {
      options.onStatus({ connected: connectedCount() });
    }

    function sendState(conn, reply) {
      sendJson(conn, { t: "state", reply: Boolean(reply), state: options.getState() });
    }

    function forward(exceptId) {
      links.forEach((link, id) => {
        if (id !== exceptId && link.authed && link.conn.open) sendState(link.conn, false);
      });
    }

    // Handshake and message handling for one connection, either direction.
    function wire(conn) {
      const myNonce = randomString("0123456789abcdef", 16);
      let remoteId = null;
      let authed = false;
      let closedHandled = false;

      const finishClose = () => {
        if (closedHandled) return;
        closedHandled = true;
        if (remoteId && links.get(remoteId) && links.get(remoteId).conn === conn) {
          links.delete(remoteId);
          report();
        }
      };

      conn.on(
        "data",
        makeReceiver((message) => {
          if (stopped) return;
          if (message.t === "hello") {
            if (typeof message.deviceId === "string" && typeof message.nonce === "string") {
              remoteId = message.deviceId;
              hmacHex(options.key, "kf-sync|" + message.nonce)
                .then((mac) => sendJson(conn, { t: "proof", mac }))
                .catch(() => {});
            }
          } else if (message.t === "proof") {
            hmacHex(options.key, "kf-sync|" + myNonce)
              .then((expected) => {
                if (expected !== message.mac || !remoteId) {
                  conn.close();
                  return;
                }
                const existing = links.get(remoteId);
                if (existing && existing.authed && existing.conn !== conn && existing.conn.open) {
                  conn.close(); // already connected to this device
                  return;
                }
                authed = true;
                links.set(remoteId, { conn, authed: true });
                if (options.onMember) options.onMember(remoteId);
                report();
                sendState(conn, true);
              })
              .catch(() => conn.close());
          } else if (message.t === "state" && authed) {
            let changed = false;
            try {
              changed = Boolean(options.onRemoteState(message.state));
            } catch (err) {
              options.onError(err);
            }
            if (message.reply) sendState(conn, false);
            if (changed) forward(remoteId);
            options.onSynced({ from: remoteId, connected: connectedCount() });
          }
        })
      );
      conn.on("close", finishClose);
      conn.on("error", finishClose);
      const hello = () => sendJson(conn, { t: "hello", nonce: myNonce, deviceId: options.deviceId });
      if (conn.open) hello();
      else conn.on("open", hello);
    }

    function tryConnections() {
      if (stopped || !peer || !peer.open) return;
      const members = options.getMembers();
      Object.keys(members).forEach((id) => {
        if (id === options.deviceId || id < options.deviceId || links.has(id)) return;
        links.set(id, { conn: null, authed: false, pending: true });
        const conn = peer.connect(peerIdFor(id), CONN_OPTIONS);
        stage("contacting " + id.slice(0, 4));
        watchIce(conn, "sync", stage);
        wire(conn);
        // Give up on this attempt so it can be retried if it never opens.
        root.setTimeout(() => {
          const link = links.get(id);
          if (link && !link.authed) {
            links.delete(id);
            try {
              conn.close();
            } catch (err) {
              /* ignore */
            }
          }
        }, RETRY_MS * 2);
      });
    }

    function open() {
      peer = new root.Peer(peerIdFor(options.deviceId));
      peer.on("open", () => {
        stage("server reached");
        report();
        tryConnections();
        connectTimer = root.setInterval(tryConnections, RETRY_MS);
      });
      peer.on("connection", (conn) => wire(conn));
      peer.on("error", (err) => {
        if (stopped) return;
        if (err.type === "peer-unavailable") return; // that member isn't open right now
        if (err.type === "unavailable-id") {
          // This device's id is still registered from a moment ago; retry shortly.
          peer.destroy();
          retryTimer = root.setTimeout(open, RETRY_MS);
          return;
        }
        options.onError(err);
      });
    }

    function syncNow() {
      links.forEach((link) => {
        if (link.authed && link.conn.open) sendState(link.conn, true);
      });
    }

    function stop() {
      stopped = true;
      root.clearTimeout(retryTimer);
      root.clearInterval(connectTimer);
      if (peer) peer.destroy();
    }

    open();
    return { stop, syncNow };
  }

  const api = {
    mergeState,
    mergeCounts,
    totalCounts,
    nearbyPairing,
    startGroupSync,
    generateGroupKey,
    // exposed for tests
    expandIPv6,
    networkKeyFromAddresses,
    fingerprintFromSdp,
    verificationNumber,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.KanjiFlashSync = api;
})(typeof window !== "undefined" ? window : globalThis);
