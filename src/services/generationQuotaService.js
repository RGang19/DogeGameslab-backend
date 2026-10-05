import { getDatabase } from "./databaseService.js";
import { normalizeTier } from "./zeroGService.js";

// Generation is free. Each wallet gets a fixed number of games per tier, set
// from .env; there is nothing to buy. Wallets in UNLIMITED_WALLETS skip the
// limits (see generationAccessService).
function envLimit(names, fallback) {
  for (const name of names) {
    const raw = process.env[name];
    if (raw === undefined || raw === "") continue;
    const value = Number(raw);
    if (Number.isInteger(value) && value >= 0) return value;
  }
  return fallback;
}

export const FAST_LIMIT = envLimit(["FREE_FAST_GENERATIONS", "FREE_HYBRID_GENERATIONS"], 10);
export const PREMIUM_LIMIT = envLimit(["FREE_PREMIUM_GENERATIONS", "FREE_ULTRA_GENERATIONS"], 1);

const TIER_LABELS = { 1: "Fast", 3: "Premium" };
const TIER_LIMITS = { 1: FAST_LIMIT, 3: PREMIUM_LIMIT };

async function countTierGenerations(ownerIds, tier) {
  if (!ownerIds) return 0;
  const database = await getDatabase();
  const collection = database.collection(process.env.MONGODB_COLLECTION || "prompt_creator_studio");
  const filter = {
    creatorId: Array.isArray(ownerIds) ? { $in: ownerIds } : ownerIds,
    tier: { $ne: "template" },
    "generation.qualityTier": tier,
    $or: [
      { buildStatus: { $in: ["ready", "building"] } },
      {
        buildStatus: { $exists: false },
        $or: [
          { "refinement.generatedCode": { $type: "string" } },
          { templateId: { $ne: "pure-agent" } }
        ]
      }
    ]
  };
  return collection.countDocuments(filter);
}

export async function getGenerationUsage(ownerIds) {
  const [fastUsed, premiumUsed] = await Promise.all([
    countTierGenerations(ownerIds, 1),
    countTierGenerations(ownerIds, 3)
  ]);
  return { fastUsed, premiumUsed };
}

export function summarizeQuota(usage) {
  return {
    limits: { fast: FAST_LIMIT, premium: PREMIUM_LIMIT },
    used: { fast: usage.fastUsed, premium: usage.premiumUsed },
    remaining: {
      fast: Math.max(0, FAST_LIMIT - usage.fastUsed),
      premium: Math.max(0, PREMIUM_LIMIT - usage.premiumUsed)
    }
  };
}

function ownerIdsFrom({ creatorId, creatorAliases }) {
  return Array.isArray(creatorAliases) && creatorAliases.length > 0 ? creatorAliases : creatorId;
}

/**
 * Checks whether the creator can generate at the given tier. Usage is counted
 * from the creator's completed and in-progress games. Throws a 403 with code
 * GENERATION_LIMIT_REACHED when the tier's allowance is used up.
 */
export async function evaluateGenerationQuota({ creatorId, creatorAliases, tier }) {
  const tierNum = normalizeTier(tier) ?? 1;
  const usage = await getGenerationUsage(ownerIdsFrom({ creatorId, creatorAliases }));
  const quota = summarizeQuota(usage);
  const remaining = tierNum === 1 ? quota.remaining.fast : quota.remaining.premium;
  if (remaining > 0) return { allowed: true, tier: tierNum, quota };

  const label = TIER_LABELS[tierNum];
  const limit = TIER_LIMITS[tierNum];
  const error = new Error(
    `You've used all ${limit} free ${label} game${limit === 1 ? "" : "s"}.`
  );
  error.status = 403;
  error.code = "GENERATION_LIMIT_REACHED";
  error.quota = quota;
  error.generationTier = tierNum;
  throw error;
}

export async function getGenerationQuotaStatus({ creatorId, creatorAliases }) {
  return summarizeQuota(await getGenerationUsage(ownerIdsFrom({ creatorId, creatorAliases })));
}
