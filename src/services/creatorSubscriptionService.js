import { readFileSync } from "node:fs";
import { ethers } from "ethers";
import { getDatabase } from "./databaseService.js";
import { grantSubscriptionGenerationCredits } from "./generationQuotaService.js";

const ABI = JSON.parse(
  readFileSync(new URL("../../contracts/creator-subscription.json", import.meta.url), "utf8")
);

export const CREATOR_SUBSCRIPTION_TIERS = {
  FREE: 0,
  PLUS: 1,
  PRO: 2
};

const TIER_NAMES = ["Free Creator", "Creator Plus", "Creator Pro"];
const DEFAULT_CONTRACT_ADDRESS = "0x9A37E7c93747bA987D75Af9Ff7864fe59b56019E";
const NO_EXPIRY = 2n ** 64n - 1n;
function rpcUrl() {
  return (
    process.env.ZEROG_EVM_RPC_MAINNET ||
    process.env.ZERO_G_MAINNET_RPC_URL ||
    process.env.ZERO_G_PAYMENT_RPC_URL ||
    "https://evmrpc.0g.ai"
  );
}

export function getCreatorSubscriptionConfig() {
  return {
    chainId: Number(process.env.ZEROG_CHAIN_ID_MAINNET || 16661),
    rpcUrl: rpcUrl(),
    contractAddress:
      process.env.CREATOR_SUBSCRIPTION_ADDRESS || DEFAULT_CONTRACT_ADDRESS,
    explorerUrl: "https://chainscan.0g.ai"
  };
}

let provider;
function getProvider() {
  if (!provider) {
    const config = getCreatorSubscriptionConfig();
    provider = new ethers.JsonRpcProvider(config.rpcUrl, {
      chainId: config.chainId,
      name: "0g-mainnet"
    });
  }
  return provider;
}

function contract() {
  const config = getCreatorSubscriptionConfig();
  return new ethers.Contract(config.contractAddress, ABI, getProvider());
}

export function normalizeEvmAddress(value, field = "Wallet") {
  try {
    return ethers.getAddress(String(value || ""));
  } catch {
    const error = new Error(`${field} must be a valid EVM wallet address`);
    error.status = 400;
    error.code = "EVM_WALLET_REQUIRED";
    throw error;
  }
}

function asDate(timestamp) {
  return timestamp === 0n || timestamp === NO_EXPIRY
    ? null
    : new Date(Number(timestamp) * 1000);
}

export async function getCreatorSubscription(wallet) {
  const account = normalizeEvmAddress(wallet);
  const state = await contract().subscriptionOf(account);
  const storedTier = Number(state.tier);
  const effectiveTier = state.active ? storedTier : CREATOR_SUBSCRIPTION_TIERS.FREE;
  return {
    wallet: account,
    tier: storedTier,
    tierName: TIER_NAMES[effectiveTier],
    effectiveTier,
    active: Boolean(state.active),
    startedAt: asDate(state.startedAt),
    expiresAt: asDate(state.expiresAt),
    renewals: Number(state.renewals),
    autoRenew: Boolean(state.autoRenew),
    creditWei: state.creditBalance.toString(),
    credit0G: ethers.formatEther(state.creditBalance)
  };
}

export async function getCreatorSubscriptionTiers() {
  const config = getCreatorSubscriptionConfig();
  const prices = await contract().allTierPrices();
  return {
    ...config,
    periodDays: 30,
    tiers: prices.map((price, tier) => ({
      tier,
      name: TIER_NAMES[tier],
      priceWei: price.toString(),
      price0G: ethers.formatEther(price)
    }))
  };
}

function validatePurchase(tier, periods) {
  const normalizedTier = Number(tier);
  const normalizedPeriods = Number(periods);
  if (![0, 1, 2].includes(normalizedTier)) {
    const error = new Error("Subscription tier must be Free, Plus, or Pro");
    error.status = 400;
    throw error;
  }
  if (!Number.isInteger(normalizedPeriods) || normalizedPeriods < 0 || normalizedPeriods > 24) {
    const error = new Error("Subscription periods must be between 0 and 24");
    error.status = 400;
    throw error;
  }
  if (normalizedTier === 0 && normalizedPeriods !== 0) {
    const error = new Error("Free Creator does not take a billing period");
    error.status = 400;
    throw error;
  }
  if (normalizedTier > 0 && normalizedPeriods < 1) {
    const error = new Error("Paid subscriptions require at least one period");
    error.status = 400;
    throw error;
  }
  return { tier: normalizedTier, periods: normalizedPeriods };
}

export async function quoteCreatorSubscription(wallet, tier, periods) {
  const account = normalizeEvmAddress(wallet);
  const purchase = validatePurchase(tier, periods);
  const subscription = contract();
  const [quote, expiresAt] = await Promise.all([
    subscription.quote(account, purchase.tier, purchase.periods),
    subscription.previewExpiry(account, purchase.tier, purchase.periods)
  ]);
  return {
    wallet: account,
    ...purchase,
    costWei: quote.cost.toString(),
    cost0G: ethers.formatEther(quote.cost),
    creditWei: quote.creditBalance.toString(),
    credit0G: ethers.formatEther(quote.creditBalance),
    dueNowWei: quote.dueNow.toString(),
    dueNow0G: ethers.formatEther(quote.dueNow),
    newExpiresAt: asDate(expiresAt)
  };
}

