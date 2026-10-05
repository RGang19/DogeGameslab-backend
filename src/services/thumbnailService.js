import { getDatabase, getGameCollection } from "./databaseService.js";
import sharp from "sharp";
import { isObjectStorageConfigured, uploadPublicObject } from "./objectStorageService.js";
import { callZeroGChat, generateImageAsset, getModelsForTier } from "./zeroGService.js";
import opentype from "opentype.js";
import { readFileSync } from "node:fs";
import { putBufferOnZeroG } from "./zeroGStorage.js";
import { logActivityOnChain, ACTIVITY } from "./zeroGActivityLog.js";
import { DOGECOIN_ART_RULE } from "./dogeHeroService.js";
import { fileURLToPath } from "node:url";

const COVER_FONT_FILE = fileURLToPath(new URL("../../assets/fonts/LuckiestGuy-Regular.ttf", import.meta.url));

const COLLECTION_NAME = "thumbnails";
const THUMBNAIL_WIDTH = 384;
const THUMBNAIL_HEIGHT = 576;

export async function getThumbnailCollection() {
  const database = await getDatabase();
  return database.collection(COLLECTION_NAME);
}

export async function uploadThumbnail(templateId, buffer, contentType, fileName) {
  const collection = await getThumbnailCollection();
  const zeroGStorage = await putBufferOnZeroG({
    objectType: "thumbnail",
    objectId: templateId,
    buffer,
    contentType,
    fileName,
    metadata: { templateId }
  });
  // 0G on-chain: an asset-stored event.
  logActivityOnChain(ACTIVITY.ASSET_STORED, templateId);

  // Primary store is the object store (Cloudflare R2) — Mongo keeps only the
  // public URL. If that upload fails, fall through to Mongo binary storage
  // instead of losing the thumbnail.
  const storeUrl = async () => (isObjectStorageConfigured()
    ? uploadPublicObject(`thumbnails/${encodeURIComponent(templateId)}`, buffer, contentType)
    : null);
  let url = null;
  try {
    url = await storeUrl();
  } catch (error) {
    console.warn("Thumbnail store failed; keeping it in Mongo instead", { templateId, message: error.message });
  }
  if (url) {
    await collection.updateOne(
      { templateId },
      {
        $set: { templateId, url, contentType, fileName, zeroGStorage, updatedAt: new Date() },
        $unset: { data: "" },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );
    return { templateId, contentType, fileName, url };
  }

  // Fallback (no store configured, or it failed): legacy binary storage.
  await collection.updateOne(
    { templateId },
    {
      $set: { templateId, data: buffer, contentType, fileName, zeroGStorage, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() }
    },
    { upsert: true }
  );
  return { templateId, contentType, fileName, zeroGStorage };
}

export async function getThumbnail(templateId) {
  const collection = await getThumbnailCollection();
  return collection.findOne({ templateId });
}

export async function listThumbnailIds() {
  const collection = await getThumbnailCollection();
  return collection
    .find({}, { projection: { templateId: 1, contentType: 1, fileName: 1, _id: 0 } })
    .toArray();
}

async function downloadImage(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Thumbnail download failed with status ${response.status}`);
  }
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get("content-type") || "image/png"
  };
}

/**
 * Generates a cover image for a freshly generated game (hybrid or pure-agent),
 * downloads it, stores the binary in the thumbnails collection like every
 * other image, and points the saved game record at the served URL.
 * Runs as a background job — never blocks game generation.
 */
// A short, uppercase cover title (max 3 words) — image models render short
// text far more legibly than long strings, so we trim the game title down.
export function coverTitle(title) {
  const cleaned = String(title || "").replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return (cleaned.split(" ").slice(0, 3).join(" ") || "GAME").toUpperCase();
}

// Deterministic gradient from the game id so each fallback cover looks distinct.
function fallbackGradient(seed) {
  const palettes = [
    ["#7c3aed", "#d946ef", "#0b0419"], ["#0ea5e9", "#22d3ee", "#0b1220"],
    ["#f59e0b", "#db2777", "#1a0b0b"], ["#10b981", "#14b8a6", "#04140f"],
    ["#ef4444", "#f97316", "#1a0705"], ["#6366f1", "#8b5cf6", "#0a0a1f"]
  ];
  let h = 0;
  for (const ch of String(seed || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palettes[h % palettes.length];
}

// A real WEBP cover rendered locally (no SVG data-URI, no network). Used only
// when the image model can't produce a picture, so EVERY game still ends up
// with a proper webp thumbnail hosted the same way as generated ones.
async function renderFallbackCoverWebp(game) {
  const [c1, c2, bg] = fallbackGradient(game.id);
  const title = coverTitle(game.title);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}" viewBox="0 0 384 576">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="0.55" stop-color="${c2}"/><stop offset="1" stop-color="${bg}"/>
    </linearGradient></defs>
    <rect width="384" height="576" fill="${bg}"/>
    <rect x="14" y="14" width="356" height="548" rx="26" fill="url(#g)"/>
    <circle cx="110" cy="180" r="90" fill="#ffffff" opacity="0.12"/>
    <path d="M40 470 L150 250 L230 380 L290 270 L344 470 Z" fill="#000000" opacity="0.28"/>
    <rect x="34" y="470" width="316" height="72" rx="16" fill="#000000" opacity="0.55"/>
    <text x="192" y="516" text-anchor="middle" fill="#ffffff" font-family="Arial,Helvetica,sans-serif" font-size="30" font-weight="800">${title.replace(/[<&>]/g, "")}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).webp({ quality: 90 }).toBuffer();
}

// The title as it appears on the cover: the real game title, cleaned of
// characters the display font can't draw.
function coverTitleText(title) {
  const cleaned = String(title || "").replace(/[^\p{L}\p{N}\s:!?&'.-]/gu, " ").replace(/\s+/g, " ").trim();
  return (cleaned || "GAME").toUpperCase().slice(0, 48);
}

let coverFont = null;
function loadCoverFont() {
  if (!coverFont) {
    const file = readFileSync(COVER_FONT_FILE);
    coverFont = opentype.parse(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength));
  }
  return coverFont;
}

// Splits the title into 1-3 lines and picks the largest font size at which
// every line fits the box.
function layoutCoverTitle(font, text, maxWidth, maxHeight) {
  const words = text.split(" ");
  const widthAt = (line, size) => font.getAdvanceWidth(line, size);
  let best = null;
  for (let lineCount = 1; lineCount <= Math.min(3, words.length); lineCount += 1) {
    // Balance the lines by character count.
    const target = text.length / lineCount;
    const lines = [];
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (current && next.length > target + 2 && lines.length < lineCount - 1) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    lines.push(current);
    const widest = Math.max(...lines.map((line) => widthAt(line, 100)));
    const size = Math.min(64, (maxWidth / widest) * 100, maxHeight / (lines.length * 1.04));
    if (!best || size > best.size) best = { lines, size };
  }
  return best;
}

// Draws the game title on top of the cover art. Image models misspell text, so
// the art is generated WITHOUT lettering and the title is drawn here from the
// real string. The letters are converted to vector outlines from the bundled
// font, so the result is identical on every server (no installed fonts needed).
async function overlayCoverTitle(coverBuffer, title) {
  const font = loadCoverFont();
  const text = coverTitleText(title);
  const marginX = 24;
  const top = 30;
  const { lines, size } = layoutCoverTitle(font, text, THUMBNAIL_WIDTH - marginX * 2, 168);
  const lineHeight = size * 1.04;
  const paths = lines
    .map((line, index) => {
      const x = (THUMBNAIL_WIDTH - font.getAdvanceWidth(line, size)) / 2;
      const baseline = top + size * 0.86 + index * lineHeight;
      return font.getPath(line, x, baseline, size).toPathData(2);
    })
    .join(" ");
  const stroke = Math.max(5, size * 0.2);
  const blockBottom = top + lines.length * lineHeight + 26;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${THUMBNAIL_WIDTH}" height="${THUMBNAIL_HEIGHT}">
    <defs>
      <linearGradient id="shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#0b1026" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#0b1026" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff"/>
        <stop offset="1" stop-color="#ffe9a8"/>
      </linearGradient>
    </defs>
    <rect width="${THUMBNAIL_WIDTH}" height="${Math.round(blockBottom + 40)}" fill="url(#shade)"/>
    <path d="${paths}" transform="translate(0 4)" fill="#000000" opacity="0.45" stroke="#000000" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="${paths}" fill="none" stroke="#14213d" stroke-width="${stroke}" stroke-linejoin="round"/>
    <path d="${paths}" fill="url(#fill)"/>
  </svg>`;
  return sharp(coverBuffer)
    .composite([{ input: Buffer.from(svg), left: 0, top: 0 }])
    .webp({ quality: 88 })
    .toBuffer();
}

// What the cover picture should show: a short scene description built from the
// game, phrased positively. The title and words such as "cover" or "Ð" are left
// out because they make image models paint lettering and coin symbols.
function coverArtPrompt(game) {
  const source = String(game.generation?.prompt || game.prompt || game.customization?.prompt || "")
    .replace(/Ð\s*coins?/gi, "gold dog-face coins")
    .replace(/[Ð₿$]/g, "")
    .replace(/\b(dogecoin|bitcoin|crypto\w*)\b/gi, "gold coin")
    .replace(/\b(HUD|UI|button\w*|menu\w*|score\w*|title\w*|text|label\w*|swipe\w*|tap\w*|arrow keys?)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 420);
  return [
    "A single wordless illustration of one exciting moment from a video game, shown as a scene, like a painting",
    source,
    game.gameplay?.mechanic,
    game.visuals?.mood,
    (game.visuals?.colors ?? []).slice(0, 3).join(" "),
    "polished colorful digital illustration, one clear main character in action in the lower two thirds",
    "the top quarter of the picture is calm open sky or plain background",
    DOGECOIN_ART_RULE,
    "pure artwork only: a clean picture with blank unmarked surfaces, vertical 2:3 portrait"
  ].filter(Boolean).join(", ");
}

// Asks the vision model whether the art came out clean. Image models sometimes
// paint lettering, a Bitcoin symbol or interface buttons no matter the prompt;
// a flagged picture is regenerated. Returns the number of problems (0 = clean),
// or 0 when the check itself can't run, so a cover is never blocked by it.
async function countCoverArtProblems(webpBuffer) {
  try {
    const response = await callZeroGChat({
      model: getModelsForTier(1).vision,
      maxTokens: 200,
      temperature: 0,
      retries: 1,
      timeoutMs: 45000,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            // Asking what it can READ is far more reliable than a yes/no question.
            text: 'Inspect this picture carefully. Reply with ONLY JSON: {"words": "<every word or letter sequence you can actually read in the picture, exactly as written, or empty string if there is no writing>", "coin_symbols": "<describe what is embossed on the coins: e.g. dog face, letter B, dollar sign, plain, or none if no coins>", "interface": "<list any on-screen game controls such as arrow buttons, or none>"}'
          },
          { type: "image_url", image_url: { url: `data:image/webp;base64,${webpBuffer.toString("base64")}` } }
        ]
      }]
    });
    const seen = JSON.parse(response.content.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    const hasWriting = String(seen.words ?? "").replace(/[^\p{L}\p{N}]/gu, "").length >= 2;
    const wrongCoin = /\bB\b|bitcoin|₿|dollar|\$|ethereum|\bbtc\b/i.test(String(seen.coin_symbols ?? ""));
    const hasInterface = !/^\s*(none|no|n\/a)?\s*$/i.test(String(seen.interface ?? ""));
    return [hasWriting, wrongCoin, hasInterface].filter(Boolean).length;
  } catch (error) {
    console.warn("Cover art check skipped", { message: error.message });
    return 0;
  }
}

