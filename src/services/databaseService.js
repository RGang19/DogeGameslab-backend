import { MongoClient } from "mongodb";
import { putJsonOnZeroG } from "./zeroGStorage.js";

let client;

const collectionName = process.env.MONGODB_COLLECTION || "prompt_creator_studio";

function getMongoUri() {
  if (!process.env.MONGODB_URI) {
    const error = new Error("MONGODB_URI is not configured");
    error.status = 500;
    throw error;
  }

  return process.env.MONGODB_URI;
}

export async function getDatabase() {
  if (!client) {
    client = new MongoClient(getMongoUri());
    await client.connect();
  }

  return client.db();
}

export async function getMongoClient() {
  if (!client) {
    client = new MongoClient(getMongoUri());
    await client.connect();
  }

  return client;
}

export async function getDatabaseByName(databaseName) {
  const mongoClient = await getMongoClient();
  return databaseName ? mongoClient.db(databaseName) : mongoClient.db();
}

export async function getGameCollection() {
  const database = await getDatabase();
  return database.collection(collectionName);
}

function assetManifestFor(gamePackage) {
  const manifest = {
    gameId: gamePackage.id,
    title: gamePackage.title ?? null,
    templateId: gamePackage.templateId ?? null,
    thumbnailUrl: gamePackage.thumbnailUrl ?? null,
    visuals: gamePackage.visuals ?? null,
    assets: gamePackage.assets ?? gamePackage.visuals?.assets ?? null,
    generatedAssets: gamePackage.refinement?.assets ?? gamePackage.generatedAssets ?? null,
    buildAssets: gamePackage.build?.assets ?? null
  };

  const hasAssets = Boolean(
    manifest.thumbnailUrl
    || manifest.assets
    || manifest.generatedAssets
    || manifest.buildAssets
    || manifest.visuals?.sprites
    || manifest.visuals?.sounds
    || manifest.visuals?.images
  );

  return hasAssets ? manifest : null;
}

