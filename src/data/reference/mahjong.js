import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: Mahjong-solitaire tile matching.
// Tap two free tiles with the same symbol to remove the pair. A tile is free if
// nothing covers it and one horizontal side is open. Clear the board to win. R restarts.

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

const colors = gamePackage?.visuals?.colors ?? ["#35e8ff", "#ff3df2", "#ffd166"];
const SYMS = ["🀙", "🀚", "🀛", "🀜", "🀝", "🀞", "🀟", "🀠"];
let tiles, sel, won, tw, th, ox, oy;

function layout() {
  tw = Math.min(58, (WIDTH - 40) / 9);
  th = tw * 1.3;
  ox = (WIDTH - tw * 8) / 2;
  oy = 110;
}
function reset() {
  layout();
  // build a small 2-layer pyramid layout of slots
  const slots = [];
  const layers = [
    { z: 0, rows: 4, cols: 8, offX: 0 },
    { z: 1, rows: 2, cols: 4, offX: 2 }
  ];
  for (const L of layers) for (let r = 0; r < L.rows; r++) for (let c = 0; c < L.cols; c++) {
    slots.push({ z: L.z, gx: c + L.offX + (L.z === 0 ? 0 : 0), gy: r + (L.z === 0 ? 0 : 1), sym: 0 });
  }
  // assign symbols in matched pairs
  const ids = [];
  for (let i = 0; i < slots.length; i++) ids.push(SYMS[Math.floor(i / 2) % SYMS.length]);
  ids.sort(() => Math.random() - 0.5);
  slots.forEach((s, i) => (s.sym = ids[i]));
  tiles = slots.map((s, i) => ({ ...s, id: i, dead: false }));
  sel = null;
  won = false;
}
reset();

function px(t) { return ox + t.gx * tw - t.z * 6; }
function py(t) { return oy + t.gy * th - t.z * 6; }

function isFree(t) {
  if (t.dead) return false;
  // covered by a higher-z tile overlapping
  const covered = tiles.some((o) => !o.dead && o.z > t.z && Math.abs(o.gx - t.gx) <= 0 && Math.abs(o.gy - t.gy) <= 0);
  if (covered) return false;
  const leftBlocked = tiles.some((o) => !o.dead && o.z === t.z && o.gy === t.gy && o.gx === t.gx - 1);
  const rightBlocked = tiles.some((o) => !o.dead && o.z === t.z && o.gy === t.gy && o.gx === t.gx + 1);
  return !leftBlocked || !rightBlocked;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff";
  ctx.textAlign = "center";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Tiles left " + tiles.filter((t) => !t.dead).length, WIDTH / 2, 50);
  const order = [...tiles].sort((a, b) => a.z - b.z);
  for (const t of order) {
    if (t.dead) continue;
    const x = px(t), y = py(t);
    const free = isFree(t);
    ctx.fillStyle = sel === t ? colors[2] : free ? "#f1f5ff" : "#9fb0d0";
    ctx.fillRect(x, y, tw - 3, th - 3);
    ctx.strokeStyle = "#0a1020"; ctx.strokeRect(x, y, tw - 3, th - 3);
    ctx.fillStyle = "#1a2030";
    ctx.font = `${tw * 0.7}px serif`;
    ctx.fillText(t.sym, x + tw / 2 - 1, y + th / 2 + 6);
  }
  if (won) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Cleared!", WIDTH / 2, HEIGHT / 2);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R to restart", WIDTH / 2, HEIGHT / 2 + 38);
  }
}

let last = performance.now();
function frame() { render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

canvas.addEventListener("pointerdown", (e) => {
  if (won) { reset(); return; }
  const rct = canvas.getBoundingClientRect();
  const mx = e.clientX - rct.left, my = e.clientY - rct.top;
  const order = [...tiles].sort((a, b) => b.z - a.z);
  for (const t of order) {
    if (t.dead || !isFree(t)) continue;
    const x = px(t), y = py(t);
    if (mx >= x && mx <= x + tw && my >= y && my <= y + th) {
      if (!sel) sel = t;
      else if (sel === t) sel = null;
      else if (sel.sym === t.sym) { sel.dead = true; t.dead = true; sel = null; if (tiles.every((q) => q.dead)) won = true; }
      else sel = t;
      return;
    }
  }
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });
