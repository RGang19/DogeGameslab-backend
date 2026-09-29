import "dotenv/config";
import { getGameCollection } from "../src/services/databaseService.js";
import {
  recordCreatorGamePublished,
  awardFirstGameBonus,
  getCreatorScoreSummary,
  getPointSummary
} from "../src/services/pointsService.js";

// EVM creatorIds are stored lowercase (see normalizeUserId).
const WALLET = "0xA123ed1F58A71266078a27C013c3f32294DEdF4A".toLowerCase();

const col = await getGameCollection();
// Playable generated games only (never template-library entries).
const playable = {
  tier: { $ne: "template" },
  "refinement.generatedCode": { $exists: true }
};
const games = await col.find(playable, { projection: { _id: 0, id: 1, title: 1 } }).toArray();
console.log(`Publishing ${games.length} playable games under ${WALLET} …`);

let done = 0;
for (const g of games) {
  const now = new Date();
  await col.updateOne(
    { id: g.id },
    {
      $set: {
        creatorId: WALLET,
        publish: {
          published: true,
          status: "published",
          publishedAt: now,
          playPath: `/studio/play/${g.id}`
        },
        updatedAt: now
      }
    }
  );
  // Award through the SAME code the publish flow uses (creator score + KP,
  // idempotent per game).
  await recordCreatorGamePublished({ creatorId: WALLET, gameId: g.id }).catch(() => null);
  await awardFirstGameBonus({ creatorId: WALLET, gameId: g.id }).catch(() => null);
  done += 1;
  if (done % 10 === 0) console.log(`  …${done}/${games.length}`);
}

const cs = await getCreatorScoreSummary(WALLET);
const kp = await getPointSummary(WALLET);
const publishedCount = await col.countDocuments({ creatorId: WALLET, "publish.published": true });

console.log(`\nDONE. published=${done}`);
console.log("creatorScore summary:", JSON.stringify(cs));
console.log("dogeGamePoints summary  :", JSON.stringify(kp));
console.log("published games count:", publishedCount);
process.exit(0);
