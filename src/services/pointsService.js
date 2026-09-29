import { createHash } from "node:crypto";
import { getDatabase, getDatabaseByName, getGameCollection } from "./databaseService.js";
import { recordPointsLedgerEvent } from "./zeroGProvenanceService.js";
import { logActivityOnChain } from "./zeroGActivityLog.js";

export const POINT_VALUES = Object.freeze({
  playerPlay: 10,
  creatorPlay: 2,
  playerFirstPlay: 30,
  creatorFirstPlay: 10,
  playerReplay: 5,
  creatorReplay: 2,
  playerComplete: 20,
  creatorComplete: 5,
  playerLike: 2,
  creatorLike: 15,
  playerShare: 10,
  creatorShare: 25,
  playerFollow: 20,
  creatorFollow: 40,
  playerPublish: 50,
  creatorPublish: 100,
  referralInviterKp: 200,
  referralFriendKp: 100,
  referralInviterCs: 100,
  dailyLoginKp: 10,
  dailyChallengeKp: 100,
  dailyChallengeCs: 250,
  remixNewCreatorKp: 25,
  remixNewCreatorCs: 40,
  remixOriginalCreatorCs: 30,
  trendingDailyTopKp: 500,
  trendingDailyTopCs: 1000,
  trendingTop100Kp: 150,
  trendingTop100Cs: 300,
  featuredKp: 1000,
  featuredCs: 3000,
  genesisCreatorKp: 1000,
  genesisCreatorCs: 5000,

  // Backward-compatible aliases used by older call sites.
  qualifiedPlay: 2,
  like: 15,
  share: 25,
  follow: 40,
  referralPlay: 200,
  firstGameBonus: 100,
});

const PLAY_REWARD_DAILY_CAP = 50;
const DEFAULT_BROWSER_DB = "kult_browser";
const DEFAULT_COLLECTIONS = Object.freeze({
  playerKpLedger: "player_kp_ledger",
  browserBalances: "kult_points",
  creatorScoreLedger: "creator_score_ledger",
  creatorScoreBalances: "creator_score_balances",
  creators: "creators",
  badges: "creator_badges",
  botSignals: "reward_bot_signals",
});

let indexesReady;
let testHarness = null;

function collectionName(key) {
  const envKey = `DUAL_ECONOMY_${key.replace(/[A-Z]/g, (char) => `_${char}`).toUpperCase()}_COLLECTION`;
  return process.env[envKey] || DEFAULT_COLLECTIONS[key];
}

function browserDatabaseName() {
  return process.env.DOGEGAME_POINTS_DB || process.env.DOGEGAME_BROWSER_DB || DEFAULT_BROWSER_DB;
}

function normalizeUserId(userId) {
  const value = String(userId || "").trim();
  return /^0x/i.test(value) ? value.toLowerCase() : value;
}

function hashValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return createHash("sha256")
    .update(`${process.env.REWARD_SIGNAL_SALT || "kult-reward-v1"}:${raw}`)
    .digest("hex");
}

export function kpLevelForPoints(points) {
  const total = Math.max(0, Number(points) || 0);
  let level = 1;
  let threshold = 100;
  let remaining = total;
  while (remaining >= threshold && level < 100) {
    remaining -= threshold;
    level += 1;
    threshold = Math.round(threshold * 1.18 + 25);
  }
  return {
    level,
    points: total,
    currentLevelPoints: remaining,
    nextLevelPoints: threshold,
    progress: threshold > 0 ? Math.min(1, remaining / threshold) : 1,
  };
}

