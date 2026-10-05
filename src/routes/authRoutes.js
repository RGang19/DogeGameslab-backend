import { Router } from "express";
import { z } from "zod";
import {
  createSignInChallenge,
  getAuthConfig,
  readSignInChallenge,
  signToken,
  verifySignInSignature,
} from "../services/authService.js";
import { consumeSignInNonce } from "../services/signInNonceService.js";
import { attributeNewUser, requestIp } from "../services/referralService.js";
import { logActivityOnChain, ACTIVITY } from "../services/zeroGActivityLog.js";

// DogeOS (0x…) or Dogecoin (D…/n…) address; full validation happens in authService.
const walletAddress = z.string().regex(/^(0x[a-fA-F0-9]{40}|[Dn][1-9A-HJ-NP-Za-km-z]{25,34})$/);

const challengeSchema = z.object({ address: walletAddress }).strict();

const tokenSchema = z
  .object({
    address: walletAddress,
    message: z.string().min(20).max(2000),
    // EVM: 0x-hex personal_sign. Dogecoin: base64 compact signature.
    signature: z.string().regex(/^(0x[a-fA-F0-9]+|[A-Za-z0-9+/]{86,88}={0,2})$/),
  })
  .strict();

// The sign-in message names the site the user is signing in to.
function requestDomain(request) {
  const origin = request.get("origin") || request.get("referer") || "";
  try {
    return new URL(origin).host;
  } catch {
    return request.get("host") || "";
  }
}

export const authRouter = Router();

authRouter.get("/config", (_request, response) => {
  response.json(getAuthConfig());
});

// Issues an application JWT only after the DogeOS wallet has signed a
// server-issued challenge.
function referralCookie(request) {
  const raw = request.headers.cookie || "";
  const match = raw.split(";").map((part) => part.trim()).find((part) => part.startsWith("dogegame_ref="));
  return match ? decodeURIComponent(match.slice("dogegame_ref=".length)) : null;
}

authRouter.post("/challenge", (request, response, next) => {
  try {
    const input = challengeSchema.parse(request.body ?? {});
    response.json(createSignInChallenge({ address: input.address, domain: requestDomain(request) }));
  } catch (error) {
    next(error);
  }
});

authRouter.post("/token", async (request, response, next) => {
  try {
    const input = tokenSchema.parse(request.body ?? {});
    const identity = verifySignInSignature(input);
    const userId = identity.userId;
    // Each signed challenge signs in once: a replayed message is rejected here.
    await consumeSignInNonce({ ...readSignInChallenge(input.message), address: userId });
    // On-chain: log a login/session-start event (0G + DogeOS).
    logActivityOnChain(ACTIVITY.LOGIN, userId);
    await attributeNewUser({
      userId,
      code: referralCookie(request),
      ip: requestIp(request),
    }).catch((error) => {
      // Referral accounting must never block sign-in.
      console.warn("Could not process referral attribution", { message: error.message });
    });
    const token = signToken(identity);
    response.clearCookie("dogegame_ref", { path: "/" });
    response.json({
      token,
      userId,
      evmWalletAddress: identity.evmWalletAddress,
      dogecoinAddress: identity.dogecoinAddress,
      identityAliases: identity.identityAliases,
      expirationDays: getAuthConfig().expirationDays
    });
  } catch (error) {
    next(error);
  }
});
