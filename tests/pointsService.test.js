import test from "node:test";
import assert from "node:assert/strict";
import {
  POINT_VALUES,
  __setPointsTestHarness,
  awardFollowCreator,
  awardFirstGameBonus,
  awardDailyChallenge,
  awardDailyLogin,
  awardGameCompletion,
  awardLike,
  awardMilestone,
  awardQualifiedPlay,
  awardReferralPlay,
  awardRemix,
  awardShare,
  getCreatorScoreSummary,
  getDailyPlayerActivity,
  getPointSummary,
  recordCreatorGamePublished,
} from "../src/services/pointsService.js";

function getByPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setByPath(object, path, value) {
  const parts = path.split(".");
  let target = object;
  for (const part of parts.slice(0, -1)) {
    target[part] ??= {};
    target = target[part];
  }
  target[parts.at(-1)] = value;
}

function matches(doc, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === "$or" && Array.isArray(value)) {
      return value.some((candidate) => matches(doc, candidate));
    }
    const current = getByPath(doc, key);
    if (value && typeof value === "object" && "$ne" in value) {
      return Array.isArray(current) ? !current.includes(value.$ne) : current !== value.$ne;
    }
    if (value && typeof value === "object" && "$exists" in value) {
      return value.$exists ? current !== undefined : current === undefined;
    }
    if (value && typeof value === "object" && "$gt" in value) {
      return current > value.$gt;
    }
    if (value && typeof value === "object" && "$gte" in value) {
      return new Date(current).getTime() >= new Date(value.$gte).getTime();
    }
    if (value && typeof value === "object" && "$lte" in value) {
      return new Date(current).getTime() <= new Date(value.$lte).getTime();
    }
    if (value && typeof value === "object" && "$in" in value) {
      return value.$in.includes(current);
    }
    return current === value;
  });
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

class MemoryCollection {
  constructor(seed = []) {
    this.docs = seed.map(clone);
  }

  async createIndex() {
    return "ok";
  }

  async countDocuments(filter = {}) {
    return this.docs.filter((item) => matches(item, filter)).length;
  }

  async findOne(filter, options = {}) {
    const doc = this.docs.find((item) => matches(item, filter));
    if (!doc) return null;
    const copy = clone(doc);
    if (options.projection?._id === 0) delete copy._id;
    return copy;
  }

  find(filter, options = {}) {
    const docs = this.docs
      .filter((item) => matches(item, filter))
      .slice(0, options.limit ?? undefined)
      .map((doc) => {
        const copy = clone(doc);
        if (options.projection?._id === 0) delete copy._id;
        return copy;
      });
    return {
      toArray: async () => docs,
    };
  }

  async updateOne(filter, update, options = {}) {
    let doc = this.docs.find((item) => matches(item, filter));
    let upsertedCount = 0;
    if (!doc && options.upsert) {
      doc = clone(filter);
      this.docs.push(doc);
      upsertedCount = 1;
      for (const [key, value] of Object.entries(update.$setOnInsert ?? {})) {
        setByPath(doc, key, clone(value));
      }
    }
    if (!doc) return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };

    for (const [key, value] of Object.entries(update.$inc ?? {})) {
      setByPath(doc, key, Number(getByPath(doc, key) ?? 0) + value);
    }
    for (const [key, value] of Object.entries(update.$set ?? {})) {
      setByPath(doc, key, clone(value));
    }
    for (const [key, value] of Object.entries(update.$addToSet ?? {})) {
      const current = getByPath(doc, key) ?? [];
      if (!current.includes(value)) current.push(value);
      setByPath(doc, key, current);
    }
    return { matchedCount: 1, modifiedCount: 1, upsertedCount };
  }
}

function setupHarness(game = {}) {
  const collections = {
    playerKpLedger: new MemoryCollection(),
    browserBalances: new MemoryCollection(),
    creatorScoreLedger: new MemoryCollection(),
    creatorScoreBalances: new MemoryCollection(),
    creators: new MemoryCollection(),
    badges: new MemoryCollection(),
    botSignals: new MemoryCollection(),
  };
  const gameCollection = new MemoryCollection([
    {
      id: "game-1",
      creatorId: "creator-1",
      points: { plays: 0, likes: 0, shares: 0, total: 0 },
      ...game,
    },
  ]);
  __setPointsTestHarness({ collections, gameCollection });
  return { collections, gameCollection };
}

