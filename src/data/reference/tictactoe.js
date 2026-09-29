import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: Tic-Tac-Toe vs an unbeatable AI (minimax).
// Tap a cell to place your X. The AI plays O. Get three in a row. R restarts.

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
let board, turn, result, size, ox, oy, wins;

function layout() {
  size = Math.min(WIDTH - 60, HEIGHT - 160);
  ox = (WIDTH - size) / 2; oy = 110;
}
function reset() { layout(); board = Array(9).fill(""); turn = "X"; result = null; wins = 0; }
reset();

const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function winner(b) {
  for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a];
  if (b.every((x) => x)) return "draw";
  return null;
}
function minimax(b, player) {
  const w = winner(b);
  if (w === "O") return { score: 10 };
  if (w === "X") return { score: -10 };
  if (w === "draw") return { score: 0 };
  let best = player === "O" ? { score: -Infinity } : { score: Infinity };
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = player;
    const res = minimax(b, player === "O" ? "X" : "O");
    b[i] = "";
    if (player === "O" ? res.score > best.score : res.score < best.score) best = { score: res.score, move: i };
  }
  return best;
}
function aiMove() {
  const m = minimax(board.slice(), "O").move;
  if (m != null) board[m] = "O";
  result = winner(board);
  turn = "X";
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center"; ctx.font = "800 28px Inter, system-ui, sans-serif";
  ctx.fillText("You: X    AI: O", WIDTH / 2, 60);
  const cell = size / 3;
  ctx.strokeStyle = "#3a4663"; ctx.lineWidth = 4;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(ox + i * cell, oy); ctx.lineTo(ox + i * cell, oy + size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ox, oy + i * cell); ctx.lineTo(ox + size, oy + i * cell); ctx.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const x = ox + (i % 3) * cell + cell / 2, y = oy + Math.floor(i / 3) * cell + cell / 2;
    if (board[i] === "X") {
      ctx.strokeStyle = colors[0]; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(x - cell * 0.25, y - cell * 0.25); ctx.lineTo(x + cell * 0.25, y + cell * 0.25);
      ctx.moveTo(x + cell * 0.25, y - cell * 0.25); ctx.lineTo(x - cell * 0.25, y + cell * 0.25); ctx.stroke();
    } else if (board[i] === "O") {
      ctx.strokeStyle = colors[1]; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.arc(x, y, cell * 0.28, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.lineWidth = 1;
  if (result) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(result === "draw" ? "Draw" : result === "X" ? "You win!" : "AI wins", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
  }
}

let last = performance.now();
function frame() { render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

canvas.addEventListener("pointerdown", (e) => {
  if (result) { reset(); return; }
  if (turn !== "X") return;
  const r = canvas.getBoundingClientRect();
  const cell = size / 3;
  const c = Math.floor((e.clientX - r.left - ox) / cell);
  const row = Math.floor((e.clientY - r.top - oy) / cell);
  if (c < 0 || c > 2 || row < 0 || row > 2) return;
  const idx = row * 3 + c;
  if (board[idx]) return;
  board[idx] = "X";
  result = winner(board);
  turn = "O";
  if (!result) setTimeout(aiMove, 250);
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });
