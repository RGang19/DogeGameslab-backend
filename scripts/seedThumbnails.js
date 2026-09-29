/**
 * Seed Script: Reads thumbnail images from the frontend's public directory
 * and uploads them into the MongoDB `thumbnails` collection.
 *
 * Usage:  node scripts/seedThumbnails.js
 *
 * Requires MONGODB_URI in backend/.env (already configured).
 */

import { readFileSync, existsSync } from "fs";
import { resolve, extname, basename } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const FRONTEND_PUBLIC = resolve(__dirname, "../../creator-studio-frontend/public");

// Mapping of templateId → relative file path inside the frontend public dir.
// Sourced from studio-meta.ts templateThumbnails.
const thumbnailMap = {
  "flappy": "thumbnails/flappy-cover.png",
  "match3": "thumbnails/match3-cover.png",
  "chess": "thumbnails/chess-cover.png",
  "clicker": "thumbnails/clicker-cover.png",
  "memory": "thumbnails/memory-cover.png",
  "quiz": "thumbnails/quiz-cover.png",
  "drawing": "thumbnails/drawing-cover.png",
  "runner": "thumbnails/runner-cover.png",
  "racing": "thumbnails/racing-cover.png",
  "idle": "thumbnails/idle-cover.png",
  "ai-arena": "thumbnails/ai-arena-cover.png",
  "cyber-runner": "thumbnails/cyber-runner-cover.png",
  "space-shooter": "thumbnails/space-shooter-cover.png",
  "minigames": "thumbnails/minigames-cover.png",
  "realistic-driving": "thumbnails/realistic-driving-cover.png",
  "fps-survival": "thumbnails/fps-survival-cover.png",
  "flight-sim": "thumbnails/flight-sim-cover.png",
  "neon-sudoku": "thumbnails/neon-sudoku-cover.png",
  "simple-agent-game": "thumbnails/simple-agent-game-cover.png",
  "cratch-royale": "thumbnails/cratch-royale-cover.png",
  "neon-bounce": "thumbnails/neon-bounce-cover.png",
  "plinko-pro": "thumbnails/plinko-pro-cover.png",
  "stake-mines": "thumbnails/stake-mines-cover.png",
  "unity-karting": "thumbnails/unity-karting-cover.png",
  "unity-fps": "thumbnails/unity-fps.png",
  "unity-zombiesmasher": "thumbnails/unity-zombiesmasher-cover.png",
  "unity-spaceinvaders": "thumbnails/unity-spaceinvaders-cover.png",
  "unity-pong": "thumbnails/unity-pong-cover.png",
  "unity-tetris": "thumbnails/unity-tetris-cover.png",
  "unity-snake": "thumbnails/unity-snake-cover.png",
  "unity-pacman": "thumbnails/unity-pacman-cover.png",
  "unity-towerdefense": "thumbnails/unity-towerdefense-cover.png",
  "unity-solitaire": "thumbnails/unity-solitaire.png",
  "unity-flappybird": "thumbnails/unity-flappybird-cover.png",
  "unity-runner": "thumbnails/unity-runner-cover.png",
  "head-soccer-2026": "templates/head-soccer-2026/icons/icon-256.png",
  "goof-runner": "templates/goof-runner/icons/icon-256.png",
  "mini-racer": "templates/mini-racer/icons/icon-256.png",
  "bubble-shooter": "templates/bubble-shooter/icons/icon-256.png",
  "blocks-match3": "templates/blocks-match3/icons/icon-256.png",
  "happy-halloween-match3": "templates/happy-halloween-match3/icons/icon-256.png",
  "happy-chef-bubble-shooter": "templates/happy-chef-bubble-shooter/icons/icon-256.png",
  "sea-animals": "templates/sea-animals/icon-256.png",
  "christmas-candy": "templates/christmas-candy/icons/icon-256.png",
  "lollipops-match3": "templates/lollipops-match3/icons/icon-256.png",
  "speed-racer": "templates/speed-racer/icons/icon-256.png",
  "candy-match3": "templates/candy-match3/icons/icon-256.png",
  "smiles-match3": "templates/smiles-match3/icons/icon-256.png",
  "valentines-match3": "templates/valentines-match3/icons/icon-256.png",
  "christmas-match3": "templates/christmas-match3/icons/icon-256.png",
  "animals-crash-match3": "templates/animals-crash-match3/icons/icon-256.png",
  "halloween-match3": "templates/halloween-match3/icons/icon-256.png",
  "scary-run": "templates/scary-run/icons/icon-256.png",
  "billiards": "templates/billiards/icons/icon-256.png",
  "crazy-match3": "templates/crazy-match3/icons/icon-256.png",
  "cars": "templates/cars/icons/icon-256.png",
  "monster-match3": "templates/monster-match3/icons/icon-256.png",
  "sweet-match3": "templates/sweet-match3/icons/icon-256.png",
  "crazy-car": "templates/crazy-car/icons/icon-256.png",
  "summer-match3": "templates/summer-match3/icons/icon-256.png",
  "funny-faces-match3": "templates/funny-faces-match3/icons/icon-256.png",
  "space-match3": "templates/space-match3/icons/icon-256.png",
  "math-game-kids": "templates/math-game-kids/icons/icon-256.png",
  "truck-racer": "templates/truck-racer/icons/icon-256.png",
  "christmas-gifts": "templates/christmas-gifts/icons/icon-256.png",
  "christmas-bubbles": "templates/christmas-bubbles/icons/icon-256.png",
  "stick-panda": "templates/stick-panda/icons/icon-256.png",
  "christmas-balls": "templates/christmas-balls/icons/icon-256.png",
  "road-racer": "templates/road-racer/icons/icon-256.png",
  "jewels-match": "templates/jewels-match/icons/icon-256.png",
  "pops-billiards": "templates/pops-billiards/icons/icon-256.png",
  "frog-super-bubbles": "templates/frog-super-bubbles/icons/icon-256.png",
  "chicken-cross": "templates/chicken-cross/assets/chicken.png",
  "race-kings": "templates/race-kings/assets/logo.png",
  "spin-wheel-royale": "templates/spin-wheel-royale/assets/loading.jpg",
  "satoshi-head": "templates/satoshi-head/icons/icon-256.png",
};

