import { Router } from "express";
import { optionalAuth, requireAuth } from "../services/authService.js";
import {
  handleToggleLike,
  handleGetLikeStatus,
  handleAddComment,
  handleGetComments,
  handleDeleteComment,
  handleToggleFavorite,
  handleGetFavoriteStatus,
  handleGetUserFavorites,
  handleRecordShare,
  handleGetShareCount,
  handleGetSocialStats,
  handleGetUserActivities,
  handleGetRecentActivities,
  handleGetUserLikes,
  handleRecordView,
  handleGetViewCount,
  handleRecordQualifiedPlay,
  handleRecordCompletion,
  handleDailyLogin,
  handleDailyChallenge,
  handleRecordRemix,
  handleRecordMilestone,
  handleToggleFollow,
  handleGetFollowStatus,
  handleGetFollowing,
  handleGetCreatorStats,
  handleUpdateProfile,
  handleGetProfile,
  handleGetPointSummary,
  handleGetEconomyLeaderboard,
  handleGetTopViewed,
  handleGetDailyChallenges,
  handleGetAchievements,
  handleGetNotifications,
  handleCreateNotification,
  handleMarkNotificationsRead,
} from "../controllers/socialController.js";

import { actAsWallet, optionalWalletActor, ownWalletParam } from "../middleware/walletIdentity.js";

export const socialRouter = Router();

// Resolve the signed-in DogeOS wallet whenever a token is available. Writes act
// as that wallet (the one primary key for a user); public reads still work.
socialRouter.use(optionalAuth);

// Aggregate stats for a game
socialRouter.get("/stats/:gameId", handleGetSocialStats);

// Likes
socialRouter.post("/likes/toggle", actAsWallet(), handleToggleLike);
socialRouter.get("/likes/:gameId", handleGetLikeStatus);
socialRouter.get("/likes/user/:userId", handleGetUserLikes);

// Comments
socialRouter.post("/comments", actAsWallet(), handleAddComment);
socialRouter.get("/comments/:gameId", handleGetComments);
socialRouter.delete("/comments/:commentId", actAsWallet(), handleDeleteComment);

// Favorites
socialRouter.post("/favorites/toggle", actAsWallet(), handleToggleFavorite);
socialRouter.get("/favorites/:gameId", handleGetFavoriteStatus);
socialRouter.get("/favorites/user/:userId", handleGetUserFavorites);

// Shares
socialRouter.post("/shares", actAsWallet(), handleRecordShare);
socialRouter.get("/shares/:gameId", handleGetShareCount);

// User activities
socialRouter.get("/activity/recent", handleGetRecentActivities);
socialRouter.get("/activity/user/:userId", handleGetUserActivities);

// Views (plays)
socialRouter.get("/views-top", handleGetTopViewed);
socialRouter.post("/views/:gameId", optionalWalletActor(), handleRecordView);
socialRouter.get("/views/:gameId", handleGetViewCount);
socialRouter.post("/plays/:gameId/qualify", actAsWallet(), handleRecordQualifiedPlay);
socialRouter.post("/completions/:gameId", actAsWallet(), handleRecordCompletion);

// Dual economy reward hooks
socialRouter.post("/daily-login", actAsWallet(), handleDailyLogin);
socialRouter.post("/daily-challenge", actAsWallet(), handleDailyChallenge);
socialRouter.post("/remixes", actAsWallet("newCreatorId"), handleRecordRemix);
socialRouter.post("/milestones", actAsWallet(), handleRecordMilestone);

// Follows
socialRouter.post("/follows/toggle", actAsWallet(), handleToggleFollow);
socialRouter.get("/follows/user/:userId", handleGetFollowing);
socialRouter.get("/follows/:creatorId", handleGetFollowStatus);

// Creator profile stats (real numbers)
socialRouter.post("/profile", actAsWallet(), handleUpdateProfile);
socialRouter.get("/profile/:userId", handleGetProfile);
socialRouter.get("/creator-stats/:creatorId", handleGetCreatorStats);
socialRouter.get("/points/:userId", handleGetPointSummary);
socialRouter.get("/economy-leaderboard", handleGetEconomyLeaderboard);
socialRouter.get("/daily-challenges/:userId", handleGetDailyChallenges);
socialRouter.get("/achievements/:userId", handleGetAchievements);
socialRouter.get("/notifications/:userId", ownWalletParam, handleGetNotifications);
socialRouter.post("/notifications", requireAuth, handleCreateNotification);
socialRouter.post("/notifications/:userId/read", ownWalletParam, handleMarkNotificationsRead);