export async function saveGamePackage(gamePackage) {
  const collection = await getGameCollection();
  const zeroGStorage = await putJsonOnZeroG({
    objectType: "game",
    objectId: gamePackage.id,
    data: {
      ...gamePackage,
      zeroGStorage: undefined
    },
    metadata: {
      creatorId: gamePackage.creatorId ?? null,
      title: gamePackage.title ?? null,
      templateId: gamePackage.templateId ?? null
    }
  });
  const assetManifest = assetManifestFor(gamePackage);
  const assetZeroGStorage = assetManifest
    ? await putJsonOnZeroG({
      objectType: "game-assets",
      objectId: gamePackage.id,
      data: assetManifest,
      metadata: {
        gameId: gamePackage.id,
        creatorId: gamePackage.creatorId ?? null,
        title: gamePackage.title ?? null
      }
    })
    : undefined;
  // Round-tripped packages can carry createdAt/_id from a previous read —
  // they must not collide with $setOnInsert / the immutable _id.
  const { _id, createdAt, ...fields } = gamePackage;
  void _id;
  void createdAt;
  await collection.updateOne(
    { id: gamePackage.id },
    {
      $set: {
        ...fields,
        zeroGStorage,
        ...(assetZeroGStorage ? { assetZeroGStorage } : {}),
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  );

  return {
    database: "connected",
    collection: collectionName
  };
}

// Fast-path for the short request that creates a background generation job.
// Unlike saveGamePackage, this does not wait for finalized 0G Storage uploads;
// immutable provenance is recorded asynchronously by the running build job.
export async function upsertBuildingGamePackage(gamePackage) {
  const collection = await getGameCollection();
  const { _id, createdAt, zeroGStorage, assetZeroGStorage, ...fields } = gamePackage;
  void _id;
  void createdAt;
  void zeroGStorage;
  void assetZeroGStorage;
  await collection.updateOne(
    { id: gamePackage.id },
    {
      $set: {
        ...fields,
        updatedAt: new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    { upsert: true }
  );
}

export async function getGamePackageById(id) {
  const collection = await getGameCollection();
  return collection.findOne({ id }, { projection: { _id: 0 } });
}

export async function listGamePackages({
  limit = 50,
  offset = 0,
  search,
  category,
  creatorId,
  ids,
  publishedOnly = false
} = {}) {
  const collection = await getGameCollection();
  // Template auto-saves (every studio selection persists one) are not user
  // creations — only prompt-generated games belong in the creations list.
  const filter = { tier: { $ne: "template" } };
  // My Games and public discovery contain playable results only. New builds
  // explicitly become "ready"; legacy records remain visible only when they
  // contain generated code or are playable Hybrid/template-based creations.
  filter.$and = [
    {
      $or: [
        { buildStatus: "ready" },
        {
          buildStatus: { $exists: false },
          $or: [
            { "refinement.generatedCode": { $type: "string" } },
            { templateId: { $ne: "pure-agent" } }
          ]
        }
      ]
    }
  ];
  if (publishedOnly) filter["publish.published"] = true;
  if (Array.isArray(creatorId) && creatorId.length > 0) filter.creatorId = { $in: creatorId };
  else if (creatorId) filter.creatorId = creatorId;
  if (Array.isArray(ids) && ids.length > 0) filter.id = { $in: ids };
  if (category) {
    const escapedCategory = String(category).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.category = { $regex: `^${escapedCategory}$`, $options: "i" };
  }
  if (search) {
    filter.$or = [
      { id: search },
      { title: { $regex: search, $options: "i" } },
      { "customization.prompt": { $regex: search, $options: "i" } }
    ];
  }
  const games = await collection
    .find(filter, { projection: { _id: 0 } })
    .sort({ updatedAt: -1 })
    .skip(publishedOnly ? 0 : offset)
    .limit(publishedOnly ? Math.min((offset + limit) * 3, 300) : limit)
    .toArray();
  if (!publishedOnly) return games;
  const now = Date.now();
  return games
    .sort((a, b) => {
      const aBoosted = a.launchBoost?.active === true && (Date.parse(a.launchBoost?.endsAt ?? "") || 0) > now;
      const bBoosted = b.launchBoost?.active === true && (Date.parse(b.launchBoost?.endsAt ?? "") || 0) > now;
      if (aBoosted !== bBoosted) return aBoosted ? -1 : 1;
      return (Date.parse(b.updatedAt ?? "") || 0) - (Date.parse(a.updatedAt ?? "") || 0);
    })
    .slice(offset, offset + limit);
}

export async function countCreatedGamePackagesByCreator(creatorId) {
  if (!creatorId) return 0;
  const collection = await getGameCollection();
  return collection.countDocuments({
    creatorId: Array.isArray(creatorId) ? { $in: creatorId } : creatorId,
    tier: { $ne: "template" },
    $or: [
      { buildStatus: "ready" },
      {
        buildStatus: { $exists: false },
        $or: [
          { "refinement.generatedCode": { $type: "string" } },
          { templateId: { $ne: "pure-agent" } }
        ]
      }
    ]
  });
}

// Targeted update: only touches the given fields. Background jobs (code,
// thumbnail) finish at different times — saving a whole stale package from
// one job would clobber what the other already wrote.
export async function updateGamePackageFields(id, fields) {
  const collection = await getGameCollection();
  await collection.updateOne(
    { id },
    { $set: { ...fields, updatedAt: new Date() } }
  );
}

export async function deleteGamePackage(id) {
  const collection = await getGameCollection();
  const result = await collection.deleteOne({ id });
  // Remove the game's generated cover image alongside it.
  const database = await getDatabase();
  await database.collection("thumbnails").deleteOne({ templateId: id });
  return { deleted: result.deletedCount > 0 };
}

export function getDatabaseConfig() {
  return {
    configured: Boolean(process.env.MONGODB_URI),
    collection: collectionName
  };
}
