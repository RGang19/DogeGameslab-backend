import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: memory pairs. Flip two cards; matches stay open.
// Clear the board in as few moves as possible. R restarts.

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
// Fill the whole game frame (portrait on phones): WIDTH/HEIGHT track the
// live canvas size so the playfield always fills the screen, no letterbox.
let WIDTH = Math.max(240, Math.floor(window.innerWidth || 960));
let HEIGHT = Math.max(240, Math.floor(window.innerHeight || 540));
canvas.width = WIDTH;
canvas.height = HEIGHT;
window.addEventListener("resize", () => {
  WIDTH = canvas.width = Math.max(240, Math.floor(window.innerWidth || 960));
  HEIGHT = canvas.height = Math.max(240, Math.floor(window.innerHeight || 540));
});

const colors = gamePackage?.visuals?.colors ?? ["#35e8ff", "#ff3df2", "#ffd166"];
const tuning = gamePackage?.gameplay?.tuning ?? {};
const COLS = Math.max(4, Math.min(6, tuning.cols ?? 4));
// keep the card count even so every card has a pair
const ROWS = (() => {
  const rows = Math.max(3, Math.min(4, tuning.rows ?? 4));
  return (COLS * rows) % 2 === 0 ? rows : rows - 1;
})();
const SYMBOLS = ["★", "♦", "♣", "♠", "♥", "☀", "☾", "⚡", "✿", "♫", "☂", "⚓"];

const CARD_W = 110;
const CARD_H = 96;
const GAP = 14;
const OX = Math.floor((WIDTH - (COLS * (CARD_W + GAP) - GAP)) / 2);
const OY = Math.floor((HEIGHT - (ROWS * (CARD_H + GAP) - GAP)) / 2) + 16;

let cards, first, second, lockTimer, moves, matched, won;

function reset() {
  const pairCount = (COLS * ROWS) / 2;
  const pool = [];
  for (let i = 0; i < pairCount; i += 1) {
    pool.push(i, i);
  }
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  cards = pool.map((symbol, index) => ({
    symbol,
    row: Math.floor(index / COLS),
    col: index % COLS,
    open: false,
    done: false
  }));
  first = null;
  second = null;
  lockTimer = 0;
  moves = 0;
  matched = 0;
  won = false;
}
reset();

function cardRect(card) {
  return {
    x: OX + card.col * (CARD_W + GAP),
    y: OY + card.row * (CARD_H + GAP),
    w: CARD_W,
    h: CARD_H
  };
}

function flip(card) {
  if (won) {
    reset();
    return;
  }
  if (lockTimer > 0 || card.open || card.done) return;
  card.open = true;
  if (!first) {
    first = card;
    return;
  }
  second = card;
  moves += 1;
  if (first.symbol === second.symbol) {
    first.done = true;
    second.done = true;
    matched += 2;
    first = null;
    second = null;
    if (matched === cards.length) won = true;
  } else {
    lockTimer = 0.8;
  }
}

function update(dt) {
  if (lockTimer > 0) {
    lockTimer -= dt;
    if (lockTimer <= 0 && first && second) {
      first.open = false;
      second.open = false;
      first = null;
      second = null;
    }
  }
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Pairs " + matched / 2 + " / " + cards.length / 2, 28, 36);
  ctx.textAlign = "right";
  ctx.fillText("Moves " + moves, WIDTH - 28, 36);

  for (const card of cards) {
    const r = cardRect(card);
    if (card.open || card.done) {
      ctx.fillStyle = card.done ? "#16203a" : "#1d2a4a";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = card.done ? colors[2] : colors[0];
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = colors[card.symbol % colors.length];
      ctx.font = "800 44px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(SYMBOLS[card.symbol % SYMBOLS.length], r.x + r.w / 2, r.y + r.h / 2);
    } else {
      ctx.fillStyle = "#11182b";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = "#1c2742";
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
    }
  }

  if (won) {
    ctx.fillStyle = "rgba(7,10,18,0.78)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillText("Board Cleared!", WIDTH / 2, HEIGHT / 2 - 20);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText(moves + " moves · Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
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
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
  const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
  if (won) {
    reset();
    return;
  }
  for (const card of cards) {
    const r = cardRect(card);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      flip(card);
      return;
    }
  }
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") reset();
});
