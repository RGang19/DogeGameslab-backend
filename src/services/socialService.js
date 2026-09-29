import { getDatabase, getGameCollection, getGamePackageById } from "./databaseService.js";
import { putJsonOnZeroG } from "./zeroGStorage.js";
import {
  awardDailyChallenge,
  awardDailyLogin,
  awardFollowCreator,
  awardGameCompletion,
  awardLike,
  awardMilestone,
  awardQualifiedPlay,
  awardRemix,
  awardShare,
  getCreatorScoreSummary,
  getCreatorScoreLeaderboard,
  getDailyPlayerActivity,
  getDogeGamePointsLeaderboard,
  getPointSummary,
} from "./pointsService.js";

const COLLECTIONS = {
  likes: "social_likes",
  comments: "social_comments",
  favorites: "social_favorites",
  shares: "social_shares",
  views: "social_views",
  follows: "social_follows",
  notifications: "social_notifications",
};

// ─── In-memory fallback when MongoDB is unavailable ────────────────────────
const memoryStore = {
  likes: new Map(),       // gameId → Set<userId>
  comments: new Map(),    // gameId → Array<comment>
  favorites: new Map(),   // gameId → Set<userId>
  shares: new Map(),      // gameId → count
  views: new Map(),       // gameId → count
  follows: new Map(),     // creatorId → Set<followerId>
  notifications: new Map(), // userId → Array<notification>
};

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function weekKey(date = new Date()) {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const day = new Date(utc).getUTCDay() || 7;
  const thursday = new Date(utc);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((thursday - yearStart) / 86400000) + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function creatorScore({ games = 0, plays = 0, likes = 0, shares = 0, remixes = 0, followers = 0, featured = 0 }) {
  return (games * 25) + Math.floor(plays / 5) + (likes * 5) + (shares * 10) + (remixes * 15) + (followers * 20) + (featured * 100);
}

async function notifyUser({ userId, type, title, body, gameId = null, actorId = null, metadata = {} }) {
  if (!userId) return null;
  const notification = {
    userId,
    type,
    title,
    body,
    gameId,
    actorId,
    metadata,
    read: false,
    createdAt: new Date(),
  };
  const col = await getCollection(COLLECTIONS.notifications);
  if (col) {
    const result = await col.insertOne(notification);
    return { ...notification, _id: result.insertedId };
  }
  const list = memoryStore.notifications.get(userId) ?? [];
  const stored = { ...notification, _id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
  list.unshift(stored);
  memoryStore.notifications.set(userId, list);
  return stored;
}

export async function createUserNotification(input) {
  return notifyUser(input);
}

async function getCollection(name) {
  try {
    const db = await getDatabase();
    return db.collection(name);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  LIKES
// ═══════════════════════════════════════════════════════════════════════════

export async function toggleLike(gameId, userId) {
  const col = await getCollection(COLLECTIONS.likes);

  if (col) {
    const existing = await col.findOne({ gameId, userId });
    if (existing) {
      await col.deleteOne({ _id: existing._id });
      const count = await col.countDocuments({ gameId });
      return { liked: false, count };
    }
    await col.insertOne({ gameId, userId, createdAt: new Date() });
    const count = await col.countDocuments({ gameId });
    const game = await getGamePackageById(gameId).catch(() => null);
    const points = game ? await awardLike({ game, actorId: userId }).catch(() => null) : null;
    if (game?.creatorId && game.creatorId !== userId) {
      void notifyUser({
        userId: game.creatorId,
        type: "like",
        title: "Someone liked your game",
        body: `"${game.title || "Your game"}" got a new like.`,
        gameId,
        actorId: userId,
      }).catch(() => null);
    }
    return { liked: true, count, points };
  }

  // fallback
  if (!memoryStore.likes.has(gameId)) memoryStore.likes.set(gameId, new Set());
  const set = memoryStore.likes.get(gameId);
  const wasLiked = set.has(userId);
  wasLiked ? set.delete(userId) : set.add(userId);
  const result = { liked: !wasLiked, count: set.size };
  if (result.liked) {
    const game = await getGamePackageById(gameId).catch(() => null);
    result.points = game ? await awardLike({ game, actorId: userId }).catch(() => null) : null;
    if (game?.creatorId && game.creatorId !== userId) {
      void notifyUser({
        userId: game.creatorId,
        type: "like",
        title: "Someone liked your game",
        body: `"${game.title || "Your game"}" got a new like.`,
        gameId,
        actorId: userId,
      }).catch(() => null);
    }
  }
  return result;
}

export async function getLikeStatus(gameId, userId) {
  const col = await getCollection(COLLECTIONS.likes);

  if (col) {
    const existing = userId ? await col.findOne({ gameId, userId }) : null;
    const count = await col.countDocuments({ gameId });
    return { liked: Boolean(existing), count };
  }

  const set = memoryStore.likes.get(gameId) ?? new Set();
  return { liked: userId ? set.has(userId) : false, count: set.size };
}

// ═══════════════════════════════════════════════════════════════════════════
//  COMMENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function addComment(gameId, userId, username, text) {
  const comment = {
    gameId,
    userId,
    username,
    text,
    createdAt: new Date(),
  };

  const col = await getCollection(COLLECTIONS.comments);

  if (col) {
    const result = await col.insertOne(comment);
    comment._id = result.insertedId;
    const count = await col.countDocuments({ gameId });
    const game = await getGamePackageById(gameId).catch(() => null);
    if (game?.creatorId && game.creatorId !== userId) {
      void notifyUser({
        userId: game.creatorId,
        type: "comment",
        title: "New comment on your game",
        body: `${username || "Someone"} commented on "${game.title || "your game"}".`,
        gameId,
        actorId: userId,
        metadata: { commentId: String(comment._id) },
      }).catch(() => null);
    }
    return { comment, count };
  }

  // fallback
  if (!memoryStore.comments.has(gameId)) memoryStore.comments.set(gameId, []);
  const arr = memoryStore.comments.get(gameId);
  comment._id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  arr.push(comment);
  const game = await getGamePackageById(gameId).catch(() => null);
  if (game?.creatorId && game.creatorId !== userId) {
    void notifyUser({
      userId: game.creatorId,
      type: "comment",
      title: "New comment on your game",
      body: `${username || "Someone"} commented on "${game.title || "your game"}".`,
      gameId,
      actorId: userId,
      metadata: { commentId: String(comment._id) },
    }).catch(() => null);
  }
  return { comment, count: arr.length };
}

export async function getComments(gameId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const col = await getCollection(COLLECTIONS.comments);

  if (col) {
    const [comments, count] = await Promise.all([
      col.find({ gameId }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments({ gameId }),
    ]);
    return { comments, count, page, limit, totalPages: Math.ceil(count / limit) };
  }

  const arr = memoryStore.comments.get(gameId) ?? [];
  const sorted = [...arr].reverse();
  return {
    comments: sorted.slice(skip, skip + limit),
    count: arr.length,
    page,
    limit,
    totalPages: Math.ceil(arr.length / limit),
  };
}

export async function deleteComment(commentId, userId) {
  const col = await getCollection(COLLECTIONS.comments);

  if (col) {
    const { ObjectId } = await import("mongodb");
    let filter;
    try {
      filter = { _id: new ObjectId(commentId), userId };
    } catch {
      filter = { _id: commentId, userId };
    }
    const result = await col.deleteOne(filter);
    return { deleted: result.deletedCount > 0 };
  }

  for (const [, arr] of memoryStore.comments) {
    const idx = arr.findIndex((c) => c._id === commentId && c.userId === userId);
    if (idx !== -1) {
      arr.splice(idx, 1);
      return { deleted: true };
    }
  }
  return { deleted: false };
}

// Comment count for each of the given games. Returns { [gameId]: count }.
// Used by the creator dashboard to badge each game with its comment total.
export async function getCommentCountsForGames(gameIds = []) {
  const ids = [...new Set(gameIds.filter(Boolean))];
  const counts = {};
  for (const id of ids) counts[id] = 0;
  if (!ids.length) return counts;
  const col = await getCollection(COLLECTIONS.comments);
  if (col) {
    const rows = await col
      .aggregate([
        { $match: { gameId: { $in: ids } } },
        { $group: { _id: "$gameId", count: { $sum: 1 } } },
      ])
      .toArray();
    for (const row of rows) counts[row._id] = Number(row.count ?? 0);
    return counts;
  }
  for (const id of ids) counts[id] = (memoryStore.comments.get(id) ?? []).length;
  return counts;
}

// Per-game engagement counts (likes, shares, remixes) plus grand totals, for
// the creator dashboard's Activity tab. Likes and shares are one-doc-per-event
// keyed by gameId; a remix is a game whose `remixOf` points at one of these.
export async function getEngagementCountsForGames(gameIds = []) {
  const ids = [...new Set(gameIds.filter(Boolean))];
  const byGame = {};
  for (const id of ids) byGame[id] = { likes: 0, shares: 0, remixes: 0 };
  const totals = { likes: 0, shares: 0, remixes: 0 };
  if (!ids.length) return { byGame, totals };

  const [likesCol, sharesCol] = await Promise.all([
    getCollection(COLLECTIONS.likes),
    getCollection(COLLECTIONS.shares),
  ]);

  if (likesCol && sharesCol) {
    const groupByGame = [
      { $match: { gameId: { $in: ids } } },
      { $group: { _id: "$gameId", count: { $sum: 1 } } },
    ];
    const gamesCol = await getGameCollection();
    const [likeRows, shareRows, remixRows] = await Promise.all([
      likesCol.aggregate(groupByGame).toArray(),
      sharesCol.aggregate(groupByGame).toArray(),
      gamesCol
        .aggregate([
          { $match: { remixOf: { $in: ids } } },
          { $group: { _id: "$remixOf", count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);
    for (const row of likeRows) if (byGame[row._id]) byGame[row._id].likes = Number(row.count ?? 0);
    for (const row of shareRows) if (byGame[row._id]) byGame[row._id].shares = Number(row.count ?? 0);
    for (const row of remixRows) if (byGame[row._id]) byGame[row._id].remixes = Number(row.count ?? 0);
  } else {
    // In-memory fallback (no Mongo): likes are a Set, shares a running count.
    for (const id of ids) {
      byGame[id].likes = (memoryStore.likes.get(id) ?? new Set()).size;
      byGame[id].shares = memoryStore.shares.get(id) ?? 0;
    }
  }

  for (const id of ids) {
    totals.likes += byGame[id].likes;
    totals.shares += byGame[id].shares;
    totals.remixes += byGame[id].remixes;
  }
  return { byGame, totals };
}

// For each game: its up-to-`perGame` newest comments + total comment count.
// Returns { byGame: { [gameId]: { items: [comment], count } } }.
export async function getRecentCommentsPerGame(gameIds = [], perGame = 2) {
  const ids = [...new Set(gameIds.filter(Boolean))];
  const byGame = {};
  for (const id of ids) byGame[id] = { items: [], count: 0 };
  if (!ids.length) return { byGame };
  const cap = Math.max(1, Math.min(Number(perGame) || 2, 10));

  const col = await getCollection(COLLECTIONS.comments);
  if (col) {
    const rows = await col
      .aggregate([
        { $match: { gameId: { $in: ids } } },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: "$gameId",
            items: { $push: { _id: "$_id", username: "$username", text: "$text", createdAt: "$createdAt", gameId: "$gameId" } },
            count: { $sum: 1 },
          },
        },
        { $project: { items: { $slice: ["$items", cap] }, count: 1 } },
      ])
      .toArray();
    for (const row of rows) {
      if (byGame[row._id]) byGame[row._id] = { items: row.items ?? [], count: Number(row.count ?? 0) };
    }
    return { byGame };
  }

  for (const id of ids) {
    const arr = [...(memoryStore.comments.get(id) ?? [])].reverse();
    byGame[id] = { items: arr.slice(0, cap), count: arr.length };
  }
  return { byGame };
}

// Most-recent comments across a set of games (newest first), each tagged with
// its gameId so the dashboard can show "who said what on which game".
export async function getRecentCommentsForGames(gameIds = [], limit = 50) {
  const ids = [...new Set(gameIds.filter(Boolean))];
  if (!ids.length) return [];
  const capped = Math.max(1, Math.min(Number(limit) || 50, 200));
  const col = await getCollection(COLLECTIONS.comments);
  if (col) {
    return col
      .find({ gameId: { $in: ids } })
      .sort({ createdAt: -1 })
      .limit(capped)
      .toArray();
  }
  const all = [];
  for (const id of ids) {
    for (const comment of memoryStore.comments.get(id) ?? []) all.push(comment);
  }
  return all
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, capped);
}

// ═══════════════════════════════════════════════════════════════════════════
//  FAVORITES (Bookmark)
// ═══════════════════════════════════════════════════════════════════════════

export async function toggleFavorite(gameId, userId) {
  const col = await getCollection(COLLECTIONS.favorites);

  if (col) {
    const existing = await col.findOne({ gameId, userId });
    if (existing) {
      await col.deleteOne({ _id: existing._id });
      const count = await col.countDocuments({ gameId });
      return { favorited: false, count };
    }
    await col.insertOne({ gameId, userId, createdAt: new Date() });
    const count = await col.countDocuments({ gameId });
    return { favorited: true, count };
  }

  if (!memoryStore.favorites.has(gameId)) memoryStore.favorites.set(gameId, new Set());
  const set = memoryStore.favorites.get(gameId);
  const was = set.has(userId);
  was ? set.delete(userId) : set.add(userId);
  return { favorited: !was, count: set.size };
}

export async function getFavoriteStatus(gameId, userId) {
  const col = await getCollection(COLLECTIONS.favorites);

  if (col) {
    const existing = userId ? await col.findOne({ gameId, userId }) : null;
    const count = await col.countDocuments({ gameId });
    return { favorited: Boolean(existing), count };
  }

  const set = memoryStore.favorites.get(gameId) ?? new Set();
  return { favorited: userId ? set.has(userId) : false, count: set.size };
}

export async function getUserFavorites(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const col = await getCollection(COLLECTIONS.favorites);

  if (col) {
    const [favorites, count] = await Promise.all([
      col.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments({ userId }),
    ]);
    return { favorites, count, page, limit };
  }

  const results = [];
  for (const [gameId, set] of memoryStore.favorites) {
    if (set.has(userId)) results.push({ gameId, userId });
  }
  return { favorites: results.slice(skip, skip + limit), count: results.length, page, limit };
}

// ═══════════════════════════════════════════════════════════════════════════
//  SHARES
// ═══════════════════════════════════════════════════════════════════════════

export async function recordShare(gameId, userId, platform) {
  const share = {
    gameId,
    userId,
    platform: platform ?? "link",
    createdAt: new Date(),
  };

  const col = await getCollection(COLLECTIONS.shares);

  if (col) {
    await col.insertOne(share);
    const count = await col.countDocuments({ gameId });
    const game = await getGamePackageById(gameId).catch(() => null);
    const points = game ? await awardShare({ game, actorId: userId, platform }).catch(() => null) : null;
    if (game?.creatorId && game.creatorId !== userId) {
      void notifyUser({
        userId: game.creatorId,
        type: "share",
        title: "Your game was shared",
        body: `"${game.title || "Your game"}" was shared via ${platform || "link"}.`,
        gameId,
        actorId: userId,
      }).catch(() => null);
    }
    return { shared: true, count, points };
  }

  memoryStore.shares.set(gameId, (memoryStore.shares.get(gameId) ?? 0) + 1);
  const game = await getGamePackageById(gameId).catch(() => null);
  const points = game ? await awardShare({ game, actorId: userId, platform }).catch(() => null) : null;
  if (game?.creatorId && game.creatorId !== userId) {
    void notifyUser({
      userId: game.creatorId,
      type: "share",
      title: "Your game was shared",
      body: `"${game.title || "Your game"}" was shared via ${platform || "link"}.`,
      gameId,
      actorId: userId,
    }).catch(() => null);
  }
  return { shared: true, count: memoryStore.shares.get(gameId), points };
}

export async function getShareCount(gameId) {
  const col = await getCollection(COLLECTIONS.shares);

  if (col) {
    const count = await col.countDocuments({ gameId });
    return { count };
  }

  return { count: memoryStore.shares.get(gameId) ?? 0 };
}

// ═══════════════════════════════════════════════════════════════════════════
//  AGGREGATE — all social stats for a game at once
// ═══════════════════════════════════════════════════════════════════════════

export async function getSocialStats(gameId, userId) {
  const [like, comments, favorite, share, view] = await Promise.all([
    getLikeStatus(gameId, userId),
    getComments(gameId, 1, 0), // just count
    getFavoriteStatus(gameId, userId),
    getShareCount(gameId),
    getViewCount(gameId),
  ]);

  return {
    likes: { liked: like.liked, count: like.count },
    comments: { count: comments.count },
    favorites: { favorited: favorite.favorited, count: favorite.count },
    shares: { count: share.count },
    views: { count: view.views },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  VIEWS (plays)
// ═══════════════════════════════════════════════════════════════════════════

export async function recordView(gameId, userId) {
  const col = await getCollection(COLLECTIONS.views);
  let count;
  if (col) {
    await col.updateOne(
      { gameId },
      {
        $inc: { count: 1 },
        $addToSet: { viewers: userId ?? "anon" },
        $setOnInsert: { gameId, createdAt: new Date() },
      },
      { upsert: true },
    );
    const doc = await col.findOne({ gameId });
    count = doc?.count ?? 1;
  } else {
    count = (memoryStore.views.get(gameId) ?? 0) + 1;
    memoryStore.views.set(gameId, count);
  }

  // Mirror onto the game record so list endpoints can show real play counts.
  try {
    const games = await getGameCollection();
    await games.updateOne({ id: gameId }, { $set: { views: count } });
  } catch {
    // game collection unavailable — the views collection still has the truth
  }

  return { gameId, views: count };
}

export async function recordQualifiedPlay(gameId, { userId, sessionId, durationSeconds, signals }) {
  if (Number(durationSeconds) < 30) {
    return { qualified: false, reason: "duration", points: null };
  }

  const game = await getGamePackageById(gameId).catch(() => null);
  if (!game) return { qualified: false, reason: "game-not-found", points: null };

  const points = await awardQualifiedPlay({
    game,
    actorId: userId,
    sessionId,
    durationSeconds,
    signals,
  });
  if ((points.awarded || points.duplicate) && game.creatorId && game.creatorId !== userId) {
    void notifyUser({
      userId: game.creatorId,
      type: "play",
      title: "Someone played your game",
      body: `"${game.title || "Your game"}" got a qualified play.`,
      gameId,
      actorId: userId,
    }).catch(() => null);
  }

  return {
    qualified: Boolean(points.awarded || points.duplicate),
    points,
  };
}

export async function recordGameCompletion(gameId, { userId, completionId, signals }) {
  const game = await getGamePackageById(gameId).catch(() => null);
  if (!game) return { completed: false, reason: "game-not-found", points: null };
  const points = await awardGameCompletion({ game, actorId: userId, completionId, signals });
  return { completed: Boolean(points.awarded || points.duplicate), points };
}

export async function recordDailyLogin({ userId, signals }) {
  const points = await awardDailyLogin({ userId, signals });
  return { rewarded: Boolean(points.awarded || points.duplicate), points };
}

export async function recordDailyChallenge({ userId, creatorId, challengeId, gameId, aliases, signals }) {
  const summary = await getDailyChallenges(userId, aliases);
  const challenge = summary.challenges.find((item) => item.id === challengeId);
  if (!challenge) {
    const error = new Error("Unknown or expired daily challenge");
    error.status = 400;
    throw error;
  }
  if (!challenge.completed) {
    const error = new Error("Daily challenge is not complete");
    error.status = 409;
    throw error;
  }
  const points = await awardDailyChallenge({ userId, creatorId, challengeId, gameId, signals });
  return { rewarded: Boolean(points.awarded || points.duplicate), points };
}

export async function recordRemix({ newCreatorId, originalCreatorId, originalGameId, remixGameId, signals }) {
  const points = await awardRemix({ newCreatorId, originalCreatorId, originalGameId, remixGameId, signals });
  return { rewarded: Boolean(points.awarded), points };
}

export async function recordMilestone({ userId, creatorId, gameId, milestone, signals }) {
  const points = await awardMilestone({ userId, creatorId, gameId, milestone, signals });
  return { rewarded: Boolean(points.awarded || points.duplicate), points };
}

export async function getEconomyLeaderboard({ economy, period, limit }) {
  const range = period === "weekly" ? "weekly" : period === "monthly" ? "monthly" : "allTime";
  if (economy === "kp" || economy === "player") {
    const leaderboard = await getDogeGamePointsLeaderboard({ limit, range });
    return { economy: "kp", period, entries: leaderboard.entries };
  }
  const leaderboard = await getCreatorScoreLeaderboard({ limit, range });
  return { economy: "cs", period, entries: leaderboard.entries };
}

export async function getViewCount(gameId) {
  const col = await getCollection(COLLECTIONS.views);
  if (col) {
    const doc = await col.findOne({ gameId });
    return { gameId, views: doc?.count ?? 0 };
  }
  return { gameId, views: memoryStore.views.get(gameId) ?? 0 };
}

export async function getTopViewed(limit = 100) {
  const col = await getCollection(COLLECTIONS.views);
  if (col) {
    const docs = await col
      .find({}, { projection: { _id: 0, gameId: 1, count: 1 } })
      .sort({ count: -1 })
      .limit(limit)
      .toArray();
    return docs.map((d) => ({ gameId: d.gameId, views: d.count ?? 0 }));
  }
  return [...memoryStore.views.entries()]
    .map(([gameId, count]) => ({ gameId, views: count }))
    .sort((a, b) => b.views - a.views)
    .slice(0, limit);
}

// ═══════════════════════════════════════════════════════════════════════════
//  FOLLOWS (creator ↔ follower)
// ═══════════════════════════════════════════════════════════════════════════

export async function toggleFollow(creatorId, followerId) {
  const col = await getCollection(COLLECTIONS.follows);
  if (col) {
    const existing = await col.findOne({ creatorId, followerId });
    if (existing) {
      await col.deleteOne({ _id: existing._id });
    } else {
      await col.insertOne({ creatorId, followerId, createdAt: new Date() });
      void notifyUser({
        userId: creatorId,
        type: "follow",
        title: "New follower",
        body: "Someone followed your creator profile.",
        actorId: followerId,
      }).catch(() => null);
    }
    const followers = await col.countDocuments({ creatorId });
    const points = !existing
      ? await awardFollowCreator({ creatorId, followerId }).catch(() => null)
      : null;
    return { creatorId, following: !existing, followers, points };
  }

  const set = memoryStore.follows.get(creatorId) ?? new Set();
  const following = !set.has(followerId);
  if (following) set.add(followerId);
  else set.delete(followerId);
  memoryStore.follows.set(creatorId, set);
  const points = following
    ? await awardFollowCreator({ creatorId, followerId }).catch(() => null)
    : null;
  if (following) {
    void notifyUser({
      userId: creatorId,
      type: "follow",
      title: "New follower",
      body: "Someone followed your creator profile.",
      actorId: followerId,
    }).catch(() => null);
  }
  return { creatorId, following, followers: set.size, points };
}

export async function getFollowStatus(creatorId, followerId) {
  const col = await getCollection(COLLECTIONS.follows);
  if (col) {
    const [existing, followers] = await Promise.all([
      followerId ? col.findOne({ creatorId, followerId }) : null,
      col.countDocuments({ creatorId }),
    ]);
    return { creatorId, following: Boolean(existing), followers };
  }
  const set = memoryStore.follows.get(creatorId) ?? new Set();
  return { creatorId, following: followerId ? set.has(followerId) : false, followers: set.size };
}

export async function getFollowingList(followerId, followerAliases = [followerId]) {
  const aliases = [...new Set(followerAliases.filter(Boolean))];
  const col = await getCollection(COLLECTIONS.follows);
  if (col) {
    const docs = await col.find({ followerId: { $in: aliases } }).toArray();
    return { followerId, following: [...new Set(docs.map((d) => d.creatorId))] };
  }
  const following = [];
  for (const [creatorId, set] of memoryStore.follows) {
    if (aliases.some((alias) => set.has(alias))) following.push(creatorId);
  }
  return { followerId, following };
}

// ═══════════════════════════════════════════════════════════════════════════
//  CREATOR STATS (real profile numbers)
// ═══════════════════════════════════════════════════════════════════════════

export async function getCreatorStats(creatorId, creatorAliases = [creatorId]) {
  try {
    const aliases = [...new Set(creatorAliases.filter(Boolean))];
    const games = await getGameCollection();
    const ownGames = await games
      .find({
        creatorId: { $in: aliases },
        tier: { $ne: "template" },
        $or: [
          { buildStatus: "ready" },
          {
            buildStatus: { $exists: false },
            $or: [
              { "refinement.generatedCode": { $type: "string" } },
              { templateId: { $ne: "pure-agent" } }
            ]
          }
        ]
      }, { projection: { id: 1, views: 1 } })
      .toArray();
    const gameIds = ownGames.map((g) => g.id);
    const db = await getDatabase();
    const [likes, followers, shares, remixes, featured, points] = await Promise.all([
      gameIds.length ? db.collection(COLLECTIONS.likes).countDocuments({ gameId: { $in: gameIds } }) : 0,
      db.collection(COLLECTIONS.follows).countDocuments({ creatorId: { $in: aliases } }),
      gameIds.length ? db.collection(COLLECTIONS.shares).countDocuments({ gameId: { $in: gameIds } }) : 0,
      gameIds.length ? games.countDocuments({ remixOf: { $in: gameIds } }) : 0,
      games.countDocuments({ creatorId: { $in: aliases }, "browserFeature.featured": true }),
      getCreatorScoreSummary(creatorId, aliases),
    ]);
    const plays = ownGames.reduce((total, g) => total + (g.views ?? 0), 0);
    const score = creatorScore({ games: ownGames.length, plays, likes, shares, remixes, followers, featured });
    const profile = {
      creatorId,
      games: ownGames.length,
      plays,
      likes,
      shares,
      remixes,
      followers,
      featured,
      creatorScore: points?.lifetimeScore ?? points?.lifetimePoints ?? score,
      lifetimeScore: points?.lifetimeScore ?? points?.lifetimePoints ?? score,
      dailyScore: points?.dailyScore ?? points?.dailyPoints ?? {},
      weeklyScore: points?.weeklyScore ?? points?.weeklyPoints ?? {},
      lifetimePoints: points?.lifetimePoints ?? 0,
      dailyPoints: points?.dailyPoints ?? points?.dailyScore ?? {},
      weeklyPoints: points?.weeklyPoints ?? points?.weeklyScore ?? {},
      currentDay: points?.currentDay ?? null,
      currentWeek: points?.currentWeek ?? null,
    };
    void putJsonOnZeroG({
      objectType: "profile-snapshot",
      objectId: creatorId,
      data: {
        ...profile,
        snapshottedAt: new Date()
      },
      metadata: { creatorId }
    }).catch((error) => {
      console.warn("0G profile snapshot upload failed", { creatorId, message: error.message });
    });
    return profile;
  } catch {
    return {
      creatorId,
      games: 0,
      plays: 0,
      likes: 0,
      shares: 0,
      remixes: 0,
      followers: 0,
      featured: 0,
      creatorScore: 0,
      lifetimeScore: 0,
      dailyScore: {},
      weeklyScore: {},
      lifetimePoints: 0,
      dailyPoints: {},
      weeklyPoints: {},
      currentDay: null,
      currentWeek: null,
    };
  }
}


export async function getUserLikes(userId, page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  const col = await getCollection(COLLECTIONS.likes);

  if (col) {
    const [likes, count] = await Promise.all([
      col.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments({ userId }),
    ]);
    return { likes, count, page, limit };
  }

  const results = [];
  for (const [gameId, set] of memoryStore.likes) {
    if (set.has(userId)) results.push({ gameId, userId });
  }
  return { likes: results.slice(skip, skip + limit), count: results.length, page, limit };
}

export async function getNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
  const col = await getCollection(COLLECTIONS.notifications);
  if (col) {
    const filter = { userId, ...(unreadOnly ? { read: false } : {}) };
    const notifications = await col
      .find(filter, { projection: { _id: 0 } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return { userId, notifications };
  }
  const notifications = (memoryStore.notifications.get(userId) ?? [])
    .filter((item) => !unreadOnly || !item.read)
    .slice(0, limit);
  return { userId, notifications };
}

export async function markNotificationsRead(userId) {
  const col = await getCollection(COLLECTIONS.notifications);
  if (col) {
    const result = await col.updateMany({ userId, read: false }, { $set: { read: true, readAt: new Date() } });
    return { userId, updated: result.modifiedCount ?? 0 };
  }
  const list = memoryStore.notifications.get(userId) ?? [];
  let updated = 0;
  for (const item of list) {
    if (!item.read) {
      item.read = true;
      item.readAt = new Date();
      updated += 1;
    }
  }
  return { userId, updated };
}

async function getFollowerIds(creatorId) {
  const col = await getCollection(COLLECTIONS.follows);
  if (col) {
    const docs = await col.find({ creatorId }, { projection: { _id: 0, followerId: 1 } }).toArray();
    return docs.map((doc) => doc.followerId).filter(Boolean);
  }
  return [...(memoryStore.follows.get(creatorId) ?? [])];
}

export async function notifyFollowersOfPublish(game) {
  if (!game?.creatorId || !game?.id) return { notified: 0 };
  const followers = await getFollowerIds(game.creatorId);
  await Promise.all(followers.map((followerId) => notifyUser({
    userId: followerId,
    type: "creator_publish",
    title: "A creator you follow published",
    body: `"${game.title || "New game"}" is ready to play.`,
    gameId: game.id,
    actorId: game.creatorId,
  }).catch(() => null)));
  return { notified: followers.length };
}

async function getPublishedGameCounts(aliases, now = new Date()) {
  const creatorIds = [...new Set(aliases.filter(Boolean))];
  if (!creatorIds.length) return { lifetime: 0, today: 0 };
  const games = await getGameCollection();
  const startOfDay = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);
  const baseFilter = {
    creatorId: { $in: creatorIds },
    "publish.published": true,
    tier: { $ne: "template" },
  };
  const [lifetime, today] = await Promise.all([
    games.countDocuments(baseFilter),
    games.countDocuments({
      ...baseFilter,
      "publish.publishedAt": { $gte: startOfDay, $lt: endOfDay },
    }),
  ]);
  return { lifetime, today };
}

export async function getDailyChallenges(userId, aliases = [userId]) {
  const today = dayKey();
  const [activity, publishedGames] = await Promise.all([
    getDailyPlayerActivity(userId, aliases),
    getPublishedGameCounts(aliases),
  ]);
  const challenges = [
    {
      id: `${today}:play-3`,
      title: "Play 3 games",
      metric: "gamesPlayed",
      target: 3,
      progress: Math.min(3, activity.plays),
      reward: "100 DP + 250 Creator Score",
    },
    {
      id: `${today}:publish-1`,
      title: "Publish 1 game",
      metric: "publishedGames",
      target: 1,
      progress: Math.min(1, Math.max(activity.publishes, publishedGames.today)),
      reward: "100 DP + 250 Creator Score",
    },
    {
      id: `${today}:share-1`,
      title: "Share 1 game",
      metric: "shares",
      target: 1,
      progress: Math.min(1, activity.shares),
      reward: "100 DP + 250 Creator Score",
    },
  ].map((challenge) => ({
    ...challenge,
    completed: challenge.progress >= challenge.target,
  }));
  return { userId, date: today, week: weekKey(), challenges };
}

export async function getAchievements(userId, aliases = [userId]) {
  const [stats, points, publishedGames] = await Promise.all([
    getCreatorStats(userId, aliases),
    getPointSummary(userId, aliases).catch(() => null),
    getPublishedGameCounts(aliases),
  ]);
  const lifetimePoints = Number(points?.lifetimePoints ?? 0);
  const achievements = [
    { id: "first-publish", title: "First Publish", description: "Publish your first game.", unlocked: publishedGames.lifetime >= 1 },
    { id: "crowd-spark", title: "Crowd Spark", description: "Reach 10 total likes.", unlocked: stats.likes >= 10 },
    { id: "playmaker", title: "Playmaker", description: "Reach 100 total plays.", unlocked: stats.plays >= 100 },
    { id: "rising-creator", title: "Rising Creator", description: "Reach 500 Creator Score.", unlocked: stats.creatorScore >= 500 },
    { id: "kp-collector", title: "DP Collector", description: "Earn 250 DP.", unlocked: lifetimePoints >= 250 },
    { id: "genesis-founder", title: "Genesis Founder", description: "Early DogeGame creator identity badge.", unlocked: publishedGames.lifetime > 0 || lifetimePoints > 0 },
  ];
  return {
    userId,
    inventory: {
      badges: achievements.filter((item) => item.unlocked).map((item) => item.id),
      genesisFounderBadge: achievements.some((item) => item.id === "genesis-founder" && item.unlocked),
    },
    achievements,
  };
}
