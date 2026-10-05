import { getDatabase } from "./databaseService.js";

// A signed sign-in challenge is good for one sign-in only. The challenge itself
// is stateless (HMAC + expiry); this records each nonce the moment it is used,
// so the same signed message cannot be replayed before it expires. Records
// delete themselves once the challenge would have expired anyway.
const COLLECTION = process.env.SIGN_IN_NONCES_COLLECTION || "auth_sign_in_nonces";

let indexesReady = null;

async function nonceCollection() {
  const collection = (await getDatabase()).collection(COLLECTION);
  indexesReady ??= Promise.all([
    collection.createIndex({ nonce: 1 }, { unique: true }),
    collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  ]).catch((error) => {
    indexesReady = null;
    throw error;
  });
  await indexesReady;
  return collection;
}

/**
 * Marks a challenge nonce as used. Throws a 401 (SIGN_IN_REPLAYED) if it was
 * used before. Call only after the signature has been verified.
 */
export async function consumeSignInNonce({ nonce, address, expiresAt }) {
  const collection = await nonceCollection();
  try {
    await collection.insertOne({
      nonce: String(nonce),
      address: String(address),
      expiresAt: new Date(expiresAt),
      usedAt: new Date()
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const replay = new Error("This sign-in request was already used. Please sign in again.");
    replay.status = 401;
    replay.code = "SIGN_IN_REPLAYED";
    throw replay;
  }
}
