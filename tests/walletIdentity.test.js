import test from "node:test";
import assert from "node:assert/strict";
import { enrichAuthPayload, requireAuth, signToken } from "../src/services/authService.js";
import { actAsWallet, ownWalletParam } from "../src/middleware/walletIdentity.js";

const WALLET = "0x5e95aa80893ee0fddfbcd051c042ed8f9814568e";

function withSecret(fn) {
  return async () => {
    const original = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-wallet-identity-secret";
    try {
      await fn();
    } finally {
      if (original === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = original;
    }
  };
}

function run(middlewares, request) {
  const response = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  let reached = false;
  const chain = [...middlewares.flat(), () => { reached = true; }];
  const step = (index) => chain[index]?.(request, response, () => step(index + 1));
  step(0);
  return { reached, response };
}

const bearer = (token) => ({ headers: { authorization: `Bearer ${token}` } });

test("the wallet address is the only identity key", () => {
  const auth = enrichAuthPayload({
    userId: WALLET.toUpperCase().replace("0X", "0x"),
    identityAliases: ["did:privy:old", "tg_123"],
  });
  assert.equal(auth.userId, WALLET);
  assert.deepEqual(auth.identityAliases, [WALLET]);
});

test("tokens that are not bound to a wallet are rejected", withSecret(() => {
  const legacy = signToken({ userId: "did:privy:someone" });
  const { reached, response } = run([requireAuth], bearer(legacy));
  assert.equal(reached, false);
  assert.equal(response.statusCode, 401);
}));

test("writes act as the signed-in wallet, not a client-supplied id", withSecret(() => {
  const token = signToken({ userId: WALLET, evmWalletAddress: WALLET });
  const request = { ...bearer(token), body: { userId: "0x0000000000000000000000000000000000000001", gameId: "g1" } };
  const { reached } = run(actAsWallet(), request);
  assert.equal(reached, true);
  assert.equal(request.body.userId, WALLET);
  assert.equal(request.body.gameId, "g1");
}));

test("private routes only serve the caller's own wallet", withSecret(() => {
  const token = signToken({ userId: WALLET, evmWalletAddress: WALLET });
  const other = run(ownWalletParam, { ...bearer(token), params: { userId: "0x0000000000000000000000000000000000000001" } });
  assert.equal(other.reached, false);
  assert.equal(other.response.statusCode, 403);

  const own = run(ownWalletParam, { ...bearer(token), params: { userId: WALLET.toUpperCase().replace("0X", "0x") } });
  assert.equal(own.reached, true);
}));
