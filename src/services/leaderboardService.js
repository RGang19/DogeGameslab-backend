import { getDatabase } from "./databaseService.js";
import { putJsonOnZeroG } from "./zeroGStorage.js";

const collectionName = "game_leaderboard_scores";
const memoryScores = new Map();

async function getCollection() {
  try {
    const db = await getDatabase();
    return db.collection(collectionName);
  } catch {
    return null;
  }
}

function rankScores(scores, limit) {
  return scores
    .sort((first, second) => {
      if (second.score !== first.score) return second.score - first.score;
      return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
    })
    .slice(0, limit)
    .map((entry, index) => ({
      rank: index + 1,
      gameId: entry.gameId,
      userId: entry.userId,
      username: entry.username,
      score: entry.score,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));
}

export async function getLeaderboard(gameId, limit = 50) {
  const collection = await getCollection();

  if (collection) {
    const scores = await collection
      .find({ gameId })
      .sort({ score: -1, createdAt: 1 })
      .limit(limit)
      .toArray();

    return {
      gameId,
      entries: scores.map((entry, index) => ({
        rank: index + 1,
        gameId: entry.gameId,
        userId: entry.userId,
        username: entry.username,
        score: entry.score,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })),
    };
  }

  return {
    gameId,
    entries: rankScores([...(memoryScores.get(gameId) ?? [])], limit),
  };
}

export async function submitScore({ gameId, userId, username, score }) {
  const now = new Date();
  const entry = {
    gameId,
    userId,
    username,
    score,
    updatedAt: now,
  };
  const collection = await getCollection();

  if (collection) {
    const scoreStorage = await putJsonOnZeroG({
      objectType: "leaderboard-score",
      objectId: `${gameId}:${userId}`,
      data: { ...entry, submittedAt: now },
      metadata: { gameId, userId }
    });
    await collection.updateOne(
      { gameId, userId },
      {
        $max: { score },
        $set: { username, updatedAt: entry.updatedAt, zeroGStorage: scoreStorage },
        $setOnInsert: { gameId, userId, createdAt: new Date() },
      },
      { upsert: true },
    );
    const leaderboard = await getLeaderboard(gameId);
    const snapshotStorage = await putJsonOnZeroG({
      objectType: "leaderboard-snapshot",
      objectId: gameId,
      data: leaderboard,
      metadata: { gameId, limit: leaderboard.entries.length }
    });
    return { ...leaderboard, zeroGStorage: snapshotStorage };
  }

  const scores = memoryScores.get(gameId) ?? [];
  const existing = scores.find((item) => item.userId === userId);
  if (existing) {
    if (score > existing.score) existing.score = score;
    existing.username = username;
    existing.updatedAt = entry.updatedAt;
  } else {
    scores.push({ ...entry, createdAt: new Date() });
  }
  memoryScores.set(gameId, scores);
  return getLeaderboard(gameId);
}
