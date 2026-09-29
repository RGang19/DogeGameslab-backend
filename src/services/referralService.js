import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
import { getDatabase } from "./databaseService.js";
import { logActivity } from "./activityService.js";
import { POINT_VALUES, awardReferralPlay } from "./pointsService.js";
import { recordReferralAttribution } from "./zeroGProvenanceService.js";
import { logActivityOnChain, ACTIVITY } from "./zeroGActivityLog.js";

const VELOCITY_LIMIT = 10;
const VELOCITY_WINDOW_MS = 60 * 60 * 1000;

let indexesReady;

function hashIp(ip) {
  return createHash("sha256")
    .update(`${process.env.REFERRAL_IP_SALT || "kult-referral-v1"}:${ip || "0.0.0.0"}`)
    .digest("hex");
}

export function requestIp(request) {
  const forwarded = request.headers["x-forwarded-for"];
  return String(Array.isArray(forwarded) ? forwarded[0] : forwarded || request.ip || "0.0.0.0")
    .split(",")[0]
    .trim();
}

async function collections() {
  const database = await getDatabase();
  const profiles = database.collection("referral_profiles");
  const attributions = database.collection("referral_attributions");
  const clicks = database.collection("referral_clicks");

  if (!indexesReady) {
    indexesReady = Promise.all([
      profiles.createIndex({ userId: 1 }, { unique: true }),
      profiles.createIndex({ code: 1 }, { unique: true }),
      attributions.createIndex({ referredId: 1 }, { unique: true }),
      attributions.createIndex({ code: 1, createdAt: -1 }),
      attributions.createIndex({ status: 1, createdAt: 1 }),
      clicks.createIndex({ code: 1, createdAt: -1 }),
    ]);
  }
  await indexesReady;
  return { profiles, attributions, clicks };
}

async function createUniqueCode(profiles) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = nanoid(8);
    if (!(await profiles.findOne({ code }))) return code;
  }
  throw new Error("Could not generate a unique referral code");
}

export async function ensureReferralProfile(userId, ip) {
  const { profiles } = await collections();
  const existing = await profiles.findOne({ userId }, { projection: { _id: 0 } });
  if (existing) return { profile: existing, created: false };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const profile = {
      userId,
      code: await createUniqueCode(profiles),
      ipHash: hashIp(ip),
      createdAt: new Date(),
    };
    try {
      await profiles.insertOne(profile);
      return { profile, created: true };
    } catch (error) {
      if (error.code !== 11000) throw error;
      const concurrent = await profiles.findOne({ userId }, { projection: { _id: 0 } });
      if (concurrent) return { profile: concurrent, created: false };
    }
  }
  throw new Error("Could not create referral profile");
}

