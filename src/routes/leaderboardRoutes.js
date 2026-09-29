import { Router } from "express";
import {
  handleGetCreatorScoreLeaderboard,
  handleGetDogeGamePointsLeaderboard,
  handleGetLeaderboard,
  handleSubmitScore,
} from "../controllers/leaderboardController.js";

import { actAsWallet } from "../middleware/walletIdentity.js";

export const leaderboardRouter = Router();

leaderboardRouter.get("/creators", handleGetCreatorScoreLeaderboard);
leaderboardRouter.get("/dogegame-points", handleGetDogeGamePointsLeaderboard);
leaderboardRouter.get("/:gameId", handleGetLeaderboard);
leaderboardRouter.post("/:gameId/scores", actAsWallet(), handleSubmitScore);
