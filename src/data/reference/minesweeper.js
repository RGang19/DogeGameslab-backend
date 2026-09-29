import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: Minesweeper grid deduction.
// Tap to reveal a cell. Long-press / right-click to flag a suspected mine.
// Reveal every safe cell to win. R restarts.

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
const tuning = gamePackage?.gameplay?.tuning ?? {};
const COLS = tuning.cols ?? 10;
const ROWS = tuning.rows ?? 12;
const MINES = tuning.mines ?? 18;

let cells, over, win, cell, ox, oy;

function layout() {
  cell = Math.min((WIDTH - 40) / COLS, (HEIGHT - 120) / ROWS);
  ox = (WIDTH - cell * COLS) / 2;
  oy = 90;
}
function reset() {
  layout();
  cells = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) cells.push({ r, c, mine: false, rev: false, flag: false, n: 0 });
  const idx = [...Array(cells.length).keys()].sort(() => Math.random() - 0.5).slice(0, MINES);
  idx.forEach((i) => (cells[i].mine = true));
  for (const cl of cells) cl.n = neighbors(cl).filter((n) => n.mine).length;
  over = false;
  win = false;
}
function get(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS ? cells[r * COLS + c] : null; }
function neighbors(cl) {
  const a = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const n = get(cl.r + dr, cl.c + dc);
    if (n) a.push(n);
  }
  return a;
}
reset();

function reveal(cl) {
  if (cl.rev || cl.flag) return;
  cl.rev = true;
  if (cl.mine) { over = true; cells.forEach((c) => c.mine && (c.rev = true)); return; }
  if (cl.n === 0) neighbors(cl).forEach(reveal);
  if (cells.every((c) => c.mine || c.rev)) win = true;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "center";
  const flags = cells.filter((c) => c.flag).length;
  ctx.fillText("Mines left " + (MINES - flags), WIDTH / 2, 48);
  for (const cl of cells) {
    const x = ox + cl.c * cell, y = oy + cl.r * cell;
    if (cl.rev) {
      ctx.fillStyle = cl.mine ? colors[1] : "#1d2942";
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      if (!cl.mine && cl.n > 0) {
        ctx.fillStyle = colors[cl.n % colors.length];
        ctx.font = `800 ${cell * 0.5}px Inter, system-ui, sans-serif`;
        ctx.fillText(String(cl.n), x + cell / 2, y + cell * 0.66);
      }
    } else {
      ctx.fillStyle = "#2b3a5c";
      ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
      if (cl.flag) {
        ctx.fillStyle = colors[2];
        ctx.fillRect(x + cell * 0.35, y + cell * 0.25, cell * 0.3, cell * 0.5);
      }
    }
  }
  if (over || win) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(win ? "Cleared!" : "Boom", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
  }
}

let last = performance.now();
function frame() { render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

function cellAt(e) {
  const r = canvas.getBoundingClientRect();
  const c = Math.floor((e.clientX - r.left - ox) / cell);
  const row = Math.floor((e.clientY - r.top - oy) / cell);
  return get(row, c);
}
let pressTimer = null, longPressed = false;
canvas.addEventListener("pointerdown", (e) => {
  if (over || win) { reset(); return; }
  longPressed = false;
  pressTimer = setTimeout(() => {
    longPressed = true;
    const cl = cellAt(e);
    if (cl && !cl.rev) cl.flag = !cl.flag;
  }, 350);
});
canvas.addEventListener("pointerup", (e) => {
  clearTimeout(pressTimer);
  if (longPressed || over || win) return;
  const cl = cellAt(e);
  if (cl) reveal(cl);
});
canvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  const cl = cellAt(e);
  if (cl && !cl.rev) cl.flag = !cl.flag;
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });
