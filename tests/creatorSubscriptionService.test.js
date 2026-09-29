import test from "node:test";
import assert from "node:assert/strict";
import {
  CREATOR_SUBSCRIPTION_TIERS,
  getCreatorSubscriptionConfig,
  minimumSubscriptionTierForGeneration,
  normalizeEvmAddress
} from "../src/services/creatorSubscriptionService.js";

test("generation quality tiers remain separate from subscription tiers", () => {
  assert.equal(
    minimumSubscriptionTierForGeneration(1),
    CREATOR_SUBSCRIPTION_TIERS.FREE
  );
  assert.equal(
    minimumSubscriptionTierForGeneration(2),
    CREATOR_SUBSCRIPTION_TIERS.PLUS
  );
  assert.equal(
    minimumSubscriptionTierForGeneration(3),
    CREATOR_SUBSCRIPTION_TIERS.PRO
  );
});

test("subscription configuration defaults to the supplied 0G mainnet deployment", () => {
  const config = getCreatorSubscriptionConfig();
  assert.equal(config.chainId, 16661);
  assert.equal(
    config.contractAddress,
    "0x9A37E7c93747bA987D75Af9Ff7864fe59b56019E"
  );
});

test("wallet normalization rejects identities that are not EVM addresses", () => {
  assert.throws(() => normalizeEvmAddress("not-a-wallet"), /valid EVM wallet/);
  assert.equal(
    normalizeEvmAddress("0x9A37E7c93747bA987D75Af9Ff7864fe59b56019E"),
    "0x9A37E7c93747bA987D75Af9Ff7864fe59b56019E"
  );
});
