import { z } from "zod";
import {
  recordView,
  getViewCount,
  toggleFollow,
  getFollowStatus,
  getFollowingList,
  getCreatorStats,
  getTopViewed,
  toggleLike,
  getLikeStatus,
  addComment,
  getComments,
  deleteComment,
  toggleFavorite,
  getFavoriteStatus,
  getUserFavorites,
  recordShare,
  getShareCount,
  getSocialStats,
  getUserLikes,
  recordQualifiedPlay,
  getDailyChallenges,
  getAchievements,
  getNotifications,
  markNotificationsRead,
  createUserNotification,
  recordGameCompletion,
  recordDailyLogin,
  recordDailyChallenge,
  recordRemix,
  recordMilestone,
  getEconomyLeaderboard,
} from "../services/socialService.js";
import { logActivity, getGameTitle, getUserActivities, getRecentActivities } from "../services/activityService.js";
import { getPointSummary, getProfileUsername, setProfileUsername } from "../services/pointsService.js";
import { authIdentityAliases, authOwnsIdentity } from "../services/identityAliasService.js";

// ─── Schemas ───────────────────────────────────────────────────────────────

const gameIdSchema = z.object({
  gameId: z.string().min(1),
}).strict();

const userIdSchema = z.object({
  userId: z.string().min(1),
}).strict();

const likeSchema = gameIdSchema.merge(userIdSchema);

const commentCreateSchema = gameIdSchema.merge(userIdSchema).extend({
  username: z.string().min(1).max(50),
  text: z.string().min(1).max(2000),
}).strict();

const commentDeleteSchema = z.object({
  commentId: z.string().min(1),
  userId: z.string().min(1),
}).strict();

const favoriteSchema = gameIdSchema.merge(userIdSchema);

const shareSchema = gameIdSchema.merge(userIdSchema).extend({
  platform: z.enum(["link", "twitter", "discord", "whatsapp", "embed", "instagram", "email", "youtube"]).optional(),
}).strict();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

// ═══════════════════════════════════════════════════════════════════════════
//  LIKES
// ═══════════════════════════════════════════════════════════════════════════

export async function handleToggleLike(req, res, next) {
  try {
    const { gameId, userId } = likeSchema.parse(req.body);
    const result = await toggleLike(gameId, userId);

    // Log activity
    const gameTitle = await getGameTitle(gameId);
    await logActivity({
      userId,
      gameId,
      gameTitle,
      activityType: "like",
      details: result.liked ? `Liked the game "${gameTitle || "game"}"` : `Removed like from "${gameTitle || "game"}"`
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetLikeStatus(req, res, next) {
  try {
    const { gameId } = gameIdSchema.parse(req.params);
    const userId = req.query.userId ?? null;
    const result = await getLikeStatus(gameId, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  COMMENTS
// ═══════════════════════════════════════════════════════════════════════════

export async function handleAddComment(req, res, next) {
  try {
    const { gameId, userId, username, text } = commentCreateSchema.parse(req.body);
    const result = await addComment(gameId, userId, username, text);

    // Log activity
    const gameTitle = await getGameTitle(gameId);
    await logActivity({
      userId,
      gameId,
      gameTitle,
      activityType: "comment",
      details: `Commented: "${text}" on "${gameTitle || "game"}"`
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetComments(req, res, next) {
  try {
    const { gameId } = gameIdSchema.parse(req.params);
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await getComments(gameId, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleDeleteComment(req, res, next) {
  try {
    const { commentId } = z.object({ commentId: z.string().min(1) }).strict().parse(req.params);
    const { userId } = userIdSchema.parse(req.body);
    const result = await deleteComment(commentId, userId);
    if (!result.deleted) {
      res.status(404).json({ error: "Comment not found or not owned by user" });
      return;
    }
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  FAVORITES
// ═══════════════════════════════════════════════════════════════════════════

export async function handleToggleFavorite(req, res, next) {
  try {
    const { gameId, userId } = favoriteSchema.parse(req.body);
    const result = await toggleFavorite(gameId, userId);

    // Log activity
    const gameTitle = await getGameTitle(gameId);
    await logActivity({
      userId,
      gameId,
      gameTitle,
      activityType: "favorite",
      details: result.favorited ? `Favorited the game "${gameTitle || "game"}"` : `Removed favorited status from "${gameTitle || "game"}"`
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetFavoriteStatus(req, res, next) {
  try {
    const { gameId } = gameIdSchema.parse(req.params);
    const userId = req.query.userId ?? null;
    const result = await getFavoriteStatus(gameId, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetUserFavorites(req, res, next) {
  try {
    const { userId } = userIdSchema.parse(req.params);
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await getUserFavorites(userId, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  SHARES
// ═══════════════════════════════════════════════════════════════════════════

export async function handleRecordShare(req, res, next) {
  try {
    const { gameId, userId, platform } = shareSchema.parse(req.body);
    const result = await recordShare(gameId, userId, platform);

    // Log activity
    const gameTitle = await getGameTitle(gameId);
    await logActivity({
      userId,
      gameId,
      gameTitle,
      activityType: "share",
      details: `Shared "${gameTitle || "game"}" via ${platform || "link"}`
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetShareCount(req, res, next) {
  try {
    const { gameId } = gameIdSchema.parse(req.params);
    const result = await getShareCount(gameId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  AGGREGATE
// ═══════════════════════════════════════════════════════════════════════════

export async function handleGetSocialStats(req, res, next) {
  try {
    const { gameId } = gameIdSchema.parse(req.params);
    const userId = req.query.userId ?? null;
    const result = await getSocialStats(gameId, userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetUserActivities(req, res, next) {
  try {
    const { userId } = z.object({ userId: z.string().min(1) }).parse(req.params);
    const activities = await getUserActivities(userId);
    res.json(activities);
  } catch (error) {
    next(error);
  }
}

export async function handleGetRecentActivities(req, res, next) {
  try {
    const { limit } = z.object({
      limit: z.coerce.number().int().min(1).max(100).default(50),
    }).parse(req.query);
    const activities = await getRecentActivities(limit);
    res.json(activities);
  } catch (error) {
    next(error);
  }
}

export async function handleGetUserLikes(req, res, next) {
  try {
    const { userId } = userIdSchema.parse(req.params);
    const { page, limit } = paginationSchema.parse(req.query);
    const result = await getUserLikes(userId, page, limit);
    res.json(result);
  } catch (error) {
    next(error);
  }
}


const viewSchema = z.object({
  userId: z.string().optional(),
}).strict();

const qualifiedPlaySchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  durationSeconds: z.coerce.number().positive(),
  deviceId: z.string().optional(),
}).strict();

const completionSchema = z.object({
  userId: z.string().min(1),
  completionId: z.string().optional(),
  deviceId: z.string().optional(),
}).strict();

const dailyLoginSchema = z.object({
  userId: z.string().min(1),
  deviceId: z.string().optional(),
}).strict();

const dailyChallengeSchema = z.object({
  userId: z.string().min(1),
  creatorId: z.string().optional(),
  challengeId: z.string().min(1),
  gameId: z.string().optional(),
  deviceId: z.string().optional(),
}).strict();

const remixSchema = z.object({
  newCreatorId: z.string().min(1),
  originalCreatorId: z.string().min(1),
  originalGameId: z.string().optional(),
  remixGameId: z.string().min(1),
  deviceId: z.string().optional(),
}).strict();

const milestoneSchema = z.object({
  userId: z.string().min(1),
  creatorId: z.string().min(1),
  gameId: z.string().optional(),
  milestone: z.enum(["trending_daily_top", "trending_top_100", "featured_browser", "genesis_creator_10000_plays"]),
  deviceId: z.string().optional(),
}).strict();

const economyLeaderboardSchema = z.object({
  economy: z.enum(["kp", "player", "cs", "creator"]).default("cs"),
  period: z.enum(["weekly", "all-time"]).default("all-time"),
  limit: z.coerce.number().int().min(1).max(500).default(100),
}).strict();

function requestSignals(req, deviceId) {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = String(Array.isArray(forwarded) ? forwarded[0] : forwarded || req.ip || "")
    .split(",")[0]
    .trim();
  return {
    ip,
    deviceId: deviceId || req.get("x-device-id") || undefined,
  };
}

export async function handleRecordView(req, res, next) {
  try {
    const { gameId } = req.params;
    const { userId } = viewSchema.parse(req.body ?? {});
    const result = await recordView(gameId, userId);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetViewCount(req, res, next) {
  try {
    res.json(await getViewCount(req.params.gameId));
  } catch (error) {
    next(error);
  }
}

export async function handleRecordQualifiedPlay(req, res, next) {
  try {
    const input = qualifiedPlaySchema.parse(req.body ?? {});
    const result = await recordQualifiedPlay(req.params.gameId, {
      ...input,
      signals: requestSignals(req, input.deviceId),
    });
    res.status(result.qualified ? 201 : 202).json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleRecordCompletion(req, res, next) {
  try {
    const input = completionSchema.parse(req.body ?? {});
    const result = await recordGameCompletion(req.params.gameId, {
      ...input,
      signals: requestSignals(req, input.deviceId),
    });
    res.status(result.completed ? 201 : 202).json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleDailyLogin(req, res, next) {
  try {
    const input = dailyLoginSchema.parse(req.body ?? {});
    res.status(201).json(await recordDailyLogin({
      ...input,
      signals: requestSignals(req, input.deviceId),
    }));
  } catch (error) {
    next(error);
  }
}

export async function handleDailyChallenge(req, res, next) {
  try {
    const input = dailyChallengeSchema.parse(req.body ?? {});
    if (req.auth && !authOwnsIdentity(req.auth, input.userId)) {
      res.status(403).json({ error: "Cannot claim a challenge for another user" });
      return;
    }
    const userId = req.auth?.userId ?? input.userId;
    res.status(201).json(await recordDailyChallenge({
      ...input,
      userId,
      creatorId: userId,
      aliases: req.auth ? authIdentityAliases(req.auth) : [userId],
      signals: requestSignals(req, input.deviceId),
    }));
  } catch (error) {
    next(error);
  }
}

export async function handleRecordRemix(req, res, next) {
  try {
    const input = remixSchema.parse(req.body ?? {});
    res.status(201).json(await recordRemix({
      ...input,
      signals: requestSignals(req, input.deviceId),
    }));
  } catch (error) {
    next(error);
  }
}

export async function handleRecordMilestone(req, res, next) {
  try {
    const input = milestoneSchema.parse(req.body ?? {});
    res.status(201).json(await recordMilestone({
      ...input,
      signals: requestSignals(req, input.deviceId),
    }));
  } catch (error) {
    next(error);
  }
}

const followSchema = z.object({
  creatorId: z.string().min(1),
  userId: z.string().min(1),
}).strict();

export async function handleToggleFollow(req, res, next) {
  try {
    const { creatorId, userId: submittedUserId } = followSchema.parse(req.body);
    // The authenticated DogeOS wallet always wins over a client-submitted id.
    const userId = req.auth?.userId ?? submittedUserId;
    if (creatorId === userId) {
      res.status(400).json({ error: "You cannot follow yourself" });
      return;
    }
    res.status(201).json(await toggleFollow(creatorId, userId));
  } catch (error) {
    next(error);
  }
}

export async function handleGetFollowStatus(req, res, next) {
  try {
    res.json(await getFollowStatus(req.params.creatorId, req.query.userId));
  } catch (error) {
    next(error);
  }
}

export async function handleGetFollowing(req, res, next) {
  try {
    const requestedId = req.params.userId;
    const aliases = authOwnsIdentity(req.auth, requestedId)
      ? authIdentityAliases(req.auth)
      : [requestedId];
    res.json(await getFollowingList(requestedId, aliases));
  } catch (error) {
    next(error);
  }
}

export async function handleGetCreatorStats(req, res, next) {
  try {
    const requestedId = req.params.creatorId;
    const canonicalCreatorId = req.auth?.userId ?? requestedId;
    // Same resolution the creator dashboard uses: an authenticated caller always
    // gets their OWN full identity alias set from the token, so stats count every
    // game across their linked identities regardless of
    // which id form the client sent in the URL. In this app every creator-stats
    // call is a user viewing their own profile/home, so we trust the token over
    // the URL id. Only unauthenticated requests fall back to the requested id.
    const callerAliases = authIdentityAliases(req.auth);
    const aliases = callerAliases.length > 0 ? callerAliases : [requestedId].filter(Boolean);
    res.json(await getCreatorStats(canonicalCreatorId, aliases));
  } catch (error) {
    next(error);
  }
}

const profileSchema = z.object({
  userId: z.string().min(1),
  username: z.string().min(1).max(32),
}).strict();

export async function handleUpdateProfile(req, res, next) {
  try {
    const { userId: submittedUserId, username } = profileSchema.parse(req.body);
    if (req.auth && !authOwnsIdentity(req.auth, submittedUserId)) {
      res.status(403).json({ error: "Cannot update another user's profile" });
      return;
    }
    const userId = req.auth?.userId ?? submittedUserId;
    const aliases = req.auth ? authIdentityAliases(req.auth) : [userId];
    const result = await setProfileUsername({ userId, username, aliases });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function handleGetProfile(req, res, next) {
  try {
    const { userId } = userIdSchema.parse(req.params);
    const ownsIdentity = authOwnsIdentity(req.auth, userId);
    const canonicalUserId = ownsIdentity ? (req.auth?.userId ?? userId) : userId;
    const aliases = ownsIdentity ? authIdentityAliases(req.auth) : [userId];
    res.json(await getProfileUsername(canonicalUserId, aliases));
  } catch (error) {
    next(error);
  }
}

export async function handleGetPointSummary(req, res, next) {
  try {
    const { userId } = userIdSchema.parse(req.params);
    const ownsIdentity = authOwnsIdentity(req.auth, userId);
    const canonicalUserId = ownsIdentity ? (req.auth?.userId ?? userId) : userId;
    const aliases = ownsIdentity
      ? authIdentityAliases(req.auth)
      : [userId];
    const summary = await getPointSummary(canonicalUserId, aliases);
    res.json({
      userId,
      dogeGamePoints: summary?.dogeGamePoints ?? 0,
      level: summary?.level ?? null,
      lifetimePoints: summary?.lifetimePoints ?? summary?.dogeGamePoints ?? 0,
      dailyPoints: summary?.dailyPoints ?? {},
      weeklyPoints: summary?.weeklyPoints ?? {},
      currentDay: summary?.currentDay ?? null,
      currentWeek: summary?.currentWeek ?? null,
      updatedAt: summary?.updatedAt ?? null,
    });
  } catch (error) {
    next(error);
  }
}

export async function handleGetEconomyLeaderboard(req, res, next) {
  try {
    const query = economyLeaderboardSchema.parse(req.query);
    res.json(await getEconomyLeaderboard(query));
  } catch (error) {
    next(error);
  }
}

export async function handleGetTopViewed(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    res.json({ games: await getTopViewed(limit) });
  } catch (error) {
    next(error);
  }
}

export async function handleGetDailyChallenges(req, res, next) {
  try {
    const { userId } = userIdSchema.parse(req.params);
    // Dashboard method: an authenticated caller always resolves from their full
    // token alias set, so progress counts activity across all their linked
    // logins regardless of which id form the client sent.
    const callerAliases = authIdentityAliases(req.auth);
    const canonicalUserId = callerAliases.length > 0 ? (req.auth?.userId ?? userId) : userId;
    const aliases = callerAliases.length > 0 ? callerAliases : [userId];
    res.json(await getDailyChallenges(canonicalUserId, aliases));
  } catch (error) {
    next(error);
  }
}

export async function handleGetAchievements(req, res, next) {
  try {
    const { userId } = userIdSchema.parse(req.params);
    // Dashboard method: resolve from the caller's full token alias set so
    // unlocks (published games, likes, plays, score, DP) count everything they
    // own across their linked identities.
    const callerAliases = authIdentityAliases(req.auth);
    const canonicalUserId = callerAliases.length > 0 ? (req.auth?.userId ?? userId) : userId;
    const aliases = callerAliases.length > 0 ? callerAliases : [userId];
    res.json(await getAchievements(canonicalUserId, aliases));
  } catch (error) {
    next(error);
  }
}

const notificationQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
}).strict();

const notificationCreateSchema = z.object({
  userId: z.string().min(1),
  type: z.string().min(1).max(64),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  gameId: z.string().min(1).nullable().optional(),
  actorId: z.string().min(1).nullable().optional(),
  metadata: z.record(z.any()).optional(),
}).strict();

export async function handleGetNotifications(req, res, next) {
  try {
    const { userId } = userIdSchema.parse(req.params);
    const query = notificationQuerySchema.parse(req.query);
    res.json(await getNotifications(userId, query));
  } catch (error) {
    next(error);
  }
}

export async function handleCreateNotification(req, res, next) {
  try {
    // The sender is always the signed-in wallet, never a client-supplied id.
    const input = { ...notificationCreateSchema.parse(req.body), actorId: req.auth.userId };
    const notification = await createUserNotification(input);
    res.status(201).json({ notification });
  } catch (error) {
    next(error);
  }
}

export async function handleMarkNotificationsRead(req, res, next) {
  try {
    const { userId } = userIdSchema.parse(req.params);
    res.json(await markNotificationsRead(userId));
  } catch (error) {
    next(error);
  }
}
