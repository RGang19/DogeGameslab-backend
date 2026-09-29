import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: clicker economy. Tap the core to earn, buy
// upgrades that raise click power and automate income. R restarts.

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
const BASE_CLICK = tuning.clickValue ?? 1;

const CORE = { x: 280, y: HEIGHT / 2 + 20, r: 110 };

let credits, clickPower, perSecond, pulse, upgrades, floaters;

function reset() {
  credits = 0;
  clickPower = BASE_CLICK;
  perSecond = 0;
  pulse = 0;
  floaters = [];
  upgrades = [
    { name: "Sharper Taps", desc: "+1 per click", cost: 25, owned: 0, apply: () => (clickPower += 1) },
    { name: "Auto Drone", desc: "+1 per second", cost: 100, owned: 0, apply: () => (perSecond += 1) },
    { name: "Click Engine", desc: "+5 per click", cost: 600, owned: 0, apply: () => (clickPower += 5) },
    { name: "Drone Swarm", desc: "+8 per second", cost: 2200, owned: 0, apply: () => (perSecond += 8) }
  ];
}
reset();

function upgradeRect(i) {
  return { x: 560, y: 110 + i * 92, w: 360, h: 76 };
}

function clickCore() {
  credits += clickPower;
  pulse = 0.18;
  floaters.push({ x: CORE.x + (Math.random() - 0.5) * 80, y: CORE.y - 40, vy: -70, life: 0.9, text: "+" + clickPower });
}

function buyUpgrade(i) {
  const u = upgrades[i];
  if (credits < u.cost) return;
  credits -= u.cost;
  u.owned += 1;
  u.apply();
  u.cost = Math.ceil(u.cost * 1.6);
}

function handleTap(x, y) {
  if (Math.hypot(x - CORE.x, y - CORE.y) <= CORE.r + 8) {
    clickCore();
    return;
  }
  for (let i = 0; i < upgrades.length; i += 1) {
    const r = upgradeRect(i);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      buyUpgrade(i);
      return;
    }
  }
}

function update(dt) {
  credits += perSecond * dt;
  if (pulse > 0) pulse -= dt;
  for (const f of floaters) {
    f.y += f.vy * dt;
    f.life -= dt;
  }
  floaters = floaters.filter((f) => f.life > 0);
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 34px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(Math.floor(credits) + " credits", 28, 44);
  ctx.font = "800 18px Inter, system-ui, sans-serif";
  ctx.fillStyle = colors[0];
  ctx.fillText("+" + clickPower + " per click · +" + perSecond + " per second", 28, 78);

  const r = CORE.r * (pulse > 0 ? 1.06 : 1);
  const grad = ctx.createRadialGradient(CORE.x, CORE.y, r * 0.2, CORE.x, CORE.y, r);
  grad.addColorStop(0, colors[2]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(CORE.x, CORE.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#070a12";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("TAP", CORE.x, CORE.y);

  for (const f of floaters) {
    ctx.globalAlpha = Math.max(0, f.life);
    ctx.fillStyle = "#eef6ff";
    ctx.font = "800 22px Inter, system-ui, sans-serif";
    ctx.fillText(f.text, f.x, f.y);
    ctx.globalAlpha = 1;
  }

  ctx.textAlign = "left";
  for (let i = 0; i < upgrades.length; i += 1) {
    const u = upgrades[i];
    const box = upgradeRect(i);
    const affordable = credits >= u.cost;
    ctx.fillStyle = affordable ? "#16203a" : "#0d1322";
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = affordable ? colors[0] : "#1c2742";
    ctx.lineWidth = 2;
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = "#eef6ff";
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText(u.name + (u.owned ? " x" + u.owned : ""), box.x + 16, box.y + 26);
    ctx.fillStyle = affordable ? colors[2] : "#5a6781";
    ctx.font = "800 16px Inter, system-ui, sans-serif";
    ctx.fillText(u.desc + " · cost " + u.cost, box.x + 16, box.y + 54);
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
  handleTap(((e.clientX - rect.left) / rect.width) * WIDTH, ((e.clientY - rect.top) / rect.height) * HEIGHT);
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    clickCore();
  }
  if (e.code === "KeyR") reset();
});