export async function attributeNewUser({ userId, code, ip }) {
  const { profiles, attributions } = await collections();
  const { created } = await ensureReferralProfile(userId, ip);
  if (!created || !code) return null;

  const referrer = await profiles.findOne({ code }, { projection: { _id: 0 } });
  if (!referrer || referrer.userId === userId) return null;
  if (await attributions.findOne({ referredId: userId })) return null;

  const velocity = await attributions.countDocuments({
    code,
    createdAt: { $gte: new Date(Date.now() - VELOCITY_WINDOW_MS) },
  });
  const attribution = {
    referrerId: referrer.userId,
    referredId: userId,
    code,
    status: velocity >= VELOCITY_LIMIT ? "held" : "pending",
    ipHash: hashIp(ip),
    ...(velocity >= VELOCITY_LIMIT ? { holdReasons: ["velocity"] } : {}),
    createdAt: new Date(),
  };
  try {
    const result = await attributions.insertOne(attribution);
    // 0G: immutable referral attribution record + on-chain event.
    recordReferralAttribution({ userId, referrerId: referrer.userId, referredId: userId, code, status: attribution.status });
    logActivityOnChain(ACTIVITY.REFERRAL, userId);
    return { ...attribution, _id: result.insertedId };
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
}

export async function trackReferralClick({ code, ip, userAgent }) {
  const { clicks } = await collections();
  await clicks.insertOne({
    code,
    ipHash: hashIp(ip),
    userAgent: String(userAgent || "unknown").slice(0, 500),
    createdAt: new Date(),
  });
}

async function issueRewards(attribution, gameId = attribution.qualifiedGameId ?? null) {
  const { attributions } = await collections();
  const attributionId = String(attribution._id);
  const now = new Date();

  const points = await awardReferralPlay({
    referrerId: attribution.referrerId,
    referredId: attribution.referredId,
    attributionId,
    gameId,
  });

  await attributions.updateOne(
    { _id: attribution._id, status: { $ne: "rewarded" } },
    { $set: { status: "rewarded", rewardedAt: now } },
  );
  await logActivity({
    userId: attribution.referrerId,
    gameId,
    activityType: "reward_claim",
    details: `Invite reward claimed: ${POINT_VALUES.referralInviterKp} DP and ${POINT_VALUES.referralInviterCs} CS`
  });
  return {
    status: "rewarded",
    referrerReward: POINT_VALUES.referralInviterKp,
    referredReward: POINT_VALUES.referralFriendKp,
    creatorScoreReward: POINT_VALUES.referralInviterCs,
    points,
  };
}

export async function qualifyReferral({ userId, gameId, durationSeconds }) {
  if (durationSeconds <= 30) return { qualified: false, reason: "duration" };
  const { profiles, attributions } = await collections();
  const attribution = await attributions.findOne({ referredId: userId });
  if (!attribution) return { qualified: false, reason: "not-referred" };
  if (attribution.status === "rewarded") return { qualified: true, status: "rewarded" };
  if (attribution.status === "held") return { qualified: false, status: "held" };

  const referrer = await profiles.findOne({ userId: attribution.referrerId });
  const sameIp = Boolean(referrer?.ipHash && attribution.ipHash && referrer.ipHash === attribution.ipHash);
  const since = new Date(attribution.createdAt.getTime() - VELOCITY_WINDOW_MS);
  const velocity = await attributions.countDocuments({
    code: attribution.code,
    createdAt: { $gte: since, $lte: attribution.createdAt },
  });

  if (sameIp || velocity > VELOCITY_LIMIT) {
    const holdReasons = [sameIp ? "same-ip" : null, velocity > VELOCITY_LIMIT ? "velocity" : null].filter(Boolean);
    await attributions.updateOne(
      { _id: attribution._id, status: "pending" },
      { $set: { status: "held", holdReasons, qualifiedAt: new Date(), qualifiedGameId: gameId } },
    );
    return { qualified: false, status: "held", holdReasons };
  }

  await attributions.updateOne(
    { _id: attribution._id, status: "pending" },
    { $set: { qualifiedAt: new Date(), qualifiedGameId: gameId } },
  );
  return { qualified: true, ...(await issueRewards(attribution, gameId)) };
}

export async function getReferralSummary(userId, origin) {
  const { profile } = await ensureReferralProfile(userId);
  const { attributions } = await collections();
  const count = await attributions.countDocuments({ referrerId: userId, status: "rewarded" });
  return {
    code: profile.code,
    link: `${origin.replace(/\/$/, "")}/r/${profile.code}`,
    count,
    kpEarned: count * POINT_VALUES.referralPlay,
  };
}

export async function listHeldReferrals() {
  const { attributions } = await collections();
  return attributions.find({ status: "held" }).sort({ createdAt: 1 }).toArray();
}

export async function approveHeldReferral(id) {
  const { attributions } = await collections();
  const { ObjectId } = await import("mongodb");
  if (!ObjectId.isValid(id)) return null;
  const attribution = await attributions.findOne({ _id: new ObjectId(id), status: "held" });
  if (!attribution) return null;
  return issueRewards(attribution);
}
