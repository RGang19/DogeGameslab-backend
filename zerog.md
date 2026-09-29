# 0G Architecture: Storage, Compute, and Verifiable Game State

This document defines the final 0G architecture for the backend. It is not a brainstorming note, not a roadmap, and not a partial integration summary. It describes the strongest and most appropriate use of **0G Storage** and **0G Compute** for this product.

The architecture is intentionally hybrid:

- 0G Compute performs the expensive intelligence work.
- 0G Storage preserves canonical artifacts and proof-grade snapshots.
- MongoDB remains the fast operational database and hash index.
- The backend is the controlled authority boundary.
- The frontend is a consumer of verified backend APIs.

This is the best use of 0G for this application because it puts every system component in the role where it is technically strongest.

This backend uses 0G as two separate but complementary infrastructure layers:

- **0G Compute** is the inference and agent execution layer.
- **0G Storage** is the durable, content-addressed persistence layer.
- **MongoDB** is the low-latency operational index.

This is the correct production split. The system does not abuse decentralized storage as a query database, and it does not use MongoDB as the final source of truth for generated artifacts. MongoDB remains the fast coordination plane. 0G becomes the verifiable persistence plane.

## Core Principle

Every important artifact must have two identities:

1. **Application identity**
   - `gameId`
   - `userId`
   - `objectType`
   - `objectId`

2. **Cryptographic storage identity**
   - `contentHash`
   - `rootHash`
   - `txHash`
   - `uri`

The application identity makes retrieval fast. The cryptographic identity makes the artifact independently verifiable.

```text
Frontend
  -> Backend API
    -> MongoDB operational index
      -> 0G rootHash / txHash / uri
        -> 0G Storage artifact
```

The frontend never receives or controls the 0G private key. All 0G write authority remains backend-side.

## 0G Compute Usage

0G Compute is implemented in:

```text
src/services/zeroGService.js
```

It uses the OpenAI-compatible 0G router:

```env
ZERO_G_BASE_URL=https://router-api.0g.ai/v1
ZERO_G_API_KEY=...
LLM_PROVIDER=0g
```

The backend uses multiple 0G models as a task-specialized agent stack:

```text
ZERO_G_ORCHESTRATOR_MODEL  -> intent planning and task routing
ZERO_G_CODING_MODEL        -> complex game/code generation
ZERO_G_BACKGROUND_MODEL    -> cheap metadata, validation, summaries, repairs
ZERO_G_IMAGE_MODEL         -> thumbnails, sprites, visual assets
ZERO_G_VISION_MODEL        -> reference image analysis
ZERO_G_SPEECH_MODEL        -> voice transcription
```

### Compute Flow

```text
User prompt / uploaded reference / edit request
  -> Backend API
    -> 0G orchestration model
      -> template selection or pure-agent build plan
        -> 0G coding/background/image/vision/speech models
          -> generated game package / code / assets / metadata
            -> MongoDB + 0G Storage persistence
```

The compute layer is ephemeral. It produces outputs. Those outputs become durable only after they are written to MongoDB and 0G Storage.

## 0G Storage Usage

0G Storage is implemented in:

```text
src/services/zeroGStorage.js
```

It uses the official SDK:

```text
@0gfoundation/0g-storage-ts-sdk
ethers
```

The upload path follows the official SDK mechanics:

```text
Buffer / JSON
  -> SHA-256 content hash
  -> MemData
  -> merkleTree()
  -> Indexer.upload(file, evmRpc, signer)
  -> rootHash + txHash
  -> MongoDB pointer record
```

Configured by:

```env
ZERO_G_STORAGE_ENABLED=true
ZERO_G_STORAGE_INDEXER_RPC=https://indexer-storage-testnet-turbo.0g.ai
ZERO_G_STORAGE_EVM_RPC=https://evmrpc-testnet.0g.ai
ZERO_G_STORAGE_PRIVATE_KEY=...
ZERO_G_STORAGE_EXPECTED_REPLICA=1
ZERO_G_STORAGE_COLLECTION=zero_g_storage_objects
```

The private key must be a backend-only 0G Galileo Testnet wallet key. It must never be placed in frontend code or any `VITE_` environment variable.

## MongoDB Pointer Model

All 0G uploads create or update a pointer document in:

```text
zero_g_storage_objects
```

Canonical record shape:

