import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: type-the-falling-words (ZType / typing trainer).
// Words drift down. Type a word's letters to destroy it before it reaches the
// bottom. Three misses ends the game. R restarts.

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
const BANK = gamePackage?.gameplay?.words ?? [
  "code", "pixel", "rocket", "ninja", "laser", "turbo", "cyber", "matrix",
  "vector", "quantum", "galaxy", "plasma", "orbit", "nitro", "spark", "blitz"
];
let words, spawn, fallSpeed, typed, target, score, miss, over;

function reset() {
  words = [];
  spawn = 0;
  fallSpeed = 40;
  typed = "";
  target = null;
  score = 0;
  miss = 0;
  over = false;
}
reset();

function update(dt) {
  if (over) return;
  spawn -= dt;
  if (spawn <= 0) {
    spawn = Math.max(0.7, 1.8 - score * 0.02);
    const text = BANK[Math.floor(Math.random() * BANK.length)];
    words.push({ text, x: 40 + Math.random() * (WIDTH - 160), y: -10, prog: 0 });
  }
  for (const w of words) w.y += fallSpeed * dt;
  for (const w of words) if (w.y > HEIGHT - 30 && !w.done) { w.done = true; miss += 1; if (miss >= 3) over = true; }
  words = words.filter((w) => !w.cleared && !w.done);
  fallSpeed = 40 + score * 1.5;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  for (const w of words) {
    ctx.fillStyle = w === target ? colors[2] : "#eef6ff";
    ctx.fillText(w.text.slice(w.prog), w.x + ctx.measureText(w.text.slice(0, w.prog)).width, w.y);
    if (w.prog > 0) { ctx.fillStyle = colors[0]; ctx.fillText(w.text.slice(0, w.prog), w.x, w.y); }
  }
  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Score " + score + "   Miss " + miss + "/3", 20, 36);
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Game Over — " + score, WIDTH / 2, HEIGHT / 2 - 10);
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

function typeLetter(ch) {
  if (over) return;
  if (!target) {
    target = words.filter((w) => !w.cleared).sort((a, b) => b.y - a.y).find((w) => w.text[0] === ch) || null;
  }
  if (target && target.text[target.prog] === ch) {
    target.prog += 1;
    if (target.prog >= target.text.length) { target.cleared = true; score += 1; target = null; }
  }
}
window.addEventListener("keydown", (e) => {
  if (over && e.code === "KeyR") { reset(); return; }
  if (/^[a-zA-Z]$/.test(e.key)) typeLetter(e.key.toLowerCase());
});
canvas.addEventListener("pointerdown", () => { if (over) reset(); });
