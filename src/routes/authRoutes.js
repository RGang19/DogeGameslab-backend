import { Router } from "express";
import { z } from "zod";
import {
  createSignInChallenge,
  getAuthConfig,
  signToken,
  verifySignInSignature,
} from "../services/authService.js";
import { attributeNewUser, requestIp } from "../services/referralService.js";
import { logActivityOnChain, ACTIVITY } from "../services/zeroGActivityLog.js";

const evmAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

const challengeSchema = z.object({ address: evmAddress }).strict();

const tokenSchema = z
  .object({
    address: evmAddress,
    message: z.string().min(20).max(2000),
    signature: z.string().regex(/^0x[a-fA-F0-9]+$/),
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
      identityAliases: identity.identityAliases,
      expirationDays: getAuthConfig().expirationDays
    });
  } catch (error) {
    next(error);
  }
});
