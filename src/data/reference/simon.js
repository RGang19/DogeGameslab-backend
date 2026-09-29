import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: Simon sequence-memory game.
// Watch the pads flash, then repeat the growing sequence by tapping them in
// order. One mistake ends the run. R restarts.

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

const colors = gamePackage?.visuals?.colors?.length >= 4
  ? gamePackage.visuals.colors
  : ["#35e8ff", "#ff3df2", "#ffd166", "#7CFC8A"];
let seq, step, phase, flashIdx, flashT, lit, score, over;

function reset() {
  seq = []; score = 0; over = false;
  nextRound();
}
function nextRound() {
  seq.push(Math.floor(Math.random() * 4));
  step = 0; phase = "show"; flashIdx = 0; flashT = 0; lit = -1;
}
reset();

function pads() {
  const cx = WIDTH / 2, cy = HEIGHT / 2 + 20, R = Math.min(WIDTH, HEIGHT) * 0.32;
  return [
    { i: 0, x: cx, y: cy - R / 2, r: R / 2.4 },
    { i: 1, x: cx + R / 2, y: cy, r: R / 2.4 },
    { i: 2, x: cx, y: cy + R / 2, r: R / 2.4 },
    { i: 3, x: cx - R / 2, y: cy, r: R / 2.4 }
  ];
}

function update(dt) {
  if (over) return;
  if (phase === "show") {
    flashT -= dt;
    if (flashT <= 0) {
      if (lit >= 0) { lit = -1; flashT = 0.18; if (flashIdx >= seq.length) phase = "input"; }
      else { lit = seq[flashIdx]; flashIdx++; flashT = 0.45; }
    }
  }
}

function tap(i) {
  if (over) { reset(); return; }
  if (phase !== "input") return;
  lit = i; setTimeout(() => (lit = -1), 150);
  if (i === seq[step]) {
    step++;
    if (step >= seq.length) { score++; setTimeout(() => nextRound(), 500); phase = "wait"; }
  } else { over = true; }
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center"; ctx.font = "800 28px Inter, system-ui, sans-serif";
  ctx.fillText("Round " + seq.length, WIDTH / 2, 60);
  ctx.font = "800 18px Inter, system-ui, sans-serif"; ctx.fillStyle = "#9fb0d0";
  ctx.fillText(phase === "input" ? "Your turn — repeat it" : phase === "show" ? "Watch..." : "", WIDTH / 2, 90);
  for (const p of pads()) {
    ctx.fillStyle = colors[p.i];
    ctx.globalAlpha = lit === p.i ? 1 : 0.4;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Score " + score, WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
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
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  for (const p of pads()) if (Math.hypot(p.x - x, p.y - y) < p.r) { tap(p.i); return; }
  if (over) reset();
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });
