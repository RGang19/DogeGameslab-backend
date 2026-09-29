import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: match-3 puzzle. Click a gem, then an adjacent gem
// to swap. Runs of 3+ clear, the board collapses and refills, cascades score
// extra. Reach the target before running out of moves. R restarts.

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
// Fill the whole game frame (portrait on phones): WIDTH/HEIGHT track the
// live canvas size so the playfield always fills the screen, no letterbox.
let WIDTH = Math.max(240, Math.floor(window.innerWidth || 960));
let HEIGHT = Math.max(240, Math.floor(window.innerHeight || 540));
canvas.width = WIDTH;
canvas.height = HEIGHT;
window.addEventListener("resize", () => {
  WIDTH = canvas.width = Math.max(240, Math.floor(window.innerWidth || 960));
  HEIGHT = canvas.height = Math.max(240, Math.floor(window.innerHeight || 540));
});

const palette = gamePackage?.visuals?.colors ?? [];
const tuning = gamePackage?.gameplay?.tuning ?? {};
const GRID = Math.max(5, Math.min(9, tuning.grid ?? 7));
const COLOR_COUNT = Math.max(4, Math.min(6, tuning.colors ?? 5));
const MOVES = tuning.moves ?? 32;
const TARGET = tuning.target ?? 1300;

const GEM_COLORS = [
  palette[0] ?? "#ff3df2",
  palette[1] ?? "#35e8ff",
  palette[2] ?? "#ffd166",
  "#7cffb2",
  "#ff8c5a",
  "#b18cff"
].slice(0, COLOR_COUNT);

const CELL = Math.floor(Math.min((HEIGHT - 80) / GRID, 420 / GRID));
const BOARD_W = CELL * GRID;
const OX = Math.floor((WIDTH - BOARD_W) / 2);
const OY = Math.floor((HEIGHT - BOARD_W) / 2) + 14;

let board, selected, movesLeft, score, over, won;

function randomGem() {
  return Math.floor(Math.random() * GEM_COLORS.length);
}

function reset() {
  board = [];
  for (let r = 0; r < GRID; r += 1) {
    board.push([]);
    for (let c = 0; c < GRID; c += 1) {
      let gem = randomGem();
      // avoid spawning an immediate 3-run
      while (
        (c >= 2 && board[r][c - 1] === gem && board[r][c - 2] === gem) ||
        (r >= 2 && board[r - 1][c] === gem && board[r - 2][c] === gem)
      ) {
        gem = randomGem();
      }
      board[r].push(gem);
    }
  }
  selected = null;
  movesLeft = MOVES;
  score = 0;
  over = false;
  won = false;
}
reset();

function findMatches() {
  const hits = new Set();
  for (let r = 0; r < GRID; r += 1) {
    for (let c = 0; c < GRID; c += 1) {
      const gem = board[r][c];
      if (gem === -1) continue;
      if (c <= GRID - 3 && board[r][c + 1] === gem && board[r][c + 2] === gem) {
        let k = c;
        while (k < GRID && board[r][k] === gem) {
          hits.add(r + "," + k);
          k += 1;
        }
      }
      if (r <= GRID - 3 && board[r + 1][c] === gem && board[r + 2][c] === gem) {
        let k = r;
        while (k < GRID && board[k][c] === gem) {
          hits.add(k + "," + c);
          k += 1;
        }
      }
    }
  }
  return hits;
}

function collapseAndRefill() {
  for (let c = 0; c < GRID; c += 1) {
    let write = GRID - 1;
    for (let r = GRID - 1; r >= 0; r -= 1) {
      if (board[r][c] !== -1) {
        board[write][c] = board[r][c];
        write -= 1;
      }
    }
    for (let r = write; r >= 0; r -= 1) board[r][c] = randomGem();
  }
}

function resolveBoard() {
  let cascade = 1;
  let cleared = 0;
  let hits = findMatches();
  while (hits.size > 0) {
    for (const key of hits) {
      const [r, c] = key.split(",").map(Number);
      board[r][c] = -1;
    }
    score += hits.size * 10 * cascade;
    cleared += hits.size;
    collapseAndRefill();
    cascade += 1;
    hits = findMatches();
  }
  return cleared;
}

function trySwap(a, b) {
  const dr = Math.abs(a.r - b.r);
  const dc = Math.abs(a.c - b.c);
  if (dr + dc !== 1) return false;

  const tmp = board[a.r][a.c];
  board[a.r][a.c] = board[b.r][b.c];
  board[b.r][b.c] = tmp;

  if (resolveBoard() === 0) {
    board[b.r][b.c] = board[a.r][a.c];
    board[a.r][a.c] = tmp;
    return false;
  }

  movesLeft -= 1;
  if (score >= TARGET) {
    over = true;
    won = true;
  } else if (movesLeft <= 0) {
    over = true;
    won = false;
  }
  return true;
}

function cellAt(x, y) {
  const c = Math.floor((x - OX) / CELL);
  const r = Math.floor((y - OY) / CELL);
  if (r < 0 || c < 0 || r >= GRID || c >= GRID) return null;
  return { r, c };
}

function handleTap(x, y) {
  if (over) {
    reset();
    return;
  }
  const cell = cellAt(x, y);
  if (!cell) {
    selected = null;
    return;
  }
  if (!selected) {
    selected = cell;
    return;
  }
  if (selected.r === cell.r && selected.c === cell.c) {
    selected = null;
    return;
  }
  trySwap(selected, cell);
  selected = null;
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#11182b";
  ctx.fillRect(OX - 8, OY - 8, BOARD_W + 16, BOARD_W + 16);

  for (let r = 0; r < GRID; r += 1) {
    for (let c = 0; c < GRID; c += 1) {
      const x = OX + c * CELL;
      const y = OY + r * CELL;
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      const gem = board[r][c];
      if (gem !== -1) {
        ctx.fillStyle = GEM_COLORS[gem];
        ctx.beginPath();
        ctx.arc(x + CELL / 2, y + CELL / 2, CELL * 0.36, 0, Math.PI * 2);
        ctx.fill();
      }
      if (selected && selected.r === r && selected.c === c) {
        ctx.strokeStyle = "#eef6ff";
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4);
      }
    }
  }

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Score " + score + " / " + TARGET, 28, 36);
  ctx.textAlign = "right";
  ctx.fillText("Moves " + movesLeft, WIDTH - 28, 36);

  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.78)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillText(won ? "You Win!" : "Out of Moves", WIDTH / 2, HEIGHT / 2 - 20);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Score " + score + " · Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
  }
}

function frame() {
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * WIDTH,
    y: ((e.clientY - rect.top) / rect.height) * HEIGHT
  };
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const p = canvasPoint(e);
  handleTap(p.x, p.y);
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") reset();
});
