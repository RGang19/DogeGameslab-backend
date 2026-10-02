import test from "node:test";
import assert from "node:assert/strict";
import { SigningKey, Wallet, concat, encodeBase58, getBytes, ripemd160, sha256 } from "ethers";
import { createSignInChallenge, signToken, verifySignInSignature, requireAuth } from "../src/services/authService.js";
import { dogecoinMessageHash, isDogecoinAddress } from "../src/services/dogecoinSignature.js";

// A minimal Dogecoin wallet: compressed P2PKH address + compact message signatures.
function dogeWallet() {
  const key = new SigningKey(Wallet.createRandom().privateKey);
  const payload = concat([Uint8Array.of(0x1e), getBytes(ripemd160(sha256(key.compressedPublicKey)))]);
  const address = encodeBase58(concat([payload, getBytes(sha256(sha256(payload))).slice(0, 4)]));
  const sign = (message) => {
    const sig = key.sign(dogecoinMessageHash(message));
    const header = 27 + (sig.v - 27) + 4; // compressed key
    return Buffer.from(getBytes(concat([Uint8Array.of(header), getBytes(sig.r), getBytes(sig.s)]))).toString("base64");
  };
  return { address, sign };
}

function withSecret(fn) {
  return async () => {
    const original = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-dogecoin-secret";
    try { await fn(); } finally {
      if (original === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = original;
    }
  };
}

test("a MyDoge-style Dogecoin signature signs the user in with their D… address", withSecret(() => {
  const wallet = dogeWallet();
  assert.ok(isDogecoinAddress(wallet.address));
  const challenge = createSignInChallenge({ address: wallet.address, domain: "dogegamelab.xyz" });
  const identity = verifySignInSignature({ address: wallet.address, message: challenge.message, signature: wallet.sign(challenge.message) });
  assert.equal(identity.userId, wallet.address); // case preserved
  assert.equal(identity.dogecoinAddress, wallet.address);
  assert.equal(identity.evmWalletAddress, null);
}));

test("a Dogecoin signature from another wallet is rejected", withSecret(() => {
  const wallet = dogeWallet();
  const other = dogeWallet();
  const challenge = createSignInChallenge({ address: wallet.address, domain: "dogegamelab.xyz" });
  assert.throws(
    () => verifySignInSignature({ address: wallet.address, message: challenge.message, signature: other.sign(challenge.message) }),
    /does not match/
  );
}));

test("a Dogecoin session token passes requireAuth with the D… address as userId", withSecret(() => {
  const wallet = dogeWallet();
  const challenge = createSignInChallenge({ address: wallet.address, domain: "x" });
  const token = signToken(verifySignInSignature({ address: wallet.address, message: challenge.message, signature: wallet.sign(challenge.message) }));
  const request = { headers: { authorization: `Bearer ${token}` } };
  let passed = false;
  requireAuth(request, { status() { return this; }, json() { return this; } }, () => { passed = true; });
  assert.equal(passed, true);
  assert.equal(request.auth.userId, wallet.address);
}));
