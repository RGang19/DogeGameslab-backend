import "dotenv/config";
import { getGameCollection } from "../src/services/databaseService.js";
import { generateAndStoreGameThumbnail } from "../src/services/thumbnailService.js";

// Backfill thumbnails ONLY for generated games (never template-library entries).
// A "generated" game has a generation/refinement, or a generated tier.
const missing = {
  $or: [
    { thumbnailUrl: { $in: [null, ""] } },
    { thumbnailUrl: { $exists: false } },
    { thumbnailUrl: { $regex: "^data:image/svg" } }
  ]
};
const generated = {
  $and: [
    { tier: { $ne: "template" } },
    { $or: [
      { generation: { $exists: true } },
      { refinement: { $exists: true } },
      { tier: { $in: ["prompt-agent", "ai-refinement", "prompt-template"] } }
    ] }
  ]
};

const col = await getGameCollection();
const games = await col
  .find({ $and: [missing, generated] }, { projection: { _id: 0 } })
  .sort({ updatedAt: -1 })
  .toArray();

console.log(`Backfilling thumbnails for ${games.length} generated games…`);
let ok = 0;
let failed = 0;
for (let i = 0; i < games.length; i++) {
  const g = games[i];
  const tag = `[${i + 1}/${games.length}] ${g.id} "${(g.title || "?").slice(0, 24)}"`;
  try {
    const res = await generateAndStoreGameThumbnail(g);
    ok += 1;
    console.log(`${tag} -> OK  ${res?.thumbnailUrl ?? ""}`);
  } catch (error) {
    failed += 1;
    console.log(`${tag} -> FAIL ${error.message}`);
  }
}
console.log(`\nDONE. success=${ok} failed=${failed} of ${games.length}`);
process.exit(0);
