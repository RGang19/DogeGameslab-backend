import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: idle / incremental clicker with upgrades.
// Click the big button to earn. Buy generators that produce per second and
// multipliers. Numbers keep climbing. R resets.

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

let coins, perClick, gens, pop;
function reset() {
  coins = 0;
  perClick = 1;
  gens = [
    { name: "Worker", base: 15, owned: 0, rate: 0.5, cost: 15 },
    { name: "Drill", base: 120, owned: 0, rate: 4, cost: 120 },
    { name: "Factory", base: 1300, owned: 0, rate: 40, cost: 1300 }
  ];
  pop = [];
}
reset();

function perSecond() {
  return gens.reduce((s, g) => s + g.owned * g.rate, 0);
}
function fmt(n) {
  if (n < 1000) return Math.floor(n).toString();
  const u = ["K", "M", "B", "T"];
  let i = -1;
  while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
  return n.toFixed(2) + u[i];
}

let acc = 0;
function update(dt) {
  acc += perSecond() * dt;
  if (acc >= 1) { coins += Math.floor(acc); acc -= Math.floor(acc); }
  for (const p of pop) { p.y -= 40 * dt; p.life -= dt; }
  pop = pop.filter((p) => p.life > 0);
}

const btn = () => ({ x: WIDTH / 2 - 90, y: HEIGHT * 0.18, w: 180, h: 100 });
function rows() {
  return gens.map((g, i) => ({ x: WIDTH / 2 - 170, y: HEIGHT * 0.46 + i * 86, w: 340, h: 72, g }));
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff";
  ctx.textAlign = "center";
  ctx.font = "800 40px Inter, system-ui, sans-serif";
  ctx.fillText(fmt(coins) + " coins", WIDTH / 2, 70);
  ctx.font = "800 20px Inter, system-ui, sans-serif";
  ctx.fillStyle = colors[0];
  ctx.fillText(fmt(perSecond()) + "/sec", WIDTH / 2, 100);
  const b = btn();
  ctx.fillStyle = colors[2];
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = "#0a1020";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("TAP +" + perClick, WIDTH / 2, b.y + b.h / 2 + 8);
  for (const r of rows()) {
    const afford = coins >= r.g.cost;
    ctx.fillStyle = afford ? "#1d2942" : "#141b2c";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "left";
    ctx.font = "800 22px Inter, system-ui, sans-serif";
    ctx.fillText(`${r.g.name} x${r.g.owned}`, r.x + 14, r.y + 30);
    ctx.font = "800 16px Inter, system-ui, sans-serif";
    ctx.fillStyle = colors[0];
    ctx.fillText(`+${r.g.rate}/s`, r.x + 14, r.y + 54);
    ctx.textAlign = "right";
    ctx.fillStyle = afford ? colors[2] : "#5b6884";
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText(fmt(r.g.cost), r.x + r.w - 14, r.y + 44);
    ctx.textAlign = "left";
  }
  ctx.fillStyle = colors[2];
  ctx.textAlign = "center";
  ctx.font = "800 22px Inter, system-ui, sans-serif";
  for (const p of pop) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillText("+" + p.v, p.x, p.y);
    ctx.globalAlpha = 1;
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

function hit(rx, ry, r) { return rx >= r.x && rx <= r.x + r.w && ry >= r.y && ry <= r.y + r.h; }
canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left, y = e.clientY - rect.top;
  const b = btn();
  if (hit(x, y, b)) {
    coins += perClick;
    pop.push({ x, y, v: perClick, life: 1 });
    return;
  }
  for (const r of rows()) {
    if (hit(x, y, r) && coins >= r.g.cost) {
      coins -= r.g.cost;
      r.g.owned += 1;
      r.g.cost = Math.ceil(r.g.base * Math.pow(1.15, r.g.owned));
      if (r.g.owned % 10 === 0) perClick += 1;
    }
  }
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });
