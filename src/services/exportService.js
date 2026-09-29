import { templates, themePresets } from "../data/templates.js";

function assetManifestFor(template) {
  const common = [
    {
      id: "hud-score",
      type: "text",
      format: "canvas",
      description: "Score, timer, and progress readouts rendered with Canvas text."
    },
    {
      id: "screen-effects",
      type: "procedural",
      format: "canvas",
      description: "Hit flashes, particles, transitions, and combo bursts generated at runtime."
    }
  ];

  const byTemplate = {
    flappy: ["bird block", "pipe columns", "cloud bands", "ground strip"],
    match3: ["gem tiles", "power gems", "board frame", "cascade sparks"],
    clicker: ["central token", "upgrade cards", "income meters", "prestige badge"],
    memory: ["card backs", "pair icons", "match glow", "timer strip"],
    quiz: ["question panel", "answer cards", "timer ring", "streak badge"],
    drawing: ["drawing canvas", "brush cursor", "palette swatches", "voting cards"],
    runner: ["runner avatar", "obstacles", "coin pickups", "parallax lanes"],
    racing: ["car sprites", "track lanes", "checkpoints", "tire trails"],
    idle: ["factory nodes", "conveyors", "resource counters", "upgrade chips"],
    minigames: ["challenge cards", "round timer", "score rail", "transition effects"]
  };

  return [
    ...common,
    ...(byTemplate[template.id] ?? []).map((name, index) => ({
      id: `${template.id}-asset-${index + 1}`,
      type: "procedural",
      format: "canvas",
      name,
      description: `${name} is drawn at runtime, so no external image download is required.`
    }))
  ];
}

function promptPackFor(template) {
  return {
    system: "You are an expert Phaser 3 game developer. Output only executable JavaScript. Use Canvas-drawn assets. No markdown.",
    userTemplate: [
      `Game: ${template.name}`,
      `Mechanic: ${template.mechanic}`,
      `Controls: ${template.controls}`,
      `States: ${template.specs.states.join(", ")}`,
      `Scoring: ${template.specs.scoring}`,
      `Collision: ${template.specs.collision.join(", ") || "none"}`,
      "Apply selected theme, selected difficulty tuning, and creator customization."
    ].join("\n")
  };
}

export function buildTemplateExport() {
  return {
    name: "dogegame-template-pack",
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    strategy: {
      tier1: "Templates are primary: instant, deterministic, zero API cost.",
      tier2: "LLM refinement is optional and prompt-driven."
    },
    themes: themePresets,
    templates: templates.map(template => ({
      ...template,
      assets: assetManifestFor(template),
      aiRefinement: promptPackFor(template)
    })),
    usage: {
      frontend: "Use this JSON to render template cards, default packages, editor controls, and asset lists.",
      backend: "Use this JSON as a portable seed for database import or publishing workflows.",
      exportNote: "Assets are procedural Canvas manifests. The game runtime draws them instead of shipping image files."
    }
  };
}
