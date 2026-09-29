export const templates = [
  {
    id: "flappy",
    name: "Flappy Bird",
    category: "Arcade",
    estimatedSeconds: 20,
    reliability: 1,
    mechanic: "Tap to jump through moving pipe gates.",
    controls: "Tap, click, or space",
    assets: "Bird block, pipes, score text, cloud bands",
    specs: {
      states: ["BOOT", "PLAY", "GAMEOVER"],
      collision: ["player vs pipe", "player vs ceiling", "player vs floor"],
      scoring: "+1 for each cleared gate"
    },
    difficulty: {
      easy: { gravity: 520, jump: -290, speed: 165, gap: 180 },
      normal: { gravity: 600, jump: -320, speed: 200, gap: 150 },
      hard: { gravity: 680, jump: -340, speed: 240, gap: 128 },
      insane: { gravity: 760, jump: -360, speed: 285, gap: 112 }
    }
  },
  {
    id: "match3",
    name: "Match-3 Puzzle",
    category: "Puzzle",
    estimatedSeconds: 25,
    reliability: 1,
    mechanic: "Swap adjacent gems and trigger chain reactions.",
    controls: "Tap two adjacent tiles",
    assets: "Gem tiles, power gems, board frame, score bursts",
    specs: {
      states: ["BOOT", "PLAY", "CASCADE", "GAMEOVER"],
      collision: ["adjacent swap validation"],
      scoring: "matches and cascade multipliers"
    },
    difficulty: {
      easy: { grid: 6, colors: 4, moves: 38, target: 800 },
      normal: { grid: 7, colors: 5, moves: 32, target: 1300 },
      hard: { grid: 8, colors: 6, moves: 28, target: 2000 },
      insane: { grid: 9, colors: 6, moves: 24, target: 3100 }
    }
  },
  {
    id: "chess",
    name: "Chess",
    category: "Board",
    estimatedSeconds: 30,
    reliability: 1,
    mechanic: "Click a piece, then a highlighted square. Full legal moves, check, checkmate, castling, en passant, promotion. Play White against a built-in AI.",
    controls: "Click or tap a piece then its destination, R for a new game",
    assets: "8x8 board, Unicode piece glyphs, move highlights, captured-piece tray",
    specs: {
      states: ["BOOT", "PLAY", "CHECKMATE", "STALEMATE"],
      collision: ["legal-move validation", "king safety", "castling path checks"],
      scoring: "captured material value"
    },
    difficulty: {
      easy: { aiDepth: 0, aiDelayMs: 350 },
      normal: { aiDepth: 1, aiDelayMs: 450 },
      hard: { aiDepth: 1, aiDelayMs: 250 },
      insane: { aiDepth: 1, aiDelayMs: 150 }
    }
  },
  {
    id: "clicker",
    name: "Clicker Economy",
    category: "Idle",
    estimatedSeconds: 18,
    reliability: 1,
    mechanic: "Click to earn, buy upgrades, automate income.",
    controls: "Click, tap, upgrade buttons",
    assets: "Central token, upgrade cards, income meters",
    specs: {
      states: ["BOOT", "PLAY", "PRESTIGE"],
      collision: [],
      scoring: "currency per click and passive income"
    },
    difficulty: {
      easy: { baseClick: 2, upgradeCost: 20, multiplier: 1.18, prestige: 5000 },
      normal: { baseClick: 1, upgradeCost: 35, multiplier: 1.24, prestige: 10000 },
      hard: { baseClick: 1, upgradeCost: 55, multiplier: 1.32, prestige: 18000 },
      insane: { baseClick: 1, upgradeCost: 80, multiplier: 1.42, prestige: 32000 }
    }
  },
  {
    id: "memory",
    name: "Memory Cards",
    category: "Casual",
    estimatedSeconds: 20,
    reliability: 1,
    mechanic: "Flip cards, find pairs, clear the board.",
    controls: "Tap or click cards",
    assets: "Card backs, icons, timer, match effects",
    specs: {
      states: ["BOOT", "PREVIEW", "PLAY", "COMPLETE"],
      collision: ["card pair equality"],
      scoring: "time remaining and fewer misses"
    },
    difficulty: {
      easy: { pairs: 6, timer: 120, preview: 3 },
      normal: { pairs: 8, timer: 100, preview: 2 },
      hard: { pairs: 10, timer: 85, preview: 1 },
      insane: { pairs: 12, timer: 70, preview: 0 }
    }
  },
  {
    id: "quiz",
    name: "Quiz Rush",
    category: "Trivia",
    estimatedSeconds: 22,
    reliability: 1,
    mechanic: "Answer timed questions and build score streaks.",
    controls: "Tap answer cards or number keys",
    assets: "Question panels, answer buttons, timer ring",
    specs: {
      states: ["BOOT", "QUESTION", "RESULT", "GAMEOVER"],
      collision: [],
      scoring: "correct answers, speed bonus, streak bonus"
    },
    difficulty: {
      easy: { questions: 8, seconds: 20, penalty: 0 },
      normal: { questions: 10, seconds: 16, penalty: 20 },
      hard: { questions: 12, seconds: 12, penalty: 35 },
      insane: { questions: 15, seconds: 8, penalty: 50 }
    }
  },
  {
    id: "drawing",
    name: "Drawing Duel",
    category: "Creative",
    estimatedSeconds: 28,
    reliability: 1,
    mechanic: "Draw prompts under time pressure and vote winners.",
    controls: "Pointer drawing tools",
    assets: "Canvas, brushes, palette, voting cards",
    specs: {
      states: ["LOBBY", "DRAW", "VOTE", "SCORE"],
      collision: [],
      scoring: "votes, bonus badges, round wins"
    },
    difficulty: {
      easy: { roundSeconds: 90, brushLimit: 6, prompts: 5 },
      normal: { roundSeconds: 70, brushLimit: 5, prompts: 8 },
      hard: { roundSeconds: 55, brushLimit: 4, prompts: 10 },
      insane: { roundSeconds: 40, brushLimit: 3, prompts: 12 }
    }
  },
  {
    id: "runner",
    name: "Infinite Runner",
    category: "Action",
    estimatedSeconds: 24,
    reliability: 1,
    mechanic: "Run, jump, slide, collect, and survive scaling speed.",
    controls: "Space, swipe, arrow keys",
    assets: "Runner, obstacles, coins, parallax lanes",
    specs: {
      states: ["BOOT", "RUN", "CRASH", "GAMEOVER"],
      collision: ["player vs obstacle", "player vs collectible"],
      scoring: "distance and coins"
    },
    difficulty: {
      easy: { speed: 260, spawn: 1.8, jump: -440, lanes: 2 },
      normal: { speed: 330, spawn: 1.45, jump: -470, lanes: 3 },
      hard: { speed: 410, spawn: 1.15, jump: -500, lanes: 3 },
      insane: { speed: 500, spawn: 0.9, jump: -530, lanes: 4 }
    }
  },
  {
    id: "racing",
    name: "2D Racing",
    category: "Racing",
    estimatedSeconds: 27,
    reliability: 1,
    mechanic: "Drift through checkpoints and beat lap targets.",
    controls: "Arrow keys, WASD, touch steering",
    assets: "Cars, track lanes, checkpoints, tire trails",
    specs: {
      states: ["BOOT", "COUNTDOWN", "RACE", "FINISH"],
      collision: ["car vs wall", "car vs checkpoint", "car vs traffic"],
      scoring: "lap time and checkpoint accuracy"
    },
    difficulty: {
      easy: { laps: 2, grip: 0.88, traffic: 3, target: 95 },
      normal: { laps: 3, grip: 0.8, traffic: 5, target: 82 },
      hard: { laps: 4, grip: 0.72, traffic: 7, target: 72 },
      insane: { laps: 5, grip: 0.64, traffic: 9, target: 62 }
    }
  },
  {
    id: "idle",
    name: "Idle Factory",
    category: "Automation",
    estimatedSeconds: 19,
    reliability: 1,
    mechanic: "Build generators, unlock chains, and prestige.",
    controls: "Tap buttons and manage upgrade panels",
    assets: "Factory nodes, conveyors, resource counters",
    specs: {
      states: ["BOOT", "PRODUCE", "UPGRADE", "PRESTIGE"],
      collision: [],
      scoring: "resource rate and prestige level"
    },
    difficulty: {
      easy: { generators: 4, unlockRate: 0.72, offlineCap: 12 },
      normal: { generators: 5, unlockRate: 1, offlineCap: 8 },
      hard: { generators: 6, unlockRate: 1.35, offlineCap: 6 },
      insane: { generators: 7, unlockRate: 1.8, offlineCap: 4 }
    }
  },
  {
    id: "ai-arena",
    name: "AI Arena Battle",
    category: "Combat",
    estimatedSeconds: 30,
    reliability: 1,
    mechanic: "Survive enemy robot waves with dash shots and health pickups.",
    controls: "WASD, arrows, Space, click, controller",
    assets: "Fighter sprites, robot enemies, arena tiles, laser effects, explosions, health UI",
    specs: {
      states: ["BOOT", "WAVE", "BATTLE", "BOSS", "GAMEOVER"],
      collision: ["player vs robot", "laser vs robot", "player vs pickup"],
      scoring: "robot eliminations, wave clears, survival bonus"
    },
    difficulty: {
      easy: { enemies: 4, speed: 95, fireRate: 0.42, health: 5 },
      normal: { enemies: 6, speed: 120, fireRate: 0.34, health: 4 },
      hard: { enemies: 8, speed: 150, fireRate: 0.28, health: 3 },
      insane: { enemies: 11, speed: 180, fireRate: 0.22, health: 3 }
    }
  },
  {
    id: "cyber-runner",
    name: "Cyberpunk Runner",
    category: "Arcade",
    estimatedSeconds: 27,
    reliability: 1,
    mechanic: "Dodge neon traffic, collect data shards, and boost through a cyber city.",
    controls: "Arrow keys, WASD, Space boost, touch steering",
    assets: "Neon road, hover vehicle, city props, data coins, powerups, particles, SFX hooks",
    specs: {
      states: ["BOOT", "RUN", "BOOST", "CRASH", "GAMEOVER"],
      collision: ["vehicle vs traffic", "vehicle vs data shard", "vehicle vs powerup"],
      scoring: "distance, shards, boost chains"
    },
    difficulty: {
      easy: { speed: 260, traffic: 4, lanes: 3, boost: 1.35 },
      normal: { speed: 330, traffic: 6, lanes: 3, boost: 1.55 },
      hard: { speed: 410, traffic: 8, lanes: 4, boost: 1.75 },
      insane: { speed: 500, traffic: 10, lanes: 4, boost: 2 }
    }
  },
  {
    id: "space-shooter",
    name: "Space Shooter Boss Fight",
    category: "Shooter",
    estimatedSeconds: 30,
    reliability: 1,
    mechanic: "Blast enemy ships, dodge bullets, and break the boss shield.",
    controls: "WASD, arrows, Space/click fire, controller",
    assets: "Player ship, enemy ships, bullets, boss sprite, explosions, starfield, score UI",
    specs: {
      states: ["BOOT", "WAVE", "BOSS", "VICTORY", "GAMEOVER"],
      collision: ["player bullet vs enemy", "enemy bullet vs player", "player bullet vs boss"],
      scoring: "ships destroyed, boss damage, lives remaining"
    },
    difficulty: {
      easy: { enemies: 4, bossHealth: 36, bulletSpeed: 420, lives: 5 },
      normal: { enemies: 6, bossHealth: 52, bulletSpeed: 480, lives: 4 },
      hard: { enemies: 8, bossHealth: 72, bulletSpeed: 540, lives: 3 },
      insane: { enemies: 10, bossHealth: 96, bulletSpeed: 620, lives: 3 }
    }
  },
  {
    id: "minigames",
    name: "Mini-Game Pack",
    category: "Collection",
    estimatedSeconds: 30,
    reliability: 1,
    mechanic: "Rotate through short skill challenges with shared score.",
    controls: "Contextual tap, click, and keyboard controls",
    assets: "Challenge cards, timers, score rail, transition effects",
    specs: {
      states: ["BOOT", "SELECT", "ROUND", "TRANSITION", "GAMEOVER"],
      collision: ["challenge-specific checks"],
      scoring: "shared score and lives"
    },
    difficulty: {
      easy: { games: 3, seconds: 25, lives: 5 },
      normal: { games: 4, seconds: 20, lives: 4 },
      hard: { games: 5, seconds: 16, lives: 3 },
      insane: { games: 6, seconds: 12, lives: 2 }
    }
  },
  {
    id: "realistic-driving",
    name: "3D City Driving",
    category: "Simulation",
    estimatedSeconds: 45,
    reliability: 1,
    mechanic: "Navigate a realistic 3D city with physics-based vehicle handling.",
    controls: "WASD, Space for handbrake, C for camera",
    assets: "High-poly car model, detailed city environment, PBR materials, dynamic lighting",
    specs: {
      states: ["BOOT", "DRIVE", "CRASH"],
      collision: ["car vs buildings", "car vs traffic"],
      scoring: "distance driven without collisions"
    },
    difficulty: {
      easy: { trafficDensity: 0.2, handling: 1.5 },
      normal: { trafficDensity: 0.5, handling: 1.0 },
      hard: { trafficDensity: 0.8, handling: 0.7 },
      insane: { trafficDensity: 1.2, handling: 0.5 }
    }
  },
  {
    id: "fps-survival",
    name: "FPS Zombie Survival",
    category: "Action",
    estimatedSeconds: 50,
    reliability: 1,
    mechanic: "Survive endless waves of zombies in a photorealistic environment.",
    controls: "WASD to move, Mouse to aim/shoot, R to reload",
    assets: "3D weapon models, zombie character rigs, post-processing effects, spatial audio",
    specs: {
      states: ["BOOT", "WAVE", "RELOAD", "GAMEOVER"],
      collision: ["bullet vs zombie", "player vs environment"],
      scoring: "headshots and waves survived"
    },
    difficulty: {
      easy: { zombieSpeed: 2, ammo: 120, health: 100 },
      normal: { zombieSpeed: 4, ammo: 90, health: 80 },
      hard: { zombieSpeed: 6, ammo: 60, health: 60 },
      insane: { zombieSpeed: 8, ammo: 30, health: 40 }
    }
  },
  {
    id: "flight-sim",
    name: "Realistic Flight Simulator",
    category: "Simulation",
    estimatedSeconds: 60,
    reliability: 1,
    mechanic: "Take off, fly, and land a commercial jet with realistic aerodynamics.",
    controls: "Mouse Yoke, W/S for throttle, Q/E for rudder",
    assets: "Detailed aircraft cockpit, volumetric clouds, terrain heightmaps, atmospheric scattering",
    specs: {
      states: ["BOOT", "TAKEOFF", "FLIGHT", "LANDING", "CRASH"],
      collision: ["plane vs terrain"],
      scoring: "smoothness of landing and flight path accuracy"
    },
    difficulty: {
    }
  },
  {
    id: "unity-karting",
    name: "Unity Kart Racer",
    category: "Racing",
    estimatedSeconds: 45,
    reliability: 1,
    mechanic: "Complete 3 laps in a physics-based 3D kart racing game.",
    controls: "WASD / Arrow Keys, Space drift",
    assets: "3D Kart model, racetrack terrain, checkpoints, booster pads",
    engine: "unity",
    specs: {
      states: ["MENU", "COUNTDOWN", "RACING", "FINISH"],
      collision: ["kart vs walls", "kart vs checkpoints", "kart vs obstacles"],
      scoring: "fastest lap and overall race time"
    },
    difficulty: {
      easy: { speedMultiplier: 0.8, gravity: 9.81 },
      normal: { speedMultiplier: 1.0, gravity: 9.81 },
      hard: { speedMultiplier: 1.2, gravity: 12.0 },
      insane: { speedMultiplier: 1.5, gravity: 15.0 }
    }
  },
  {
    id: "unity-fps",
    name: "Unity FPS Arena",
    category: "Action",
    estimatedSeconds: 50,
    reliability: 1,
    mechanic: "Fight waves of robot drones inside a sci-fi arena.",
    controls: "WASD, Mouse to aim/shoot, Space to jump",
    assets: "3D character controller, robot drones, sci-fi weapons, laser beams",
    engine: "unity",
    specs: {
      states: ["BOOT", "MENU", "WAVE", "GAMEOVER"],
      collision: ["bullets vs drones", "player vs drones"],
      scoring: "eliminations, survival score, headshot multipliers"
    },
    difficulty: {
      easy: { dronesCount: 3, droneHealth: 50 },
      normal: { dronesCount: 5, droneHealth: 100 },
      hard: { dronesCount: 8, droneHealth: 150 },
      insane: { dronesCount: 12, droneHealth: 200 }
    }
  },
  {
    id: "unity-platformer",
    name: "Unity 3D Platformer",
    category: "Adventure",
    estimatedSeconds: 40,
    reliability: 1,
    mechanic: "Navigate challenging floating platforms and collect gold keys.",
    controls: "WASD / Arrow Keys, Space to double-jump",
    assets: "Character rig, floating island templates, spikes, moving platforms",
    engine: "unity",
    specs: {
      states: ["BOOT", "PLAY", "FALLOUT", "COMPLETE"],
      collision: ["player vs keys", "player vs spikes", "player vs deathzone"],
      scoring: "keys collected and time remaining"
    },
    difficulty: {
      easy: { checkPoints: 5, timeLimit: 120 },
      normal: { checkPoints: 3, timeLimit: 90 },
      hard: { checkPoints: 1, timeLimit: 60 },
      insane: { checkPoints: 0, timeLimit: 45 }
    }
  },
  {
    id: "unity-zombiesmasher",
    name: "Zombie Smasher",
    category: "Action",
    estimatedSeconds: 55,
    reliability: 1,
    mechanic: "Control a powerful tank to crush endless waves of zombies and destroy obstacles.",
    controls: "WASD to move, Mouse Click to shoot",
    assets: "3D Tank model, environment obstacle prefabs, detailed zombie assets",
    engine: "unity",
    specs: {
      states: ["BOOT", "MENU", "SMASHING", "GAMEOVER"],
      collision: ["tank vs zombies", "bullets vs obstacles", "tank vs obstacles"],
      scoring: "zombies smashed, duration, obstacles destroyed"
    },
    difficulty: {
      easy: { speed: 5, health: 100 },
      normal: { speed: 8, health: 150 },
      hard: { speed: 12, health: 200 },
      insane: { speed: 18, health: 300 }
    }
  },
  {
    id: "unity-spaceinvaders",
    name: "Space Invaders",
    category: "Action",
    estimatedSeconds: 30,
    reliability: 1,
    mechanic: "Destroy descending waves of alien invaders and dodge their plasma projectiles.",
    controls: "A / D or Arrow Keys to move ship, Space to shoot",
    assets: "Classic spaceship, dynamic alien invaders, barriers, particle explosions",
    engine: "unity",
    specs: {
      states: ["BOOT", "MENU", "PLAYING", "GAMEOVER"],
      collision: ["player bullet vs alien", "alien bullet vs player", "alien vs barriers"],
      scoring: "aliens destroyed, wave bonus"
    },
    difficulty: {
      easy: { speed: 1.5, shootRate: 0.2 },
      normal: { speed: 3, shootRate: 0.5 },
      hard: { speed: 5, shootRate: 0.8 },
      insane: { speed: 7.5, shootRate: 1.2 }
    }
  },
  {
    id: "unity-pong",
    name: "Pong",
    category: "Sports",
    estimatedSeconds: 15,
    reliability: 1,
    mechanic: "Classic table tennis simulation. Bounce the ball past the opponent's paddle.",
    controls: "W / S or Arrow Keys to move paddle",
    assets: "Paddles, ball, arena boundary, score labels",
    engine: "unity",
    specs: {
      states: ["MENU", "PLAY", "GAMEOVER"],
      collision: ["ball vs paddle", "ball vs wall"],
      scoring: "player score vs ai score"
    },
    difficulty: {
      easy: { speed: 5 },
      normal: { speed: 8 },
      hard: { speed: 12 },
      insane: { speed: 18 }
    }
  },
  {
    id: "unity-tetris",
    name: "Tetris",
    category: "Puzzle",
    estimatedSeconds: 20,
    reliability: 1,
    mechanic: "Rotate and fit falling tetromino shapes to clear horizontal lines.",
    controls: "Arrow Keys / WASD, Space to drop",
    assets: "Tetromino blocks, grid frame, preview window, score text",
    engine: "unity",
    specs: {
      states: ["MENU", "PLAY", "GAMEOVER"],
      collision: ["block vs grid", "block vs block"],
      scoring: "lines cleared, combo multipliers"
    },
    difficulty: {
      easy: { speed: 1 },
      normal: { speed: 2 },
      hard: { speed: 3 },
      insane: { speed: 5 }
    }
  },
  {
    id: "unity-snake",
    name: "Retro Snake",
    category: "Retro",
    estimatedSeconds: 15,
    reliability: 1,
    mechanic: "Guide the growing snake to eat food while avoiding walls and your own tail.",
    controls: "Arrow Keys / WASD to steer",
    assets: "Snake head & segments, food items, boundary grid, score display",
    engine: "unity",
    specs: {
      states: ["MENU", "PLAYING", "GAMEOVER"],
      collision: ["snake vs wall", "snake vs body", "snake vs food"],
      scoring: "food consumed"
    },
    difficulty: {
      easy: { speed: 5 },
      normal: { speed: 8 },
      hard: { speed: 12 },
      insane: { speed: 16 }
    }
  },
  {
    id: "unity-pacman",
    name: "Pac-Man",
    category: "Arcade",
    estimatedSeconds: 25,
    reliability: 1,
    mechanic: "Navigate the maze to consume all dots while dodging wandering ghosts.",
    controls: "Arrow Keys / WASD to move",
    assets: "Pac-Man model, ghosts, maze walls, score dots, power pellets",
    engine: "unity",
    specs: {
      states: ["MENU", "PLAYING", "GAMEOVER", "VICTORY"],
      collision: ["pacman vs ghost", "pacman vs dot", "pacman vs powerpellet"],
      scoring: "dots consumed, ghosts eaten"
    },
    difficulty: {
      easy: { speed: 4, ghosts: 2 },
      normal: { speed: 6, ghosts: 4 },
      hard: { speed: 8, ghosts: 4 },
      insane: { speed: 10, ghosts: 4 }
    }
  },
  {
    id: "unity-towerdefense",
    name: "Tower Defense",
    category: "Strategy",
    estimatedSeconds: 45,
    reliability: 1,
    mechanic: "Place defensive towers along a path to destroy waves of incoming enemies.",
    controls: "Mouse Click to place towers",
    assets: "Turret towers, creeps/enemies, pathways, health bars, base core",
    engine: "unity",
    specs: {
      states: ["MENU", "PLAYING", "GAMEOVER", "VICTORY"],
      collision: ["projectile vs enemy", "enemy vs base"],
      scoring: "enemies eliminated, waves survived"
    },
    difficulty: {
      easy: { startingGold: 500, waveInterval: 20 },
      normal: { startingGold: 300, waveInterval: 15 },
      hard: { startingGold: 200, waveInterval: 12 },
      insane: { startingGold: 100, waveInterval: 10 }
    }
  },
  {
    id: "unity-solitaire",
    name: "Solitaire",
    category: "Card",
    estimatedSeconds: 40,
    reliability: 1,
    mechanic: "Sort cards by suit and descending order in this classic solitaire layout.",
    controls: "Mouse Drag & Drop / Click",
    assets: "Card deck sprites, board felt green background, suit signs, score tracking",
    engine: "unity",
    specs: {
      states: ["MENU", "PLAYING", "WIN"],
      collision: ["card snap to column"],
      scoring: "cards sorted, moves made"
    },
    difficulty: {
      easy: { drawCount: 1 },
      normal: { drawCount: 3 },
      hard: { drawCount: 3, timed: true },
      insane: { drawCount: 3, timed: true, penalty: true }
    }
  },
  {
    id: "unity-flappybird",
    name: "Flappy Bird",
    category: "Casual",
    estimatedSeconds: 20,
    reliability: 1,
    mechanic: "Tap or click to flap wings and navigate safely between pipes.",
    controls: "Mouse Click / Space",
    assets: "Flappy character model, scrolling columns/pipes, score trigger, sound controls",
    engine: "unity",
    specs: {
      states: ["MENU", "PLAYING", "GAMEOVER"],
      collision: ["bird vs pipe", "bird vs ground"],
      scoring: "pipes cleared"
    },
    difficulty: {
      easy: { gravity: 450, gap: 200 },
      normal: { gravity: 600, gap: 150 },
      hard: { gravity: 750, gap: 120 },
      insane: { gravity: 900, gap: 100 }
    }
  },
  {
    id: "unity-runner",
    name: "Endless Runner",
    category: "Action",
    estimatedSeconds: 30,
    reliability: 1,
    mechanic: "Run indefinitely, jump over hazards, and grab score pickups.",
    controls: "Space to jump, Mouse Click",
    assets: "Running avatar, procedural obstacles, coin pickups, parallax skyline background",
    engine: "unity",
    specs: {
      states: ["MENU", "PLAYING", "GAMEOVER"],
      collision: ["player vs obstacle", "player vs coin"],
      scoring: "distance traveled, coins collected"
    },
    difficulty: {
      easy: { speedMultiplier: 0.8, obstacleFrequency: 1.5 },
      normal: { speedMultiplier: 1.0, obstacleFrequency: 1.2 },
      hard: { speedMultiplier: 1.25, obstacleFrequency: 0.9 },
      insane: { speedMultiplier: 1.6, obstacleFrequency: 0.7 }
    }
  }
];

export const themePresets = {
  neon: { label: "Neon", colors: ["#35e8ff", "#ff3df2", "#ffd166"], mood: "bright arcade glow" },
  retro: { label: "Retro", colors: ["#ff8bd6", "#ffd166", "#67ffb4"], mood: "pixel cabinet energy" },
  nature: { label: "Nature", colors: ["#67ffb4", "#a8e063", "#35e8ff"], mood: "lush bioluminescent garden" },
  space: { label: "Space", colors: ["#8f7dff", "#35e8ff", "#ffffff"], mood: "deep orbit spectacle" },
  fantasy: { label: "Fantasy", colors: ["#ff7a3d", "#67ffb4", "#ffd166"], mood: "rune-lit adventure" }
};
