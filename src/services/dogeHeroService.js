// DogeGameLab's hero rule: most games star a Doge (Shiba Inu), and every game
// gets its OWN Doge — different look, outfit, personality and name — while the
// classic Doge face and a small gold "Ð" detail keep it recognisably DogeOS.
// A user who names a different character keeps it; games without a main
// character (chess, match-3, quiz, cards, puzzles) are left as they are.

const FUR = [
  "classic golden-tan with a cream mask",
  "pale cream almost white",
  "deep red-orange",
  "black-and-tan",
  "sesame (red with dark-tipped fur)",
  "honey gold with a fluffy white chest",
];
const STYLE = [
  "chunky chibi proportions",
  "sleek athletic build",
  "round and fluffy",
  "small and scrappy",
  "tall and heroic",
];
const VIBE = [
  "brave and determined",
  "cheeky and mischievous",
  "cool and laid-back",
  "hyper-energetic",
  "wise and calm",
  "goofy and lovable",
];
const ACCENT = [
  "a scarf",
  "goggles",
  "a backpack",
  "fingerless gloves",
  "a bandana",
  "a cape",
  "a chunky collar",
  "a visor",
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * Random Doge inspiration for one new game, so two games never default to the
 * same dog. The model adapts it to the game's theme (outfit, gear, art style).
 */
export function randomDogeTraits() {
  return `fur: ${pick(FUR)}; build: ${pick(STYLE)}; personality: ${pick(VIBE)}; signature accessory: ${pick(ACCENT)}`;
}

/** Rules for the spec writer (one-line idea -> full game spec). */
export function dogeHeroSpecRules(traits = randomDogeTraits()) {
  return [
    "HERO RULE (DogeGameLab is built on DogeOS):",
    "If the game has a main playable character and the user did NOT name a specific character, the hero is a DOGE — a Shiba Inu with the classic Doge face and expression.",
    "Design a NEW, UNIQUE Doge for this game; never a generic default. Give it a fitting name and describe its look concretely: fur, build, outfit and gear that match the game's theme and art style, and its personality in motion.",
    `Use this as inspiration for this game's Doge (adapt it to the theme): ${traits}.`,
    "Always include one small gold 'Ð' (Dogecoin) detail on the Doge, such as a collar tag, badge or emblem.",
    "If the user named a character (e.g. a ninja, a cat, a robot), keep exactly that character and ignore this rule.",
    "Games without a main character (chess, match-3, quiz, card, board or abstract puzzles) MUST keep their standard, instantly readable pieces, tiles and cards — do not turn them into dogs. At most add ONE subtle Doge touch outside the play pieces, such as a small Doge mascot in the corner or a Ð coin for score.",
    DOGECOIN_CODE_RULE,
  ].join("\n");
}

/** Extra direction for the player-character sprite. */
export const DOGE_HERO_SPRITE_RULE =
  "If the specification's main character is a Doge / Shiba Inu, draw exactly that Doge as described — a cute, instantly recognisable Shiba Inu with the classic Doge face, matching its described fur, build, outfit and gear, with its small gold Ð detail. Otherwise draw the character the specification describes.";

// DogeGameLab runs on DogeOS: money in a game is always Dogecoin.
/** For game specs and game code. */
export const DOGECOIN_CODE_RULE =
  "DOGECOIN ONLY: any coin, currency, token, crypto or money in the game is Dogecoin — a gold coin marked with 'Ð' (or a Doge face), called DOGE or Ð. Never show or mention Bitcoin (₿, BTC), Ethereum, other cryptocurrencies or their symbols, and do not use '$' for in-game coins.";

/** For image prompts (covers, sprites): describes the coin positively, because naming other coins makes image models draw them. */
export const DOGECOIN_ART_RULE =
  "any coins are plain gold coins embossed with a cute Shiba Inu dog face";
