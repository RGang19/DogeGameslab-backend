import { z } from "zod";
import {
  approveHeldReferral,
  getReferralSummary,
  listHeldReferrals,
  qualifyReferral,
  requestIp,
} from "../services/referralService.js";

const qualifySchema = z.object({
  gameId: z.string().min(1),
  durationSeconds: z.number().positive(),
});

function requestOrigin(request) {
  return process.env.REFERRAL_BASE_URL
    || `${request.protocol}://${request.get("host")}`;
}

function requireReferralAdmin(request, response) {
  const expected = process.env.REFERRAL_ADMIN_KEY;
  if (!expected || request.headers["x-admin-key"] !== expected) {
    response.status(403).json({ error: "Referral admin access required" });
    return false;
  }
  return true;
}

export async function referralMe(request, response, next) {
  try {
    response.json(await getReferralSummary(request.auth.userId, requestOrigin(request)));
  } catch (error) {
    next(error);
  }
}

export async function qualifyFirstGame(request, response, next) {
  try {
    const input = qualifySchema.parse(request.body);
    const result = await qualifyReferral({
      userId: request.auth.userId,
      gameId: input.gameId,
      durationSeconds: input.durationSeconds,
      ip: requestIp(request),
    });
    response.json(result);
  } catch (error) {
    next(error);
  }
}

export async function heldReferrals(request, response, next) {
  if (!requireReferralAdmin(request, response)) return;
  try {
    response.json({ referrals: await listHeldReferrals() });
  } catch (error) {
    next(error);
  }
}

export async function approveReferral(request, response, next) {
  if (!requireReferralAdmin(request, response)) return;
  try {
    const result = await approveHeldReferral(request.params.id);
    if (!result) {
      response.status(404).json({ error: "Held referral not found" });
      return;
    }
    response.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
}