// Also seed the offline-* games that all use flappy-cover.png
const offlineGames = [
  "offline-12minibattles", "offline-1on1soccer", "offline-1on1tennis",
  "offline-2048", "offline-2048cupcakes", "offline-8ballclassic",
  "offline-alpha_1.2.6", "offline-beta_1.3", "offline-indev",
  "offline-agariolite", "offline-ageofwar", "offline-amongus",
  "offline-awesometanks", "offline-baconmaydie", "offline-badicecream",
  "offline-badicecream2", "offline-badicecream3", "offline-badpiggies",
  "offline-basketballlegends", "offline-basketballstars", "offline-basketbros",
  "offline-basketrandom", "offline-bloonstd", "offline-bloonstd2",
  "offline-bloonstd3", "offline-bloonstd4", "offline-bloxorz",
  "offline-blumgiracers", "offline-blumgirocket", "offline-bobtherobber2",
  "offline-bobtherobber5", "offline-breakingthebank", "offline-bubbleshooter",
  "offline-candycrush", "offline-choppyorc", "offline-circloo",
  "offline-circloo2", "offline-clashofvikings", "offline-dadish",
  "offline-dadish2", "offline-dadish3", "offline-deathrun3d",
  "offline-doodlejump", "offline-drawclimber", "offline-ducklife",
  "offline-ducklife2", "offline-ducklingsio", "offline-earntodie",
  "offline-eggycar", "offline-evilglitch", "offline-fancypantsadventure",
  "offline-fireboyandwatergirl", "offline-fireboyandwatergirl2",
  "offline-fireboyandwatergirl3", "offline-fireboyandwatergirl4",
  "offline-flappybird", "offline-floodrunner2", "offline-floodrunner3",
  "offline-footballlegends", "offline-freerider3", "offline-fruitninja",
  "offline-funnybattle", "offline-getontop", "offline-googlebaseball",
  "offline-googledino", "offline-hanger2", "offline-helixjump",
  "offline-hillclimbracinglite", "offline-idlebreakout", "offline-ironsnout",
  "offline-johnnytrigger", "offline-jumpingshell", "offline-karatebros",
  "offline-learntofly", "offline-learntoflyidle", "offline-leveldevil",
  "offline-mergeroundracers", "offline-minesweeper", "offline-monstertracks",
  "offline-motox3m2", "offline-motox3m3", "offline-motox3mpoolparty",
  "offline-motox3mspookyland", "offline-motox3mwinter", "offline-noobminer",
  "offline-oppositeday", "offline-ovo", "offline-ovo2", "offline-pacman",
  "offline-papasburgeria", "offline-papaspizzeria", "offline-parkingfury",
  "offline-parkingfury2", "offline-parkingfury3", "offline-picosschool",
  "offline-pingpongchaos", "offline-pixelspeedrun", "offline-plonky",
  "offline-polytrack",
];

// Special case: offline-chess uses chess-cover.png
const offlineChessPath = "thumbnails/chess-cover.png";
const offlineDefaultPath = "thumbnails/flappy-cover.png";

function getMimeType(filePath) {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".gif": "image/gif",
  };
  return mimeTypes[ext] || "image/png";
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const collection = db.collection("thumbnails");

  // Create unique index on templateId
  await collection.createIndex({ templateId: 1 }, { unique: true });
  console.log("Created unique index on templateId");

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  // Seed main thumbnails
  for (const [templateId, relativePath] of Object.entries(thumbnailMap)) {
    const filePath = resolve(FRONTEND_PUBLIC, relativePath);
    if (!existsSync(filePath)) {
      console.warn(`  SKIP (file not found): ${templateId} → ${relativePath}`);
      skipped++;
      continue;
    }

    try {
      const buffer = readFileSync(filePath);
      const contentType = getMimeType(filePath);
      const fileName = basename(filePath);

      await collection.updateOne(
        { templateId },
        {
          $set: { templateId, data: buffer, contentType, fileName, updatedAt: new Date() },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
      console.log(`  ✔ ${templateId} (${(buffer.length / 1024).toFixed(1)} KB)`);
      uploaded++;
    } catch (err) {
      console.error(`  ✘ ${templateId}: ${err.message}`);
      errors++;
    }
  }

  // Seed offline games (all use flappy-cover.png except offline-chess)
  const defaultBuffer = existsSync(resolve(FRONTEND_PUBLIC, offlineDefaultPath))
    ? readFileSync(resolve(FRONTEND_PUBLIC, offlineDefaultPath))
    : null;
  const chessBuffer = existsSync(resolve(FRONTEND_PUBLIC, offlineChessPath))
    ? readFileSync(resolve(FRONTEND_PUBLIC, offlineChessPath))
    : null;

  for (const templateId of offlineGames) {
    const buffer = defaultBuffer;
    if (!buffer) {
      console.warn(`  SKIP (default thumbnail not found): ${templateId}`);
      skipped++;
      continue;
    }

    try {
      await collection.updateOne(
        { templateId },
        {
          $set: {
            templateId,
            data: buffer,
            contentType: "image/png",
            fileName: "flappy-cover.png",
            updatedAt: new Date()
          },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
      console.log(`  ✔ ${templateId} (default)`);
      uploaded++;
    } catch (err) {
      console.error(`  ✘ ${templateId}: ${err.message}`);
      errors++;
    }
  }

  // offline-chess special case
  if (chessBuffer) {
    try {
      await collection.updateOne(
        { templateId: "offline-chess" },
        {
          $set: {
            templateId: "offline-chess",
            data: chessBuffer,
            contentType: "image/png",
            fileName: "chess-cover.png",
            updatedAt: new Date()
          },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
      );
      console.log(`  ✔ offline-chess (chess cover)`);
      uploaded++;
    } catch (err) {
      console.error(`  ✘ offline-chess: ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone! Uploaded: ${uploaded}, Skipped: ${skipped}, Errors: ${errors}`);
  await client.close();
}

main().catch(error => {
  console.error("Seed failed:", error);
  process.exit(1);
});
