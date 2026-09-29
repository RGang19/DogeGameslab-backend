import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: basketball arcade hoops.
// Drag from the ball and release to shoot (slingshot aim). Sink it through the
// moving hoop. 30-second clock. R restarts.

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
const GRAVITY = tuning.gravity ?? 1200;
let ball, hoop, score, time, flying, aim, scored, over;

function home() { ball = { x: WIDTH * 0.5, y: HEIGHT - 90, vx: 0, vy: 0, r: 22 }; flying = false; scored = false; }
function reset() {
  hoop = { x: WIDTH * 0.5, y: HEIGHT * 0.3, r: 38, dir: 1, range: WIDTH * 0.3 };
  score = 0; time = 30; over = false; aim = null; home();
}
reset();

function update(dt) {
  if (over) return;
  time -= dt;
  if (time <= 0) { time = 0; over = true; return; }
  hoop.x += hoop.dir * 90 * dt * (1 + score * 0.05);
  if (hoop.x > WIDTH * 0.5 + hoop.range) hoop.dir = -1;
  if (hoop.x < WIDTH * 0.5 - hoop.range) hoop.dir = 1;
  if (flying) {
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt; ball.y += ball.vy * dt;
    if (!scored && ball.vy > 0 && Math.abs(ball.x - hoop.x) < hoop.r * 0.7 && Math.abs(ball.y - hoop.y) < 18) {
      scored = true; score += 1;
    }
    if (ball.y > HEIGHT + 60 || ball.x < -60 || ball.x > WIDTH + 60) home();
  }
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // backboard + hoop
  ctx.fillStyle = "#eef6ff";
  ctx.fillRect(hoop.x - 4, hoop.y - 70, 8, 50);
  ctx.fillStyle = "#2b3a5c";
  ctx.fillRect(hoop.x - 40, hoop.y - 78, 80, 54);
  ctx.strokeStyle = colors[1]; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(hoop.x, hoop.y, hoop.r, 9, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  // ball
  ctx.fillStyle = colors[2];
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
  if (aim) {
    ctx.strokeStyle = "#eef6ff"; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(aim.x, aim.y); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.fillText("Score " + score, 20, 40);
  ctx.textAlign = "right"; ctx.fillText("Time " + Math.ceil(time), WIDTH - 20, 40);
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Buzzer! — " + score, WIDTH / 2, HEIGHT / 2 - 10);
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

function at(e) { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
canvas.addEventListener("pointerdown", (e) => {
  if (over) { reset(); return; }
  if (flying) return;
  const p = at(e);
  if (Math.hypot(p.x - ball.x, p.y - ball.y) < 80) aim = p;
});
canvas.addEventListener("pointermove", (e) => { if (aim) aim = at(e); });
window.addEventListener("pointerup", () => {
  if (!aim || flying) { aim = null; return; }
  ball.vx = (ball.x - aim.x) * 3.2;
  ball.vy = (ball.y - aim.y) * 3.2;
  flying = true; aim = null;
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });
