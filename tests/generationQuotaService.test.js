import test from "node:test";
import assert from "node:assert/strict";
import { FAST_LIMIT, PREMIUM_LIMIT, summarizeQuota } from "../src/services/generationQuotaService.js";
import { getEditingModelsForTier, getModelsForTier, normalizeTier } from "../src/services/zeroGService.js";

test("free limits match product defaults", () => {
  assert.equal(FAST_LIMIT, 10);
  assert.equal(PREMIUM_LIMIT, 1);
});

test("summarizeQuota reports what is left on each tier", () => {
  const summary = summarizeQuota({ fastUsed: 3, premiumUsed: 4 });
  assert.deepEqual(summary.used, { fast: 3, premium: 4 });
  assert.deepEqual(summary.remaining, { fast: 7, premium: 0 });
});

test("there are two tiers, and the retired middle tier maps to Premium", () => {
  assert.equal(normalizeTier(1), 1);
  assert.equal(normalizeTier(3), 3);
  assert.equal(normalizeTier(2), 3);
  assert.equal(normalizeTier("tier2"), 3);
  assert.equal(normalizeTier(null), null);
  assert.deepEqual(getEditingModelsForTier(2), getEditingModelsForTier(3));
  assert.equal(getModelsForTier(2).tier, 3);
});
