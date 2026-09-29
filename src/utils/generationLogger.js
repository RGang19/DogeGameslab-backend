import { appendFileSync } from "node:fs";

// Optional real-time sink: when GENERATION_PROGRESS_FILE is set, every step is
// written synchronously (so it's readable live, unlike buffered console output).
function emitToProgressFile(startedAt, step, extra = {}) {
  const path = process.env.GENERATION_PROGRESS_FILE;
  if (!path) return;
  const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
  try {
    appendFileSync(path, `[+${secs}s] ${step}${Object.keys(extra).length ? " " + JSON.stringify(extra) : ""}\n`);
  } catch {
    // never let progress logging break generation
  }
}

/** Structured timing logs for the prompt-to-game pipeline. */
export function createGenerationLogger(requestId) {
  const startedAt = Date.now();
  let lastStepAt = startedAt;

  const log = (step, data = {}) => {
    const now = Date.now();
    const payload = {
      requestId,
      step,
      msSinceStart: now - startedAt,
      msSinceLastStep: now - lastStepAt,
      ...data,
    };
    console.info(`[generate-from-prompt] ${step}`, payload);
    emitToProgressFile(startedAt, step, { sinceLastStepMs: now - lastStepAt });
    lastStepAt = now;
    return payload;
  };

  return {
    requestId,
    startedAt,
    log,
    fail(step, error, extra = {}) {
      console.error(`[generate-from-prompt] ${step}`, {
        requestId,
        msSinceStart: Date.now() - startedAt,
        message: error?.message ?? String(error),
        status: error?.status ?? null,
        stack: error?.stack,
        ...extra,
      });
      emitToProgressFile(startedAt, `FAIL:${step}`, { message: error?.message ?? String(error), status: error?.status ?? null });
    },
    done(extra = {}) {
      return log("complete", extra);
    },
  };
}
