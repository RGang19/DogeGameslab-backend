import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

// On-chain activity logging: every real product action sends one transaction
// to the DogeGameActivityLog contract on EACH configured network — 0G and
// DogeOS — producing a discoverable on-chain footprint on both (readable via
// the contract's `totalActivities` counter and Activity events).
// FIRE-AND-FORGET: logging must never block or break the product flow.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "contracts", "DogeGameActivityLog.abi.json"), "utf8")
);

// Canonical action names — one per real product action.
export const ACTIVITY = {
  LOGIN: "login",
  GAME_GENERATED: "game_generated",
  GAME_EDITED: "game_edited",
  GAME_PUBLISHED: "game_published",
  PLAY_STARTED: "play_started",
  PLAY_QUALIFIED: "play_qualified",
  GAME_COMPLETED: "game_completed",
  SCORE_SUBMITTED: "score_submitted",
  LIKE: "like",
  SHARE: "share",
  FOLLOW: "follow",
  REFERRAL: "referral_attributed",
  POINTS_AWARDED: "points_awarded",
  PAYMENT: "payment",
  ASSET_STORED: "asset_stored"
};

function networkConfigs() {
  return [
    {
      name: "0G",
      enabled: process.env.ZERO_G_ACTIVITY_ENABLED !== "false",
      contract: process.env.ZERO_G_ACTIVITY_CONTRACT?.trim(),
      rpc: process.env.ZERO_G_STORAGE_EVM_RPC || "https://evmrpc.0g.ai",
      privateKey: process.env.ZERO_G_STORAGE_PRIVATE_KEY || process.env.ZERO_G_PRIVATE_KEY
    },
    {
      name: "DogeOS",
      enabled: process.env.DOGEOS_ACTIVITY_ENABLED !== "false",
      contract: process.env.DOGEOS_ACTIVITY_CONTRACT?.trim(),
      rpc: process.env.DOGEOS_RPC_URL || "https://rpc.testnet.dogeos.com/",
      privateKey: process.env.DOGEOS_ACTIVITY_PRIVATE_KEY || process.env.ZERO_G_STORAGE_PRIVATE_KEY || process.env.ZERO_G_PRIVATE_KEY
    }
  ];
}

function isNetworkConfigured(c) {
  return Boolean(c.enabled && c.contract && c.privateKey);
}

export function isActivityLogConfigured() {
  return networkConfigs().some(isNetworkConfigured);
}

// One contract handle and one send queue per network. All log txs on a network
// sign from the SAME wallet, so concurrent sends collide on the nonce
// ("replacement fee too low") — serialize each network through its own chain.
const targets = new Map();

function getTarget(c) {
  if (!isNetworkConfigured(c)) return null;
  const existing = targets.get(c.name);
  if (existing && existing.contractAddr === c.contract && existing.rpc === c.rpc) return existing;
  const provider = new ethers.JsonRpcProvider(c.rpc);
  const wallet = new ethers.Wallet(c.privateKey, provider);
  const target = {
    contract: new ethers.Contract(c.contract, ABI, wallet),
    contractAddr: c.contract,
    rpc: c.rpc,
    queue: existing?.queue ?? Promise.resolve()
  };
  targets.set(c.name, target);
  return target;
}

/**
 * Fire-and-forget: records one on-chain activity event on every configured
 * network (0G and DogeOS). Never throws to callers.
 * @param {string} action one of ACTIVITY.*
 * @param {string|number} refId a reference (gameId, userId, txHash, eventId…)
 */
export function logActivityOnChain(action, refId = "") {
  if (!action) return;
  for (const c of networkConfigs()) {
    const target = getTarget(c);
    if (!target) continue;
    const send = () => target.contract.log(action, String(refId ?? "")).then((tx) => tx.hash);
    target.queue = target.queue.then(
      () => send().catch((error) => {
        console.warn(`${c.name} activity log failed`, { action, message: error.message });
      }),
      () => send().catch(() => undefined)
    );
  }
}

// Reads the on-chain totals per network (handy for a grant dashboard / health check).
export async function getOnChainActivityTotal() {
  const totals = {};
  for (const c of networkConfigs()) {
    const target = getTarget(c);
    if (!target) continue;
    totals[c.name] = Number(await target.contract.totalActivities());
  }
  return Object.keys(totals).length ? totals : null;
}
