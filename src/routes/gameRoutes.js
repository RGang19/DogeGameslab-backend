import { Router } from "express";
import {
  createGame,
  deleteGame,
  exportGameCode,
  featureGameInBrowser,
  generateGame,
  checkGenerationAccess,
  showGenerationQuota,
  listBrowserFeaturedGames,
  listGames,
  publishGame,
  refineGame,
  saveGame,
  showManagedGame,
  showPublicGame,
  unfeatureGameInBrowser,
  unpublishGame
} from "../controllers/gameController.js";
import { optionalAuth, requireAuth } from "../services/authService.js";

export const gameRouter = Router();

gameRouter.get("/list", optionalAuth, listGames);
gameRouter.get("/browser-featured", listBrowserFeaturedGames);
gameRouter.get("/generation-access", requireAuth, checkGenerationAccess);
gameRouter.get("/generation-quota", requireAuth, showGenerationQuota);
gameRouter.post("/create", requireAuth, createGame);
gameRouter.post("/generate-from-prompt", requireAuth, generateGame);
gameRouter.post("/refine", requireAuth, refineGame);
gameRouter.post("/export-code", requireAuth, exportGameCode);
gameRouter.post("/:gameId/publish", requireAuth, publishGame);
gameRouter.delete("/:gameId/publish", requireAuth, unpublishGame);
gameRouter.post("/:gameId/browser-feature", requireAuth, featureGameInBrowser);
gameRouter.delete("/:gameId/browser-feature", requireAuth, unfeatureGameInBrowser);
gameRouter.get("/:gameId/manage", requireAuth, showManagedGame);
gameRouter.get("/:gameId", showPublicGame);
gameRouter.put("/:gameId", requireAuth, saveGame);
gameRouter.delete("/:gameId", requireAuth, deleteGame);
