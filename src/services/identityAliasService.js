function normalizeIdentity(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return /^0x[a-fA-F0-9]{40}$/.test(raw) ? raw.toLowerCase() : raw;
}

// Reduces an identity to a single canonical string for MATCHING only.
function canonicalForMatch(value) {
  const normalized = normalizeIdentity(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function authIdentityAliases(auth) {
  return [
    auth?.userId,
    auth?.evmWalletAddress,
    ...(Array.isArray(auth?.identityAliases) ? auth.identityAliases : [])
  ]
    .map(normalizeIdentity)
    .filter(Boolean);
}

export function authOwnsIdentity(auth, identity) {
  const target = canonicalForMatch(identity);
  if (!target) return false;
  return authIdentityAliases(auth).some((alias) => canonicalForMatch(alias) === target);
}

export function creatorFilterForAuth(auth, requestedCreatorId) {
  const aliases = authIdentityAliases(auth);
  if (aliases.length > 0) return aliases;
  return [normalizeIdentity(requestedCreatorId)].filter(Boolean);
}
