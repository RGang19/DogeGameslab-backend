import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: 2048-style merge puzzle. Arrows/WASD or swipe to
// slide tiles; equal tiles merge and double. Reach the target tile to win,
// keep playing for score. R restarts.

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

const palette = gamePackage?.visuals?.colors ?? ["#35e8ff", "#ff3df2", "#ffd166"];
const tuning = gamePackage?.gameplay?.tuning ?? {};
const SIZE = Math.max(4, Math.min(5, tuning.grid ?? 4));
const TARGET = tuning.target ?? 2048;

const CELL = Math.floor((HEIGHT - 120) / SIZE);
const BOARD = CELL * SIZE;
const OX = Math.floor((WIDTH - BOARD) / 2);
const OY = 90;

const TILE_COLORS = [
  "#1c2742", palette[0] ?? "#35e8ff", palette[1] ?? "#ff3df2", palette[2] ?? "#ffd166",
  "#7cffb2", "#ff8c5a", "#b18cff", "#ff5a7a", "#5ad7ff", "#ffe45a", "#9dff5a"
];

let board, score, best, over, won;

function emptyCells() {
  const cells = [];
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (board[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

function spawnTile() {
  const cells = emptyCells();
  if (!cells.length) return;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  board[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function reset() {
  board = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  score = 0;
  best = best ?? 0;
  over = false;
  won = false;
  spawnTile();
  spawnTile();
}
reset();

// Slides one row toward index 0, merging equal neighbours once.
function slideRow(row) {
  const tiles = row.filter((v) => v !== 0);
  const result = [];
  let moved = false;
  for (let i = 0; i < tiles.length; i += 1) {
    if (i + 1 < tiles.length && tiles[i] === tiles[i + 1]) {
      const merged = tiles[i] * 2;
      result.push(merged);
      score += merged;
      if (merged >= TARGET) won = true;
      i += 1;
    } else {
      result.push(tiles[i]);
    }
  }
  while (result.length < SIZE) result.push(0);
  for (let i = 0; i < SIZE; i += 1) {
    if (row[i] !== result[i]) moved = true;
  }
  return { result, moved };
}

function move(dir) {
  if (over) {
    reset();
    return;
  }
  // dir: 0 left, 1 right, 2 up, 3 down
  let movedAny = false;
  for (let i = 0; i < SIZE; i += 1) {
    let line = [];
    for (let j = 0; j < SIZE; j += 1) {
      line.push(dir < 2 ? board[i][j] : board[j][i]);
    }
    if (dir === 1 || dir === 3) line.reverse();
    const { result, moved } = slideRow(line);
    if (dir === 1 || dir === 3) result.reverse();
    for (let j = 0; j < SIZE; j += 1) {
      if (dir < 2) board[i][j] = result[j];
      else board[j][i] = result[j];
    }
    movedAny = movedAny || moved;
  }
  if (!movedAny) return;
  spawnTile();
  best = Math.max(best, score);

  // any move left?
  if (emptyCells().length === 0) {
    let canMerge = false;
    for (let r = 0; r < SIZE; r += 1) {
      for (let c = 0; c < SIZE; c += 1) {
        if (r + 1 < SIZE && board[r][c] === board[r + 1][c]) canMerge = true;
        if (c + 1 < SIZE && board[r][c] === board[r][c + 1]) canMerge = true;
      }
    }
    if (!canMerge) over = true;
  }
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 28px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Score " + score, 28, 44);
  ctx.textAlign = "right";
  ctx.fillText("Best " + best + (won ? " · " + TARGET + " reached!" : ""), WIDTH - 28, 44);

  ctx.fillStyle = "#11182b";
  ctx.fillRect(OX - 8, OY - 8, BOARD + 16, BOARD + 16);

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      const value = board[r][c];
      const x = OX + c * CELL;
      const y = OY + r * CELL;
      const tier = value === 0 ? 0 : Math.min(TILE_COLORS.length - 1, Math.log2(value));
      ctx.fillStyle = TILE_COLORS[tier];
      ctx.fillRect(x + 4, y + 4, CELL - 8, CELL - 8);
      if (value !== 0) {
        ctx.fillStyle = "#070a12";
        ctx.font = `800 ${value < 1000 ? 34 : 26}px Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(String(value), x + CELL / 2, y + CELL / 2);
      }
    }
  }

  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.78)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillText("No Moves Left", WIDTH / 2, HEIGHT / 2 - 20);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Score " + score + " · Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
  }
}

function frame() {
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

let swipeStart = null;
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (over) {
    reset();
    return;
  }
  swipeStart = { x: e.clientX, y: e.clientY };
});
window.addEventListener("pointerup", (e) => {
  if (!swipeStart) return;
  const dx = e.clientX - swipeStart.x;
  const dy = e.clientY - swipeStart.y;
  swipeStart = null;
  if (Math.hypot(dx, dy) < 24) return;
  if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 1 : 0);
  else move(dy > 0 ? 3 : 2);
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") {
    e.preventDefault();
    move(0);
  }
  if (e.code === "ArrowRight" || e.code === "KeyD") {
    e.preventDefault();
    move(1);
  }
  if (e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault();
    move(2);
  }
  if (e.code === "ArrowDown" || e.code === "KeyS") {
    e.preventDefault();
    move(3);
  }
  if (e.code === "KeyR") reset();
});
