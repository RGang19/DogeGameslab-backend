import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAddress, verifyMessage } from "ethers";
import jwt from "jsonwebtoken";

// JWT configuration comes from the environment:
//   JWT_SECRET          — signing secret (required; no insecure default)
//   JWT_EXPIRATION_DAYS — token lifetime in days (default 7)
//
// Sign-in is wallet based: the DogeOS SDK connects the user's DogeOS wallet
// (embedded email/Google/X wallet or an external wallet such as MyDoge), the
// wallet signs a server-issued challenge, and the recovered EVM address becomes
// the account identity.

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error("JWT_SECRET is not configured");
    error.status = 500;
    throw error;
  }
  return secret;
}

function getExpirationDays() {
  const days = Number(process.env.JWT_EXPIRATION_DAYS);
  return Number.isFinite(days) && days > 0 ? days : 7;
}

export function getAuthConfig() {
  return {
    configured: Boolean(process.env.JWT_SECRET),
    expirationDays: getExpirationDays(),
    method: "dogeos-wallet"
  };
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const APP_NAME = process.env.APP_NAME || "DogeGameLab";

function getDogeOSChainId() {
  const chainId = Number(process.env.DOGEOS_CHAIN_ID);
  return Number.isFinite(chainId) && chainId > 0 ? chainId : 6281971;
}

function authError(message, status = 401, code) {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
}

function normalizeEvmAddress(value) {
  try {
    return getAddress(String(value || "").trim());
  } catch {
    throw authError("A valid DogeOS (EVM) wallet address is required", 400, "EVM_WALLET_REQUIRED");
  }
}

function challengeMac(fields) {
  return createHmac("sha256", getJwtSecret()).update(fields.join("|")).digest("hex");
}

function readField(message, label) {
  const match = String(message || "").match(new RegExp(`^${label}: (.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

/**
 * Issues a sign-in message for the wallet to sign. Stateless: the message
 * carries an HMAC over its own fields, so any backend instance can verify it
 * without shared challenge storage.
 */
export function createSignInChallenge({ address, domain }) {
  const normalizedAddress = normalizeEvmAddress(address);
  const host = String(domain || "").trim() || "dogegamelab";
  const chainId = getDogeOSChainId();
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
  const requestId = challengeMac([normalizedAddress, host, chainId, nonce, issuedAt, expiresAt]);
  const message = [
    `${host} wants you to sign in to ${APP_NAME} with your DogeOS wallet.`,
    "",
    "This signature proves you own this wallet. It does not send a transaction or cost any DOGE.",
    "",
    `Address: ${normalizedAddress}`,
    `Domain: ${host}`,
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expires At: ${expiresAt}`,
    `Request ID: ${requestId}`
  ].join("\n");

  return {
    message,
    address: normalizedAddress,
    nonce,
    chainId,
    expiresInSeconds: Math.floor(CHALLENGE_TTL_MS / 1000)
  };
}

/** Verifies a signed sign-in challenge and returns the wallet identity. */
export function verifySignInSignature({ address, message, signature }) {
  const normalizedAddress = normalizeEvmAddress(address);
  const fields = {
    address: readField(message, "Address"),
    domain: readField(message, "Domain"),
    chainId: readField(message, "Chain ID"),
    nonce: readField(message, "Nonce"),
    issuedAt: readField(message, "Issued At"),
    expiresAt: readField(message, "Expires At"),
    requestId: readField(message, "Request ID")
  };
  if (Object.values(fields).some((value) => !value)) {
    throw authError("Sign-in message is malformed. Request a new signature.", 400);
  }

  const expected = challengeMac([
    fields.address,
    fields.domain,
    Number(fields.chainId),
    fields.nonce,
    fields.issuedAt,
    fields.expiresAt
  ]);
  const provided = Buffer.from(fields.requestId, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (provided.length !== expectedBuffer.length || !timingSafeEqual(provided, expectedBuffer)) {
    throw authError("Sign-in message was not issued by this server.", 401);
  }
  if (Date.parse(fields.expiresAt) <= Date.now()) {
    throw authError("Sign-in request expired. Please sign again.", 401, "SIGN_IN_EXPIRED");
  }
  if (fields.address !== normalizedAddress) {
    throw authError("Sign-in message does not match this wallet.", 401);
  }

  let recovered;
  try {
    recovered = getAddress(verifyMessage(message, signature));
  } catch {
    throw authError("Could not verify the wallet signature.", 401);
  }
  if (recovered !== normalizedAddress) {
    throw authError("Wallet signature does not match the address.", 401);
  }

  const walletAddress = normalizedAddress.toLowerCase();
  return {
    userId: walletAddress,
    evmWalletAddress: walletAddress,
    identityAliases: [walletAddress]
  };
}

function normalizeAddress(address) {
  const value = String(address || "").trim();
  if (!value) return null;
  return /^0x[a-fA-F0-9]{40}$/.test(value) ? value.toLowerCase() : value;
}

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;

/**
 * The DogeOS wallet address (lowercase 0x…) is the one primary key for a
 * user's identity. Every signed-in payload is reduced to exactly that key.
 */
export function enrichAuthPayload(payload = {}) {
  const wallet = normalizeAddress(payload.evmWalletAddress ?? payload.userId);
  const walletAddress = wallet && EVM_ADDRESS.test(wallet) ? wallet : null;
  return {
    ...payload,
    userId: walletAddress ?? payload.userId,
    evmWalletAddress: walletAddress,
    identityAliases: walletAddress ? [walletAddress] : []
  };
}

/** Rejects tokens that are not bound to a wallet (e.g. pre-DogeOS sessions). */
function requireWalletIdentity(payload) {
  const auth = enrichAuthPayload(payload);
  if (!auth.evmWalletAddress || auth.userId !== auth.evmWalletAddress) {
    throw authError("Sign in again with your DogeOS wallet.", 401, "WALLET_SIGN_IN_REQUIRED");
  }
  return auth;
}

/** Drop JWT metadata so re-signing a verified token does not conflict with expiresIn. */
function sanitizeTokenPayload(payload = {}) {
  const {
    iat,
    exp,
    nbf,
    aud,
    iss,
    sub,
    ...claims
  } = payload;
  return claims;
}

/** Signs a JWT for the given payload (e.g. { userId }). */
export function signToken(payload) {
  return jwt.sign(sanitizeTokenPayload(enrichAuthPayload(payload)), getJwtSecret(), {
    expiresIn: `${getExpirationDays()}d`
  });
}

/** Verifies a token and returns its payload, or throws a 401 error. */
export function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (cause) {
    const error = new Error(
      cause.name === "TokenExpiredError" ? "Token expired" : "Invalid token",
      { cause }
    );
    error.status = 401;
    throw error;
  }
}

/**
 * Express middleware: requires a valid `Authorization: Bearer <token>` header
 * and attaches the decoded payload as request.auth.
 */
export function requireAuth(request, response, next) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    response.status(401).json({ error: "Authorization token required" });
    return;
  }

  try {
    request.auth = requireWalletIdentity(verifyToken(token));
    next();
  } catch (error) {
    response.status(error.status ?? 401).json({ error: error.message });
  }
}

/**
 * Attaches a verified identity when a Bearer token is present, while allowing
 * genuinely public requests to continue without one.
 */
export function optionalAuth(request, response, next) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;

  if (!token) {
    next();
    return;
  }

  try {
    request.auth = requireWalletIdentity(verifyToken(token));
    next();
  } catch (error) {
    response.status(error.status ?? 401).json({ error: error.message });
  }
}
