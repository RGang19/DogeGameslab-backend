import { countCreatedGamePackagesByCreator } from "./databaseService.js";
import { verifyAndRecordGenerationPayment } from "./zeroGPaymentService.js";
import { normalizeTier } from "./zeroGService.js";
import {
  getCreatorSubscription
} from "./creatorSubscriptionService.js";
import {
  evaluateGenerationQuota,
  getGenerationQuotaStatus
} from "./generationQuotaService.js";

// Reads a non-negative number from env, else the given fallback.
function envPrice(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

// Built-in per-tier defaults, used only when the matching env var is unset.
// Tier 1 is the cheap/entry tier; Tier 3 is premium.
const DEFAULT_0G_PRICE = { 1: 2, 2: 6, 3: 15 };

// Price per generation in 0G. With a tier, prefers PAID_GAME_PRICE_0G_TIER{n},
// then the global PAID_GAME_PRICE_0G, then the built-in tier default.
export function paidGenerationPrice0G(tier) {
  const n = normalizeTier(tier);
  const globalDefault = envPrice("PAID_GAME_PRICE_0G", n ? DEFAULT_0G_PRICE[n] : 2);
  if (!n) return globalDefault;
  return envPrice(`PAID_GAME_PRICE_0G_TIER${n}`, globalDefault);
}

// Built-in per-tier EDITING price defaults (post-creation "wish" edits). 0 =
// free. Editing is free by default; set EDIT_PRICE_0G_TIER{n} to charge per edit.
const DEFAULT_EDIT_0G_PRICE = { 1: 0, 2: 0, 3: 0 };

export function editingPrice0G(tier) {
  const n = normalizeTier(tier) ?? 1;
  return envPrice(`EDIT_PRICE_0G_TIER${n}`, DEFAULT_EDIT_0G_PRICE[n]);
}

// Wallets in UNLIMITED_WALLETS (comma-separated in .env) skip the payment gate
// entirely: unlimited games on any tier, always free. Matching is
// case-insensitive and only checks the AUTHENTICATED wallet identities on the
// request, so it can't be spoofed by typing an address — the caller must have
// signed in with that DogeOS wallet.
function canonicalIdentity(value) {
  const s = String(value || "").trim();
  return s ? s.toLowerCase() : null;
}

function unlimitedWalletSet() {
  return new Set(
    String(process.env.UNLIMITED_WALLETS || "")
      .split(",")
      .map((entry) => canonicalIdentity(entry))
      .filter(Boolean)
  );
}

function hasUnlimitedAccess({ creatorId, creatorAliases, evmWalletAddress }) {
  const allow = unlimitedWalletSet();
  if (allow.size === 0) return false;
  const rawIdentities = [
    creatorId,
    evmWalletAddress,
    ...(Array.isArray(creatorAliases) ? creatorAliases : [])
  ].filter(Boolean);
  const identities = rawIdentities.map((value) => canonicalIdentity(value)).filter(Boolean);
  const matched = identities.some((value) => allow.has(value));
  // Diagnostic: on a MISS, log the exact identity strings the gate saw so the
  // right one can be added to UNLIMITED_WALLETS. Only logs when a whitelist is
  // configured, so it stays quiet in normal operation.
  if (!matched) {
    console.log("[unlimited-wallet] no match — whitelist one of these identities:", rawIdentities);
  }
  return matched;
}

// Payments are always 0G, sent from the user's DogeOS wallet on 0G mainnet.
function buildGenerationMethods({ tier }) {
  const zerog = { method: "0g", currency: "0G", amount: paidGenerationPrice0G(tier) };
  return { chain: zerog, "0g": zerog };
}

function generationAccessError({ existingGames, tier, methods }) {
  const error = new Error(
    `You already generated your free game. Generate another for ${methods.chain.amount} 0G.`
  );
  error.status = 402;
  error.code = "PAID_GENERATION_REQUIRED";
  error.payment = {
    required: true,
    currency: "0G",
    amount: methods.chain.amount,
    tier: normalizeTier(tier),
    existingGames,
    methods
  };
  return error;
}

export async function assertGenerationAccess({
  creatorId,
  creatorAliases,
  paymentTxHash,
  evmWalletAddress,
  tier
}) {
  const amount = paidGenerationPrice0G(tier);
  const normalizedTier = normalizeTier(tier);

  // Whitelisted wallets bypass counting AND payment: unlimited free games, any tier.
  if (hasUnlimitedAccess({ creatorId, creatorAliases, evmWalletAddress })) {
    return {
      free: true,
      currency: "0G",
      amount: 0,
      tier: normalizedTier,
      existingGames: 0,
      unlimited: true
    };
  }

  const ownerIds = Array.isArray(creatorAliases) && creatorAliases.length > 0 ? creatorAliases : creatorId;
  const existingGames = await countCreatedGamePackagesByCreator(ownerIds);

  // Subscription billing replaces the legacy pay-per-generation path. Keep the
  // old per-generation 0G transaction flow available only when explicitly
  // selected for a rollback during deployment.
  if (String(process.env.GENERATION_BILLING_MODE || "subscription").toLowerCase() !== "legacy") {
    const subscriptionState = evmWalletAddress
      ? await getCreatorSubscription(evmWalletAddress)
      : null;
    const quotaDecision = await evaluateGenerationQuota({
      creatorId,
      creatorAliases,
      evmWalletAddress,
      tier,
      subscriptionState
    });
    return {
      free: quotaDecision.source === "free",
      subscription: quotaDecision.source === "credit",
      currency: "0G",
      amount: 0,
      tier: normalizedTier,
      existingGames,
      paymentMethod: quotaDecision.source === "free" ? "free-tier" : "subscription-credit",
      creatorSubscription: subscriptionState,
      quota: quotaDecision.quota,
      quotaSource: quotaDecision.source,
      quotaCreditKey: quotaDecision.creditKey
    };
  }

  if (existingGames < 1) {
    return { free: true, currency: "0G", amount, tier: normalizedTier, existingGames };
  }

  // A zero-priced generation tier is always free.
  if (!amount || amount <= 0) {
    return {
      free: true,
      currency: "0G",
      amount: 0,
      tier: normalizedTier,
      existingGames,
      paymentMethod: "0g",
      zeroPriceTier: true
    };
  }

  const methods = buildGenerationMethods({ tier });
  if (!paymentTxHash) {
    throw generationAccessError({ existingGames, tier, methods });
  }
  const payment = await verifyAndRecordGenerationPayment({
    txHash: paymentTxHash,
    creatorId: evmWalletAddress ?? creatorId,
    amount0G: amount
  });
  return {
    free: false,
    currency: "0G",
    amount,
    tier: normalizedTier,
    existingGames,
    paymentMethod: "0g",
    paymentTxHash,
    payment
  };
}

// Access gate for post-creation EDITS. Independent of generation pricing: uses
// EDIT_PRICE_0G_TIER{n}. When the tier's editing price is 0 (the default)
// editing is free. Whitelisted wallets always edit free. There is no "first
// edit free" rule — the price applies from the first paid edit.
export async function assertEditAccess({
  creatorId,
  creatorAliases,
  paymentTxHash,
  evmWalletAddress,
  tier
}) {
  const amount = editingPrice0G(tier);
  const normalizedTier = normalizeTier(tier) ?? 1;

  if (hasUnlimitedAccess({ creatorId, creatorAliases, evmWalletAddress })) {
    return { free: true, editing: true, currency: "0G", amount: 0, tier: normalizedTier, unlimited: true };
  }

  if (!amount || amount <= 0) {
    return { free: true, editing: true, currency: "0G", amount: 0, tier: normalizedTier };
  }

  if (!paymentTxHash) {
    throw editAccessError({ tier, amount });
  }
  const payment = await verifyAndRecordGenerationPayment({
    txHash: paymentTxHash,
    creatorId: evmWalletAddress ?? creatorId,
    amount0G: amount
  });

  return { free: false, editing: true, currency: "0G", amount, tier: normalizedTier, paymentMethod: "0g", paymentTxHash, payment };
}

// 402 for a paid edit.
function editAccessError({ tier, amount }) {
  const zerog = { method: "0g", currency: "0G", amount };
  const error = new Error(`This edit costs ${amount} 0G.`);
  error.status = 402;
  error.code = "PAID_EDIT_REQUIRED";
  error.payment = {
    required: true,
    editing: true,
    currency: "0G",
    amount,
    tier: normalizeTier(tier),
    methods: { chain: zerog, "0g": zerog }
  };
  return error;
}

export function generationAccessMetadata(generationAccess) {
  return {
    free: generationAccess.free,
    unlimited: generationAccess.unlimited ?? false,
    currency: generationAccess.currency ?? "0G",
    tier: generationAccess.tier ?? null,
    amount: generationAccess.free ? 0 : generationAccess.amount,
    price0G: generationAccess.currency === "0G" && !generationAccess.free ? generationAccess.amount : 0,
    paymentMethod: generationAccess.paymentMethod ?? null,
    subscription: generationAccess.subscription ?? false,
    creatorSubscription: generationAccess.creatorSubscription ?? null,
    quota: generationAccess.quota ?? null,
    quotaSource: generationAccess.quotaSource ?? null,
    quotaCreditKey: generationAccess.quotaCreditKey ?? null,
    paymentTxHash: generationAccess.paymentTxHash ?? null,
    payment: generationAccess.payment ?? null,
    existingGamesBeforeCreate: generationAccess.existingGames
  };
}

export async function fetchGenerationQuotaForAuth({
  creatorId,
  creatorAliases,
  evmWalletAddress
}) {
  return getGenerationQuotaStatus({
    creatorId,
    creatorAliases,
    evmWalletAddress
  });
}