const COVER_ART_ATTEMPTS = Math.max(1, Number(process.env.COVER_ART_ATTEMPTS) || 3);

export async function generateAndStoreGameThumbnail(game) {
  if (!game?.id) throw new Error("game.id is required for thumbnail generation");

  const prompt = coverArtPrompt(game);

  // Request a native 2:3 portrait composition, then normalize the stored file
  // to the exact dimensions used by mobile and tablet game cards. generateImageAsset
  // already has an internal timeout + retries; if the image model still can't
  // deliver, we render a real webp cover locally instead of throwing — so the
  // job ALWAYS finishes with a webp, never hangs, and never leaves an SVG.
  let result = { model: null };
  let buffer;
  let contentType = "image/webp";
  let usedFallback = false;
  try {
    // Generate the art, check it, and regenerate if it has lettering, a Bitcoin
    // symbol or interface buttons. The cleanest attempt is kept.
    let best = null;
    for (let attempt = 1; attempt <= COVER_ART_ATTEMPTS; attempt += 1) {
      let generated;
      try {
        generated = await generateImageAsset({ prompt, size: "1024x1536" });
      } catch (error) {
        if (best) break;
        generated = await generateImageAsset({ prompt });
      }
      const image = generated.images?.[0];
      let source;
      if (image?.b64_json) {
        source = Buffer.from(image.b64_json, "base64");
      } else if (image?.url) {
        ({ buffer: source } = await downloadImage(image.url));
      } else {
        throw new Error("Image agent returned no image");
      }
      const art = await sharp(source)
        .resize(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, { fit: "cover", position: "centre" })
        .webp({ quality: 88 })
        .toBuffer();
      const problems = await countCoverArtProblems(art);
      if (!best || problems < best.problems) best = { art, problems, generated };
      if (problems === 0) break;
      console.warn("Cover art had unwanted content; regenerating", { gameId: game.id, attempt, problems });
    }
    result = best.generated;
    buffer = best.art;
    try {
      buffer = await overlayCoverTitle(buffer, game.title);
    } catch (error) {
      // The art alone is still a valid cover; the card shows the title under it.
      console.warn("Cover title overlay failed; keeping the art without a title", { gameId: game.id, message: error.message });
    }
  } catch (error) {
    console.warn("Thumbnail image model unavailable; rendering webp fallback cover", { gameId: game.id, message: error.message });
    buffer = await renderFallbackCoverWebp(game);
    result = { model: "webp-fallback" };
    usedFallback = true;
  }

  // Primary store: Cloudflare R2 — the public URL goes onto the game
  // record in MongoDB and the frontend renders it directly. Falls back to the
  // Mongo-served thumbnail when R2 is unavailable.
  const zeroGStorage = await putBufferOnZeroG({
    objectType: "thumbnail",
    objectId: game.id,
    buffer,
    contentType,
    fileName: `${game.id}.webp`,
    metadata: {
      gameId: game.id,
      title: game.title ?? null,
      sourceModel: result.model ?? null,
      width: THUMBNAIL_WIDTH,
      height: THUMBNAIL_HEIGHT
    }
  });
  let thumbnailUrl;
  if (isObjectStorageConfigured()) {
    try {
      const uploadedUrl = await uploadPublicObject(
        `thumbnails/${encodeURIComponent(game.id)}`,
        buffer,
        contentType
      );
      thumbnailUrl = `${uploadedUrl}?v=${Date.now()}`;
    } catch (error) {
      console.warn("Object storage upload failed; falling back to Mongo thumbnail", { message: error.message });
    }
  }
  if (!thumbnailUrl) {
    await uploadThumbnail(game.id, buffer, contentType, `${game.id}.webp`);
    thumbnailUrl = `/api/thumbnails/${encodeURIComponent(game.id)}`;
  }

  const games = await getGameCollection();
  await games.updateOne(
    { id: game.id },
    {
      $set: {
        thumbnailUrl,
        thumbnailModel: result.model,
        thumbnailWidth: THUMBNAIL_WIDTH,
        thumbnailHeight: THUMBNAIL_HEIGHT,
        thumbnailZeroGStorage: zeroGStorage,
        thumbnailIsFallback: usedFallback,
        updatedAt: new Date()
      }
    }
  );

  return {
    gameId: game.id,
    thumbnailUrl,
    model: result.model,
    usedFallback,
    bytes: buffer.length,
    width: THUMBNAIL_WIDTH,
    height: THUMBNAIL_HEIGHT,
    zeroGStorage
  };
}
