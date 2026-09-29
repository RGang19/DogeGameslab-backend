import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { MongoClient } from "mongodb";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

async function main() {
  const uri = process.env.MONGODB_URI;
  const collectionName = process.env.MONGODB_COLLECTION || "prompt_creator_studio";
  
  console.log("Connecting to:", uri);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const collection = db.collection(collectionName);
  
  const games = await collection.find({}).toArray();
  console.log(`Found ${games.length} games:`);
  for (const game of games) {
    console.log(`- ID: ${game.id}, Title: ${game.title}, Strategy: ${game.strategy ?? "N/A"}, CreatedAt: ${game.createdAt}`);
  }
  await client.close();
}

main().catch(console.error);
