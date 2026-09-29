import { z } from "zod";
import { enrichAuthPayload } from "../services/authService.js";
import { authIdentityAliases } from "../services/identityAliasService.js";
import {
  confirmCreatorSubscription,
  getCreatorSubscription,
  getCreatorSubscriptionTiers,
  quoteCreatorSubscription
} from "../services/creatorSubscriptionService.js";
import { listPaymentHistoryForUser } from "../services/paymentHistoryService.js";

const quoteSchema = z
  .object({
    tier: z.coerce.number().int().min(0).max(2),
    periods: z.coerce.number().int().min(0).max(24)
  })
  .strict();

const confirmSchema = z
  .object({
    txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/)
  })
  .strict();

function authenticatedWallet(request) {
  const wallet = enrichAuthPayload(request.auth ?? {}).evmWalletAddress;
  if (!wallet) {
    const error = new Error("Connect an EVM wallet to manage a Creator subscription");
    error.status = 400;
    error.code = "EVM_WALLET_REQUIRED";
    throw error;
  }
  return wallet;
}

export async function listCreatorSubscriptionTiers(_request, response, next) {
  try {
    response.json(await getCreatorSubscriptionTiers());
  } catch (error) {
    next(error);
  }
}

export async function showMyCreatorSubscription(request, response, next) {
  try {
    response.json({ subscription: await getCreatorSubscription(authenticatedWallet(request)) });
  } catch (error) {
    next(error);
  }
}

export async function quoteMyCreatorSubscription(request, response, next) {
  try {
    const input = quoteSchema.parse(request.body);
    response.json({
      quote: await quoteCreatorSubscription(
        authenticatedWallet(request),
        input.tier,
        input.periods
      )
    });
  } catch (error) {
    next(error);
  }
}

export async function confirmMyCreatorSubscription(request, response, next) {
  try {
    const input = confirmSchema.parse(request.body);
    response.json(
      await confirmCreatorSubscription({
        txHash: input.txHash,
        wallet: authenticatedWallet(request),
        userId: request.auth?.userId
      })
    );
  } catch (error) {
    next(error);
  }
}

export async function listMyCreatorTransactions(request, response, next) {
  try {
    const auth = enrichAuthPayload(request.auth ?? {});
    const transactions = await listPaymentHistoryForUser({
      evmWalletAddress: auth.evmWalletAddress,
      identityAliases: authIdentityAliases(auth)
    });
    response.json({ transactions });
  } catch (error) {
    next(error);
  }
}