async function collections() {
  const database = await getDatabase();
  const subscriptions = database.collection(
    process.env.CREATOR_SUBSCRIPTIONS_COLLECTION || "creator_subscriptions"
  );
  const events = database.collection(
    process.env.CREATOR_SUBSCRIPTION_EVENTS_COLLECTION || "creator_subscription_events"
  );
  await Promise.all([
    subscriptions.createIndex({ wallet: 1 }, { unique: true }),
    events.createIndex({ txHash: 1, logIndex: 1 }, { unique: true })
  ]);
  return { subscriptions, events };
}

export async function syncCreatorSubscription(wallet, userId = null) {
  const state = await getCreatorSubscription(wallet);
  const { subscriptions } = await collections();
  await subscriptions.updateOne(
    { wallet: state.wallet.toLowerCase() },
    {
      $set: {
        ...state,
        wallet: state.wallet.toLowerCase(),
        ...(userId ? { userId } : {}),
        syncedAt: new Date()
      },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
  return state;
}

export async function confirmCreatorSubscription({ txHash, wallet, userId }) {
  if (!/^0x[a-fA-F0-9]{64}$/.test(String(txHash || ""))) {
    const error = new Error("A valid subscription transaction hash is required");
    error.status = 400;
    throw error;
  }
  const account = normalizeEvmAddress(wallet);
  const config = getCreatorSubscriptionConfig();
  const receipt = await getProvider().getTransactionReceipt(txHash);
  if (!receipt) {
    const error = new Error("Subscription transaction is not confirmed yet");
    error.status = 409;
    error.code = "SUBSCRIPTION_NOT_CONFIRMED";
    throw error;
  }
  if (receipt.status !== 1) {
    const error = new Error("Subscription transaction failed on-chain");
    error.status = 402;
    error.code = "SUBSCRIPTION_TRANSACTION_FAILED";
    throw error;
  }

  const iface = new ethers.Interface(ABI);
  let subscribedEvent = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== config.contractAddress.toLowerCase()) continue;
    try {
      const parsed = iface.parseLog({ topics: [...log.topics], data: log.data });
      if (parsed?.name === "Subscribed") {
        if (parsed.args.account.toLowerCase() !== account.toLowerCase()) {
          const error = new Error("Subscription transaction belongs to a different wallet");
          error.status = 403;
          error.code = "SUBSCRIPTION_WALLET_MISMATCH";
          throw error;
        }
        subscribedEvent = { parsed, log };
        break;
      }
    } catch (error) {
      if (error?.code === "SUBSCRIPTION_WALLET_MISMATCH") throw error;
    }
  }
  if (!subscribedEvent) {
    const error = new Error("Transaction does not contain a subscription purchase");
    error.status = 400;
    error.code = "SUBSCRIPTION_EVENT_MISSING";
    throw error;
  }

  const { events } = await collections();
  const { parsed, log } = subscribedEvent;
  await events.updateOne(
    { txHash: receipt.hash.toLowerCase(), logIndex: log.index },
    {
      $setOnInsert: {
        wallet: account.toLowerCase(),
        userId,
        eventName: "Subscribed",
        tier: Number(parsed.args.tier),
        periods: Number(parsed.args.periods),
        costWei: parsed.args.cost.toString(),
        expiresAt: asDate(parsed.args.expiresAt),
        gasless: Boolean(parsed.args.gasless),
        payer: String(parsed.args.payer).toLowerCase(),
        txHash: receipt.hash.toLowerCase(),
        blockNumber: receipt.blockNumber,
        logIndex: log.index,
        createdAt: new Date()
      }
    },
    { upsert: true }
  );

  const purchasedTier = Number(parsed.args.tier);
  const creditGrant =
    purchasedTier > CREATOR_SUBSCRIPTION_TIERS.FREE
      ? await grantSubscriptionGenerationCredits(account, purchasedTier)
      : null;

  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    subscription: await syncCreatorSubscription(account, userId),
    generationCredits: creditGrant
  };
}

export function minimumSubscriptionTierForGeneration(generationTier) {
  const tier = Number(generationTier);
  if (tier <= 1) return CREATOR_SUBSCRIPTION_TIERS.FREE;
  return tier >= 3
    ? CREATOR_SUBSCRIPTION_TIERS.PRO
    : CREATOR_SUBSCRIPTION_TIERS.PLUS;
}

export async function requireCreatorSubscription(wallet, generationTier) {
  const requiredTier = minimumSubscriptionTierForGeneration(generationTier);
  const state = await getCreatorSubscription(wallet);
  if (state.effectiveTier < requiredTier) {
    const error = new Error(
      `${TIER_NAMES[requiredTier]} is required for this generation mode.`
    );
    error.status = 402;
    error.code = "SUBSCRIPTION_REQUIRED";
    error.subscription = {
      required: true,
      requiredTier,
      requiredTierName: TIER_NAMES[requiredTier],
      currentTier: state.effectiveTier,
      currentTierName: state.tierName,
      active: state.active,
      expiresAt: state.expiresAt,
      contractAddress: getCreatorSubscriptionConfig().contractAddress,
      chainId: getCreatorSubscriptionConfig().chainId
    };
    throw error;
  }
  return state;
}
