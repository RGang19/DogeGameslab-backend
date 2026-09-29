import { ethers } from "ethers";
import { getDatabase } from "./databaseService.js";
import { getCreatorSubscriptionConfig } from "./creatorSubscriptionService.js";

const SUBSCRIPTION_EVENTS_COLLECTION =
  process.env.CREATOR_SUBSCRIPTION_EVENTS_COLLECTION || "creator_subscription_events";
const ZERO_G_PAYMENTS_COLLECTION =
  process.env.ZERO_G_PAYMENTS_COLLECTION || "zero_g_generation_payments";

const TIER_NAMES = ["Free Creator", "Creator Plus", "Creator Pro"];

function walletQueryValues(...values) {
  const matches = new Set();
  for (const value of values) {
    const raw = String(value ?? "");
    if (!/^0x[a-fA-F0-9]{40}$/.test(raw)) continue;
    matches.add(raw.toLowerCase());
    try {
      matches.add(ethers.getAddress(raw));
    } catch {
      // ignore invalid checksum variants
    }
  }
  return [...matches];
}

function format0G(weiValue) {
  try {
    return ethers.formatEther(BigInt(String(weiValue ?? "0")));
  } catch {
    return "0";
  }
}

/** Subscription purchases + legacy per-generation 0G payments for the signed-in wallet. */
export async function listPaymentHistoryForUser({ evmWalletAddress, identityAliases = [] }) {
  const wallets = walletQueryValues(evmWalletAddress, ...identityAliases);
  if (wallets.length === 0) return [];

  const database = await getDatabase();
  const config = getCreatorSubscriptionConfig();
  const explorerBase = String(config.explorerUrl ?? "https://chainscan.0g.ai").replace(/\/$/, "");

  const [subscriptionEvents, generationPayments] = await Promise.all([
    database
      .collection(SUBSCRIPTION_EVENTS_COLLECTION)
      .find({ wallet: { $in: wallets } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray(),
    database
      .collection(ZERO_G_PAYMENTS_COLLECTION)
      .find({ payer: { $in: wallets } })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()
  ]);

  const items = [
    ...subscriptionEvents.map((event) => ({
      id: `subscription:${event.txHash}:${event.logIndex ?? 0}`,
      kind: "subscription",
      txHash: event.txHash,
      label: TIER_NAMES[Number(event.tier)] ?? `Subscription tier ${event.tier}`,
      amount0G: format0G(event.costWei),
      periods: Number(event.periods) || 1,
      createdAt: event.createdAt ?? null,
      explorerUrl: `${explorerBase}/tx/${event.txHash}`
    })),
    ...generationPayments.map((payment) => ({
      id: `generation:${payment.txHash}`,
      kind: "generation",
      txHash: payment.txHash,
      label: "Game generation",
      amount0G: format0G(payment.amountWei),
      periods: null,
      createdAt: payment.createdAt ?? null,
      explorerUrl: `${explorerBase}/tx/${payment.txHash}`
    }))
  ];

  return items
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())
    .slice(0, 50);
}
