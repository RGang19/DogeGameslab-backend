import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: ball / water sort puzzle.
// Tap a tube to pick up its top run of same-colored balls, tap another tube to
// pour. You can only pour onto matching color or an empty tube. Sort every tube
// to a single color to win. R restarts.

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
let WIDTH = Math.max(240, Math.floor(window.innerWidth || 960));
let HEIGHT = Math.max(240, Math.floor(window.innerHeight || 540));
canvas.width = WIDTH;
canvas.height = HEIGHT;
window.addEventListener("resize", () => {
  WIDTH = canvas.width = Math.max(240, Math.floor(window.innerWidth || 960));
  HEIGHT = canvas.height = Math.max(240, Math.floor(window.innerHeight || 540));
  layout();
});

const palette = gamePackage?.visuals?.colors?.length >= 4
  ? gamePackage.visuals.colors
  : ["#35e8ff", "#ff3df2", "#ffd166", "#7CFC8A", "#ff8c42"];
const CAP = 4;
let tubes, sel, won, moves, tw, th, ballR, ys;

function layout() {
  const n = tubes ? tubes.length : 6;
  tw = Math.min(60, (WIDTH - 40) / n - 10);
  th = CAP * (tw * 0.85) + 20;
  ballR = tw * 0.36;
  ys = HEIGHT / 2 - th / 2 + 40;
}
function reset() {
  const numColors = 4;
  const numTubes = numColors + 2;
  let balls = [];
  for (let c = 0; c < numColors; c++) for (let k = 0; k < CAP; k++) balls.push(c);
  balls.sort(() => Math.random() - 0.5);
  tubes = [];
  for (let t = 0; t < numColors; t++) tubes.push(balls.slice(t * CAP, t * CAP + CAP));
  tubes.push([], []);
  sel = null; won = false; moves = 0;
  layout();
}
reset();

function tubeX(i) { const n = tubes.length; const total = n * (tw + 14) - 14; return (WIDTH - total) / 2 + i * (tw + 14); }

function topRun(t) {
  if (t.length === 0) return { color: -1, count: 0 };
  const color = t[t.length - 1]; let count = 0;
  for (let i = t.length - 1; i >= 0 && t[i] === color; i--) count++;
  return { color, count };
}
function pour(from, to) {
  if (from === to) return;
  const a = tubes[from], b = tubes[to];
  if (a.length === 0) return;
  const run = topRun(a);
  if (b.length >= CAP) return;
  if (b.length > 0 && b[b.length - 1] !== run.color) return;
  const space = CAP - b.length;
  const move = Math.min(run.count, space);
  for (let i = 0; i < move; i++) b.push(a.pop());
  moves += 1;
  checkWin();
}
function checkWin() {
  won = tubes.every((t) => t.length === 0 || (t.length === CAP && t.every((c) => c === t[0])));
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Moves " + moves, 20, 40);
  for (let i = 0; i < tubes.length; i++) {
    const x = tubeX(i);
    const lift = sel === i ? 18 : 0;
    ctx.strokeStyle = "#3a4663"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, ys - lift); ctx.lineTo(x, ys + th - lift - tw / 2);
    ctx.arc(x + tw / 2, ys + th - lift - tw / 2, tw / 2, Math.PI, 0, true);
    ctx.lineTo(x + tw, ys - lift);
    ctx.stroke();
    const t = tubes[i];
    for (let j = 0; j < t.length; j++) {
      ctx.fillStyle = palette[t[j] % palette.length];
      const cy = ys + th - lift - tw / 2 - j * (tw * 0.85) - ballR - 4;
      ctx.beginPath(); ctx.arc(x + tw / 2, cy, ballR, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.lineWidth = 1;
  if (won) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Sorted!", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R to play again", WIDTH / 2, HEIGHT / 2 + 28);
  }
}

let last = performance.now();
function frame() { render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

canvas.addEventListener("pointerdown", (e) => {
  if (won) { reset(); return; }
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  for (let i = 0; i < tubes.length; i++) {
    const tx = tubeX(i);
    if (x >= tx - 6 && x <= tx + tw + 6 && y >= ys - 30 && y <= ys + th + 10) {
      if (sel === null) { if (tubes[i].length) sel = i; }
      else if (sel === i) sel = null;
      else { pour(sel, i); sel = null; }
      return;
    }
  }
  sel = null;
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });
