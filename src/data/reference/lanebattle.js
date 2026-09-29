import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: lane / base battle (Age of War style).
// Spend gold to spawn units that march right and fight. Destroy the enemy base
// before yours falls. Click the SPAWN button or press Space. R restarts.

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
const UNIT_COST = tuning.cost ?? 25;

let units, gold, goldT, baseHpL, baseHpR, enemyT, over, win;
const LANE_Y = () => HEIGHT * 0.6;

function reset() {
  units = [];
  gold = 50;
  goldT = 0;
  baseHpL = 100;
  baseHpR = 100;
  enemyT = 0;
  over = false;
  win = false;
}
reset();

function spawn(side) {
  units.push({ x: side === 1 ? 80 : WIDTH - 80, side, hp: 20, dmg: 6, speed: 70 });
}

function update(dt) {
  if (over || win) return;
  goldT += dt;
  if (goldT > 1) { goldT = 0; gold += 8; }
  enemyT -= dt;
  if (enemyT <= 0) { enemyT = 2.2; spawn(-1); }
  for (const u of units) {
    const enemies = units.filter((o) => o.side !== u.side && !o.dead);
    const inFront = enemies.find((o) => Math.abs(o.x - u.x) < 36);
    if (inFront) { inFront.hp -= u.dmg * dt; }
    else {
      u.x += u.side * u.speed * dt;
      if (u.side === 1 && u.x > WIDTH - 70) { baseHpR -= u.dmg * dt * 2; u.dead = true; }
      if (u.side === -1 && u.x < 70) { baseHpL -= u.dmg * dt * 2; u.dead = true; }
    }
  }
  units = units.filter((u) => u.hp > 0 && !u.dead);
  if (baseHpL <= 0) over = true;
  if (baseHpR <= 0) win = true;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#161d2e";
  ctx.fillRect(0, LANE_Y() + 30, WIDTH, HEIGHT);
  ctx.fillStyle = colors[0];
  ctx.fillRect(20, LANE_Y() - 50, 44, 80);
  ctx.fillStyle = colors[1];
  ctx.fillRect(WIDTH - 64, LANE_Y() - 50, 44, 80);
  for (const u of units) {
    ctx.fillStyle = u.side === 1 ? colors[0] : colors[1];
    ctx.fillRect(u.x - 10, LANE_Y() - 22, 20, 34);
  }
  ctx.fillStyle = "#23304a";
  ctx.fillRect(20, 20, 200, 14); ctx.fillRect(WIDTH - 220, 20, 200, 14);
  ctx.fillStyle = colors[0]; ctx.fillRect(20, 20, 200 * Math.max(0, baseHpL) / 100, 14);
  ctx.fillStyle = colors[1]; ctx.fillRect(WIDTH - 220, 20, 200 * Math.max(0, baseHpR) / 100, 14);
  // spawn button
  ctx.fillStyle = gold >= UNIT_COST ? colors[2] : "#394763";
  ctx.fillRect(WIDTH / 2 - 90, HEIGHT - 70, 180, 48);
  ctx.fillStyle = "#0a1020";
  ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("SPAWN  " + UNIT_COST, WIDTH / 2, HEIGHT - 40);
  ctx.fillStyle = "#eef6ff";
  ctx.textAlign = "left";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Gold " + Math.floor(gold), 20, 60);
  if (over || win) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(win ? "Victory!" : "Base destroyed", WIDTH / 2, HEIGHT / 2 - 10);
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

function trySpawn() {
  if (over || win) { reset(); return; }
  if (gold >= UNIT_COST) { gold -= UNIT_COST; spawn(1); }
}
canvas.addEventListener("pointerdown", () => trySpawn());
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); trySpawn(); }
  if (e.code === "KeyR") reset();
});
