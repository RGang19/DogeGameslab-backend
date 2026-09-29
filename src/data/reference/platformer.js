import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: level-based platformer (distinct from endless runner).
// Arrow keys / A-D to move, Space / W / Up to jump, R to restart. Reach the flag.

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
const tuning = gamePackage?.gameplay?.tuning ?? {};
const GRAVITY = tuning.gravity ?? 1800;
const MOVE = tuning.speed ?? 260;
const JUMP = tuning.jump ?? -680;

const platforms = [
  { x: 0, y: 460, w: 360, h: 60 },
  { x: 440, y: 400, w: 200, h: 20 },
  { x: 720, y: 330, w: 200, h: 20 },
  { x: 1000, y: 420, w: 260, h: 100 },
  { x: 1340, y: 340, w: 180, h: 20 },
  { x: 1620, y: 440, w: 420, h: 80 }
];
const coins = [
  { x: 520, y: 360, got: false },
  { x: 800, y: 290, got: false },
  { x: 1400, y: 300, got: false }
];
const goal = { x: 1980, y: 360, w: 16, h: 80 };
const keys = {};
let player, cam, score, won, over;

function reset() {
  player = { x: 60, y: 380, w: 30, h: 40, vx: 0, vy: 0, onGround: false };
  cam = 0;
  score = 0;
  won = false;
  over = false;
  coins.forEach((c) => (c.got = false));
}
reset();

function update(dt) {
  if (won || over) return;
  player.vx = (keys["right"] ? MOVE : 0) - (keys["left"] ? MOVE : 0);
  if (keys["jump"] && player.onGround) {
    player.vy = JUMP;
    player.onGround = false;
  }
  player.vy += GRAVITY * dt;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  player.onGround = false;
  for (const p of platforms) {
    if (
      player.x + player.w > p.x &&
      player.x < p.x + p.w &&
      player.y + player.h > p.y &&
      player.y + player.h < p.y + 40 &&
      player.vy >= 0
    ) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
    }
  }
  for (const c of coins) {
    if (!c.got && Math.hypot(c.x - (player.x + 15), c.y - (player.y + 20)) < 28) {
      c.got = true;
      score += 1;
    }
  }
  if (player.x + player.w > goal.x && player.y + player.h > goal.y) won = true;
  if (player.y > HEIGHT + 200) over = true;
  cam = Math.max(0, player.x - WIDTH * 0.4);
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.translate(-cam, 0);
  ctx.fillStyle = colors[0];
  for (const p of platforms) ctx.fillRect(p.x, p.y, p.w, p.h);
  for (const c of coins) {
    if (c.got) continue;
    ctx.fillStyle = colors[2];
    ctx.beginPath();
    ctx.arc(c.x, c.y, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = colors[1];
  ctx.fillRect(goal.x, goal.y, goal.w, goal.h);
  ctx.fillStyle = "#eef6ff";
  ctx.fillRect(player.x, player.y, player.w, player.h);
  ctx.restore();
  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Coins " + score, 24, 38);
  if (won || over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(won ? "You reached the flag!" : "You fell", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R to restart", WIDTH / 2, HEIGHT / 2 + 30);
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
  if (code === "ArrowLeft" || code === "KeyA") keys["left"] = on;
  if (code === "ArrowRight" || code === "KeyD") keys["right"] = on;
  if (code === "Space" || code === "ArrowUp" || code === "KeyW") keys["jump"] = on;
  if (on && code === "KeyR") reset();
}
window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "Space"].includes(e.code)) e.preventDefault();
  setKey(e.code, true);
});
window.addEventListener("keyup", (e) => setKey(e.code, false));
canvas.addEventListener("pointerdown", (e) => {
  if (over || won) { reset(); return; }
  keys[e.clientX < WIDTH / 2 ? "left" : "right"] = true;
  keys["jump"] = true;
});
canvas.addEventListener("pointerup", () => {
  keys["left"] = keys["right"] = keys["jump"] = false;
});
