import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: falling-blocks puzzle. Arrows/A-D move, Up/W
// rotates, Down soft-drops, Space hard-drops. Clear lines to score; speed
// rises with level. Tap left/right/middle of the board on touch. R restarts.

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

const colors = gamePackage?.visuals?.colors ?? ["#35e8ff", "#ff3df2", "#ffd166"];
const tuning = gamePackage?.gameplay?.tuning ?? {};
const COLS = 10;
const ROWS = 20;
const CELL = Math.floor((HEIGHT - 40) / ROWS);
const OX = Math.floor((WIDTH - COLS * CELL) / 2);
const OY = 20;
const BASE_DROP = tuning.dropTime ?? 0.8;

const SHAPES = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[0, 1, 0], [1, 1, 1]],
  [[1, 0, 0], [1, 1, 1]],
  [[0, 0, 1], [1, 1, 1]],
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]]
];
const PIECE_COLORS = [
  colors[0] ?? "#35e8ff",
  colors[1] ?? "#ff3df2",
  colors[2] ?? "#ffd166",
  "#7cffb2",
  "#ff8c5a",
  "#b18cff",
  "#ff5a7a"
];

let board, piece, dropTimer, dropTime, score, lines, level, over;

function newPiece() {
  const type = Math.floor(Math.random() * SHAPES.length);
  return {
    type,
    shape: SHAPES[type].map((row) => [...row]),
    x: Math.floor(COLS / 2) - 1,
    y: 0
  };
}

function reset() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(-1));
  piece = newPiece();
  dropTimer = 0;
  dropTime = BASE_DROP;
  score = 0;
  lines = 0;
  level = 1;
  over = false;
}
reset();

function collides(shape, px, py) {
  for (let r = 0; r < shape.length; r += 1) {
    for (let c = 0; c < shape[r].length; c += 1) {
      if (!shape[r][c]) continue;
      const x = px + c;
      const y = py + r;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && board[y][x] !== -1) return true;
    }
  }
  return false;
}

function rotate() {
  if (over) return;
  const rotated = piece.shape[0].map((_, c) => piece.shape.map((row) => row[c]).reverse());
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collides(rotated, piece.x + kick, piece.y)) {
      piece.shape = rotated;
      piece.x += kick;
      return;
    }
  }
}

function move(dx) {
  if (over) return;
  if (!collides(piece.shape, piece.x + dx, piece.y)) piece.x += dx;
}

function lockPiece() {
  for (let r = 0; r < piece.shape.length; r += 1) {
    for (let c = 0; c < piece.shape[r].length; c += 1) {
      if (piece.shape[r][c] && piece.y + r >= 0) board[piece.y + r][piece.x + c] = piece.type;
    }
  }
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r -= 1) {
    if (board[r].every((cell) => cell !== -1)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(-1));
      cleared += 1;
      r += 1;
    }
  }
  if (cleared > 0) {
    lines += cleared;
    score += [0, 100, 300, 500, 800][cleared] * level;
    level = 1 + Math.floor(lines / 10);
    dropTime = Math.max(0.12, BASE_DROP - (level - 1) * 0.07);
  }
  piece = newPiece();
  if (collides(piece.shape, piece.x, piece.y)) over = true;
}

function step() {
  if (collides(piece.shape, piece.x, piece.y + 1)) lockPiece();
  else piece.y += 1;
}

function hardDrop() {
  if (over) {
    reset();
    return;
  }
  while (!collides(piece.shape, piece.x, piece.y + 1)) piece.y += 1;
  lockPiece();
}

function update(dt) {
  if (over) return;
  dropTimer += dt;
  if (dropTimer >= dropTime) {
    dropTimer = 0;
    step();
  }
}

function drawCell(x, y, type) {
  ctx.fillStyle = PIECE_COLORS[type % PIECE_COLORS.length];
  ctx.fillRect(OX + x * CELL + 1, OY + y * CELL + 1, CELL - 2, CELL - 2);
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#0b1020";
  ctx.fillRect(OX, OY, COLS * CELL, ROWS * CELL);
  ctx.strokeStyle = "#1c2742";
  ctx.lineWidth = 2;
  ctx.strokeRect(OX, OY, COLS * CELL, ROWS * CELL);

  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (board[r][c] !== -1) drawCell(c, r, board[r][c]);
    }
  }
  for (let r = 0; r < piece.shape.length; r += 1) {
    for (let c = 0; c < piece.shape[r].length; c += 1) {
      if (piece.shape[r][c] && piece.y + r >= 0) drawCell(piece.x + c, piece.y + r, piece.type);
    }
  }

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Score", 60, 60);
  ctx.fillText(String(score), 60, 92);
  ctx.fillText("Lines", 60, 150);
  ctx.fillText(String(lines), 60, 182);
  ctx.fillText("Level", 60, 240);
  ctx.fillText(String(level), 60, 272);

  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.78)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillText("Game Over", WIDTH / 2, HEIGHT / 2 - 20);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Score " + score + " · Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (over) {
    reset();
    return;
  }
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
  const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
  const boardLeft = OX + (COLS * CELL) / 3;
  const boardRight = OX + (2 * COLS * CELL) / 3;
  if (y > OY + ROWS * CELL * 0.85) hardDrop();
  else if (x < boardLeft) move(-1);
  else if (x > boardRight) move(1);
  else rotate();
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") move(-1);
  if (e.code === "ArrowRight" || e.code === "KeyD") move(1);
  if (e.code === "ArrowUp" || e.code === "KeyW") rotate();
  if (e.code === "ArrowDown" || e.code === "KeyS") step();
  if (e.code === "Space") {
    e.preventDefault();
    hardDrop();
  }
  if (e.code === "KeyR") reset();
});
