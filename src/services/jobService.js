import { nanoid } from "nanoid";
import { getDatabase } from "./databaseService.js";

// Async job store. Long-running agent work (code generation can take
// 5-15 minutes) cannot survive a single HTTP request through browsers and
// gateways, so callers get a jobId immediately and poll for the result.
//
// Jobs live in memory (fast, holds the running promise) and are mirrored to
// the `jobs` collection so a backend restart doesn't silently lose them:
// orphaned "running" jobs are reported as failed instead of vanishing.

const jobs = new Map();

const JOB_TTL_MS = 60 * 60 * 1000; // keep finished jobs for one hour

async function jobCollection() {
  const database = await getDatabase();
  return database.collection("jobs");
}

// Fire-and-forget mirror to Mongo; job execution never blocks on persistence.
function persistJob(job) {
  jobCollection()
    .then((collection) =>
      collection.updateOne({ id: job.id }, { $set: { ...job } }, { upsert: true })
    )
    .catch(() => {});
}

function pruneJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

export function runningJobCount() {
  let count = 0;
  for (const job of jobs.values()) {
    if (job.status === "running") count += 1;
  }
  return count;
}

/**
 * Starts a background job. `work` receives an `updateProgress(progress)`
 * callback it may call to report incremental progress (kept in memory,
 * returned to pollers).
 */
export function startJob(type, work) {
  pruneJobs();

  const id = `job_${nanoid(12)}`;
  const job = {
    id,
    type,
    status: "running",
    progress: null,
    createdAt: Date.now(),
    finishedAt: null,
    result: null,
    error: null
  };
  jobs.set(id, job);
  persistJob(job);

  const updateProgress = (progress) => {
    job.progress = { ...progress, at: Date.now() };
  };

  Promise.resolve()
    .then(() => work(updateProgress))
    .then((result) => {
      job.status = "complete";
      job.result = result;
      job.finishedAt = Date.now();
      persistJob(job);
    })
    .catch((error) => {
      job.status = "failed";
      job.error = {
        message: error.message,
        status: error.status ?? 500
      };
      job.finishedAt = Date.now();
      persistJob(job);
      console.error(`Job ${id} (${type}) failed`, { message: error.message, status: error.status ?? null });
    });

  return job;
}

export async function getJob(id) {
  const inMemory = jobs.get(id);
  if (inMemory) return inMemory;

  // Not in memory — either expired or the server restarted mid-job. The Mongo
  // mirror lets us answer instead of 404ing; a doc still marked "running" with
  // no in-memory twin means the job died with the old process.
  try {
    const collection = await jobCollection();
    const stored = await collection.findOne({ id }, { projection: { _id: 0 } });
    if (!stored) return null;
    if (stored.status === "running") {
      stored.status = "failed";
      stored.error = { message: "Job was interrupted by a server restart — please retry", status: 500 };
      stored.finishedAt = Date.now();
      persistJob(stored);
    }
    return stored;
  } catch {
    return null;
  }
}

export function serializeJob(job) {
  return {
    jobId: job.id,
    type: job.type,
    status: job.status,
    progress: job.progress ?? null,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    elapsedMs: (job.finishedAt ?? Date.now()) - job.createdAt,
    result: job.status === "complete" ? job.result : null,
    error: job.error
  };
}
