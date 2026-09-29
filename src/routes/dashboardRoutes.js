import { Router } from "express";
import { requireAuth } from "../services/authService.js";
import { creatorDashboard } from "../controllers/dashboardController.js";

export const dashboardRouter = Router();

dashboardRouter.get("/creator", requireAuth, creatorDashboard);
