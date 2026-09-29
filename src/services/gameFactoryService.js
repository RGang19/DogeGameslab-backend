import { nanoid } from "nanoid";
import { themePresets } from "../data/templates.js";
import { getTemplate } from "./templateService.js";

export function createGamePackage(input) {
  const template = getTemplate(input.templateId);
  if (!template) {
    const error = new Error(`Unknown template: ${input.templateId}`);
    error.status = 404;
    throw error;
  }

  // Only a theme the caller actually chose (from the prompt) prefixes the title.
  // When no theme is implied, the title stays the plain game name — no forced
  // "Neon …". A palette is still needed for rendering, so it falls back to a
  // neutral preset without leaking that word into the name.
  const themePreset = themePresets[input.theme] ?? null;
  const theme = themePreset ?? themePresets.neon;
  const difficulty = input.difficulty ?? "normal";
  const tuning = template.difficulty[difficulty] ?? template.difficulty.normal;
  const title = themePreset ? `${themePreset.label} ${template.name}` : template.name;

  return {
    id: nanoid(12),
    tier: "template",
    title,
    templateId: template.id,
    templateName: template.name,
    category: template.category,
    createdIn: `${template.estimatedSeconds}s`,
    apiCost: 0,
    reliability: `${Math.round(template.reliability * 100)}%`,
    customization: {
      prompt: input.prompt ?? "",
      theme: themePreset ? themePreset.label : "Custom",
      difficulty,
      level: input.customization ?? "light",
      extra: input.extra ?? "none"
    },
    gameplay: {
      mechanic: template.mechanic,
      controls: template.controls,
      tuning,
      states: template.specs.states,
      scoring: template.specs.scoring,
      collision: template.specs.collision
    },
    visuals: {
      mood: theme.mood,
      colors: theme.colors,
      assets: template.assets,
      externalAssets: false
    },
    build: {
      runtime: "browser",
      renderer: "canvas",
      preview: "playable-canvas",
      targetFps: 60,
      publishReady: true
    },
    publish: {
      published: false,
      status: "draft",
      ipfsReady: true,
      nftMetadataReady: true,
      marketplaceReady: true
    },
    checklist: [
      "Template loaded",
      "Difficulty tuning applied",
      "Theme injected",
      "Canvas-only asset plan selected",
      "Package ready for play and publish"
    ]
  };
}
