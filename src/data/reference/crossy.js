import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: road crosser. Hop one tile at a time with
// arrows/WASD or by tapping a side of the screen. Dodge traffic; reaching the
// top scores a level and the road resets faster. R restarts.

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
const TILE = 54;
const COLS = Math.floor(WIDTH / TILE);
const ROWS = Math.floor(HEIGHT / TILE);
const BASE_CAR_SPEED = tuning.carSpeed ? tuning.carSpeed * 60 : 160;

let player, lanes, score, level, over, started;

function buildLanes() {
  lanes = [];
  for (let row = 1; row < ROWS - 1; row += 1) {
    // safe median every few rows
    if (row % 4 === 0) {
      lanes.push({ row, cars: [], speed: 0 });
      continue;
    }
    const dir = row % 2 === 0 ? 1 : -1;
    const speed = (BASE_CAR_SPEED + Math.random() * 90 + level * 25) * dir;
    const cars = [];
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i += 1) {
      cars.push({ x: (WIDTH / count) * i + Math.random() * 80, w: TILE * (1 + Math.floor(Math.random() * 2)) });
    }
    lanes.push({ row, cars, speed });
  }
}

function reset() {
  player = { col: Math.floor(COLS / 2), row: ROWS - 1 };
  score = 0;
  level = 1;
  over = false;
  started = false;
  buildLanes();
}
reset();

function hop(dc, dr) {
  if (over) {
    reset();
    return;
  }
  started = true;
  player.col = Math.max(0, Math.min(COLS - 1, player.col + dc));
  player.row = Math.max(0, Math.min(ROWS - 1, player.row + dr));
  if (dr < 0) score += 1;

  if (player.row === 0) {
    level += 1;
    score += 10;
    player.row = ROWS - 1;
    buildLanes();
  }
}

function update(dt) {
  if (!started || over) return;
  const px = player.col * TILE + TILE / 2;
  const py = player.row * TILE + TILE / 2;

  for (const lane of lanes) {
    for (const car of lane.cars) {
      car.x += lane.speed * dt;
      if (lane.speed > 0 && car.x > WIDTH + 60) car.x = -car.w - 40;
      if (lane.speed < 0 && car.x < -car.w - 60) car.x = WIDTH + 40;

      const cy = lane.row * TILE + TILE / 2;
      if (
        Math.abs(cy - py) < TILE / 2 &&
        px + TILE * 0.32 > car.x &&
        px - TILE * 0.32 < car.x + car.w
      ) {
        over = true;
      }
    }
  }
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // rows: grass for safe, asphalt for traffic
  for (let row = 0; row < ROWS; row += 1) {
    const lane = lanes.find((l) => l.row === row);
    ctx.fillStyle = !lane || lane.speed === 0 ? "#10231a" : "#161b29";
    ctx.fillRect(0, row * TILE, WIDTH, TILE - 2);
  }

  for (const lane of lanes) {
    for (const car of lane.cars) {
      ctx.fillStyle = colors[1];
      ctx.fillRect(car.x, lane.row * TILE + 8, car.w, TILE - 18);
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(car.x + 8, lane.row * TILE + 14, car.w - 16, 10);
    }
  }

  // player chicken
  const px = player.col * TILE + TILE / 2;
  const py = player.row * TILE + TILE / 2;
  ctx.fillStyle = "#eef6ff";
  ctx.beginPath();
  ctx.arc(px, py, TILE * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors[2];
  ctx.beginPath();
  ctx.moveTo(px, py - 6);
  ctx.lineTo(px + 10, py);
  ctx.lineTo(px, py + 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Score " + score + " · Level " + level, 28, 28);

  if (!started) {
    ctx.textAlign = "center";
    ctx.fillText("Arrows/WASD or tap a side to hop · reach the top!", WIDTH / 2, HEIGHT / 2);
  }
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillText("Squashed!", WIDTH / 2, HEIGHT / 2 - 20);
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
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
  const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
  const px = player.col * TILE + TILE / 2;
  const py = player.row * TILE + TILE / 2;
  if (over) {
    reset();
    return;
  }
  // hop toward the dominant axis of the tap relative to the player
  if (Math.abs(x - px) > Math.abs(y - py)) hop(Math.sign(x - px), 0);
  else hop(0, Math.sign(y - py) || -1);
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW" || e.code === "Space") {
    e.preventDefault();
    hop(0, -1);
  }
  if (e.code === "ArrowDown" || e.code === "KeyS") hop(0, 1);
  if (e.code === "ArrowLeft" || e.code === "KeyA") hop(-1, 0);
  if (e.code === "ArrowRight" || e.code === "KeyD") hop(1, 0);
  if (e.code === "KeyR") reset();
});
