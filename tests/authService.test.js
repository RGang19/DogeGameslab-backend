import test from "node:test";
import assert from "node:assert/strict";
import { Wallet } from "ethers";
import {
  createSignInChallenge,
  enrichAuthPayload,
  signToken,
  verifySignInSignature,
  verifyToken
} from "../src/services/authService.js";

function withSecret(fn) {
  return async () => {
    const originalSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-sign-in-secret";
    try {
      await fn();
    } finally {
      if (originalSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = originalSecret;
    }
  };
}

test("enrichAuthPayload backfills evmWalletAddress from userId", () => {
  const enriched = enrichAuthPayload({
    userId: "0x5e95aa80893ee0fddfbcd051c042ed8f9814568e",
    evmWalletAddress: null
  });

  assert.equal(enriched.evmWalletAddress, "0x5e95aa80893ee0fddfbcd051c042ed8f9814568e");
});

test("a DogeOS wallet signature over the issued challenge signs the user in", withSecret(async () => {
  const wallet = Wallet.createRandom();
  const challenge = createSignInChallenge({ address: wallet.address, domain: "app.example" });
  const signature = await wallet.signMessage(challenge.message);

  const identity = verifySignInSignature({ address: wallet.address, message: challenge.message, signature });

  assert.equal(identity.userId, wallet.address.toLowerCase());
  assert.equal(identity.evmWalletAddress, wallet.address.toLowerCase());
  assert.match(challenge.message, /Domain: app\.example/);
  assert.match(challenge.message, /Chain ID: 6281971/);
}));

test("a signature from a different wallet is rejected", withSecret(async () => {
  const wallet = Wallet.createRandom();
  const other = Wallet.createRandom();
  const challenge = createSignInChallenge({ address: wallet.address, domain: "app.example" });
  const signature = await other.signMessage(challenge.message);

  assert.throws(
    () => verifySignInSignature({ address: wallet.address, message: challenge.message, signature }),
    /does not match/
  );
}));

test("a tampered challenge is rejected", withSecret(async () => {
  const wallet = Wallet.createRandom();
  const challenge = createSignInChallenge({ address: wallet.address, domain: "app.example" });
  const message = challenge.message.replace("Domain: app.example", "Domain: evil.example");
  const signature = await wallet.signMessage(message);

  assert.throws(
    () => verifySignInSignature({ address: wallet.address, message, signature }),
    /not issued by this server/
  );
}));

test("an expired challenge is rejected", withSecret(async () => {
  const wallet = Wallet.createRandom();
  const realNow = Date.now;
  const challenge = createSignInChallenge({ address: wallet.address, domain: "app.example" });
  const signature = await wallet.signMessage(challenge.message);
  Date.now = () => realNow() + 10 * 60 * 1000;
  try {
    assert.throws(
      () => verifySignInSignature({ address: wallet.address, message: challenge.message, signature }),
      /expired/
    );
  } finally {
    Date.now = realNow;
  }
}));

test("signToken issues a JWT carrying the wallet identity", withSecret(() => {
  const address = "0x5e95aa80893ee0fddfbcd051c042ed8f9814568e";
  const token = signToken({ userId: address, evmWalletAddress: address, identityAliases: [address] });
  const verified = verifyToken(token);
  assert.equal(verified.userId, address);
  assert.equal(verified.evmWalletAddress, address);

  // Re-signing a verified payload must not conflict with the JWT metadata.
  assert.equal(verifyToken(signToken(verified)).evmWalletAddress, address);
}));