test("like rewards player KP in Browser balance and creator CS in Studio only", async () => {
  const { collections, gameCollection } = setupHarness();
  const game = { id: "game-1", creatorId: "creator-1" };

  const first = await awardLike({ game, actorId: "player-1" });
  const duplicate = await awardLike({ game, actorId: "player-1" });

  assert.equal(first.awarded, true);
  assert.equal(first.playerKp.kp, POINT_VALUES.playerLike);
  assert.equal(first.creatorScore.cs, POINT_VALUES.creatorLike);
  assert.equal(duplicate.awarded, false);
  assert.equal(duplicate.duplicate, true);

  assert.equal(collections.playerKpLedger.docs.length, 1);
  assert.equal(collections.creatorScoreLedger.docs.length, 1);
  assert.equal(collections.browserBalances.docs[0].walletAddress, "player-1");
  assert.equal(collections.browserBalances.docs[0].kultPoints, POINT_VALUES.playerLike);
  assert.equal(collections.creatorScoreBalances.docs[0].creatorId, "creator-1");
  assert.equal(collections.creatorScoreBalances.docs[0].lifetimeScore, POINT_VALUES.creatorLike);

  const storedGame = await gameCollection.findOne({ id: "game-1" });
  assert.deepEqual(storedGame.points, { plays: 0, likes: 1, shares: 0, total: POINT_VALUES.creatorLike });
});

test("qualified play rewards first play then replay, and ignores self-play", async () => {
  const { collections, gameCollection } = setupHarness();
  const game = { id: "game-1", creatorId: "creator-1" };

  const self = await awardQualifiedPlay({
    game,
    actorId: "creator-1",
    sessionId: "self-session",
    durationSeconds: 30,
  });
  const first = await awardQualifiedPlay({
    game,
    actorId: "player-1",
    sessionId: "session-1",
    durationSeconds: 30,
  });
  const replay = await awardQualifiedPlay({
    game,
    actorId: "player-1",
    sessionId: "session-2",
    durationSeconds: 30,
  });

  assert.equal(self.awarded, false);
  assert.equal(self.reason, "self-play");
  assert.equal(first.playerKp.kp, POINT_VALUES.playerFirstPlay);
  assert.equal(first.creatorScore.cs, POINT_VALUES.creatorFirstPlay);
  assert.equal(replay.playerKp.kp, POINT_VALUES.playerReplay);
  assert.equal(replay.creatorScore.cs, POINT_VALUES.creatorReplay);
  assert.equal(collections.browserBalances.docs[0].kultPoints, POINT_VALUES.playerFirstPlay + POINT_VALUES.playerReplay);
  assert.equal(collections.creatorScoreBalances.docs[0].lifetimeScore, POINT_VALUES.creatorFirstPlay + POINT_VALUES.creatorReplay);

  const storedGame = await gameCollection.findOne({ id: "game-1" });
  assert.deepEqual(storedGame.points, {
    plays: 2,
    likes: 0,
    shares: 0,
    total: POINT_VALUES.creatorFirstPlay + POINT_VALUES.creatorReplay,
  });
});

test("share and publish keep KP and CS separate", async () => {
  const { collections } = setupHarness();
  const game = { id: "game-1", creatorId: "creator-1" };

  await awardShare({ game, actorId: "player-1", platform: "link" });
  await awardShare({ game, actorId: "player-1", platform: "link" });
  const publish = await awardFirstGameBonus({ creatorId: "creator-1", gameId: "game-1" });
  const duplicatePublish = await awardFirstGameBonus({ creatorId: "creator-1", gameId: "game-1" });

  assert.equal(publish.awarded, true);
  assert.equal(duplicatePublish.awarded, false);
  assert.equal(collections.playerKpLedger.docs.length, 2);
  assert.equal(collections.creatorScoreLedger.docs.length, 2);

  const playerSummary = await getPointSummary("player-1");
  const creatorKpSummary = await getPointSummary("creator-1");
  const creatorScore = await getCreatorScoreSummary("creator-1");
  assert.equal(playerSummary.lifetimePoints, POINT_VALUES.playerShare);
  assert.equal(creatorKpSummary.lifetimePoints, POINT_VALUES.playerPublish);
  assert.equal(creatorScore.lifetimeScore, POINT_VALUES.creatorShare + POINT_VALUES.creatorPublish);
});

test("profile summaries find publish activity across authenticated identity aliases", async () => {
  setupHarness();
  await awardFirstGameBonus({ creatorId: "legacy-creator-id", gameId: "published-game" });

  const activity = await getDailyPlayerActivity("canonical-wallet", [
    "canonical-wallet",
    "legacy-creator-id",
  ]);
  const points = await getPointSummary("canonical-wallet", [
    "canonical-wallet",
    "legacy-creator-id",
  ]);
  const creatorScore = await getCreatorScoreSummary("canonical-wallet", [
    "canonical-wallet",
    "legacy-creator-id",
  ]);

  assert.equal(activity.publishes, 1);
  assert.equal(points.lifetimePoints, POINT_VALUES.playerPublish);
  assert.equal(creatorScore.lifetimeScore, POINT_VALUES.creatorPublish);
});

