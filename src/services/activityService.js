import { getDatabase } from "./databaseService.js";
import { putJsonOnZeroG } from "./zeroGStorage.js";

const collectionName = "user_activities";
const memoryActivities = [];
const AUDIT_ACTIVITY_TYPES = new Set([
  "publish",
  "unpublish",
  "major_edit",
  "tournament_result",
  "reward_claim"
]);

async function getCollection() {
  try {
    const db = await getDatabase();
    return db.collection(collectionName);
  } catch {
    return null;
  }
}

export async function logActivity({ userId, gameId, gameTitle, activityType, details }) {
  if (!userId) return;
  const activity = {
    userId,
    gameId: gameId || null,
    gameTitle: gameTitle || null,
    activityType,
    details: details || "",
    timestamp: new Date()
  };

  const col = await getCollection();
  if (col) {
    const result = await col.insertOne(activity);
    activity._id = result.insertedId;
  } else {
    memoryActivities.unshift(activity);
    if (memoryActivities.length > 100) memoryActivities.pop(); // Cap memory fallback
  }

  if (AUDIT_ACTIVITY_TYPES.has(activityType)) {
    void putJsonOnZeroG({
      objectType: "audit-event",
      objectId: String(activity._id ?? `${activityType}:${userId}:${activity.timestamp.getTime()}`),
      data: {
        userId: activity.userId,
        gameId: activity.gameId,
        gameTitle: activity.gameTitle,
        activityType: activity.activityType,
        details: activity.details,
        timestamp: activity.timestamp
      },
      metadata: {
        userId,
        gameId: gameId || null,
        activityType
      }
    }).catch((error) => {
      console.warn("0G audit event upload failed", { activityType, message: error.message });
    });
  }
}

export async function getUserActivities(userId, limit = 50) {
  if (!userId) return [];
  const col = await getCollection();
  if (col) {
    return col.find({ userId }).sort({ timestamp: -1 }).limit(limit).toArray();
  }
  return memoryActivities.filter(a => a.userId === userId).slice(0, limit);
}

export async function getRecentActivities(limit = 50) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 100));
  const col = await getCollection();
  if (col) {
    return col.find({}).sort({ timestamp: -1 }).limit(safeLimit).toArray();
  }
  return memoryActivities.slice(0, safeLimit);
}

export async function getGameTitle(gameId) {
  if (!gameId) return null;
  // If it's a pre-built template
  try {
    const { templates } = await import("../data/templates.js");
    const template = templates.find(t => t.id === gameId);
    if (template) return template.name;
  } catch {
    // silent
  }

  // Otherwise, query MongoDB
  try {
    const db = await getDatabase();
    const game = await db.collection(process.env.MONGODB_COLLECTION || "prompt_creator_studio").findOne({ id: gameId });
    return game?.title || null;
  } catch {
    return null;
  }
}
