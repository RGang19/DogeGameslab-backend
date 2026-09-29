import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: hill-climb physics driving.
// Hold right side / Right / D for gas, left side / Left / A for brake.
// Drive over the hills, don't run out of fuel. R restarts.

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
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
const ACCEL = tuning.speed ?? 240;
const MAXSPEED = tuning.maxSpeed ?? 420;

function terrain(x) {
  return HEIGHT * 0.7 + Math.sin(x * 0.004) * 90 + Math.sin(x * 0.011) * 40;
}

const keys = {};
let car, fuel, dist, over;

function reset() {
  car = { x: 200, speed: 0 };
  fuel = 100;
  dist = 0;
  over = false;
}
reset();

function update(dt) {
  if (over) return;
  if (keys["gas"]) { car.speed += ACCEL * dt; fuel -= 4 * dt; }
  if (keys["brake"]) car.speed -= ACCEL * 1.5 * dt;
  car.speed *= 0.99;
  car.speed = Math.max(0, Math.min(MAXSPEED, car.speed));
  car.x += car.speed * dt;
  dist = Math.floor(car.x / 10);
  fuel -= 1 * dt;
  for (let i = 0; i < 6; i++) {
    const fx = car.x + i * 90 - 200;
    if (Math.abs(fx % 900) < 4 && car.speed > 0) fuel = Math.min(100, fuel + 0);
  }
  if (Math.floor(car.x) % 900 < 3) fuel = Math.min(100, fuel + 30);
  if (fuel <= 0) { fuel = 0; over = true; }
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const cam = car.x - WIDTH * 0.3;
  ctx.fillStyle = colors[0];
  ctx.beginPath();
  ctx.moveTo(0, HEIGHT);
  for (let sx = 0; sx <= WIDTH; sx += 6) ctx.lineTo(sx, terrain(sx + cam));
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.closePath();
  ctx.fill();
  const cy = terrain(car.x);
  const slope = terrain(car.x + 20) - terrain(car.x - 20);
  ctx.save();
  ctx.translate(WIDTH * 0.3, cy - 18);
  ctx.rotate(Math.atan2(slope, 40));
  ctx.fillStyle = "#eef6ff";
  ctx.fillRect(-26, -14, 52, 22);
  ctx.fillStyle = colors[1];
  ctx.beginPath(); ctx.arc(-16, 10, 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(16, 10, 9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#23304a";
  ctx.fillRect(24, 24, 160, 16);
  ctx.fillStyle = colors[2];
  ctx.fillRect(24, 24, 160 * (fuel / 100), 16);
  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Distance " + dist + "m", 24, 64);
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Out of fuel", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R to restart", WIDTH / 2, HEIGHT / 2 + 28);
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

function setKey(code, on) {
  if (code === "ArrowRight" || code === "KeyD") keys["gas"] = on;
  if (code === "ArrowLeft" || code === "KeyA") keys["brake"] = on;
  if (on && code === "KeyR") reset();
}
window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  setKey(e.code, true);
});
window.addEventListener("keyup", (e) => setKey(e.code, false));
canvas.addEventListener("pointerdown", (e) => {
  if (over) { reset(); return; }
  keys[e.clientX > WIDTH / 2 ? "gas" : "brake"] = true;
});
canvas.addEventListener("pointerup", () => { keys["gas"] = keys["brake"] = false; });
