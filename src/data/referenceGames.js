import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

// Map a template id to the reference module file that the coding agent edits.
// Add archetypes here (runner, match3, shooter, ...) — one seed per mechanic family.
const REFERENCE_FILES = {
  chess: "chess.js",
  flappy: "flappy.js",
  runner: "runner.js",
  match3: "match3.js",
  shooter: "shooter.js",
  arena: "arena.js",
  clicker: "clicker.js",
  memory: "memory.js",
  quiz: "quiz.js",
  racing: "racing.js",
  snake: "snake.js",
  pong: "pong.js",
  tetris: "tetris.js",
  bubble: "bubble.js",
  breakout: "breakout.js",
  soccer: "soccer.js",
  crossy: "crossy.js",
  merge2048: "merge2048.js",

  // Expanded archetype seeds (50 new mechanic families).
  platformer: "platformer.js",
  doodlejump: "doodlejump.js",
  jetpack: "jetpack.js",
  caveflyer: "caveflyer.js",
  hillclimb: "hillclimb.js",
  stack: "stack.js",
  towerdefense: "towerdefense.js",
  lanebattle: "lanebattle.js",
  idle: "idle.js",
  fighter: "fighter.js",
  iogrow: "iogrow.js",
  fruitslice: "fruitslice.js",
  cooking: "cooking.js",
  miner: "miner.js",
  helix: "helix.js",
  swing: "swing.js",
  drawline: "drawline.js",
  minesweeper: "minesweeper.js",
  solitaire: "solitaire.js",
  mahjong: "mahjong.js",
  wordguess: "wordguess.js",
  typing: "typing.js",
  rhythm: "rhythm.js",
  whackmole: "whackmole.js",
  plinko: "plinko.js",
  wheel: "wheel.js",
  mines: "mines.js",
  sokoban: "sokoban.js",
  rollblock: "rollblock.js",
  maze: "maze.js",
  pinball: "pinball.js",
  airhockey: "airhockey.js",
  hoops: "hoops.js",
  baseball: "baseball.js",
  minigolf: "minigolf.js",
  archery: "archery.js",
  cannon: "cannon.js",
  asteroids: "asteroids.js",
  tank: "tank.js",
  bomberman: "bomberman.js",
  lightcycle: "lightcycle.js",
  ballsort: "ballsort.js",
  pipeflow: "pipeflow.js",
  cutrope: "cutrope.js",
  simon: "simon.js",
  reaction: "reaction.js",
  tictactoe: "tictactoe.js",
  connect4: "connect4.js",
  blockblast: "blockblast.js",
  stackball: "stackball.js"
};

// Aliases let several template ids reuse the closest archetype seed. Every
// template id — backend templates and all frontend/public-folder games —
// must resolve to a seed so hybrid generation always edits working code
// instead of writing a game from a blank page.
const ALIASES = {
  // flappy family
  "unity-flappybird": "flappy",
  "stick-panda": "flappy",

  // runner / platformer family
  "cyber-runner": "runner",
  "unity-runner": "runner",
  "unity-platformer": "runner",
  "minigames": "runner",
  "goof-runner": "runner",
  "scary-run": "runner",

  // falling-blocks puzzles
  "unity-tetris": "tetris",

  // match-3 family (the 36-games bundle ships many reskins)
  "blocks-match3": "match3",
  "animals-crash-match3": "match3",
  "candy-match3": "match3",
  "christmas-balls": "match3",
  "christmas-candy": "match3",
  "christmas-gifts": "match3",
  "christmas-match3": "match3",
  "crazy-match3": "match3",
  "funny-faces-match3": "match3",
  "halloween-match3": "match3",
  "happy-halloween-match3": "match3",
  "jewels-match": "match3",
  "lollipops-match3": "match3",
  "monster-match3": "match3",
  "sea-animals": "match3",
  "smiles-match3": "match3",
  "space-match3": "match3",
  "summer-match3": "match3",
  "sweet-match3": "match3",
  "valentines-match3": "match3",

  // bubble shooter family
  "bubble-shooter": "bubble",
  "frog-super-bubbles": "bubble",
  "happy-chef-bubble-shooter": "bubble",
  "christmas-bubbles": "bubble",

  // shooter family
  "space-shooter": "shooter",
  "unity-spaceinvaders": "shooter",
  "unity-towerdefense": "towerdefense",

  // top-down arena / combat family
  "ai-arena": "arena",
  "fps-survival": "arena",
  "unity-fps": "arena",
  "unity-zombiesmasher": "arena",

  // idle / tap family
  "idle": "idle",
  "spin-wheel-royale": "wheel",
  "plinko-pro": "plinko",

  // card / grid-reveal family
  "unity-solitaire": "solitaire",
  "cratch-royale": "memory",
  "stake-mines": "mines",

  // trivia / creative family
  "drawing": "quiz",
  "math-game-kids": "quiz",

  // racing / driving family
  "realistic-driving": "racing",
  "unity-karting": "racing",
  "flight-sim": "racing",
  "mini-racer": "racing",
  "race-kings": "racing",
  "cars": "racing",
  "crazy-car": "racing",
  "road-racer": "racing",
  "speed-racer": "racing",
  "truck-racer": "racing",

  // grid-movement family
  "unity-snake": "snake",
  "unity-pacman": "snake",

  // ball-and-paddle family
  "unity-pong": "pong",
  "billiards": "pong",
  "pops-billiards": "pong",
  "neon-bounce": "breakout",

  // sports family
  "head-soccer-2026": "soccer",

  // road-crossing family
  "chicken-cross": "crossy",

  // ---------------------------------------------------------------------------
  // offline-* bundle (creator-studio-frontend/public/templates). 100 ripped
  // games, each mapped to the nearest existing archetype seed so hybrid
  // generation always edits working code. Grouped by mechanic family.
  // ---------------------------------------------------------------------------

  // flappy / one-tap altitude
  "offline-flappybird": "flappy",
  "offline-choppyorc": "flappy",

  // endless runner
  "offline-googledino": "runner",
  "offline-floodrunner2": "runner",
  "offline-floodrunner3": "runner",
  "offline-deathrun3d": "runner",

  // vertical jumper
  "offline-doodlejump": "doodlejump",

  // level-based platformer
  "offline-ovo": "platformer",
  "offline-ovo2": "platformer",
  "offline-leveldevil": "platformer",
  "offline-dadish": "platformer",
  "offline-dadish2": "platformer",
  "offline-dadish3": "platformer",
  "offline-fireboyandwatergirl": "platformer",
  "offline-fireboyandwatergirl2": "platformer",
  "offline-fireboyandwatergirl3": "platformer",
  "offline-fireboyandwatergirl4": "platformer",
  "offline-fancypantsadventure": "platformer",
  "offline-jumpingshell": "platformer",
  "offline-pixelspeedrun": "platformer",
  "offline-circloo": "platformer",
  "offline-circloo2": "platformer",
  "offline-bobtherobber2": "platformer",
  "offline-bobtherobber5": "platformer",
  "offline-breakingthebank": "platformer",
  "offline-baconmaydie": "platformer",
  "offline-oppositeday": "platformer",
  "offline-plonky": "platformer",
  "offline-indev": "platformer",
  "offline-alpha_1.2.6": "platformer",
  "offline-beta_1.3": "platformer",

  // rope-swing momentum
  "offline-hanger2": "swing",

  // draw-to-move physics
  "offline-drawclimber": "drawline",

  // physics-vehicle on terrain (hill climb)
  "offline-earntodie": "hillclimb",
  "offline-eggycar": "hillclimb",
  "offline-freerider3": "hillclimb",
  "offline-hillclimbracinglite": "hillclimb",
  "offline-motox3m2": "hillclimb",
  "offline-motox3m3": "hillclimb",
  "offline-motox3mpoolparty": "hillclimb",
  "offline-motox3mspookyland": "hillclimb",
  "offline-motox3mwinter": "hillclimb",
  "offline-monstertracks": "hillclimb",
  "offline-badpiggies": "hillclimb",

  // track / arcade racing
  "offline-parkingfury": "racing",
  "offline-parkingfury2": "racing",
  "offline-parkingfury3": "racing",
  "offline-polytrack": "racing",
  "offline-blumgiracers": "racing",
  "offline-blumgirocket": "racing",
  "offline-mergeroundracers": "racing",
  "offline-ducklife": "racing",
  "offline-ducklife2": "racing",
  "offline-learntofly": "racing",

  // idle / tap / time-management
  "offline-learntoflyidle": "idle",
  "offline-fruitninja": "fruitslice",
  "offline-papasburgeria": "cooking",
  "offline-papaspizzeria": "cooking",
  "offline-noobminer": "miner",

  // tower defense
  "offline-bloonstd": "towerdefense",
  "offline-bloonstd2": "towerdefense",
  "offline-bloonstd3": "towerdefense",
  "offline-bloonstd4": "towerdefense",

  // lane / base battle
  "offline-ageofwar": "lanebattle",
  "offline-clashofvikings": "lanebattle",

  // shooter
  "offline-johnnytrigger": "shooter",
  "offline-picosschool": "shooter",

  // tank duel
  "offline-awesometanks": "tank",

  // fighting / brawler
  "offline-12minibattles": "fighter",
  "offline-funnybattle": "fighter",
  "offline-getontop": "fighter",
  "offline-ironsnout": "fighter",
  "offline-karatebros": "fighter",

  // top-down arena / .io grow
  "offline-amongus": "arena",
  "offline-evilglitch": "arena",
  "offline-agariolite": "iogrow",
  "offline-ducklingsio": "iogrow",

  // head-to-head sports
  "offline-1on1soccer": "soccer",
  "offline-footballlegends": "soccer",
  "offline-basketballlegends": "soccer",
  "offline-basketballstars": "soccer",
  "offline-basketbros": "soccer",
  "offline-basketrandom": "soccer",
  "offline-1on1tennis": "soccer",

  // timing-swing baseball
  "offline-googlebaseball": "baseball",

  // paddle-and-ball
  "offline-pingpongchaos": "pong",
  "offline-8ballclassic": "pong",

  // helix ball-drop
  "offline-helixjump": "helix",

  // idle breakout
  "offline-idlebreakout": "breakout",

  // grid movement
  "offline-pacman": "snake",

  // rolling-block puzzle
  "offline-bloxorz": "rollblock",

  // box-pushing maze
  "offline-badicecream": "sokoban",
  "offline-badicecream2": "sokoban",
  "offline-badicecream3": "sokoban",

  // sliding-tile merge
  "offline-2048": "merge2048",
  "offline-2048cupcakes": "merge2048",

  // match-3
  "offline-candycrush": "match3",

  // bubble shooter
  "offline-bubbleshooter": "bubble",

  // grid-reveal deduction
  "offline-minesweeper": "minesweeper",

  // board
  "offline-chess": "chess"
};

const cache = new Map();

function load(file) {
  if (!cache.has(file)) {
    cache.set(file, readFileSync(join(here, "reference", file), "utf8"));
  }
  return cache.get(file);
}

/**
 * Returns the reference source module for a template id, or null if none exists.
 * The agent edits this working code instead of generating from a blank page.
 */
export function getReferenceGame(templateId) {
  const id = ALIASES[templateId] ?? templateId;
  const file = REFERENCE_FILES[id];
  if (!file) return null;
  try {
    return { templateId: id, code: load(file) };
  } catch {
    return null;
  }
}

export function hasReferenceGame(templateId) {
  const id = ALIASES[templateId] ?? templateId;
  return Boolean(REFERENCE_FILES[id]);
}
