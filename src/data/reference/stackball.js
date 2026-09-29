import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: smash-through tower (Stack Ball / Helix smash style).
// Hold to smash: the ball drops fast and breaks normal platforms. Release while
// passing a colored (hard) platform and you shatter — so time your holds.
// Clear all platforms to win. R restarts.

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
const GAP = 70;
let platforms, ball, scrollY, smashing, score, total, over, win;

function reset() {
  platforms = [];
  total = 16;
  for (let i = 0; i < total; i++) {
    platforms.push({ y: 220 + i * GAP, hard: i > 0 && Math.random() < 0.3, gap: Math.random() * Math.PI * 2, broken: false });
  }
  ball = { y: 140, vy: 0 };
  scrollY = 0;
  smashing = false;
  score = 0;
  over = false; win = false;
}
reset();

const cx = () => WIDTH / 2;
const towerR = () => Math.min(WIDTH, 380) * 0.34;

function update(dt) {
  if (over || win) return;
  ball.vy += (smashing ? 2600 : 1500) * dt;
  ball.y += ball.vy * dt;
  for (const p of platforms) {
    if (p.broken) continue;
    const py = p.y - scrollY;
    if (ball.y + 16 > py && ball.y + 16 < py + 22 && ball.vy > 0) {
      if (smashing && !p.hard) {
        p.broken = true; score += 1;
      } else if (p.hard && !smashing) {
        over = true;
      } else if (p.hard && smashing) {
        // bounce off hard platform when smashing -> still break? no, you shatter
        over = true;
      } else {
        ball.y = py - 16; ball.vy = -360;
      }
    }
  }
  if (ball.y > HEIGHT * 0.42) { const d = ball.y - HEIGHT * 0.42; ball.y = HEIGHT * 0.42; scrollY += d; }
  if (platforms.every((p) => p.broken || p.hard) && platforms.filter((p) => !p.hard).every((p) => p.broken)) {
    if (platforms.filter((p) => !p.broken && !p.hard).length === 0 && score >= total - platforms.filter((p) => p.hard).length) win = true;
  }
  if (score >= platforms.filter((p) => !p.hard).length) win = true;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#1c2740";
  ctx.fillRect(cx() - 6, 0, 12, HEIGHT);
  for (const p of platforms) {
    if (p.broken) continue;
    const py = p.y - scrollY;
    if (py < -30 || py > HEIGHT + 30) continue;
    ctx.fillStyle = p.hard ? colors[1] : colors[0];
    ctx.beginPath();
    ctx.arc(cx(), py + 11, towerR(), 0.2, Math.PI * 2 - 0.2);
    ctx.lineWidth = 22; ctx.strokeStyle = ctx.fillStyle;
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  ctx.fillStyle = smashing ? colors[2] : "#eef6ff";
  ctx.beginPath(); ctx.arc(cx(), ball.y, 16, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Smashed " + score, 20, 40);
  if (over || win) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(win ? "Tower cleared!" : "Shattered", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
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

function press() { if (over || win) { reset(); return; } smashing = true; }
canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); press(); });
window.addEventListener("pointerup", () => (smashing = false));
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); press(); }
  if (e.code === "KeyR") reset();
});
window.addEventListener("keyup", (e) => { if (e.code === "Space") smashing = false; });
