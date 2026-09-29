import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: top-down lane racer. Steer with arrows/A-D or
// drag, dodge traffic, grab boost pads. Speed scales with distance. R restarts.

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
const BASE_SPEED = tuning.speed ? tuning.speed * 60 : 300;
const STEER_SPEED = tuning.steer ? tuning.steer * 60 : 420;

const ROAD_X = 240;
const ROAD_W = 480;
const LANES = 4;
const LANE_W = ROAD_W / LANES;

let car, traffic, boosts, spawn, boostSpawn, speed, distance, score, boostTime, over, started, keys, dashOffset;

function reset() {
  car = { x: WIDTH / 2, y: HEIGHT - 90, w: 40, h: 64 };
  traffic = [];
  boosts = [];
  spawn = 0;
  boostSpawn = 3;
  speed = BASE_SPEED;
  distance = 0;
  score = 0;
  boostTime = 0;
  over = false;
  started = false;
  keys = {};
  dashOffset = 0;
}
reset();

function laneCenter(i) {
  return ROAD_X + LANE_W * i + LANE_W / 2;
}

function start() {
  if (over) {
    reset();
    return;
  }
  started = true;
}

function update(dt) {
  if (!started || over) return;

  const effSpeed = speed * (boostTime > 0 ? 1.6 : 1);
  if (boostTime > 0) boostTime -= dt;
  speed += 5 * dt;
  distance += effSpeed * dt;
  score = Math.floor(distance / 40);
  dashOffset = (dashOffset + effSpeed * dt) % 60;

  if (keys.left) car.x -= STEER_SPEED * dt;
  if (keys.right) car.x += STEER_SPEED * dt;
  car.x = Math.max(ROAD_X + car.w / 2 + 6, Math.min(ROAD_X + ROAD_W - car.w / 2 - 6, car.x));

  spawn -= dt;
  if (spawn <= 0) {
    spawn = Math.max(0.45, 1.3 - distance / 30000);
    const lane = Math.floor(Math.random() * LANES);
    traffic.push({ x: laneCenter(lane), y: -80, w: 40, h: 64, vy: effSpeed * (0.45 + Math.random() * 0.2) });
  }
  boostSpawn -= dt;
  if (boostSpawn <= 0) {
    boostSpawn = 4 + Math.random() * 4;
    boosts.push({ x: laneCenter(Math.floor(Math.random() * LANES)), y: -40, r: 16 });
  }

  for (const t of traffic) {
    t.y += (effSpeed - t.vy) * dt;
    if (
      Math.abs(t.x - car.x) < (t.w + car.w) / 2 - 6 &&
      Math.abs(t.y - car.y) < (t.h + car.h) / 2 - 6
    ) {
      over = true;
    }
  }
  for (const b of boosts) {
    b.y += effSpeed * dt;
    if (!b.taken && Math.abs(b.x - car.x) < b.r + car.w / 2 && Math.abs(b.y - car.y) < b.r + car.h / 2) {
      b.taken = true;
      boostTime = 1.8;
      score += 25;
    }
  }
  traffic = traffic.filter((t) => t.y < HEIGHT + 120);
  boosts = boosts.filter((b) => b.y < HEIGHT + 60 && !b.taken);
}

function drawCar(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x - w / 2, y - h / 2, w, h);
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(x - w / 2 + 6, y - h / 2 + 10, w - 12, 14);
  ctx.fillRect(x - w / 2 + 6, y + h / 2 - 22, w - 12, 12);
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#11182b";
  ctx.fillRect(ROAD_X, 0, ROAD_W, HEIGHT);
  ctx.strokeStyle = colors[0];
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(ROAD_X, 0);
  ctx.lineTo(ROAD_X, HEIGHT);
  ctx.moveTo(ROAD_X + ROAD_W, 0);
  ctx.lineTo(ROAD_X + ROAD_W, HEIGHT);
  ctx.stroke();

  ctx.strokeStyle = "#2a3656";
  ctx.lineWidth = 3;
  ctx.setLineDash([28, 32]);
  ctx.lineDashOffset = -dashOffset;
  for (let i = 1; i < LANES; i += 1) {
    ctx.beginPath();
    ctx.moveTo(ROAD_X + LANE_W * i, 0);
    ctx.lineTo(ROAD_X + LANE_W * i, HEIGHT);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  for (const b of boosts) {
    ctx.fillStyle = colors[2];
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const t of traffic) drawCar(t.x, t.y, t.w, t.h, colors[1]);
  drawCar(car.x, car.y, car.w, car.h, boostTime > 0 ? colors[2] : "#eef6ff");

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Score " + score, 28, 40);

  if (!started) {
    ctx.textAlign = "center";
    ctx.fillText("Arrows/A-D or drag to steer · tap to start", WIDTH / 2, HEIGHT / 2);
  }
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillText("Crashed!", WIDTH / 2, HEIGHT / 2 - 20);
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

function pointerX(e) {
  const rect = canvas.getBoundingClientRect();
  return ((e.clientX - rect.left) / rect.width) * WIDTH;
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  start();
  car.x = Math.max(ROAD_X + car.w / 2 + 6, Math.min(ROAD_X + ROAD_W - car.w / 2 - 6, pointerX(e)));
});
canvas.addEventListener("pointermove", (e) => {
  if (e.buttons > 0 && started && !over) {
    car.x = Math.max(ROAD_X + car.w / 2 + 6, Math.min(ROAD_X + ROAD_W - car.w / 2 - 6, pointerX(e)));
  }
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    start();
  }
  if (e.code === "KeyR") reset();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
});