```js
{
  objectType: "game",
  objectId: "game_123",
  contentType: "application/json",
  fileName: "game-game_123.json",
  byteLength: 12345,
  contentHash: "sha256:...",
  rootHash: "0x...",
  rootHashes: ["0x..."],
  txHash: "0x...",
  txHashes: ["0x..."],
  txSeq: 134350,
  uri: "0g://0x...",
  status: "uploaded",
  metadata: {
    gameId: "game_123",
    creatorId: "wallet_or_user_id"
  },
  provider: "0g-storage",
  createdAt: Date,
  updatedAt: Date,
  firstSeenAt: Date
}
```

Indexes are created for:

```text
objectType + objectId + createdAt
contentHash
rootHash
txHash
status + createdAt
```

This gives the app fast retrieval without compromising verifiability.

## What Goes to 0G Storage

### 1. Game Packages

Implemented in:

```text
src/services/databaseService.js
```

Object type:

```text
game
```

Stored content:

```text
title
category
templateId
creatorId
prompt/customization
gameplay config
visual config
generated/refined code fields
publish state
```

Reason:

The game package is the canonical structured definition of a generated game. Persisting it to 0G makes the build recoverable and auditable even if application database state is damaged. This is the correct storage boundary for generated game state.

### 2. Game Asset Manifests

Implemented in:

```text
src/services/databaseService.js
```

Object type:

```text
game-assets
```

Stored content:

```text
thumbnailUrl
visuals
assets
generatedAssets
buildAssets
sprites/images/sounds manifest references
```

Reason:

Generated asset references are tracked as an artifact group. This makes the game reproducible as a bundle rather than a loose set of files. This is the correct treatment of generated assets because the manifest becomes the durable coordination object for all related media.

### 3. Thumbnails

Implemented in:

```text
src/services/thumbnailService.js
```

Object type:

```text
thumbnail
```

Stored content:

```text
PNG/JPEG/WebP bytes
content type
file name
model metadata
game/template metadata
```

Reason:

Thumbnails are user-visible game artifacts. They are recoverable by root hash and provable by transaction hash. This is the correct treatment of generated images because visual identity is part of the game artifact, not a disposable cache.

### 4. Exported Game ZIPs

Implemented in:

```text
src/controllers/gameController.js
src/services/codeExportService.js
```

Object type:

```text
game-export-zip
```

Stored content:

```text
complete exported source/playable ZIP
package.json
index.html
README.md
src/gamePackage.js
src/main.js
src/styles.css
```

Reason:

This is the most important recovery artifact. If a user needs the exact build that was exported, the ZIP root hash is the durable retrieval handle. This is the correct treatment of build output because the exported ZIP is the closest thing to a complete reproducible release.

The export response includes hash headers:

```text
X-0G-Storage-Status
X-0G-Root-Hash
X-0G-Tx-Hash
X-0G-URI
```

### 5. Leaderboard Score Records

Implemented in:

```text
src/services/leaderboardService.js
```

Object type:

```text
leaderboard-score
```

Object id:

```text
gameId:userId
```

Stored content:

```text
gameId
userId
username
score
submittedAt
updatedAt
```

Reason:

Each submitted high score becomes independently attestable. MongoDB remains the fast ranking engine, while 0G keeps proof material. This is the correct treatment of competitive state because the app needs both low-latency ranking and durable score evidence.

### 6. Leaderboard Snapshots

Implemented in:

```text
src/services/leaderboardService.js
```

Object type:

```text
leaderboard-snapshot
```

Object id:

```text
gameId
```

Stored content:

```text
ranked leaderboard entries
scores
user ids
usernames
timestamps
```

Reason:

A snapshot gives a verifiable leaderboard state at a point in time. This is stronger than storing isolated score events only. This is the correct treatment of leaderboard history because rankings are stateful, not merely event-based.

### 7. Public Profile Snapshots

Implemented in:

```text
src/services/socialService.js
```

Object type:

```text
profile-snapshot
```

Stored content:

```text
creatorId
games count
plays count
likes count
followers count
snapshottedAt
```

Reason:

Public creator reputation metrics are snapshotted without leaking private user data. This gives durable creator-state history while keeping sensitive data out of decentralized storage. This is the correct treatment of profile data because only public reputation state belongs in permanent storage.

### 8. Audit Events

Implemented in:

```text
src/services/activityService.js
src/services/referralService.js
src/controllers/gameController.js
```

Object type:

```text
audit-event
```

Currently uploaded activity types:

```text
publish
unpublish
major_edit
tournament_result
reward_claim
```

Stored content:

```text
userId
gameId
gameTitle
activityType
details
timestamp
```

Reason:

