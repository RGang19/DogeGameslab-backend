import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: word-guess (Wordle / Hangman hybrid).
// Type a 5-letter guess and press Enter. Green = right spot, yellow = wrong spot.
// Six tries. R restarts. Uses an on-screen keyboard too.

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
const WORDS = (gamePackage?.gameplay?.words ?? [
  "APPLE", "BRAVE", "CRANE", "DREAM", "EAGLE", "FLAME", "GRAPE", "HOUSE",
  "JELLY", "LEMON", "MANGO", "NOBLE", "OCEAN", "PIANO", "QUEEN", "RIVER",
  "STONE", "TIGER", "ULTRA", "VOICE"
]).map((w) => w.toUpperCase());
const ROWS = 6, LEN = 5;
let answer, guesses, current, over, win, status;

function reset() {
  answer = WORDS[Math.floor(Math.random() * WORDS.length)];
  guesses = [];
  current = "";
  over = false;
  win = false;
  status = {};
}
reset();

function score(guess) {
  const res = Array(LEN).fill("absent");
  const a = answer.split("");
  for (let i = 0; i < LEN; i++) if (guess[i] === a[i]) { res[i] = "correct"; a[i] = null; }
  for (let i = 0; i < LEN; i++) if (res[i] !== "correct") {
    const j = a.indexOf(guess[i]);
    if (j >= 0) { res[i] = "present"; a[j] = null; }
  }
  for (let i = 0; i < LEN; i++) {
    const cur = status[guess[i]];
    if (res[i] === "correct" || (res[i] === "present" && cur !== "correct") || !cur) status[guess[i]] = res[i];
  }
  return res;
}
function submit() {
  if (current.length !== LEN) return;
  const res = score(current);
  guesses.push({ word: current, res });
  if (current === answer) win = over = true;
  else if (guesses.length >= ROWS) over = true;
  current = "";
}

function colOf(kind) { return kind === "correct" ? "#3aa856" : kind === "present" ? colors[2] : "#3a4663"; }

const KB = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
function keyRects() {
  const rects = [];
  const kw = Math.min(40, (WIDTH - 40) / 10), kh = 44, gap = 5;
  let y = HEIGHT - 170;
  for (const row of KB) {
    const rw = row.length * (kw + gap) - gap;
    let x = (WIDTH - rw) / 2;
    for (const ch of row) { rects.push({ ch, x, y, w: kw, h: kh }); x += kw + gap; }
    y += kh + gap;
  }
  return rects;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const cell = Math.min(56, (WIDTH - 60) / LEN);
  const gw = cell * LEN + (LEN - 1) * 8;
  const ox = (WIDTH - gw) / 2, oy = 40;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < LEN; c++) {
      const x = ox + c * (cell + 8), y = oy + r * (cell + 8);
      let letter = "", fill = "#0a1020", border = "#2b3a5c";
      if (r < guesses.length) { letter = guesses[r].word[c]; fill = colOf(guesses[r].res[c]); border = fill; }
      else if (r === guesses.length && c < current.length) { letter = current[c]; border = "#6a7aa0"; }
      ctx.fillStyle = fill; ctx.fillRect(x, y, cell, cell);
      ctx.strokeStyle = border; ctx.strokeRect(x, y, cell, cell);
      if (letter) {
        ctx.fillStyle = "#eef6ff"; ctx.font = `800 ${cell * 0.5}px Inter`; ctx.textAlign = "center";
        ctx.fillText(letter, x + cell / 2, y + cell * 0.66);
      }
    }
  }
  for (const k of keyRects()) {
    ctx.fillStyle = colOf(status[k.ch] || "blank");
    if (!status[k.ch]) ctx.fillStyle = "#2b3a5c";
    ctx.fillRect(k.x, k.y, k.w, k.h);
    ctx.fillStyle = "#eef6ff"; ctx.font = "800 18px Inter"; ctx.textAlign = "center";
    ctx.fillText(k.ch, k.x + k.w / 2, k.y + k.h / 2 + 6);
  }
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.8)";
    ctx.fillRect(0, HEIGHT / 2 - 60, WIDTH, 120);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 36px Inter, system-ui, sans-serif";
    ctx.fillText(win ? "Correct!" : answer, WIDTH / 2, HEIGHT / 2 - 4);
    ctx.font = "800 18px Inter, system-ui, sans-serif";
    ctx.fillText("Press R to play again", WIDTH / 2, HEIGHT / 2 + 30);
  }
}

let last = performance.now();
function frame() { render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

function typeChar(ch) {
  if (over) return;
  if (current.length < LEN) current += ch;
}
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR" && (over || e.shiftKey)) { reset(); return; }
  if (over) return;
  if (e.key === "Enter") submit();
  else if (e.key === "Backspace") current = current.slice(0, -1);
  else if (/^[a-zA-Z]$/.test(e.key)) typeChar(e.key.toUpperCase());
});
canvas.addEventListener("pointerdown", (e) => {
  if (over) { reset(); return; }
  const rct = canvas.getBoundingClientRect();
  const x = e.clientX - rct.left, y = e.clientY - rct.top;
  for (const k of keyRects()) if (x >= k.x && x <= k.x + k.w && y >= k.y && y <= k.y + k.h) typeChar(k.ch);
  if (y > HEIGHT - 40) submit();
});
