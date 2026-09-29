import { putJsonOnZeroG } from "./zeroGStorage.js";

// Immutable provenance records on 0G Storage. Every helper is FIRE-AND-FORGET:
// provenance must never block, slow, or break the main flow, so failures are
// swallowed with a warning. Each record's hash (content + 0G root + tx) lands in
// the zero_g_storage_objects collection like every other stored object.
function record(objectType, objectId, data, metadata = {}) {
  if (!objectId) return;
  void putJsonOnZeroG({ objectType, objectId: String(objectId), data, metadata }).catch((error) => {
    console.warn(`0G provenance store failed (${objectType})`, { message: error.message });
  });
}

function nowIso() {
  return new Date().toISOString();
}

// 1) Payment receipts — who paid, how much, in what, for which game.
export function recordPaymentReceipt({ creatorId, gameId, tier, access }) {
  if (!access || access.free) return;
  const ref = access.paymentTxHash ?? Date.now();
  const method = access.paymentMethod ?? "0g";
  record("payment-receipt", `${gameId ?? "generation"}-${ref}`, {
    creatorId: creatorId ?? null,
    gameId: gameId ?? null,
    tier: tier ?? access.tier ?? null,
    kind: access.editing ? "edit" : "generation",
    method,
    currency: access.currency ?? null,
    amount: access.amount ?? null,
    paymentTxHash: access.paymentTxHash ?? null,
    recordedAt: nowIso()
  }, { creatorId: creatorId ?? null, gameId: gameId ?? null });
}

// 2) Game version history — every build/edit that produced code.
export function recordGameVersion({ game, refinement, kind }) {
  if (!game?.id || !refinement?.generatedCode) return;
  record("game-version", `${game.id}-${refinement.jobId ?? Date.now()}`, {
    gameId: game.id,
    title: game.title ?? null,
    kind: kind ?? "build",
    tier: game.generation?.qualityTier ?? null,
    source: refinement.source ?? null,
    model: refinement.model ?? null,
    generatedCode: refinement.generatedCode,
    codeLength: refinement.generatedCode.length,
    recordedAt: nowIso()
  }, { gameId: game.id });
}

// 3) Published-build snapshot — a pinned, immutable copy at publish time.
export function recordPublishedSnapshot({ game }) {
  if (!game?.id) return;
  record("published-snapshot", `${game.id}-${game.publish?.publishedAt ? new Date(game.publish.publishedAt).getTime() : Date.now()}`, {
    gameId: game.id,
    title: game.title ?? null,
    creatorId: game.creatorId ?? null,
    tier: game.generation?.qualityTier ?? null,
    publishedAt: game.publish?.publishedAt ?? nowIso(),
    generatedCode: game.refinement?.generatedCode ?? null,
    package: game,
    recordedAt: nowIso()
  }, { gameId: game.id, creatorId: game.creatorId ?? null });
}

// 4) Generation provenance — prompt + tier + models that made a game.
export function recordGenerationProvenance({ game }) {
  const gen = game?.generation;
  if (!game?.id || !gen) return;
  record("generation-provenance", `${game.id}-${gen.generationId ?? Date.now()}`, {
    gameId: game.id,
    prompt: gen.prompt ?? null,
    tier: gen.qualityTier ?? null,
    strategy: gen.strategy ?? null,
    routingModel: gen.routingModel ?? null,
    planModel: gen.planModel ?? null,
    codeModel: gen.codeModel ?? null,
    imageModel: gen.imageModel ?? null,
    selection: gen.selection ?? null,
    generationId: gen.generationId ?? null,
    recordedAt: nowIso()
  }, { gameId: game.id });
}

// 5a) Reference image analysis used during generation.
export function recordReferenceInput({ creatorId, prompt, imageUrl, hasImageData, analysis }) {
  record("reference-input", `ref-${creatorId ?? "anon"}-${Date.now()}`, {
    creatorId: creatorId ?? null,
    prompt: prompt ?? null,
    imageUrl: imageUrl ?? null,
    hasImageData: Boolean(hasImageData),
    analysis: analysis ?? null,
    recordedAt: nowIso()
  }, { creatorId: creatorId ?? null });
}

// 5b) Voice input transcription used during generation.
export function recordVoiceInput({ creatorId, text, language }) {
  record("voice-input", `voice-${creatorId ?? "anon"}-${Date.now()}`, {
    creatorId: creatorId ?? null,
    transcript: text ?? null,
    language: language ?? null,
    recordedAt: nowIso()
  }, { creatorId: creatorId ?? null });
}

// 6a) Points ledger — every DP/creator-score event (tamper-proof rewards trail).
export function recordPointsLedgerEvent(event) {
  if (!event?.eventId) return;
  record("points-ledger", event.eventId, event, { userId: event.userId ?? event.creatorId ?? null });
}

// 6b) Referral attribution — who referred whom.
export function recordReferralAttribution(attribution) {
  if (!attribution) return;
  const id = attribution.id ?? attribution.attributionId ?? `${attribution.referredId ?? attribution.userId ?? "x"}-${Date.now()}`;
  record("referral-attribution", id, { ...attribution, recordedAt: nowIso() }, { userId: attribution.userId ?? null });
}
