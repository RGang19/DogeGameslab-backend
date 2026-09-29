import { Router } from "express";
import {
  analyzeReference,
  backgroundTask,
  generateAssets,
  generateCode,
  enhancePrompt,
  getAgentStack,
  getJobStatus,
  orchestrate,
  transcribeVoice
} from "../controllers/agentController.js";
import { requireAuth } from "../services/authService.js";

export const agentRouter = Router();

agentRouter.get("/stack", getAgentStack);
agentRouter.get("/jobs/:jobId", getJobStatus);
agentRouter.post("/orchestrate", requireAuth, orchestrate);
agentRouter.post("/enhance-prompt", requireAuth, enhancePrompt);
agentRouter.post("/code", requireAuth, generateCode);
agentRouter.post("/background", requireAuth, backgroundTask);
agentRouter.post("/assets", requireAuth, generateAssets);
agentRouter.post("/vision", requireAuth, analyzeReference);
agentRouter.post("/transcribe", requireAuth, transcribeVoice);
