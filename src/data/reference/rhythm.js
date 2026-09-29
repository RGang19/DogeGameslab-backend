import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: 4-lane rhythm tapper (Guitar Hero / Piano Tiles style).
// Notes fall down lanes. Tap the lane (D/F/J/K keys or touch) as the note crosses
// the hit line. Miss too many and it's over. R restarts.

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
const LANES = 4;
const KEYMAP = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
let notes, spawn, speed, score, combo, miss, flash, over;

function laneX(i) { const w = WIDTH / LANES; return i * w + w / 2; }
const HITY = () => HEIGHT - 90;

function reset() {
  notes = [];
  spawn = 0;
  speed = 260;
  score = 0;
  combo = 0;
  miss = 0;
  flash = [0, 0, 0, 0];
  over = false;
}
reset();

function update(dt) {
  if (over) return;
  spawn -= dt;
  if (spawn <= 0) {
    spawn = Math.max(0.35, 0.8 - score * 0.003);
    notes.push({ lane: Math.floor(Math.random() * LANES), y: -30, hit: false });
  }
  for (const n of notes) n.y += speed * dt;
  for (const n of notes) if (!n.hit && n.y > HITY() + 50) { n.gone = true; miss += 1; combo = 0; if (miss >= 8) over = true; }
  notes = notes.filter((n) => !n.hit && !n.gone);
  for (let i = 0; i < LANES; i++) if (flash[i] > 0) flash[i] -= dt;
  speed = 260 + score * 1.2;
}

function tap(lane) {
  if (over) return;
  flash[lane] = 0.15;
  let best = null, bestD = 60;
  for (const n of notes) {
    if (n.lane !== lane || n.hit) continue;
    const d = Math.abs(n.y - HITY());
    if (d < bestD) { bestD = d; best = n; }
  }
  if (best) { best.hit = true; score += bestD < 22 ? 2 : 1; combo += 1; }
  else { combo = 0; }
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let i = 0; i < LANES; i++) {
    const w = WIDTH / LANES;
    ctx.fillStyle = i % 2 ? "#0e1526" : "#0b1120";
    ctx.fillRect(i * w, 0, w, HEIGHT);
    if (flash[i] > 0) { ctx.fillStyle = colors[i % colors.length] + "55"; ctx.fillRect(i * w, 0, w, HEIGHT); }
  }
  ctx.strokeStyle = "#eef6ff";
  ctx.beginPath(); ctx.moveTo(0, HITY()); ctx.lineTo(WIDTH, HITY()); ctx.stroke();
  for (const n of notes) {
    ctx.fillStyle = colors[n.lane % colors.length];
    const w = WIDTH / LANES;
    ctx.fillRect(n.lane * w + 8, n.y - 16, w - 16, 32);
  }
  ctx.fillStyle = "#eef6ff";
  ctx.textAlign = "left";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Score " + score + "   Combo " + combo + "   Miss " + miss + "/8", 20, 36);
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Song over — " + score, WIDTH / 2, HEIGHT / 2 - 10);
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

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") { reset(); return; }
  if (e.code in KEYMAP) tap(KEYMAP[e.code]);
});
canvas.addEventListener("pointerdown", (e) => {
  if (over) { reset(); return; }
  const r = canvas.getBoundingClientRect();
  tap(Math.floor((e.clientX - r.left) / (WIDTH / LANES)));
});
