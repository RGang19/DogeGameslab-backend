import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: Mines reveal-and-cash-out gamble (Stake Mines style).
// Reveal safe gems to grow your multiplier. Hit a mine and you bust. Tap CASH OUT
// to bank the round. R resets bankroll.

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
const GRID = 5;
const MINES = gamePackage?.gameplay?.mines ?? 5;
const BET = 10;
let tiles, mult, bank, bust, cashed, cell, ox, oy;

function layout() {
  cell = Math.min((WIDTH - 40) / GRID, (HEIGHT - 220) / GRID);
  ox = (WIDTH - cell * GRID) / 2;
  oy = 150;
}
function newRound() {
  layout();
  tiles = [];
  for (let i = 0; i < GRID * GRID; i++) tiles.push({ mine: false, rev: false });
  const idx = [...Array(tiles.length).keys()].sort(() => Math.random() - 0.5).slice(0, MINES);
  idx.forEach((i) => (tiles[i].mine = true));
  mult = 1;
  bust = false;
  cashed = false;
}
function reset() { bank = 100; newRound(); }
reset();

const safeTotal = () => GRID * GRID - MINES;
function revealedSafe() { return tiles.filter((t) => t.rev && !t.mine).length; }

function pick(i) {
  if (bust || cashed) { newRound(); return; }
  const t = tiles[i];
  if (t.rev) return;
  t.rev = true;
  if (t.mine) { bust = true; bank -= BET; tiles.forEach((x) => x.mine && (x.rev = true)); return; }
  const remainingSafe = safeTotal() - revealedSafe() + 1;
  const remainingTiles = tiles.filter((x) => !x.rev).length + 1;
  mult *= remainingTiles / remainingSafe;
  if (revealedSafe() === safeTotal()) cashOut();
}
function cashOut() {
  if (bust || cashed) return;
  if (revealedSafe() === 0) return;
  bank += BET * mult - BET;
  cashed = true;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left";
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.fillText("Bank $" + bank.toFixed(0), 20, 40);
  ctx.textAlign = "center";
  ctx.fillStyle = colors[0];
  ctx.font = "800 30px Inter, system-ui, sans-serif";
  ctx.fillText("x" + mult.toFixed(2), WIDTH / 2, 90);
  ctx.fillStyle = "#9fb0d0"; ctx.font = "800 14px Inter";
  ctx.fillText(MINES + " mines · bet $" + BET, WIDTH / 2, 116);
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    const x = ox + (i % GRID) * cell, y = oy + Math.floor(i / GRID) * cell;
    if (t.rev) {
      ctx.fillStyle = t.mine ? colors[1] : "#1d3a2a";
      ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
      ctx.fillStyle = t.mine ? "#0a1020" : colors[0];
      ctx.font = `${cell * 0.5}px serif`; ctx.textAlign = "center";
      ctx.fillText(t.mine ? "✸" : "◆", x + cell / 2, y + cell * 0.66);
    } else {
      ctx.fillStyle = "#2b3a5c";
      ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
    }
  }
  // cash out button
  const canCash = !bust && !cashed && revealedSafe() > 0;
  ctx.fillStyle = canCash ? colors[2] : "#394763";
  ctx.fillRect(WIDTH / 2 - 110, HEIGHT - 70, 220, 50);
  ctx.fillStyle = "#0a1020"; ctx.font = "800 22px Inter"; ctx.textAlign = "center";
  ctx.fillText(bust ? "BUST — tap to retry" : cashed ? "CASHED — tap for next" : "CASH OUT", WIDTH / 2, HEIGHT - 38);
}

let last = performance.now();
function frame() { render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

canvas.addEventListener("pointerdown", (e) => {
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  if (y > HEIGHT - 70 && Math.abs(x - WIDTH / 2) < 110) {
    if (bust || cashed) newRound(); else cashOut();
    return;
  }
  const c = Math.floor((x - ox) / cell), rr = Math.floor((y - oy) / cell);
  if (c >= 0 && c < GRID && rr >= 0 && rr < GRID) pick(rr * GRID + c);
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });
