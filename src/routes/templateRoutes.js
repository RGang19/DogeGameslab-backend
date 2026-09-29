import { Router } from "express";
import { exportTemplates, indexTemplates, showTemplate } from "../controllers/templateController.js";

export const templateRouter = Router();

templateRouter.get("/", indexTemplates);
templateRouter.get("/export", exportTemplates);
templateRouter.get("/:templateId", showTemplate);
