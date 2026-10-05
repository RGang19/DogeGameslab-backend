import { countCreatedGamePackagesByCreator } from "./databaseService.js";
import { normalizeTier } from "./zeroGService.js";
import {
  evaluateGenerationQuota,
  getGenerationQuotaStatus
} from "./generationQuotaService.js";

// Wallets in UNLIMITED_WALLETS (comma-separated in .env) skip the generation
// limits entirely: unlimited games on any tier. Matching is case-insensitive
// and only checks the AUTHENTICATED wallet identities on the request, so it
// can't be spoofed by typing an address — the caller must have signed in with
// that DogeOS wallet.
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

// Gate for a fresh generation. Nothing is charged: a wallet either still has
// games left on the tier, is whitelisted, or gets a 403.
export async function assertGenerationAccess({
  creatorId,
  creatorAliases,
  evmWalletAddress,
  tier
}) {
  const normalizedTier = normalizeTier(tier);

  if (hasUnlimitedAccess({ creatorId, creatorAliases, evmWalletAddress })) {
    return { free: true, tier: normalizedTier, existingGames: 0, unlimited: true };
  }

  const ownerIds = Array.isArray(creatorAliases) && creatorAliases.length > 0 ? creatorAliases : creatorId;
  const [existingGames, decision] = await Promise.all([
    countCreatedGamePackagesByCreator(ownerIds),
    evaluateGenerationQuota({ creatorId, creatorAliases, tier })
  ]);
  return { free: true, tier: normalizedTier, existingGames, quota: decision.quota };
}

// Post-creation edits are free for everyone.
export async function assertEditAccess({ tier }) {
  return { free: true, editing: true, tier: normalizeTier(tier) ?? 1 };
}

export function generationAccessMetadata(generationAccess) {
  return {
    free: true,
    unlimited: generationAccess.unlimited ?? false,
    tier: generationAccess.tier ?? null,
    quota: generationAccess.quota ?? null,
    existingGamesBeforeCreate: generationAccess.existingGames
  };
}

export async function fetchGenerationQuotaForAuth({ creatorId, creatorAliases }) {
  return getGenerationQuotaStatus({ creatorId, creatorAliases });
}
