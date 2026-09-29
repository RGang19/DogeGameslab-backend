import { Router } from "express";
import multer from "multer";
import { serveThumbnail, uploadThumbnailHandler, listThumbnails } from "../controllers/thumbnailController.js";
import { requireAuth } from "../services/authService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  }
});

export const thumbnailRouter = Router();

thumbnailRouter.get("/", listThumbnails);
thumbnailRouter.get("/:templateId", serveThumbnail);
thumbnailRouter.post("/:templateId", requireAuth, upload.single("thumbnail"), uploadThumbnailHandler);
