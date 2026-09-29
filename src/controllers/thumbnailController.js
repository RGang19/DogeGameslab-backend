import { getThumbnail, uploadThumbnail, listThumbnailIds } from "../services/thumbnailService.js";

export async function serveThumbnail(request, response) {
  try {
    const { templateId } = request.params;
    const thumbnail = await getThumbnail(templateId);

    if (!thumbnail) {
      response.status(404).json({ error: "Thumbnail not found", templateId });
      return;
    }

    // Images live in object storage now — redirect so the browser fetches
    // (and caches) straight from the bucket/CDN.
    if (thumbnail.url) {
      response.redirect(301, thumbnail.url);
      return;
    }
    if (!thumbnail.data) {
      response.status(404).json({ error: "Thumbnail not found", templateId });
      return;
    }

    const imageBuffer = thumbnail.data.buffer
      ? Buffer.from(thumbnail.data.buffer)
      : thumbnail.data;

    response.set("Content-Type", thumbnail.contentType || "image/png");
    response.set("Cache-Control", "public, max-age=86400, immutable");
    response.set("Cross-Origin-Resource-Policy", "cross-origin");
    response.set("Content-Length", imageBuffer.length);
    response.send(imageBuffer);
  } catch (error) {
    console.error("Error serving thumbnail:", error);
    response.status(500).json({ error: "Failed to serve thumbnail" });
  }
}

export async function uploadThumbnailHandler(request, response) {
  try {
    const { templateId } = request.params;

    if (!request.file) {
      response.status(400).json({ error: "No file uploaded" });
      return;
    }

    const result = await uploadThumbnail(
      templateId,
      request.file.buffer,
      request.file.mimetype,
      request.file.originalname
    );

    response.json({ ok: true, ...result });
  } catch (error) {
    console.error("Error uploading thumbnail:", error);
    response.status(500).json({ error: "Failed to upload thumbnail" });
  }
}

export async function listThumbnails(_request, response) {
  try {
    const thumbnails = await listThumbnailIds();
    response.json({ thumbnails });
  } catch (error) {
    console.error("Error listing thumbnails:", error);
    response.status(500).json({ error: "Failed to list thumbnails" });
  }
}
