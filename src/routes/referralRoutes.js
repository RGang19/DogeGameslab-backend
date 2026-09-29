import { Router } from "express";
import {
  approveReferral,
  heldReferrals,
  qualifyFirstGame,
  referralMe,
} from "../controllers/referralController.js";
import { requireAuth } from "../services/authService.js";

export const referralRouter = Router();
export const referralAdminRouter = Router();

referralRouter.get("/me", requireAuth, referralMe);
referralRouter.post("/qualify", requireAuth, qualifyFirstGame);

referralAdminRouter.get("/held", heldReferrals);
referralAdminRouter.post("/:id/approve", approveReferral);
