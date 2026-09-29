# Template And Asset Export

The API includes a full export route for the Tier 1 template pack:

```text
GET /api/templates/export
```

The downloaded `dogegame-template-pack.json` includes:

- All templates
- Difficulty tuning
- Theme presets
- Control schemes
- Scoring and collision specs
- Procedural asset manifests
- AI refinement prompt packs

## Why The Assets Are JSON

The product strategy uses Canvas-first procedural assets for speed and reliability. Most template assets are not PNG/JPG files. They are runtime drawing instructions such as:

- `bird block`
- `pipe columns`
- `gem tiles`
- `runner avatar`
- `track lanes`
- `timer ring`

This keeps Tier 1 creation fast, cheap, and portable. Later, the same manifest can be expanded into PNG sprites, SVG sheets, Phaser scenes, or marketplace asset packs.
