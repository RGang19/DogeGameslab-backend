import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: simplified Klondike-style solitaire (card stacking).
// Tap a card then a destination column to move it. Build descending alternating
// colors. Tap the stock to deal. Move all to the foundations to win. R restarts.

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
const SUITS = ["♠", "♥", "♦", "♣"];
const RED = { "♥": 1, "♦": 1 };
let cols, foundation, stock, sel, cw, ch, gap, ox, won;

function layout() {
  cw = Math.min(84, (WIDTH - 60) / 7);
  ch = cw * 1.4;
  gap = (WIDTH - cw * 7) / 8;
  ox = gap;
}
function reset() {
  layout();
  const deck = [];
  for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) deck.push({ s, r });
  deck.sort(() => Math.random() - 0.5);
  cols = Array.from({ length: 7 }, () => []);
  for (let i = 0; i < 7; i++) for (let j = 0; j <= i; j++) {
    const card = deck.pop();
    card.up = j === i;
    cols[i].push(card);
  }
  stock = deck.map((c) => ((c.up = false), c));
  foundation = [0, 0, 0, 0];
  sel = null;
  won = false;
}
reset();

function canStack(card, onto) {
  if (!onto) return card.r === 13;
  return onto.up && onto.r === card.r + 1 && !!RED[SUITS[onto.s]] !== !!RED[SUITS[card.s]];
}

function colX(i) { return ox + i * (cw + gap); }
function colsTop() { return 140; }

function tryFoundation(card) {
  if (foundation[card.s] === card.r - 1) { foundation[card.s] = card.r; return true; }
  return false;
}

function render() {
  ctx.fillStyle = "#0a2018";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // foundations
  for (let s = 0; s < 4; s++) {
    const x = ox + s * (cw + gap), y = 20;
    ctx.strokeStyle = "#2c5a44"; ctx.strokeRect(x, y, cw, ch);
    ctx.fillStyle = "#eef6ff"; ctx.font = `800 ${cw * 0.4}px Inter`; ctx.textAlign = "center";
    ctx.fillText(SUITS[s] + (foundation[s] || ""), x + cw / 2, y + ch / 2 + 6);
  }
  // stock
  ctx.fillStyle = stock.length ? "#173e2d" : "#0a2018";
  ctx.fillRect(ox + 5 * (cw + gap), 20, cw, ch);
  ctx.strokeStyle = "#2c5a44"; ctx.strokeRect(ox + 5 * (cw + gap), 20, cw, ch);
  ctx.fillStyle = "#eef6ff"; ctx.font = "800 16px Inter"; ctx.textAlign = "center";
  ctx.fillText("Deal " + stock.length, ox + 5 * (cw + gap) + cw / 2, 20 + ch / 2);
  // columns
  for (let i = 0; i < 7; i++) {
    const x = colX(i);
    if (cols[i].length === 0) { ctx.strokeStyle = "#2c5a44"; ctx.strokeRect(x, colsTop(), cw, ch); }
    for (let j = 0; j < cols[i].length; j++) {
      const card = cols[i][j];
      const y = colsTop() + j * 28;
      ctx.fillStyle = card.up ? "#f4f7ff" : "#1c4a37";
      ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = "#0a2018"; ctx.strokeRect(x, y, cw, ch);
      if (card.up) {
        ctx.fillStyle = RED[SUITS[card.s]] ? "#e0436b" : "#1a2030";
        ctx.font = `800 ${cw * 0.34}px Inter`; ctx.textAlign = "left";
        const label = (card.r === 1 ? "A" : card.r === 11 ? "J" : card.r === 12 ? "Q" : card.r === 13 ? "K" : card.r) + SUITS[card.s];
        ctx.fillText(label, x + 5, y + cw * 0.36);
      }
      if (sel && sel.i === i && sel.j === j) { ctx.strokeStyle = colors[2]; ctx.lineWidth = 3; ctx.strokeRect(x, y, cw, ch); ctx.lineWidth = 1; }
    }
  }
  if (won) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("You won!", WIDTH / 2, HEIGHT / 2);
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
  const x = e.clientX - rct.left, y = e.clientY - rct.top;
  // stock deal
  if (y < 20 + ch && x > ox + 5 * (cw + gap)) {
    if (stock.length) {
      // deal one card to each non-empty pass: simple — add to shortest column face up
      const card = stock.pop(); card.up = true;
      let m = 0; for (let i = 1; i < 7; i++) if (cols[i].length < cols[m].length) m = i;
      cols[m].push(card);
    }
    return;
  }
  // which column
  let ci = -1;
  for (let i = 0; i < 7; i++) if (x >= colX(i) && x <= colX(i) + cw && y > colsTop()) ci = i;
  if (ci < 0) return;
  if (!sel) {
    const col = cols[ci];
    if (col.length && col[col.length - 1].up) sel = { i: ci, j: col.length - 1 };
    return;
  }
  const card = cols[sel.i][sel.j];
  const destTop = cols[ci][cols[ci].length - 1];
  if (ci === sel.i) { sel = null; return; }
  if (canStack(card, destTop)) {
    cols[sel.i].pop();
    cols[ci].push(card);
    const src = cols[sel.i];
    if (src.length && !src[src.length - 1].up) src[src.length - 1].up = true;
  } else if (tryFoundation(card) === false) {
    // also allow auto-foundation by tapping same column top twice handled above
  }
  // attempt foundation move when selecting then tapping foundations row
  sel = null;
  if (foundation.reduce((a, b) => a + b, 0) === 52) won = true;
});
canvas.addEventListener("dblclick", (e) => {
  if (!sel) return;
  const card = cols[sel.i][sel.j];
  if (sel.j === cols[sel.i].length - 1 && tryFoundation(card)) {
    cols[sel.i].pop();
    const src = cols[sel.i];
    if (src.length && !src[src.length - 1].up) src[src.length - 1].up = true;
    sel = null;
    if (foundation.reduce((a, b) => a + b, 0) === 52) won = true;
  }
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });
