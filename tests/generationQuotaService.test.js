import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_HYBRID_LIMIT,
  FREE_PRO_LIMIT,
  FREE_ULTRA_LIMIT,
  PRO_FIRST_BUNDLE,
  PRO_RENEWAL_BUNDLE,
  ULTRA_BUNDLE,
  summarizeQuota
} from "../src/services/generationQuotaService.js";

test("free tier limits match product defaults", () => {
  assert.equal(FREE_HYBRID_LIMIT, 10);
  assert.equal(FREE_PRO_LIMIT, 1);
  assert.equal(FREE_ULTRA_LIMIT, 1);
});

test("subscription bundles match product defaults", () => {
  assert.deepEqual(PRO_FIRST_BUNDLE, { pro: 15, ultra: 10, hybrid: 0 });
  assert.deepEqual(PRO_RENEWAL_BUNDLE, { pro: 20, ultra: 0, hybrid: 10 });
  assert.deepEqual(ULTRA_BUNDLE, { pro: 0, ultra: 20, hybrid: 10 });
});

test("summarizeQuota exposes remaining free and paid credits", () => {
  const summary = summarizeQuota(
    {
      hybridUsed: 3,
      proUsed: 1,
      ultraUsed: 0,
      hybridFreeRemaining: 7,
      proFreeRemaining: 0,
      ultraFreeRemaining: 1
    },
    {
      proCredits: 15,
      ultraCredits: 10,
      hybridCredits: 0
    }
  );
  assert.equal(summary.remaining.hybridFree, 7);
  assert.equal(summary.remaining.proFree, 0);
  assert.equal(summary.remaining.ultraFree, 1);
  assert.equal(summary.remaining.proCredits, 15);
});
