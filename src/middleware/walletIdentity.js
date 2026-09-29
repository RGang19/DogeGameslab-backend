import { requireAuth } from "../services/authService.js";

// The signed-in DogeOS wallet address is the one primary key for a user.
// These middlewares make routes act as that wallet, whatever id the client sent.

/**
 * Requires sign-in and overwrites `req.body[field]` with the caller's wallet,
 * so a client can never act as another user.
 */
export function actAsWallet(field = "userId") {
  return [
    requireAuth,
    (request, _response, next) => {
      request.body = { ...(request.body ?? {}), [field]: request.auth.userId };
      next();
    },
  ];
}

/** Attaches the wallet when signed in; anonymous requests carry no identity. */
export function optionalWalletActor(field = "userId") {
  return (request, _response, next) => {
    const body = { ...(request.body ?? {}) };
    if (request.auth?.userId) body[field] = request.auth.userId;
    else delete body[field];
    request.body = body;
    next();
  };
}

/** Private per-user routes: `:userId` must be the caller's own wallet. */
export const ownWalletParam = [
  requireAuth,
  (request, response, next) => {
    if (String(request.params.userId ?? "").toLowerCase() !== request.auth.userId) {
      response.status(403).json({ error: "You can only access your own wallet's data." });
      return;
    }
    request.params.userId = request.auth.userId;
    next();
  },
];
