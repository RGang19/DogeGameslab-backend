import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: bubble shooter. Aim with the pointer (or
// left/right arrows), click/Space to fire. Match 3+ of a color to pop them;
// disconnected bubbles fall. Lose if the stack reaches the line. R restarts.

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
const COLORS = [
  palette[0] ?? "#ff3df2",
  palette[1] ?? "#35e8ff",
  palette[2] ?? "#ffd166",
  "#7cffb2",
  "#ff8c5a"
].slice(0, Math.max(3, Math.min(5, tuning.colors ?? 4)));

const R = 18;
const COLS = 20;
const START_ROWS = 5;
const OX = Math.floor((WIDTH - COLS * R * 2) / 2) + R;
const LOSE_Y = HEIGHT - 110;
const SHOOTER = { x: WIDTH / 2, y: HEIGHT - 50 };
const SPEED = tuning.speed ? tuning.speed * 120 : 760;

let grid, flying, nextColor, aimAngle, score, shotsLeft, over, won;

function cellPos(row, col) {
  return {
    x: OX + col * R * 2 + (row % 2 === 1 ? R : 0),
    y: 40 + row * R * 1.74
  };
}

function reset() {
  grid = new Map();
  for (let row = 0; row < START_ROWS; row += 1) {
    for (let col = 0; col < COLS - (row % 2); col += 1) {
      grid.set(row + "," + col, Math.floor(Math.random() * COLORS.length));
    }
  }
  flying = null;
  nextColor = Math.floor(Math.random() * COLORS.length);
  aimAngle = -Math.PI / 2;
  score = 0;
  shotsLeft = tuning.shots ?? 60;
  over = false;
  won = false;
}
reset();

function neighbors(row, col) {
  const odd = row % 2 === 1;
  return [
    [row, col - 1], [row, col + 1],
    [row - 1, col], [row + 1, col],
    [row - 1, odd ? col + 1 : col - 1],
    [row + 1, odd ? col + 1 : col - 1]
  ];
}

function connected(startKey, sameColorOnly) {
  const color = grid.get(startKey);
  const seen = new Set([startKey]);
  const queue = [startKey];
  while (queue.length) {
    const [row, col] = queue.pop().split(",").map(Number);
    for (const [nr, nc] of neighbors(row, col)) {
      const key = nr + "," + nc;
      if (seen.has(key) || !grid.has(key)) continue;
      if (sameColorOnly && grid.get(key) !== color) continue;
      seen.add(key);
      queue.push(key);
    }
  }
  return seen;
}

function dropFloating() {
  // anything not connected to row 0 falls
  const anchored = new Set();
  for (const key of grid.keys()) {
    if (key.startsWith("0,") && !anchored.has(key)) {
      for (const k of connected(key, false)) anchored.add(k);
    }
  }
  let dropped = 0;
  for (const key of [...grid.keys()]) {
    if (!anchored.has(key)) {
      grid.delete(key);
      dropped += 1;
    }
  }
  score += dropped * 20;
}

function settleBubble(x, y, color) {
  // snap to the nearest free cell
  let best = null;
  let bestDist = Infinity;
  for (let row = 0; row < 14; row += 1) {
    for (let col = 0; col < COLS - (row % 2); col += 1) {
      const key = row + "," + col;
      if (grid.has(key)) continue;
      const p = cellPos(row, col);
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = key;
      }
    }
  }
  if (!best) {
    over = true;
    return;
  }
  grid.set(best, color);

  const cluster = connected(best, true);
  if (cluster.size >= 3) {
    for (const key of cluster) grid.delete(key);
    score += cluster.size * 10;
    dropFloating();
  }

  for (const key of grid.keys()) {
    const [row, col] = key.split(",").map(Number);
    if (cellPos(row, col).y + R > LOSE_Y) over = true;
  }
  if (grid.size === 0) {
    over = true;
    won = true;
  }
  if (shotsLeft <= 0 && !won) over = true;
}

function shoot() {
  if (over) {
    reset();
    return;
  }
  if (flying || shotsLeft <= 0) return;
  flying = {
    x: SHOOTER.x,
    y: SHOOTER.y,
    vx: Math.cos(aimAngle) * SPEED,
    vy: Math.sin(aimAngle) * SPEED,
    color: nextColor
  };
  nextColor = Math.floor(Math.random() * COLORS.length);
  shotsLeft -= 1;
}

function update(dt) {
  if (!flying || over) return;
  flying.x += flying.vx * dt;
  flying.y += flying.vy * dt;
  if (flying.x < R || flying.x > WIDTH - R) {
    flying.vx *= -1;
    flying.x = Math.max(R, Math.min(WIDTH - R, flying.x));
  }
  if (flying.y < 40) {
    settleBubble(flying.x, flying.y, flying.color);
    flying = null;
    return;
  }
  for (const key of grid.keys()) {
    const [row, col] = key.split(",").map(Number);
    const p = cellPos(row, col);
    if ((p.x - flying.x) ** 2 + (p.y - flying.y) ** 2 < (R * 1.8) ** 2) {
      settleBubble(flying.x, flying.y, flying.color);
      flying = null;
      return;
    }
  }
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const [key, color] of grid) {
    const [row, col] = key.split(",").map(Number);
    const p = cellPos(row, col);
    ctx.fillStyle = COLORS[color];
    ctx.beginPath();
    ctx.arc(p.x, p.y, R - 1, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = "#2a3656";
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(0, LOSE_Y);
  ctx.lineTo(WIDTH, LOSE_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // aim guide
  ctx.strokeStyle = "#eef6ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(SHOOTER.x, SHOOTER.y);
  ctx.lineTo(SHOOTER.x + Math.cos(aimAngle) * 70, SHOOTER.y + Math.sin(aimAngle) * 70);
  ctx.stroke();

  if (flying) {
    ctx.fillStyle = COLORS[flying.color];
    ctx.beginPath();
    ctx.arc(flying.x, flying.y, R - 1, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = COLORS[nextColor];
  ctx.beginPath();
  ctx.arc(SHOOTER.x, SHOOTER.y, R - 1, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Score " + score, 28, HEIGHT - 32);
  ctx.textAlign = "right";
  ctx.fillText("Shots " + shotsLeft, WIDTH - 28, HEIGHT - 32);

  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.78)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillText(won ? "Board Cleared!" : "Game Over", WIDTH / 2, HEIGHT / 2 - 20);
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

function aimAt(x, y) {
  const angle = Math.atan2(y - SHOOTER.y, x - SHOOTER.x);
  aimAngle = Math.max(-Math.PI + 0.25, Math.min(-0.25, angle));
}

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * WIDTH,
    y: ((e.clientY - rect.top) / rect.height) * HEIGHT
  };
}

canvas.addEventListener("pointermove", (e) => {
  const p = canvasPoint(e);
  aimAt(p.x, p.y);
});
canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  const p = canvasPoint(e);
  aimAt(p.x, p.y);
  shoot();
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft") aimAngle = Math.max(-Math.PI + 0.25, aimAngle - 0.08);
  if (e.code === "ArrowRight") aimAngle = Math.min(-0.25, aimAngle + 0.08);
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    shoot();
  }
  if (e.code === "KeyR") reset();
});