Important state transitions must be tamper-evident. Publishing, unpublishing, major edits, tournament outcomes, and reward claims are not casual analytics events; they are ledger-grade application events. This is the correct treatment of audit data because it separates business-critical state transitions from ordinary telemetry.

## What Must Not Go to 0G Storage

Do not store:

```text
private keys
JWTs
session cookies
raw private profile data
email addresses unless explicitly public
IP addresses
admin secrets
payment secrets
data that must be permanently deleted
high-frequency noisy counters such as every raw view event
```

0G Storage is durable. Treat it as permanent. Only upload public, reconstructable, auditable, or user-consented artifacts.

## Runtime Read Path

The frontend reads through the backend.

```text
Frontend
  -> GET /api/games/:gameId
  -> GET /api/games/list
  -> GET /api/leaderboards/:gameId
  -> GET /api/social/creator-stats/:creatorId
```

The backend reads MongoDB first.

```text
MongoDB game/profile/leaderboard query
  -> application JSON
  -> attached zeroGStorage pointer
  -> frontend response
```

The frontend may display or pass around:

```text
rootHash
txHash
uri
contentHash
status
```

The frontend must not upload to 0G directly because that would expose the private key.

## Runtime Write Path

```text
Frontend action
  -> Backend API
    -> Validate auth and payload
      -> Write operational state to MongoDB
        -> Upload canonical artifact to 0G Storage
          -> Store 0G pointer in MongoDB
            -> Return application response
```

Some writes are synchronous:

```text
game package save
thumbnail upload
leaderboard score/snapshot
export ZIP
```

Some writes are intentionally asynchronous:

```text
profile snapshots
audit events
```

This avoids slowing down user-facing screens where strict synchronous confirmation is not necessary.

## Leaderboard Timing

MongoDB leaderboard updates are fast:

```text
normally under 1 second
```

0G upload timing is slower because it waits for storage-node workflow and transaction submission:

```text
observed tiny JSON upload: around 19 seconds
observed ZIP upload: around 19 seconds
leaderboard score + snapshot: usually 20-40 seconds if both are synchronous
```

Leaderboard persistence flow:

```text
submit score
  -> update MongoDB best score immediately
  -> return the updated live leaderboard from MongoDB
  -> persist score evidence and leaderboard snapshot to 0G
  -> update MongoDB hash fields when 0G persistence completes
```

This is the correct leaderboard model:

```text
MongoDB = live competitive ranking
0G Storage = durable score and snapshot proof
Backend = consistency coordinator
Frontend = instant leaderboard consumer
```

This preserves immediate gameplay UX while retaining 0G verifiability.

## Why This Is the Best Use of 0G Storage

0G Storage is not being used as a slow database. It is used for what decentralized storage is best at:

```text
durability
artifact recovery
cryptographic addressability
transaction-backed proof
tamper-evident snapshots
long-term availability
```

MongoDB is used for what a database is best at:

```text
querying
sorting
pagination
authorization checks
low-latency application reads
relationship lookups
live leaderboard ranking
```

This division is the correct architecture. It gives the product fast UX without sacrificing verifiability. Any architecture that pushes live querying into 0G Storage would be slower and less operationally precise. Any architecture that leaves canonical artifacts only in MongoDB would lose the strongest property 0G provides.

## Why This Is the Best Use of 0G Compute

0G Compute is used for high-value generation and reasoning tasks:

```text
planning
code generation
asset generation
metadata generation
repair
vision analysis
speech transcription
```

The backend does not trust model output blindly. Generated outputs are:

```text
validated
packaged
stored in MongoDB
persisted to 0G Storage
indexed with hashes
served through controlled backend APIs
```

This makes 0G Compute productive, while 0G Storage makes the results durable. Compute creates intelligence; storage preserves proof. Keeping those responsibilities separate is the strongest design.

## Final System Shape

```text
0G Compute
  -> creates game intelligence, code, assets, metadata

0G Storage
  -> stores canonical artifacts, ZIPs, thumbnails, snapshots, audits

MongoDB
  -> stores fast indexes, relationships, pointers, live state

Backend
  -> owns auth, private keys, uploads, validation, retrieval

Frontend
  -> consumes backend APIs and displays data/hashes
```

This is the strongest architecture for a game creation platform using 0G: decentralized where permanence matters, centralized where speed and control matter, and cryptographically linked between both layers.

No additional architectural suggestion is required for the 0G layer. The storage, compute, indexing, retrieval, and authority boundaries are already assigned to the correct systems.