function sameUser(a, b) {
  return Boolean(normalizeUserId(a) && normalizeUserId(a) === normalizeUserId(b));
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date) {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const day = new Date(utc).getUTCDay() || 7;
  const thursday = new Date(utc);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function periodIncrements(field, amount, now) {
  const day = dayKey(now);
  const week = weekKey(now);
  return {
    [`lifetime${field}`]: amount,
    [`daily${field}.${day}`]: amount,
    [`weekly${field}.${week}`]: amount,
  };
}

function periodState(now) {
  return {
    currentDay: dayKey(now),
    currentWeek: weekKey(now),
    updatedAt: now,
  };
}

async function collections() {
  if (testHarness?.collections) return testHarness.collections;

  const [studioDb, browserDb] = await Promise.all([
    getDatabase(),
    getDatabaseByName(browserDatabaseName()),
  ]);

  const playerKpLedger = studioDb.collection(collectionName("playerKpLedger"));
  const browserBalances = browserDb.collection(collectionName("browserBalances"));
  const creatorScoreLedger = studioDb.collection(collectionName("creatorScoreLedger"));
  const creatorScoreBalances = studioDb.collection(collectionName("creatorScoreBalances"));
  const creators = studioDb.collection(collectionName("creators"));
  const badges = studioDb.collection(collectionName("badges"));
  const botSignals = studioDb.collection(collectionName("botSignals"));

  if (!indexesReady) {
    indexesReady = Promise.allSettled([
      playerKpLedger.createIndex({ eventId: 1 }, { unique: true, name: "player_kp_eventId_unique" }),
      playerKpLedger.createIndex({ userId: 1, action: 1, targetGameId: 1, day: 1 }, { name: "player_kp_user_action_game_day" }),
      browserBalances.createIndex({ walletAddress: 1 }, { unique: true, name: "kult_points_walletAddress_unique" }),
      browserBalances.createIndex({ kultPoints: -1 }, { name: "kult_points_score_desc" }),
      creatorScoreLedger.createIndex({ eventId: 1 }, { unique: true, name: "creator_score_eventId_unique" }),
      creatorScoreLedger.createIndex({ creatorId: 1, action: 1, targetGameId: 1, day: 1 }, { name: "creator_score_creator_action_game_day" }),
      creatorScoreBalances.createIndex({ creatorId: 1 }, { unique: true, name: "creator_score_creatorId_unique" }),
      creators.createIndex({ creatorId: 1 }, { unique: true, name: "creators_creatorId_unique" }),
      badges.createIndex({ badgeId: 1, userId: 1 }, { unique: true, name: "badges_badge_user_unique" }),
      botSignals.createIndex({ userId: 1, createdAt: -1 }, { name: "reward_signals_user_createdAt" }),
      botSignals.createIndex({ ipHash: 1, createdAt: -1 }, { name: "reward_signals_ip_createdAt" }),
      botSignals.createIndex({ deviceHash: 1, createdAt: -1 }, { name: "reward_signals_device_createdAt" }),
    ]).then((results) => {
      for (const result of results) {
        if (result.status === "rejected") {
          console.warn("Dual economy index setup skipped", { message: result.reason?.message });
        }
      }
    });
  }
  await indexesReady;

  return { playerKpLedger, browserBalances, creatorScoreLedger, creatorScoreBalances, creators, badges, botSignals };
}

export function buildPointEventId(type, parts) {
  return ["creator-studio", type, ...parts.map((part) => String(part ?? "none"))].join(":");
}

async function insertLedgerEvent(collection, event) {
  const insertResult = await collection.updateOne(
    { eventId: event.eventId },
    { $setOnInsert: event },
    { upsert: true },
  );
  const inserted = Boolean(insertResult.upsertedCount);
  // 0G: mirror each NEW points event to an immutable ledger record + an on-chain
  // activity event. The event's own type (e.g. "like", "share", "playerPlay") is
  // used as the on-chain action name, so likes/shares/follows/plays/completions
  // all appear as distinct on-chain events from this one hook.
  if (inserted) {
    recordPointsLedgerEvent(event);
    logActivityOnChain(event.type || "points_awarded", event.eventId);
  }
  return inserted;
}

async function checkBotSignals({ userId, action, ip, deviceId, now = new Date() }) {
  const { botSignals } = await collections();
  const user = normalizeUserId(userId);
  const ipHash = hashValue(ip);
  const deviceHash = hashValue(deviceId);
  const since = new Date(now.getTime() - 60 * 60 * 1000);
  const query = {
    createdAt: { $gte: since },
    $or: [
      user ? { userId: user } : null,
      ipHash ? { ipHash } : null,
      deviceHash ? { deviceHash } : null,
    ].filter(Boolean),
  };
  const recent = query.$or.length ? await botSignals.countDocuments(query) : 0;
  const blocked = recent >= 120;
  const signalId = buildPointEventId("signal", [user, action, now.getTime(), Math.random().toString(36).slice(2)]);
  await botSignals.updateOne(
    { signalId },
    {
      $setOnInsert: {
        signalId,
        userId: user,
        action,
        ipHash,
        deviceHash,
        blocked,
        createdAt: now,
      },
    },
    { upsert: true },
  );
  return blocked ? { allowed: false, reason: "bot-velocity" } : { allowed: true };
}

export async function awardPlayerKp({
  eventId,
  userId,
  action,
  kp,
  targetGameId,
  sourceUserId,
  metadata = {},
  signals = {},
  now = new Date(),
}) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return { awarded: false, reason: "missing-user", kp: 0 };

  const amount = Number(kp);
  if (!Number.isFinite(amount) || amount <= 0) return { awarded: false, reason: "invalid-kp", kp: 0 };
  const botCheck = await checkBotSignals({ userId: normalizedUserId, action, ...signals, now });
  if (!botCheck.allowed) return { awarded: false, reason: botCheck.reason, kp: 0 };

  const { playerKpLedger, browserBalances } = await collections();
  const event = {
    eventId,
    source: "creator-studio",
    economy: "kp",
    action,
    userId: normalizedUserId,
    kpDelta: amount,
    targetGameId: targetGameId ?? null,
    sourceUserId: sourceUserId ? normalizeUserId(sourceUserId) : null,
    day: dayKey(now),
    week: weekKey(now),
    metadata,
    createdAt: now,
  };

  const awarded = await insertLedgerEvent(playerKpLedger, event);
  if (!awarded) {
    return { awarded: false, duplicate: true, kp: 0 };
  }

  await browserBalances.updateOne(
    { walletAddress: normalizedUserId },
    {
      $inc: { kultPoints: amount },
      $set: { walletAddress: normalizedUserId, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  return { awarded: true, kp: amount };
}

export async function awardCreatorScore({
  eventId,
  creatorId,
  action,
  cs,
  targetGameId,
  sourceUserId,
  metadata = {},
  signals = {},
  now = new Date(),
}) {
  const normalizedCreatorId = normalizeUserId(creatorId);
  if (!normalizedCreatorId) return { awarded: false, reason: "missing-creator", cs: 0 };

  const amount = Number(cs);
  if (!Number.isFinite(amount) || amount <= 0) return { awarded: false, reason: "invalid-cs", cs: 0 };
  const botCheck = await checkBotSignals({ userId: sourceUserId ?? normalizedCreatorId, action, ...signals, now });
  if (!botCheck.allowed) return { awarded: false, reason: botCheck.reason, cs: 0 };

  const { creatorScoreLedger, creatorScoreBalances, creators } = await collections();
  const event = {
    eventId,
    source: "creator-studio",
    economy: "cs",
    action,
    creatorId: normalizedCreatorId,
    csDelta: amount,
    targetGameId: targetGameId ?? null,
    sourceUserId: sourceUserId ? normalizeUserId(sourceUserId) : null,
    day: dayKey(now),
    week: weekKey(now),
    metadata,
    createdAt: now,
  };

  const awarded = await insertLedgerEvent(creatorScoreLedger, event);
  if (!awarded) {
    const balance = await creatorScoreBalances.findOne({ creatorId: normalizedCreatorId }, { projection: { _id: 0 } });
    return { awarded: false, duplicate: true, cs: 0, balance };
  }

  const legacyPointIncrements = periodIncrements("Points", amount, now);
  const scoreIncrements = periodIncrements("Score", amount, now);
  const state = periodState(now);

  await Promise.all([
    creatorScoreBalances.updateOne(
      { creatorId: normalizedCreatorId },
      {
        $inc: { ...scoreIncrements, ...legacyPointIncrements },
        $set: state,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    ),
    creators.updateOne(
      { creatorId: normalizedCreatorId },
      {
        $inc: { ...scoreIncrements, ...legacyPointIncrements },
        $set: state,
        $setOnInsert: { createdAt: now },
      },
      { upsert: true },
    ),
  ]);

  const balance = await creatorScoreBalances.findOne({ creatorId: normalizedCreatorId }, { projection: { _id: 0 } });
  return { awarded: true, cs: amount, balance };
}

async function getPlayerGamePlayCount(playerKpLedger, userId, gameId) {
  return playerKpLedger.countDocuments({
    userId,
    action: "game_play_qualified",
    targetGameId: gameId,
  });
}

async function getPlayerGamePlayCountForDay(playerKpLedger, userId, gameId, now) {
  return playerKpLedger.countDocuments({
    userId,
    action: "game_play_qualified",
    targetGameId: gameId,
    day: dayKey(now),
  });
}

async function updateGamePoints(gameId, inc) {
  if (!gameId) return null;
  const games = testHarness?.gameCollection ?? await getGameCollection();
  const current = await games.findOne({ id: gameId }, { projection: { _id: 0, points: 1 } });
  const points = {
    plays: Math.max(0, Number(current?.points?.plays ?? 0) + Number(inc.plays ?? 0)),
    likes: Math.max(0, Number(current?.points?.likes ?? 0) + Number(inc.likes ?? 0)),
    shares: Math.max(0, Number(current?.points?.shares ?? 0) + Number(inc.shares ?? 0)),
    total: Math.max(0, Number(current?.points?.total ?? 0) + Number(inc.total ?? 0)),
  };
  await games.updateOne(
    { id: gameId },
    { $set: { points, updatedAt: new Date() } },
  );
  return points;
}

function dualAwardResult({ playerKp, creatorScore, action, pointsForGame }) {
  const awarded = Boolean(playerKp?.awarded || creatorScore?.awarded);
  return {
    awarded,
    duplicate: Boolean(!awarded && (playerKp?.duplicate || creatorScore?.duplicate)),
    action,
    playerKp,
    creatorScore,
    kp: playerKp?.kp ?? 0,
    cs: creatorScore?.cs ?? 0,
    // Legacy fields while frontend responses are migrated.
    points: creatorScore?.cs ?? 0,
    gamePoints: pointsForGame ?? null,
  };
}

export async function awardQualifiedPlay({ game, actorId, sessionId, durationSeconds, now = new Date(), signals = {} }) {
  if (!game?.id || !game?.creatorId || !actorId || Number(durationSeconds) < 30) {
    return { awarded: false, reason: "not-qualified", playerKp: null, creatorScore: null };
  }
  if (sameUser(game.creatorId, actorId)) {
    return { awarded: false, reason: "self-play", playerKp: null, creatorScore: null };
  }

  const creatorId = normalizeUserId(game.creatorId);
  const playerId = normalizeUserId(actorId);
  const { playerKpLedger } = await collections();
  const dayCount = await getPlayerGamePlayCountForDay(playerKpLedger, playerId, game.id, now);
  if (dayCount >= PLAY_REWARD_DAILY_CAP) {
    return { awarded: false, reason: "play-daily-cap", playerKp: null, creatorScore: null };
  }

  const lifetimeCount = await getPlayerGamePlayCount(playerKpLedger, playerId, game.id);
  const firstPlay = lifetimeCount === 0;
  const playerKpValue = firstPlay ? POINT_VALUES.playerFirstPlay : POINT_VALUES.playerReplay;
  const creatorScoreValue = firstPlay ? POINT_VALUES.creatorFirstPlay : POINT_VALUES.creatorReplay;
  const playType = firstPlay ? "first_play" : "replay";
  const metadata = { durationSeconds, sessionId, playType };

  const [playerKp, creatorScore] = await Promise.all([
    awardPlayerKp({
      eventId: buildPointEventId("kp-play", [game.id, playerId, sessionId]),
      userId: playerId,
      action: "game_play_qualified",
      kp: playerKpValue,
      targetGameId: game.id,
      sourceUserId: creatorId,
      metadata,
      signals,
      now,
    }),
    awardCreatorScore({
      eventId: buildPointEventId("cs-play", [game.id, playerId, sessionId]),
      creatorId,
      action: "game_play_qualified",
      cs: creatorScoreValue,
      targetGameId: game.id,
      sourceUserId: playerId,
      metadata,
      signals,
      now,
    }),
  ]);

  const gamePoints = (playerKp.awarded || creatorScore.awarded)
    ? await updateGamePoints(game.id, { plays: 1, total: creatorScore.cs ?? 0 })
    : null;
  return dualAwardResult({ playerKp, creatorScore, action: "game_play_qualified", pointsForGame: gamePoints });
}

export async function awardGameCompletion({ game, actorId, completionId, now = new Date(), signals = {} }) {
  if (!game?.id || !game?.creatorId || !actorId) return { awarded: false, reason: "missing-input" };
  if (sameUser(game.creatorId, actorId)) return { awarded: false, reason: "self-complete" };

  const creatorId = normalizeUserId(game.creatorId);
  const playerId = normalizeUserId(actorId);
  const eventKey = completionId || `${game.id}:${playerId}`;
  const [playerKp, creatorScore] = await Promise.all([
    awardPlayerKp({
      eventId: buildPointEventId("kp-complete", [eventKey]),
      userId: playerId,
      action: "game_complete",
      kp: POINT_VALUES.playerComplete,
      targetGameId: game.id,
      sourceUserId: creatorId,
      signals,
      now,
    }),
    awardCreatorScore({
      eventId: buildPointEventId("cs-complete", [eventKey]),
      creatorId,
      action: "game_complete",
      cs: POINT_VALUES.creatorComplete,
      targetGameId: game.id,
      sourceUserId: playerId,
      signals,
      now,
    }),
  ]);
  return dualAwardResult({ playerKp, creatorScore, action: "game_complete" });
}

export async function awardLike({ game, actorId }) {
  if (!game?.id || !game?.creatorId || !actorId) return { awarded: false, reason: "missing-input" };
  if (sameUser(game.creatorId, actorId)) return { awarded: false, reason: "self-like" };

  const creatorId = normalizeUserId(game.creatorId);
  const playerId = normalizeUserId(actorId);
  const [playerKp, creatorScore] = await Promise.all([
    awardPlayerKp({
      eventId: buildPointEventId("kp-like", [game.id, playerId]),
      userId: playerId,
      action: "game_like",
      kp: POINT_VALUES.playerLike,
      targetGameId: game.id,
      sourceUserId: creatorId,
    }),
    awardCreatorScore({
      eventId: buildPointEventId("cs-like", [game.id, playerId]),
      creatorId,
      action: "game_like",
      cs: POINT_VALUES.creatorLike,
      targetGameId: game.id,
      sourceUserId: playerId,
    }),
  ]);
  const gamePoints = (playerKp.awarded || creatorScore.awarded)
    ? await updateGamePoints(game.id, { likes: 1, total: POINT_VALUES.creatorLike })
    : null;
  return dualAwardResult({ playerKp, creatorScore, action: "game_like", pointsForGame: gamePoints });
}

export async function awardShare({ game, actorId, platform }) {
  if (!game?.id || !game?.creatorId || !actorId) return { awarded: false, reason: "missing-input" };
  if (sameUser(game.creatorId, actorId)) return { awarded: false, reason: "self-share" };

  const creatorId = normalizeUserId(game.creatorId);
  const playerId = normalizeUserId(actorId);
  const metadata = { platform: platform || "link" };
  const [playerKp, creatorScore] = await Promise.all([
    awardPlayerKp({
      eventId: buildPointEventId("kp-share", [game.id, playerId, platform || "link"]),
      userId: playerId,
      action: "game_share",
      kp: POINT_VALUES.playerShare,
      targetGameId: game.id,
      sourceUserId: creatorId,
      metadata,
    }),
    awardCreatorScore({
      eventId: buildPointEventId("cs-share", [game.id, playerId, platform || "link"]),
      creatorId,
      action: "game_share",
      cs: POINT_VALUES.creatorShare,
      targetGameId: game.id,
      sourceUserId: playerId,
      metadata,
    }),
  ]);
  const gamePoints = (playerKp.awarded || creatorScore.awarded)
    ? await updateGamePoints(game.id, { shares: 1, total: POINT_VALUES.creatorShare })
    : null;
  return dualAwardResult({ playerKp, creatorScore, action: "game_share", pointsForGame: gamePoints });
}

export async function awardFollowCreator({ creatorId, followerId }) {
  if (!creatorId || !followerId) return { awarded: false, reason: "missing-input" };
  if (sameUser(creatorId, followerId)) return { awarded: false, reason: "self-follow" };

  const normalizedCreatorId = normalizeUserId(creatorId);
  const normalizedFollowerId = normalizeUserId(followerId);
  const [playerKp, creatorScore] = await Promise.all([
    awardPlayerKp({
      eventId: buildPointEventId("kp-follow", [normalizedCreatorId, normalizedFollowerId]),
      userId: normalizedFollowerId,
      action: "creator_follow",
      kp: POINT_VALUES.playerFollow,
      sourceUserId: normalizedCreatorId,
    }),
    awardCreatorScore({
      eventId: buildPointEventId("cs-follow", [normalizedCreatorId, normalizedFollowerId]),
      creatorId: normalizedCreatorId,
      action: "creator_follow",
      cs: POINT_VALUES.creatorFollow,
      sourceUserId: normalizedFollowerId,
    }),
  ]);

  return dualAwardResult({ playerKp, creatorScore, action: "creator_follow" });
}

export async function awardFirstGameBonus({ creatorId, gameId }) {
  if (!creatorId || !gameId) return { awarded: false, reason: "missing-input" };
  const normalizedCreatorId = normalizeUserId(creatorId);
  const [playerKp, creatorScore] = await Promise.all([
    awardPlayerKp({
      eventId: buildPointEventId("kp-publish", [gameId, normalizedCreatorId]),
      userId: normalizedCreatorId,
      action: "game_publish",
      kp: POINT_VALUES.playerPublish,
      targetGameId: gameId,
      sourceUserId: normalizedCreatorId,
    }),
    awardCreatorScore({
      eventId: buildPointEventId("cs-publish", [gameId, normalizedCreatorId]),
      creatorId: normalizedCreatorId,
      action: "game_publish",
      cs: POINT_VALUES.creatorPublish,
      targetGameId: gameId,
      sourceUserId: normalizedCreatorId,
    }),
  ]);
  return dualAwardResult({ playerKp, creatorScore, action: "game_publish" });
}

export async function awardDailyLogin({ userId, now = new Date(), signals = {} }) {
  const normalizedUserId = normalizeUserId(userId);
  return awardPlayerKp({
    eventId: buildPointEventId("kp-daily-login", [normalizedUserId, dayKey(now)]),
    userId: normalizedUserId,
    action: "daily_login",
    kp: POINT_VALUES.dailyLoginKp,
    metadata: { day: dayKey(now) },
    signals,
    now,
  });
}

export async function awardDailyChallenge({ userId, creatorId, challengeId, gameId, now = new Date(), signals = {} }) {
  if (!userId || !challengeId) return { awarded: false, reason: "missing-input" };
  const normalizedUserId = normalizeUserId(userId);
  const normalizedCreatorId = normalizeUserId(creatorId ?? userId);
  const [playerKp, creatorScore] = await Promise.all([
    awardPlayerKp({
      eventId: buildPointEventId("kp-daily-challenge", [challengeId, normalizedUserId, dayKey(now)]),
      userId: normalizedUserId,
      action: "daily_challenge",
      kp: POINT_VALUES.dailyChallengeKp,
      targetGameId: gameId,
      sourceUserId: normalizedCreatorId,
      metadata: { challengeId, day: dayKey(now) },
      signals,
      now,
    }),
    awardCreatorScore({
      eventId: buildPointEventId("cs-daily-challenge", [challengeId, normalizedCreatorId, dayKey(now)]),
      creatorId: normalizedCreatorId,
      action: "daily_challenge",
      cs: POINT_VALUES.dailyChallengeCs,
      targetGameId: gameId,
      sourceUserId: normalizedUserId,
      metadata: { challengeId, day: dayKey(now) },
      signals,
      now,
    }),
  ]);
  return dualAwardResult({ playerKp, creatorScore, action: "daily_challenge" });
}

export async function awardRemix({ newCreatorId, originalCreatorId, originalGameId, remixGameId, now = new Date(), signals = {} }) {
  if (!newCreatorId || !originalCreatorId || !remixGameId) return { awarded: false, reason: "missing-input" };
  if (sameUser(newCreatorId, originalCreatorId)) return { awarded: false, reason: "self-remix" };
  const newCreator = normalizeUserId(newCreatorId);
  const originalCreator = normalizeUserId(originalCreatorId);
  const remixDay = dayKey(now);
  const { creatorScoreLedger } = await collections();
  const remixCount = await creatorScoreLedger.countDocuments({
    creatorId: newCreator,
    action: "game_remix_new_creator",
    day: remixDay,
  });
  if (remixCount >= 10) return { awarded: false, reason: "remix-daily-cap" };

  const [newCreatorKp, newCreatorScore, originalCreatorScore] = await Promise.all([
    awardPlayerKp({
      eventId: buildPointEventId("kp-remix-new", [remixGameId, newCreator]),
      userId: newCreator,
      action: "game_remix_new_creator",
      kp: POINT_VALUES.remixNewCreatorKp,
      targetGameId: remixGameId,
      sourceUserId: originalCreator,
      metadata: { originalGameId, remixGameId },
      signals,
      now,
    }),
    awardCreatorScore({
      eventId: buildPointEventId("cs-remix-new", [remixGameId, newCreator]),
      creatorId: newCreator,
      action: "game_remix_new_creator",
      cs: POINT_VALUES.remixNewCreatorCs,
      targetGameId: remixGameId,
      sourceUserId: originalCreator,
      metadata: { originalGameId, remixGameId },
      signals,
      now,
    }),
    awardCreatorScore({
      eventId: buildPointEventId("cs-remix-original", [remixGameId, originalCreator]),
      creatorId: originalCreator,
      action: "game_remix_original_creator",
      cs: POINT_VALUES.remixOriginalCreatorCs,
      targetGameId: originalGameId,
      sourceUserId: newCreator,
      metadata: { originalGameId, remixGameId },
      signals,
      now,
    }),
  ]);

  return {
    awarded: Boolean(newCreatorKp.awarded || newCreatorScore.awarded || originalCreatorScore.awarded),
    playerKp: newCreatorKp,
    creatorScore: newCreatorScore,
    originalCreatorScore,
    kp: newCreatorKp.kp ?? 0,
    cs: (newCreatorScore.cs ?? 0) + (originalCreatorScore.cs ?? 0),
    points: (newCreatorScore.cs ?? 0) + (originalCreatorScore.cs ?? 0),
  };
}

export async function awardMilestone({ userId, creatorId, gameId, milestone, now = new Date(), signals = {} }) {
  const config = {
    trending_daily_top: [POINT_VALUES.trendingDailyTopKp, POINT_VALUES.trendingDailyTopCs],
    trending_top_100: [POINT_VALUES.trendingTop100Kp, POINT_VALUES.trendingTop100Cs],
    featured_browser: [POINT_VALUES.featuredKp, POINT_VALUES.featuredCs],
    genesis_creator_10000_plays: [POINT_VALUES.genesisCreatorKp, POINT_VALUES.genesisCreatorCs],
  }[milestone];
  if (!config || !userId || !creatorId) return { awarded: false, reason: "missing-input" };
  const [kp, cs] = config;
  const normalizedUserId = normalizeUserId(userId);
  const normalizedCreatorId = normalizeUserId(creatorId);
  const [playerKp, creatorScore] = await Promise.all([
    awardPlayerKp({
      eventId: buildPointEventId("kp-milestone", [milestone, gameId, normalizedUserId, dayKey(now)]),
      userId: normalizedUserId,
      action: milestone,
      kp,
      targetGameId: gameId,
      sourceUserId: normalizedCreatorId,
      signals,
      now,
    }),
    awardCreatorScore({
      eventId: buildPointEventId("cs-milestone", [milestone, gameId, normalizedCreatorId, dayKey(now)]),
      creatorId: normalizedCreatorId,
      action: milestone,
      cs,
      targetGameId: gameId,
      sourceUserId: normalizedUserId,
      signals,
      now,
    }),
  ]);
  if (milestone === "genesis_creator_10000_plays" && (playerKp.awarded || creatorScore.awarded)) {
    await awardBadge({ userId: normalizedCreatorId, badgeId: "genesis_creator", gameId, now });
  }
  return dualAwardResult({ playerKp, creatorScore, action: milestone });
}

export async function awardBadge({ userId, badgeId, gameId, now = new Date() }) {
  if (!userId || !badgeId) return { awarded: false, reason: "missing-input" };
  const { badges } = await collections();
  const normalizedUserId = normalizeUserId(userId);
  const result = await badges.updateOne(
    { userId: normalizedUserId, badgeId },
    {
      $setOnInsert: {
        userId: normalizedUserId,
        badgeId,
        gameId: gameId ?? null,
        awardedAt: now,
      },
    },
    { upsert: true },
  );
  return { awarded: Boolean(result.upsertedCount), badgeId };
}

export async function recordCreatorGamePublished({ creatorId, gameId }) {
  if (!creatorId || !gameId) return { recorded: false, reason: "missing-input" };
  const { creators } = await collections();
  const normalizedCreatorId = normalizeUserId(creatorId);
  const now = new Date();
  const existing = await creators.findOne({ creatorId: normalizedCreatorId }, { projection: { _id: 0, publishedGameIds: 1 } });
  if (existing?.publishedGameIds?.includes(gameId)) return { recorded: false, duplicate: true, gameId };

  await creators.updateOne(
    { creatorId: normalizedCreatorId },
    {
      $addToSet: { publishedGameIds: gameId },
      $inc: { gamesCreated: 1 },
      $set: { lastPublishedGameId: gameId, updatedAt: now },
      $setOnInsert: { creatorId: normalizedCreatorId, createdAt: now },
    },
    { upsert: true },
  );
  return { recorded: true, gameId };
}

export async function awardReferralPlay({ referrerId, referredId, attributionId, gameId }) {
  if (!referrerId || !referredId || !attributionId) return { awarded: false, reason: "missing-input" };
  const normalizedReferrerId = normalizeUserId(referrerId);
  const normalizedReferredId = normalizeUserId(referredId);
  if (normalizedReferrerId === normalizedReferredId) return { awarded: false, reason: "self-referral" };

  const [inviterKp, friendKp, inviterScore] = await Promise.all([
    awardPlayerKp({
      eventId: buildPointEventId("kp-invite-inviter", [attributionId, normalizedReferrerId]),
      userId: normalizedReferrerId,
      action: "invite_friend_joined",
      kp: POINT_VALUES.referralInviterKp,
      targetGameId: gameId,
      sourceUserId: normalizedReferredId,
      metadata: { attributionId },
    }),
    awardPlayerKp({
      eventId: buildPointEventId("kp-invite-friend", [attributionId, normalizedReferredId]),
      userId: normalizedReferredId,
      action: "invite_friend_joined",
      kp: POINT_VALUES.referralFriendKp,
      targetGameId: gameId,
      sourceUserId: normalizedReferrerId,
      metadata: { attributionId },
    }),
    awardCreatorScore({
      eventId: buildPointEventId("cs-invite-inviter", [attributionId, normalizedReferrerId]),
      creatorId: normalizedReferrerId,
      action: "invite_friend_joined",
      cs: POINT_VALUES.referralInviterCs,
      targetGameId: gameId,
      sourceUserId: normalizedReferredId,
      metadata: { attributionId },
    }),
  ]);

  return {
    awarded: Boolean(inviterKp.awarded || friendKp.awarded || inviterScore.awarded),
    duplicate: Boolean(inviterKp.duplicate && friendKp.duplicate && inviterScore.duplicate),
    playerKp: inviterKp,
    friendKp,
    creatorScore: inviterScore,
    kp: inviterKp.kp ?? 0,
    cs: inviterScore.cs ?? 0,
    points: inviterKp.kp ?? 0,
  };
}

/**
 * Persists the user's chosen display name so leaderboards (and anything else
 * reading the creators/balances docs) show it instead of the wallet address.
 */
export async function setProfileUsername({ userId, username, aliases = [userId] }) {
  const normalizedUserId = normalizeUserId(userId);
  const normalizedAliases = [...new Set([userId, ...aliases].map(normalizeUserId).filter(Boolean))];
  const name = String(username || "").trim().slice(0, 32);
  if (!normalizedUserId || !name) {
    const error = new Error("userId and username are required");
    error.status = 400;
    throw error;
  }
  const { creators, browserBalances } = await collections();
  const now = new Date();
  await Promise.all(normalizedAliases.flatMap((identity) => [
    creators.updateOne(
      { creatorId: identity },
      { $set: { creatorId: identity, username: name, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    ),
    browserBalances.updateOne(
      { walletAddress: identity },
      { $set: { walletAddress: identity, username: name, updatedAt: now }, $setOnInsert: { createdAt: now, kultPoints: 0 } },
      { upsert: true },
    ),
  ]));
  return { userId: normalizedUserId, username: name };
}

export async function getProfileUsername(userId, aliases = [userId]) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return { userId: "", username: null };
  const ids = [...new Set([userId, ...aliases].map(normalizeUserId).filter(Boolean))];
  const { creators, browserBalances } = await collections();
  const [creator, balance] = await Promise.all([
    creators.findOne(
      { creatorId: { $in: ids }, username: { $exists: true } },
      { projection: { _id: 0, username: 1 } },
    ),
    browserBalances.findOne(
      { walletAddress: { $in: ids }, username: { $exists: true } },
      { projection: { _id: 0, username: 1 } },
    ),
  ]);
  return {
    userId: normalizedUserId,
    username: creator?.username ?? balance?.username ?? null,
  };
}

export async function getPointSummary(userId, aliases = [userId]) {
  const normalizedUserId = normalizeUserId(userId);
  if (!normalizedUserId) return null;
  const ids = [...new Set([userId, ...aliases].map(normalizeUserId).filter(Boolean))];
  const { browserBalances, playerKpLedger } = await collections();
  const [balances, ledger] = await Promise.all([
    browserBalances.find({ walletAddress: { $in: ids } }, { projection: { _id: 0 } }).toArray(),
    playerKpLedger.find({ userId: { $in: ids } }, { projection: { _id: 0 } }).toArray(),
  ]);
  const lifetimePoints = ledger.length
    ? ledger.reduce((total, event) => total + Number(event.kpDelta ?? 0), 0)
    : balances.reduce((total, balance) => total + Number(balance.kultPoints ?? 0), 0);
  const dailyPoints = {};
  const weeklyPoints = {};
  let updatedAt = null;
  for (const event of ledger) {
    if (event.day) dailyPoints[event.day] = (dailyPoints[event.day] ?? 0) + Number(event.kpDelta ?? 0);
    if (event.week) weeklyPoints[event.week] = (weeklyPoints[event.week] ?? 0) + Number(event.kpDelta ?? 0);
    if (event.createdAt && (!updatedAt || new Date(event.createdAt) > new Date(updatedAt))) updatedAt = event.createdAt;
  }
  const now = new Date();
  return {
    userId: normalizedUserId,
    walletAddress: normalizedUserId,
    dogeGamePoints: lifetimePoints,
    lifetimePoints,
    dailyPoints,
    weeklyPoints,
    currentDay: dayKey(now),
    currentWeek: weekKey(now),
    level: kpLevelForPoints(lifetimePoints),
    updatedAt: updatedAt ?? balances.find((balance) => balance.updatedAt)?.updatedAt ?? null,
  };
}

export async function getDailyPlayerActivity(userId, aliases = [userId], now = new Date()) {
  const ids = [...new Set([userId, ...aliases].map(normalizeUserId).filter(Boolean))];
  if (!ids.length) return { plays: 0, publishes: 0, shares: 0 };
  const { playerKpLedger } = await collections();
  const events = await playerKpLedger.find(
    { userId: { $in: ids }, day: dayKey(now) },
    { projection: { _id: 0, action: 1, targetGameId: 1 } },
  ).toArray();
  const playedGames = new Set(events
    .filter((event) => ["game_play_qualified", "game_complete"].includes(event.action))
    .map((event) => event.targetGameId)
    .filter(Boolean));
  return {
    plays: playedGames.size,
    publishes: events.filter((event) => event.action === "game_publish").length,
    shares: events.filter((event) => event.action === "game_share").length,
  };
}

export async function getCreatorScoreSummary(creatorId, aliases = [creatorId]) {
  const normalizedCreatorId = normalizeUserId(creatorId);
  if (!normalizedCreatorId) return null;
  const ids = [...new Set([creatorId, ...aliases].map(normalizeUserId).filter(Boolean))];
  const { creatorScoreBalances, creatorScoreLedger } = await collections();
  const [balances, ledger] = await Promise.all([
    creatorScoreBalances.find({ creatorId: { $in: ids } }, { projection: { _id: 0 } }).toArray(),
    creatorScoreLedger.find({ creatorId: { $in: ids } }, { projection: { _id: 0 } }).toArray(),
  ]);
  if (!balances.length && !ledger.length) return null;
  const lifetimeScore = ledger.length
    ? ledger.reduce((total, event) => total + Number(event.csDelta ?? 0), 0)
    : balances.reduce((total, balance) => total + Number(balance.lifetimeScore ?? balance.lifetimePoints ?? 0), 0);
  const dailyScore = {};
  const weeklyScore = {};
  for (const event of ledger) {
    if (event.day) dailyScore[event.day] = (dailyScore[event.day] ?? 0) + Number(event.csDelta ?? 0);
    if (event.week) weeklyScore[event.week] = (weeklyScore[event.week] ?? 0) + Number(event.csDelta ?? 0);
  }
  const now = new Date();
  return {
    creatorId: normalizedCreatorId,
    lifetimeScore,
    lifetimePoints: lifetimeScore,
    dailyScore,
    dailyPoints: dailyScore,
    weeklyScore,
    weeklyPoints: weeklyScore,
    currentDay: dayKey(now),
    currentWeek: weekKey(now),
  };
}

// Creator Score (the platform's earning unit) earned per game, summed from the
// immutable ledger. `aliases` covers every identity the same creator authed as
// (all identity aliases of the wallet) so earnings aren't split across them.
// Returns { byGame: { [gameId]: { earned, plays } }, total }.
export async function getCreatorEarningsByGame(aliases = []) {
  const ids = [...new Set(aliases.map(normalizeUserId).filter(Boolean))];
  if (!ids.length) return { byGame: {}, total: 0 };
  const { creatorScoreLedger } = await collections();
  const rows = await creatorScoreLedger
    .aggregate([
      { $match: { creatorId: { $in: ids } } },
      {
        $group: {
          _id: "$targetGameId",
          earned: { $sum: "$csDelta" },
          // A "play" is any qualified-play/completion event on that game.
          plays: { $sum: { $cond: [{ $in: ["$action", PLAY_ACTIONS] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  const byGame = {};
  let total = 0;
  for (const row of rows) {
    if (!row._id) continue;
    const earned = Number(row.earned ?? 0);
    byGame[row._id] = { earned, plays: Number(row.plays ?? 0) };
    total += earned;
  }
  return { byGame, total };
}

// Lifetime Doge Points (the player economy) earned by the given identity, summed
// from the immutable DP ledger across all of the user's aliases.
export async function getDogeGamePointsEarned(aliases = []) {
  const ids = [...new Set(aliases.map(normalizeUserId).filter(Boolean))];
  if (!ids.length) return 0;
  const { playerKpLedger } = await collections();
  const rows = await playerKpLedger
    .aggregate([
      { $match: { userId: { $in: ids } } },
      { $group: { _id: null, total: { $sum: "$kpDelta" } } },
    ])
    .toArray();
  return Number(rows[0]?.total ?? 0);
}

// Real DP earned by this user, grouped by the game that awarded it.
export async function getDogeGamePointsByGame(aliases = []) {
  const ids = [...new Set(aliases.map(normalizeUserId).filter(Boolean))];
  if (!ids.length) return {};
  const { playerKpLedger } = await collections();
  const rows = await playerKpLedger.aggregate([
    { $match: { userId: { $in: ids }, targetGameId: { $nin: [null, ""] } } },
    { $group: { _id: "$targetGameId", earned: { $sum: "$kpDelta" } } },
  ]).toArray();
  return Object.fromEntries(
    rows.filter((row) => row._id).map((row) => [String(row._id), Number(row.earned ?? 0)]),
  );
}

// A "play" event, for counting plays out of the mixed creator-score ledger.
const PLAY_ACTIONS = ["game_play_qualified", "game_complete"];

// Supported analytics ranges → how the time axis is bucketed. `day` is hourly,
// `week`/`month` are daily, `year` is monthly. `fmt` matches Mongo's
// $dateToString output so we can align aggregated rows to pre-filled buckets.
const SERIES_RANGES = {
  day: { unit: "hour", count: 24, fmt: "%Y-%m-%dT%H" },
  week: { unit: "day", count: 7, fmt: "%Y-%m-%d" },
  month: { unit: "day", count: 30, fmt: "%Y-%m-%d" },
  year: { unit: "month", count: 12, fmt: "%Y-%m" },
};

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Bucket key (matching SERIES_RANGES.fmt) + short axis label for a UTC date.
function seriesKeyLabel(date, unit) {
  const iso = date.toISOString();
  if (unit === "hour") return { key: iso.slice(0, 13), label: `${iso.slice(11, 13)}:00` };
  if (unit === "month") {
    return { key: iso.slice(0, 7), label: `${MONTH_LABELS[date.getUTCMonth()]} ${iso.slice(2, 4)}` };
  }
  return { key: iso.slice(0, 10), label: iso.slice(5, 10) };
}

// Steps `date` back by one bucket unit (mutating a copy is avoided by callers).
function stepBack(date, unit, steps) {
  const next = new Date(date);
  if (unit === "hour") next.setUTCHours(next.getUTCHours() - steps);
  else if (unit === "month") next.setUTCMonth(next.getUTCMonth() - steps);
  else next.setUTCDate(next.getUTCDate() - steps);
  return next;
}

// Multi-metric series for the analytics chart, bucketed by the given range
// ("day" | "week" | "month" | "year"). Each bucket carries: earned (Creator
// Score), plays (# qualified plays/completions), timeSeconds (total play time
// from play events) and games (# games created that bucket, from
// `gameCreatedDates`). Missing buckets are zero-filled so the line is
// continuous. Returns { range, points: [{ key, label, earned, plays,
// timeSeconds, games }] } oldest→newest.
export async function getCreatorSeries(aliases = [], range = "week", gameCreatedDates = []) {
  const config = SERIES_RANGES[range] ?? SERIES_RANGES.week;
  const now = new Date();
  const points = [];
  const index = new Map();
  for (let offset = config.count - 1; offset >= 0; offset -= 1) {
    const date = stepBack(now, config.unit, offset);
    const { key, label } = seriesKeyLabel(date, config.unit);
    const point = { key, label, earned: 0, kpEarned: 0, plays: 0, timeSeconds: 0, games: 0 };
    points.push(point);
    index.set(key, point);
  }

  const since = stepBack(now, config.unit, config.count - 1);
  // Floor the window start to the bucket boundary so nothing is missed.
  if (config.unit === "hour") since.setUTCMinutes(0, 0, 0);
  else if (config.unit === "month") since.setUTCDate(1), since.setUTCHours(0, 0, 0, 0);
  else since.setUTCHours(0, 0, 0, 0);

  // Games created per bucket (dates come from the caller's own game records).
  for (const raw of gameCreatedDates) {
    const date = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(date.getTime()) || date < since) continue;
    const point = index.get(seriesKeyLabel(date, config.unit).key);
    if (point) point.games += 1;
  }

  const ids = [...new Set(aliases.map(normalizeUserId).filter(Boolean))];
  if (ids.length) {
    const { creatorScoreLedger, playerKpLedger } = await collections();
    const [rows, kpRows] = await Promise.all([
      creatorScoreLedger.aggregate([
        { $match: { creatorId: { $in: ids }, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: config.fmt, date: "$createdAt", timezone: "UTC" } },
            earned: { $sum: "$csDelta" },
            plays: { $sum: { $cond: [{ $in: ["$action", PLAY_ACTIONS] }, 1, 0] } },
            timeSeconds: {
              $sum: {
                $cond: [
                  { $in: ["$action", PLAY_ACTIONS] },
                  { $ifNull: ["$metadata.durationSeconds", 0] },
                  0,
                ],
              },
            },
          },
        },
      ]).toArray(),
      playerKpLedger.aggregate([
        { $match: { userId: { $in: ids }, createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: config.fmt, date: "$createdAt", timezone: "UTC" } },
            kpEarned: { $sum: "$kpDelta" },
          },
        },
      ]).toArray(),
    ]);
    for (const row of rows) {
      const point = index.get(row._id);
      if (point) {
        point.earned = Number(row.earned ?? 0);
        point.plays = Number(row.plays ?? 0);
        point.timeSeconds = Number(row.timeSeconds ?? 0);
      }
    }
    for (const row of kpRows) {
      const point = index.get(row._id);
      if (point) point.kpEarned = Number(row.kpEarned ?? 0);
    }
  }

  return { range: SERIES_RANGES[range] ? range : "week", points };
}

function displayNameForId(id) {
  const value = String(id || "").trim();
  if (!value) return "Unknown";
  if (/^0x[a-f0-9]{40}$/i.test(value)) return `${value.slice(0, 6)}...${value.slice(-4)}`;
  return value.startsWith("@") ? value : `@${value}`;
}

function rankRows(rows, scoreKey, limit) {
  return rows
    .filter((row) => Number(row[scoreKey] ?? 0) > 0)
    .sort((first, second) => {
      const scoreDiff = Number(second[scoreKey] ?? 0) - Number(first[scoreKey] ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      return String(first.id).localeCompare(String(second.id));
    })
    .slice(0, limit)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function rangeMatchesLedgerEvent(event, range, now) {
  if (range === "weekly") return event.week === weekKey(now);
  if (range === "monthly") return String(event.day || "").startsWith(monthKey(now));
  return true;
}

function aggregateLedgerRows(events, idKey, deltaKey, scoreKey, range, now) {
  const totals = new Map();
  for (const event of events) {
    if (!rangeMatchesLedgerEvent(event, range, now)) continue;
    const id = normalizeUserId(event[idKey]);
    if (!id) continue;
    totals.set(id, Number(totals.get(id) ?? 0) + Number(event[deltaKey] ?? 0));
  }
  return [...totals.entries()].map(([id, score]) => ({ id, [scoreKey]: score }));
}

async function creatorNamesById(creatorIds, creators) {
  const profiles = creatorIds.length
    ? await creators
      .find({ creatorId: { $in: creatorIds } }, { projection: { _id: 0, creatorId: 1, username: 1, displayName: 1, name: 1 } })
      .toArray()
    : [];
  return new Map(profiles.map((profile) => [normalizeUserId(profile.creatorId), profile]));
}

export async function getCreatorScoreLeaderboard({ limit = 100, range = "allTime", now = new Date() } = {}) {
  const { creatorScoreBalances, creators } = await collections();
  const { creatorScoreLedger } = await collections();
  const sourceRows = range === "allTime"
    // Sort + limit pushed to Mongo: rank only needs the top N, not every
    // balance document shipped to Node. Secondary key keeps ties deterministic.
    ? await creatorScoreBalances
      .find({ lifetimeScore: { $gt: 0 } }, { projection: { _id: 0 } })
      .sort({ lifetimeScore: -1 })
      .limit(limit)
      .toArray()
    : aggregateLedgerRows(
      await creatorScoreLedger.find(range === "weekly" ? { week: weekKey(now) } : {}, { projection: { _id: 0 } }).toArray(),
      "creatorId",
      "csDelta",
      "creatorScore",
      range,
      now,
    );
  const creatorIds = sourceRows.map((row) => row.creatorId ?? row.id).filter(Boolean);
  const profilesById = await creatorNamesById(creatorIds, creators);

  const rows = sourceRows.map((balance) => {
    const creatorId = normalizeUserId(balance.creatorId ?? balance.id);
    const profile = profilesById.get(creatorId);
    const name = profile?.username || profile?.displayName || profile?.name || displayNameForId(creatorId);
    const score = Number(balance.creatorScore ?? balance.lifetimeScore ?? balance.lifetimePoints ?? 0);
    return {
      id: creatorId,
      creatorId,
      name,
      creatorScore: score,
      lifetimeScore: Number(balance.lifetimeScore ?? balance.lifetimePoints ?? score),
      dailyScore: balance.dailyScore ?? {},
      weeklyScore: balance.weeklyScore ?? {},
      currentDay: balance.currentDay ?? null,
      currentWeek: balance.currentWeek ?? null,
      updatedAt: balance.updatedAt ?? null,
    };
  });

  return {
    kind: "creator-score",
    metric: "creatorScore",
    range,
    entries: rankRows(rows, "creatorScore", limit),
  };
}

export async function getDogeGamePointsLeaderboard({ limit = 100, range = "allTime", now = new Date() } = {}) {
  const { browserBalances, playerKpLedger } = await collections();
  const balances = range === "allTime"
    // Uses the kultPoints:-1 index — the collection holds 180k+ wallets and
    // fetching them all to sort in JS took ~13s per request.
    // Single-key sort so the kultPoints:-1 index is used directly (a compound
    // sort would force an in-memory sort of the full collection). rankRows
    // applies the deterministic tie-break on the fetched rows afterwards.
    ? await browserBalances
      .find({ kultPoints: { $gt: 0 } }, { projection: { _id: 0 } })
      .sort({ kultPoints: -1 })
      .limit(limit)
      .toArray()
    : aggregateLedgerRows(
      await playerKpLedger.find(range === "weekly" ? { week: weekKey(now) } : {}, { projection: { _id: 0 } }).toArray(),
      "userId",
      "kpDelta",
      "kultPoints",
      range,
      now,
    );
  // Ledger-aggregated rows (weekly/monthly) carry no username — pull the
  // stored display names from the balance docs so names show in every range.
  let usernameById = new Map();
  if (range !== "allTime" && balances.length) {
    const ids = balances.map((balance) => normalizeUserId(balance.walletAddress ?? balance.id)).filter(Boolean);
    const profiles = await browserBalances
      .find({ walletAddress: { $in: ids }, username: { $exists: true } }, { projection: { _id: 0, walletAddress: 1, username: 1 } })
      .toArray();
    usernameById = new Map(profiles.map((profile) => [profile.walletAddress, profile.username]));
  }

  const rows = balances.map((balance) => {
    const walletAddress = normalizeUserId(balance.walletAddress ?? balance.id);
    const points = Number(balance.kultPoints ?? 0);
    return {
      id: walletAddress,
      userId: walletAddress,
      walletAddress,
      name: balance.username || balance.displayName || balance.name
        || usernameById.get(walletAddress) || displayNameForId(walletAddress),
      dogeGamePoints: points,
      lifetimePoints: points,
      level: kpLevelForPoints(points),
      updatedAt: balance.updatedAt ?? null,
    };
  });

  return {
    kind: "dogegame-points",
    metric: "dogeGamePoints",
    range,
    entries: rankRows(rows, "dogeGamePoints", limit),
  };
}

export function __setPointsTestHarness(harness) {
  testHarness = harness;
  indexesReady = null;
}
