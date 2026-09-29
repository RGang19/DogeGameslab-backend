import { getDatabase } from "./databaseService.js";
import { normalizeTier } from "./zeroGService.js";

const CREATOR_SUBSCRIPTION_TIERS = {
  FREE: 0,
  PLUS: 1,
  PRO: 2
};

function minimumSubscriptionTierForGeneration(generationTier) {
  const tier = Number(generationTier);
  if (tier <= 1) return CREATOR_SUBSCRIPTION_TIERS.FREE;
  return tier >= 3 ? CREATOR_SUBSCRIPTION_TIERS.PRO : CREATOR_SUBSCRIPTION_TIERS.PLUS;
}

const COLLECTION =
  process.env.CREATOR_GENERATION_QUOTAS_COLLECTION || "creator_generation_quotas";

function envLimit(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

export const FREE_HYBRID_LIMIT = envLimit("FREE_HYBRID_GENERATIONS", 10);
export const FREE_PRO_LIMIT = envLimit("FREE_PRO_GENERATIONS", 1);
export const FREE_ULTRA_LIMIT = envLimit("FREE_ULTRA_GENERATIONS", 1);

export const PRO_FIRST_BUNDLE = {
  pro: envLimit("PRO_FIRST_BUNDLE_PRO", 15),
  ultra: envLimit("PRO_FIRST_BUNDLE_ULTRA", 10),
  hybrid: envLimit("PRO_FIRST_BUNDLE_HYBRID", 0)
};

export const PRO_RENEWAL_BUNDLE = {
  pro: envLimit("PRO_RENEWAL_BUNDLE_PRO", 20),
  ultra: envLimit("PRO_RENEWAL_BUNDLE_ULTRA", 0),
  hybrid: envLimit("PRO_RENEWAL_BUNDLE_HYBRID", 10)
};

export const ULTRA_BUNDLE = {
  pro: envLimit("ULTRA_BUNDLE_PRO", 0),
  ultra: envLimit("ULTRA_BUNDLE_ULTRA", 20),
  hybrid: envLimit("ULTRA_BUNDLE_HYBRID", 10)
};

const TIER_LABELS = { 1: "Hybrid", 2: "Pro", 3: "Ultra" };
const SUBSCRIPTION_LABELS = {
  [CREATOR_SUBSCRIPTION_TIERS.PLUS]: "Creator Plus",
  [CREATOR_SUBSCRIPTION_TIERS.PRO]: "Creator Pro"
};

function creditKeyForTier(tier) {
  const n = normalizeTier(tier);
  if (n === 1) return "hybridCredits";
  if (n === 2) return "proCredits";
  if (n === 3) return "ultraCredits";
  return null;
}

function ownerKeyFromContext({ evmWalletAddress, creatorId }) {
  if (evmWalletAddress) return String(evmWalletAddress).toLowerCase();
  if (creatorId) return String(creatorId).toLowerCase();
  return null;
}

async function quotaCollection() {
  const database = await getDatabase();
  const collection = database.collection(COLLECTION);
  await collection.createIndex({ ownerKey: 1 }, { unique: true });
  return collection;
}

export async function getOrCreateQuotaRecord(ownerKey) {
  if (!ownerKey) {
    return {
      ownerKey: null,
      proCredits: 0,
      ultraCredits: 0,
      hybridCredits: 0,
      plusPurchaseCount: 0,
      proPurchaseCount: 0
    };
  }
  const collection = await quotaCollection();
  const existing = await collection.findOne({ ownerKey });
  if (existing) {
    return {
      ownerKey,
      proCredits: Number(existing.proCredits) || 0,
      ultraCredits: Number(existing.ultraCredits) || 0,
      hybridCredits: Number(existing.hybridCredits) || 0,
      plusPurchaseCount: Number(existing.plusPurchaseCount) || 0,
      proPurchaseCount: Number(existing.proPurchaseCount) || 0
    };
  }
  return {
    ownerKey,
    proCredits: 0,
    ultraCredits: 0,
    hybridCredits: 0,
    plusPurchaseCount: 0,
    proPurchaseCount: 0
  };
}

async function countTierGenerations(ownerIds, tier) {
  if (!ownerIds) return 0;
  const database = await getDatabase();
  const collection = database.collection(process.env.MONGODB_COLLECTION || "prompt_creator_studio");
  const filter = {
    creatorId: Array.isArray(ownerIds) ? { $in: ownerIds } : ownerIds,
    tier: { $ne: "template" },
    "generation.qualityTier": normalizeTier(tier),
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
  const [hybridUsed, proUsed, ultraUsed] = await Promise.all([
    countTierGenerations(ownerIds, 1),
    countTierGenerations(ownerIds, 2),
    countTierGenerations(ownerIds, 3)
  ]);
  return {
    hybridUsed,
    proUsed,
    ultraUsed,
    hybridFreeRemaining: Math.max(0, FREE_HYBRID_LIMIT - hybridUsed),
    proFreeRemaining: Math.max(0, FREE_PRO_LIMIT - proUsed),
    ultraFreeRemaining: Math.max(0, FREE_ULTRA_LIMIT - ultraUsed)
  };
}

export function summarizeQuota(usage, credits) {
  return {
    limits: {
      hybridFree: FREE_HYBRID_LIMIT,
      proFree: FREE_PRO_LIMIT,
      ultraFree: FREE_ULTRA_LIMIT
    },
    used: {
      hybrid: usage.hybridUsed,
      pro: usage.proUsed,
      ultra: usage.ultraUsed
    },
    remaining: {
      hybridFree: usage.hybridFreeRemaining,
      proFree: usage.proFreeRemaining,
      ultraFree: usage.ultraFreeRemaining,
      hybridCredits: credits.hybridCredits,
      proCredits: credits.proCredits,
      ultraCredits: credits.ultraCredits
    }
  };
}

function quotaExceededError({
  tier,
  usage,
  credits,
  requiredSubscriptionTier = null,
  repurchaseSubscriptionTier = null
}) {
  const tierNum = normalizeTier(tier);
  const label = TIER_LABELS[tierNum] ?? "this";
  let message;
  if (tierNum === 1) {
    message =
      `You've used all ${FREE_HYBRID_LIMIT} free Hybrid games. Purchase Creator Plus or Creator Pro to unlock more generations, or use Pro/Ultra credits from your plan.`;
  } else if (tierNum === 2) {
    message = credits.proCredits <= 0
      ? `You've used your free Pro game and all Pro credits. Purchase or renew Creator Plus for ${PRO_RENEWAL_BUNDLE.pro} Pro + ${PRO_RENEWAL_BUNDLE.hybrid} Hybrid generations.`
      : `${label} generation requires an active Creator Plus subscription.`;
  } else {
    message = credits.ultraCredits <= 0
      ? `You've used your free Ultra game and all Ultra credits. Purchase or renew Creator Pro for ${ULTRA_BUNDLE.ultra} Ultra + ${ULTRA_BUNDLE.hybrid} Hybrid generations.`
      : `${label} generation requires an active Creator Pro subscription.`;
  }
  const error = new Error(message);
  error.status = 402;
  error.code = "GENERATION_QUOTA_EXCEEDED";
  error.quota = summarizeQuota(usage, credits);
  error.generationTier = tierNum;
  if (requiredSubscriptionTier != null) {
    error.subscription = {
      required: true,
      requiredTier: requiredSubscriptionTier,
      requiredTierName: SUBSCRIPTION_LABELS[requiredSubscriptionTier] ?? "Creator subscription",
      repurchaseTier: repurchaseSubscriptionTier ?? requiredSubscriptionTier
    };
  }
  return error;
}

/**
 * Checks whether the creator can generate at the given quality tier.
 * Free allowances are counted from completed/in-progress game packages.
 * Paid credits live in creator_generation_quotas and are granted on subscription purchase.
 */
export async function evaluateGenerationQuota({
  creatorId,
  creatorAliases,
  evmWalletAddress,
  tier,
  subscriptionState = null
}) {
  const tierNum = normalizeTier(tier) ?? 1;
  const ownerIds = Array.isArray(creatorAliases) && creatorAliases.length > 0 ? creatorAliases : creatorId;
  const ownerKey = ownerKeyFromContext({ evmWalletAddress, creatorId });
  const [usage, credits] = await Promise.all([
    getGenerationUsage(ownerIds),
    getOrCreateQuotaRecord(ownerKey)
  ]);
  const summary = summarizeQuota(usage, credits);

  const freeRemaining =
    tierNum === 1
      ? usage.hybridFreeRemaining
      : tierNum === 2
        ? usage.proFreeRemaining
        : usage.ultraFreeRemaining;

  if (freeRemaining > 0) {
    return {
      allowed: true,
      source: "free",
      creditKey: null,
      tier: tierNum,
      quota: summary
    };
  }

  const creditKey = creditKeyForTier(tierNum);
  if (creditKey && credits[creditKey] > 0) {
    return {
      allowed: true,
      source: "credit",
      creditKey,
      tier: tierNum,
      quota: summary
    };
  }

  const requiredSubTier = minimumSubscriptionTierForGeneration(tierNum);
  const hasPaidSub =
    subscriptionState?.active &&
    Number(subscriptionState.effectiveTier) >= requiredSubTier;

  if (tierNum === 1) {
    const hasAnyPaidSub =
      subscriptionState?.active &&
      Number(subscriptionState.effectiveTier) >= CREATOR_SUBSCRIPTION_TIERS.PLUS;
    if (!hasAnyPaidSub) {
      throw quotaExceededError({
        tier: tierNum,
        usage,
        credits,
        requiredSubscriptionTier: CREATOR_SUBSCRIPTION_TIERS.PLUS,
        repurchaseSubscriptionTier: CREATOR_SUBSCRIPTION_TIERS.PLUS
      });
    }
    throw quotaExceededError({
      tier: tierNum,
      usage,
      credits,
      requiredSubscriptionTier: CREATOR_SUBSCRIPTION_TIERS.PLUS,
      repurchaseSubscriptionTier: CREATOR_SUBSCRIPTION_TIERS.PLUS
    });
  }

  if (!evmWalletAddress) {
    const error = new Error("Connect an EVM wallet and subscribe to generate another game.");
    error.status = 402;
    error.code = "SUBSCRIPTION_REQUIRED";
    error.subscription = {
      required: true,
      walletRequired: true,
      requiredTier: requiredSubTier,
      requiredTierName: SUBSCRIPTION_LABELS[requiredSubTier] ?? "Creator subscription",
      chainId: 16661
    };
    error.quota = summary;
    throw error;
  }

  if (!hasPaidSub) {
    const error = new Error(
      `${SUBSCRIPTION_LABELS[requiredSubTier] ?? "A Creator subscription"} is required for ${TIER_LABELS[tierNum]} mode.`
    );
    error.status = 402;
    error.code = "SUBSCRIPTION_REQUIRED";
    error.subscription = {
      required: true,
      requiredTier: requiredSubTier,
      requiredTierName: SUBSCRIPTION_LABELS[requiredSubTier] ?? "Creator subscription",
      currentTier: subscriptionState?.effectiveTier ?? CREATOR_SUBSCRIPTION_TIERS.FREE,
      currentTierName: subscriptionState?.tierName ?? "Free Creator",
      active: Boolean(subscriptionState?.active),
      expiresAt: subscriptionState?.expiresAt ?? null,
      chainId: 16661
    };
    error.quota = summary;
    throw error;
  }

  throw quotaExceededError({
    tier: tierNum,
    usage,
    credits,
    requiredSubscriptionTier: requiredSubTier,
    repurchaseSubscriptionTier: requiredSubTier
  });
}

export async function consumeGenerationQuota({ evmWalletAddress, creatorId, creditKey }) {
  if (!creditKey) return null;
  const ownerKey = ownerKeyFromContext({ evmWalletAddress, creatorId });
  if (!ownerKey) return null;
  const collection = await quotaCollection();
  const field = creditKey;
  const result = await collection.findOneAndUpdate(
    { ownerKey, [field]: { $gt: 0 } },
    { $inc: { [field]: -1 }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" }
  );
  return result ?? null;
}

export async function grantSubscriptionGenerationCredits(wallet, subscriptionTier) {
  const ownerKey = String(wallet || "").toLowerCase();
  if (!ownerKey) return null;

  const tier = Number(subscriptionTier);
  if (tier === CREATOR_SUBSCRIPTION_TIERS.PLUS) {
    const existing = await getOrCreateQuotaRecord(ownerKey);
    const bundle =
      existing.plusPurchaseCount === 0 ? PRO_FIRST_BUNDLE : PRO_RENEWAL_BUNDLE;
    const collection = await quotaCollection();
    await collection.updateOne(
      { ownerKey },
      {
        $inc: {
          proCredits: bundle.pro,
          ultraCredits: bundle.ultra,
          hybridCredits: bundle.hybrid,
          plusPurchaseCount: 1
        },
        $set: { updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date(), proPurchaseCount: 0 }
      },
      { upsert: true }
    );
    return {
      ownerKey,
      subscriptionTier: tier,
      granted: bundle,
      firstPlusPurchase: existing.plusPurchaseCount === 0
    };
  }

  if (tier === CREATOR_SUBSCRIPTION_TIERS.PRO) {
    const collection = await quotaCollection();
    await collection.updateOne(
      { ownerKey },
      {
        $inc: {
          ultraCredits: ULTRA_BUNDLE.ultra,
          hybridCredits: ULTRA_BUNDLE.hybrid,
          proPurchaseCount: 1
        },
        $set: { updatedAt: new Date() },
        $setOnInsert: {
          createdAt: new Date(),
          proCredits: 0,
          ultraCredits: 0,
          hybridCredits: 0,
          plusPurchaseCount: 0
        }
      },
      { upsert: true }
    );
    return {
      ownerKey,
      subscriptionTier: tier,
      granted: ULTRA_BUNDLE,
      firstPlusPurchase: false
    };
  }

  return null;
}

export async function getGenerationQuotaStatus({ creatorId, creatorAliases, evmWalletAddress }) {
  const ownerIds = Array.isArray(creatorAliases) && creatorAliases.length > 0 ? creatorAliases : creatorId;
  const ownerKey = ownerKeyFromContext({ evmWalletAddress, creatorId });
  const [usage, credits] = await Promise.all([
    getGenerationUsage(ownerIds),
    getOrCreateQuotaRecord(ownerKey)
  ]);
  return summarizeQuota(usage, credits);
}
