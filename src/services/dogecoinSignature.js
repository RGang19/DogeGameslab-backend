import { Signature, SigningKey, concat, decodeBase58, encodeBase58, getBytes, ripemd160, sha256, toBeHex, toUtf8Bytes, zeroPadValue } from "ethers";

// Dogecoin "signed message" support (the format MyDoge's requestSignedMessage
// produces): base64 65-byte compact signature over
// sha256(sha256("\x19Dogecoin Signed Message:\n" + varint(len) + message)).

const MESSAGE_MAGIC = "\x19Dogecoin Signed Message:\n";
// Base58Check version bytes: 0x1e = mainnet P2PKH ("D…"), 0x71 = testnet ("n…").
const P2PKH_VERSIONS = new Set([0x1e, 0x71]);

const DOGECOIN_ADDRESS = /^[Dn][1-9A-HJ-NP-Za-km-z]{25,34}$/;

function doubleSha256(bytes) {
  return getBytes(sha256(sha256(bytes)));
}

function varint(n) {
  if (n < 0xfd) return Uint8Array.of(n);
  if (n <= 0xffff) return Uint8Array.of(0xfd, n & 0xff, n >> 8);
  return Uint8Array.of(0xfe, n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >>> 24) & 0xff);
}

function base58ToBytes(value) {
  const hex = toBeHex(decodeBase58(value));
  const leadingZeros = value.match(/^1*/)[0].length;
  return concat([new Uint8Array(leadingZeros), getBytes(hex)]);
}

/** True for a well-formed Dogecoin P2PKH address with a valid checksum. */
export function isDogecoinAddress(value) {
  const address = String(value || "").trim();
  if (!DOGECOIN_ADDRESS.test(address)) return false;
  try {
    const bytes = getBytes(base58ToBytes(address));
    if (bytes.length !== 25 || !P2PKH_VERSIONS.has(bytes[0])) return false;
    const checksum = doubleSha256(bytes.slice(0, 21)).slice(0, 4);
    return checksum.every((byte, index) => byte === bytes[21 + index]);
  } catch {
    return false;
  }
}

export function dogecoinMessageHash(message) {
  const magic = toUtf8Bytes(MESSAGE_MAGIC);
  const body = toUtf8Bytes(message);
  return doubleSha256(concat([magic, varint(body.length), body]));
}

function pubkeyToAddress(publicKeyHex, version) {
  const payload = concat([Uint8Array.of(version), getBytes(ripemd160(sha256(publicKeyHex)))]);
  const checksum = doubleSha256(payload).slice(0, 4);
  return encodeBase58(concat([payload, checksum]));
}

const BITCOIN_MAGIC = "\x18Bitcoin Signed Message:\n";

function messageHashWith(magic, message) {
  const body = toUtf8Bytes(message);
  return doubleSha256(concat([toUtf8Bytes(magic), varint(body.length), body]));
}

/** All plausible decodings of a wallet's signature string into 65 raw bytes. */
function decodeSignatureCandidates(signature) {
  const text = String(signature || "").trim();
  const out = [];
  const push = (bytes) => { if (bytes?.length === 65) out.push(bytes); };
  if (/^(0x)?[0-9a-fA-F]{130}$/.test(text)) push(getBytes(text.startsWith("0x") ? text : `0x${text}`));
  const once = new Uint8Array(Buffer.from(text, "base64"));
  push(once);
  // Some wallets base64-encode an already base64 signature.
  const inner = Buffer.from(once).toString("utf8").trim();
  if (/^[A-Za-z0-9+/]{86,88}={0,2}$/.test(inner)) push(new Uint8Array(Buffer.from(inner, "base64")));
  return out;
}

function recoverWithHash(hash, sig, version) {
  const header = sig[0];
  if (header < 27 || header > 42) return null;
  const recoveryId = (header - 27) & 3;
  const compressed = header >= 31;
  try {
    const publicKey = SigningKey.recoverPublicKey(
      hash,
      Signature.from({ r: zeroPadValue(sig.slice(1, 33), 32), s: zeroPadValue(sig.slice(33, 65), 32), v: 27 + recoveryId })
    );
    return [compressed, !compressed].map((c) => pubkeyToAddress(SigningKey.computePublicKey(publicKey, c), version));
  } catch {
    return null;
  }
}

/**
 * Recovers the Dogecoin address that signed `message`. Tries the standard
 * Dogecoin format first, then common wallet variations (hex or double-base64
 * encoding, Bitcoin message prefix). Returns the address only if it matches
 * `expected` (when given), else the standard recovery result or null.
 */
export function recoverDogecoinAddress(message, signature, version = 0x1e, expected = null) {
  const sigs = decodeSignatureCandidates(signature);
  const hashes = [messageHashWith(MESSAGE_MAGIC, message), messageHashWith(BITCOIN_MAGIC, message)];
  let first = null;
  for (const hash of hashes) {
    for (const sig of sigs) {
      const candidates = recoverWithHash(hash, sig, version);
      if (!candidates) continue;
      first ??= candidates[0];
      if (!expected) return candidates[0];
      if (candidates.includes(expected)) return expected;
    }
  }
  return first;
}

/** Diagnostics for a failed Dogecoin signature (logged server-side, never secrets). */
export function describeDogecoinSignature(signature) {
  const text = String(signature || "");
  const sigs = decodeSignatureCandidates(text);
  return {
    length: text.length,
    looksBase64: /^[A-Za-z0-9+/]+={0,2}$/.test(text),
    looksHex: /^(0x)?[0-9a-fA-F]+$/.test(text),
    decodedLengths: sigs.length ? sigs.map((s) => s.length) : [Buffer.from(text, "base64").length],
    header: sigs[0]?.[0] ?? null,
    preview: `${text.slice(0, 12)}…${text.slice(-6)}`,
  };
}

/** Version byte of a Dogecoin address (mainnet D… vs testnet n…). */
export function dogecoinAddressVersion(address) {
  return getBytes(base58ToBytes(address))[0];
}
