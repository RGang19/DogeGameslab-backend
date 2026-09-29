# Backend Architecture

The backend optimizes for reliable game creation before generative flexibility.

```text
User intent
  -> Template selection
  -> Structured customization
  -> Deterministic game package
  -> Optional LLM refinement
  -> Publish pipeline
```

## Tier 1: Templates

Templates are the default route:

- No API token required.
- No external image dependency.
- Canvas-friendly assets.
- Known mechanics and physics.
- Stable output schema.

Each template defines mechanics, controls, difficulty presets, render style, an asset plan, a publish checklist, and AI refinement context.

## Tier 2: LLM Refinement

AI refinement is a secondary route for power users. The backend builds a compact prompt bundle with:

- System role and output constraints
- Selected template specs
- User customization
- Exact mechanics and physics
- Validation checklist

The current implementation returns the prompt bundle and simulated job metadata. A production deployment can connect this service to OpenAI, Claude, or an internal model runner behind a queue.

## Runtime Services

- `templateService`: owns the game templates.
- `gameFactoryService`: creates deterministic game packages.
- `refinementService`: creates LLM-ready prompt bundles.
- `dashboardController`: supplies creator analytics mock data.

## Future Expansion

- Add MongoDB models for persisted games.
- Add Redis/Bull for long-running refinement and publishing jobs.
- Add IPFS and blockchain publishing adapters.
- Add Phaser runtimes for each template's playable export.
