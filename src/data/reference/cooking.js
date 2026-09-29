import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: time-management serving game (Papa's / Diner Dash style).
// Customers arrive with an order. Tap ingredient buttons to match the order, then
// tap SERVE. Serve before patience runs out. Three lost customers ends it. R restarts.

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
const ITEMS = ["Bun", "Patty", "Cheese", "Lettuce"];
let order, plate, customer, patience, score, lost, over;

function newCustomer() {
  const n = 2 + Math.floor(Math.random() * 3);
  order = [];
  for (let i = 0; i < n; i++) order.push(Math.floor(Math.random() * ITEMS.length));
  plate = [];
  patience = 12;
}
function reset() {
  score = 0;
  lost = 0;
  over = false;
  newCustomer();
}
reset();

function update(dt) {
  if (over) return;
  patience -= dt;
  if (patience <= 0) { lost += 1; if (lost >= 3) { over = true; return; } newCustomer(); }
}

function btns() {
  const w = (WIDTH - 80) / ITEMS.length;
  return ITEMS.map((name, i) => ({ x: 40 + i * w, y: HEIGHT - 160, w: w - 12, h: 70, name, i }));
}
const serveBtn = () => ({ x: WIDTH / 2 - 110, y: HEIGHT - 76, w: 220, h: 52 });

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff";
  ctx.textAlign = "center";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Order:", WIDTH / 2, 50);
  ctx.font = "800 20px Inter, system-ui, sans-serif";
  ctx.fillStyle = colors[2];
  ctx.fillText(order.map((i) => ITEMS[i]).join(" + "), WIDTH / 2, 82);
  // patience bar
  ctx.fillStyle = "#23304a";
  ctx.fillRect(WIDTH / 2 - 130, 100, 260, 12);
  ctx.fillStyle = patience < 4 ? colors[1] : colors[0];
  ctx.fillRect(WIDTH / 2 - 130, 100, 260 * Math.max(0, patience) / 12, 12);
  // plate
  ctx.fillStyle = "#eef6ff";
  ctx.fillText("Plate: " + plate.map((i) => ITEMS[i]).join(" + "), WIDTH / 2, HEIGHT - 200);
  for (const b of btns()) {
    ctx.fillStyle = colors[b.i % colors.length];
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = "#0a1020";
    ctx.font = "800 18px Inter, system-ui, sans-serif";
    ctx.fillText(b.name, b.x + b.w / 2, b.y + b.h / 2 + 6);
  }
  const s = serveBtn();
  ctx.fillStyle = colors[2];
  ctx.fillRect(s.x, s.y, s.w, s.h);
  ctx.fillStyle = "#0a1020";
  ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.fillText("SERVE", WIDTH / 2, s.y + 34);
  ctx.fillStyle = "#eef6ff";
  ctx.textAlign = "left";
  ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.fillText("Served " + score + "   Lost " + lost + "/3", 24, HEIGHT - 200);
  ctx.textAlign = "right";
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Closed — served " + score, WIDTH / 2, HEIGHT / 2 - 10);
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

function hit(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }
function sameOrder() {
  if (plate.length !== order.length) return false;
  return order.every((v, i) => plate[i] === v);
}
canvas.addEventListener("pointerdown", (e) => {
  if (over) { reset(); return; }
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  for (const b of btns()) if (hit(x, y, b)) plate.push(b.i);
  if (hit(x, y, serveBtn())) {
    if (sameOrder()) { score += 1; newCustomer(); }
    else { plate = []; }
  }
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });
