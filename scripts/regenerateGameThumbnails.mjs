import "dotenv/config";
import { getGameCollection } from "../src/services/databaseService.js";
import { generateAndStoreGameThumbnail } from "../src/services/thumbnailService.js";

const generatedGameFilter = {
  tier: { $ne: "template" },
  $or: [
    { generation: { $exists: true } },
    { refinement: { $exists: true } },
    { tier: { $in: ["prompt-agent", "ai-refinement", "prompt-template"] } }
  ]
};

const games = await (await getGameCollection())
  .find(
    {
      $and: [
        generatedGameFilter,
        {
          $or: [
            { thumbnailWidth: { $ne: 384 } },
            { thumbnailHeight: { $ne: 576 } }
          ]
        }
      ]
    },
    { projection: { _id: 0 } }
  )
  .sort({ createdAt: 1, id: 1 })
  .toArray();

console.log(`Regenerating ${games.length} generated-game thumbnails at 384x576.`);
console.log("Template-library thumbnails are excluded.");

let completed = 0;
let failed = 0;
let cursor = 0;
const concurrency = Math.max(1, Number(process.env.THUMBNAIL_MIGRATION_CONCURRENCY || 4));

async function worker() {
  while (cursor < games.length) {
    const index = cursor++;
    const game = games[index];
    const label = `[${index + 1}/${games.length}] ${game.id} "${game.title || "Untitled"}"`;
    try {
      const result = await generateAndStoreGameThumbnail(game);
      completed += 1;
      console.log(`${label} -> OK ${result.width}x${result.height}`);
    } catch (error) {
      failed += 1;
      console.error(`${label} -> FAIL ${error.message}`);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, games.length) }, () => worker()));

console.log(`Finished: ${completed} replaced, ${failed} failed, ${games.length} total.`);
process.exit(failed ? 1 : 0);