test("follow rewards follower KP and creator CS once", async () => {
  const { collections } = setupHarness();

  const first = await awardFollowCreator({ creatorId: "creator-1", followerId: "player-1" });
  const duplicate = await awardFollowCreator({ creatorId: "creator-1", followerId: "player-1" });
  const self = await awardFollowCreator({ creatorId: "creator-1", followerId: "creator-1" });

  assert.equal(first.awarded, true);
  assert.equal(first.playerKp.kp, POINT_VALUES.playerFollow);
  assert.equal(first.creatorScore.cs, POINT_VALUES.creatorFollow);
  assert.equal(duplicate.awarded, false);
  assert.equal(self.reason, "self-follow");
  assert.equal(collections.browserBalances.docs[0].walletAddress, "player-1");
  assert.equal(collections.browserBalances.docs[0].kultPoints, POINT_VALUES.playerFollow);
  assert.equal(collections.creatorScoreBalances.docs[0].creatorId, "creator-1");
  assert.equal(collections.creatorScoreBalances.docs[0].lifetimeScore, POINT_VALUES.creatorFollow);
});

test("records unique creator published games separately from publish rewards", async () => {
  const { collections } = setupHarness();

  const firstRecord = await recordCreatorGamePublished({ creatorId: "creator-1", gameId: "game-1" });
  const duplicateRecord = await recordCreatorGamePublished({ creatorId: "creator-1", gameId: "game-1" });
  const secondRecord = await recordCreatorGamePublished({ creatorId: "creator-1", gameId: "game-2" });
  await awardFirstGameBonus({ creatorId: "creator-1", gameId: "game-1" });
  await awardFirstGameBonus({ creatorId: "creator-1", gameId: "game-2" });

  assert.equal(firstRecord.recorded, true);
  assert.equal(duplicateRecord.recorded, false);
  assert.equal(secondRecord.recorded, true);
  assert.equal(collections.creators.docs[0].gamesCreated, 2);
  assert.deepEqual(collections.creators.docs[0].publishedGameIds, ["game-1", "game-2"]);
  assert.equal(collections.creatorScoreLedger.docs.length, 2);
});

test("invite rewards inviter and friend KP plus inviter CS", async () => {
  const { collections } = setupHarness();

  const result = await awardReferralPlay({
    referrerId: "creator-1",
    referredId: "player-2",
    attributionId: "attr-1",
    gameId: "game-1",
  });
  const duplicate = await awardReferralPlay({
    referrerId: "creator-1",
    referredId: "player-2",
    attributionId: "attr-1",
    gameId: "game-1",
  });

  assert.equal(result.awarded, true);
  assert.equal(result.playerKp.kp, POINT_VALUES.referralInviterKp);
  assert.equal(result.friendKp.kp, POINT_VALUES.referralFriendKp);
  assert.equal(result.creatorScore.cs, POINT_VALUES.referralInviterCs);
  assert.equal(duplicate.awarded, false);
  assert.equal(collections.playerKpLedger.docs.length, 2);
  assert.equal(collections.creatorScoreLedger.docs.length, 1);
  assert.equal(collections.browserBalances.docs.find((doc) => doc.walletAddress === "creator-1").kultPoints, POINT_VALUES.referralInviterKp);
  assert.equal(collections.browserBalances.docs.find((doc) => doc.walletAddress === "player-2").kultPoints, POINT_VALUES.referralFriendKp);
});

test("completion daily login challenge remix and milestone rewards match the spec", async () => {
  const { collections } = setupHarness();
  const game = { id: "game-1", creatorId: "creator-1" };

  const completion = await awardGameCompletion({ game, actorId: "player-1", completionId: "complete-1" });
  const dailyLogin = await awardDailyLogin({ userId: "player-1" });
  const dailyChallenge = await awardDailyChallenge({
    userId: "player-1",
    creatorId: "creator-1",
    challengeId: "challenge-1",
    gameId: "game-1",
  });
  const remix = await awardRemix({
    newCreatorId: "creator-2",
    originalCreatorId: "creator-1",
    originalGameId: "game-1",
    remixGameId: "game-2",
  });
  const milestone = await awardMilestone({
    userId: "creator-1",
    creatorId: "creator-1",
    gameId: "game-1",
    milestone: "genesis_creator_10000_plays",
  });

  assert.equal(completion.playerKp.kp, POINT_VALUES.playerComplete);
  assert.equal(completion.creatorScore.cs, POINT_VALUES.creatorComplete);
  assert.equal(dailyLogin.kp, POINT_VALUES.dailyLoginKp);
  assert.equal(dailyChallenge.playerKp.kp, POINT_VALUES.dailyChallengeKp);
  assert.equal(dailyChallenge.creatorScore.cs, POINT_VALUES.dailyChallengeCs);
  assert.equal(remix.playerKp.kp, POINT_VALUES.remixNewCreatorKp);
  assert.equal(remix.creatorScore.cs, POINT_VALUES.remixNewCreatorCs);
  assert.equal(remix.originalCreatorScore.cs, POINT_VALUES.remixOriginalCreatorCs);
  assert.equal(milestone.playerKp.kp, POINT_VALUES.genesisCreatorKp);
  assert.equal(milestone.creatorScore.cs, POINT_VALUES.genesisCreatorCs);
  assert.equal(collections.badges.docs[0].badgeId, "genesis_creator");
});
