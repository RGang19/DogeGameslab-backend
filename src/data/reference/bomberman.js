import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: grid bomber (Bomberman style).
// WASD / arrows to move, Space / tap-self to drop a bomb. Blasts destroy soft
// crates and enemies but also you. Clear all enemies to win. R restarts.

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
const COLS = 11, ROWS = 11;
let grid, player, enemies, bombs, blasts, won, over, cell, ox, oy, moveCd;

function layout() {
  cell = Math.min((WIDTH - 20) / COLS, (HEIGHT - 100) / ROWS);
  ox = (WIDTH - cell * COLS) / 2;
  oy = 80;
}
function reset() {
  layout();
  grid = [];
  for (let r = 0; r < ROWS; r++) { grid[r] = []; for (let c = 0; c < COLS; c++) {
    if (r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 || (r % 2 === 0 && c % 2 === 0)) grid[r][c] = "wall";
    else if ((r < 2 && c < 2)) grid[r][c] = "empty";
    else grid[r][c] = Math.random() < 0.45 ? "crate" : "empty";
  } }
  player = { r: 1, c: 1 };
  enemies = [];
  for (let i = 0; i < 3; i++) {
    let er, ec; do { er = 1 + Math.floor(Math.random() * (ROWS - 2)); ec = 1 + Math.floor(Math.random() * (COLS - 2)); }
    while (grid[er][ec] !== "empty" || (er < 4 && ec < 4));
    enemies.push({ r: er, c: ec, t: 0 });
  }
  bombs = []; blasts = []; won = false; over = false; moveCd = 0;
}
reset();

const keys = {};
function dropBomb() {
  if (bombs.some((b) => b.r === player.r && b.c === player.c)) return;
  bombs.push({ r: player.r, c: player.c, t: 2 });
}
function explode(b) {
  const cells = [{ r: b.r, c: b.c }];
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let k = 1; k <= 2; k++) {
      const r = b.r + dr * k, c = b.c + dc * k;
      if (grid[r][c] === "wall") break;
      cells.push({ r, c });
      if (grid[r][c] === "crate") { grid[r][c] = "empty"; break; }
    }
  }
  for (const cc of cells) blasts.push({ ...cc, t: 0.4 });
  for (const cc of cells) {
    if (player.r === cc.r && player.c === cc.c) over = true;
    enemies = enemies.filter((e) => !(e.r === cc.r && e.c === cc.c));
  }
}

function update(dt) {
  if (won || over) return;
  moveCd -= dt;
  if (moveCd <= 0) {
    let dr = 0, dc = 0;
    if (keys["up"]) dr = -1; else if (keys["down"]) dr = 1;
    else if (keys["left"]) dc = -1; else if (keys["right"]) dc = 1;
    if (dr || dc) {
      const nr = player.r + dr, nc = player.c + dc;
      if (grid[nr][nc] === "empty" && !bombs.some((b) => b.r === nr && b.c === nc)) { player.r = nr; player.c = nc; moveCd = 0.14; }
    }
  }
  for (const b of bombs) { b.t -= dt; if (b.t <= 0) b.boom = true; }
  for (const b of bombs) if (b.boom) explode(b);
  bombs = bombs.filter((b) => !b.boom);
  for (const bl of blasts) bl.t -= dt;
  blasts = blasts.filter((bl) => bl.t > 0);
  for (const e of enemies) {
    e.t -= dt;
    if (e.t <= 0) {
      e.t = 0.5;
      const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dr, dc]) => grid[e.r + dr][e.c + dc] === "empty");
      if (opts.length) { const [dr, dc] = opts[Math.floor(Math.random() * opts.length)]; e.r += dr; e.c += dc; }
    }
    if (e.r === player.r && e.c === player.c) over = true;
  }
  if (enemies.length === 0) won = true;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const x = ox + c * cell, y = oy + r * cell;
    if (grid[r][c] === "wall") ctx.fillStyle = "#39455f";
    else if (grid[r][c] === "crate") ctx.fillStyle = "#8a5a2b";
    else ctx.fillStyle = "#11192c";
    ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
  }
  for (const b of bombs) { ctx.fillStyle = "#0e0e12"; ctx.beginPath(); ctx.arc(ox + b.c * cell + cell / 2, oy + b.r * cell + cell / 2, cell * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = colors[1]; ctx.fillRect(ox + b.c * cell + cell / 2 - 2, oy + b.r * cell + cell * 0.16, 4, 6); }
  for (const bl of blasts) { ctx.fillStyle = colors[2] + "cc"; ctx.fillRect(ox + bl.c * cell + 2, oy + bl.r * cell + 2, cell - 4, cell - 4); }
  for (const e of enemies) { ctx.fillStyle = colors[1]; ctx.beginPath(); ctx.arc(ox + e.c * cell + cell / 2, oy + e.r * cell + cell / 2, cell * 0.3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = colors[0]; ctx.beginPath(); ctx.arc(ox + player.c * cell + cell / 2, oy + player.r * cell + cell / 2, cell * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Enemies " + enemies.length, 20, 40);
  if (won || over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(won ? "Cleared!" : "Boom — you died", WIDTH / 2, HEIGHT / 2 - 10);
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

function setKey(code, on) {
  if (code === "ArrowUp" || code === "KeyW") keys["up"] = on;
  if (code === "ArrowDown" || code === "KeyS") keys["down"] = on;
  if (code === "ArrowLeft" || code === "KeyA") keys["left"] = on;
  if (code === "ArrowRight" || code === "KeyD") keys["right"] = on;
  if (on && code === "Space") dropBomb();
  if (on && code === "KeyR") reset();
}
window.addEventListener("keydown", (e) => { if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault(); setKey(e.code, true); });
window.addEventListener("keyup", (e) => setKey(e.code, false));
canvas.addEventListener("pointerdown", (e) => {
  if (won || over) { reset(); return; }
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left - (ox + player.c * cell + cell / 2);
  const y = e.clientY - r.top - (oy + player.r * cell + cell / 2);
  if (Math.abs(x) < cell * 0.5 && Math.abs(y) < cell * 0.5) { dropBomb(); return; }
  if (Math.abs(x) > Math.abs(y)) keys[x > 0 ? "right" : "left"] = true;
  else keys[y > 0 ? "down" : "up"] = true;
});
canvas.addEventListener("pointerup", () => { keys.up = keys.down = keys.left = keys.right = false; });
