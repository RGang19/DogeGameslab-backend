import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: helix tower drop (Helix Jump style).
// Hold left/right (or drag) to rotate the tower. The ball bounces down through
// gaps. Hitting a colored segment ends the run; clearing all rings wins. R restarts.

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
const GRAVITY = tuning.gravity ?? 1400;
const RING_GAP = 130;

let rings, ball, rot, rotV, scrollY, score, over, win;

function reset() {
  rings = [];
  for (let i = 1; i <= 10; i++) {
    const segs = [];
    const gapStart = Math.random() * Math.PI * 2;
    for (let s = 0; s < 6; s++) {
      const a0 = (s / 6) * Math.PI * 2;
      const isGap = Math.abs(((a0 - gapStart + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > Math.PI - 0.9;
      segs.push({ a0, a1: a0 + Math.PI / 3, gap: isGap });
    }
    rings.push({ y: i * RING_GAP + 200, segs });
  }
  ball = { x: WIDTH / 2, y: 140, vy: 0, r: 14 };
  rot = 0; rotV = 0;
  scrollY = 0;
  score = 0;
  over = false;
  win = false;
}
reset();

const keys = {};
function update(dt) {
  if (over || win) return;
  rot += ((keys["right"] ? 1 : 0) - (keys["left"] ? 1 : 0)) * 3 * dt + rotV * dt;
  rotV *= 0.9;
  ball.vy += GRAVITY * dt;
  ball.y += ball.vy * dt;
  // find ring near ball
  for (const ring of rings) {
    const ry = ring.y - scrollY;
    if (Math.abs(ry - ball.y) < ball.r + 6 && ball.vy > 0 && !ring.passed) {
      // ball angle is fixed at top (pointing down center) => check segment at angle -rot
      const ang = ((-rot) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
      let blocked = false;
      for (const s of ring.segs) {
        if (s.gap) continue;
        const a0 = ((s.a0) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (ang >= a0 && ang < a0 + Math.PI / 3) blocked = true;
      }
      if (blocked) { ball.vy = -520; ring.bounce = 0.15; over = true; }
      else { ring.passed = true; score += 1; scrollY += 0; }
    }
  }
  // scroll so ball stays mid-screen
  if (ball.y > HEIGHT * 0.45) {
    const d = ball.y - HEIGHT * 0.45;
    ball.y = HEIGHT * 0.45;
    scrollY += d;
  }
  if (score >= rings.length) win = true;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const cx = WIDTH / 2;
  ctx.strokeStyle = "#1c2740";
  ctx.lineWidth = 8;
  ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, HEIGHT); ctx.stroke();
  ctx.lineWidth = 1;
  const R = Math.min(WIDTH, 360) * 0.36;
  for (const ring of rings) {
    if (ring.passed) continue;
    const ry = ring.y - scrollY;
    if (ry < -40 || ry > HEIGHT + 40) continue;
    for (const s of ring.segs) {
      if (s.gap) continue;
      ctx.fillStyle = colors[0];
      ctx.beginPath();
      ctx.moveTo(cx, ry);
      ctx.arc(cx, ry, R, s.a0 + rot, s.a1 + rot);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.fillStyle = colors[2];
  ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Rings " + score + "/" + rings.length, 24, 38);
  if (over || win) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText(win ? "Cleared!" : "Crashed", WIDTH / 2, HEIGHT / 2 - 10);
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

function setKey(code, on) {
  if (code === "ArrowLeft" || code === "KeyA") keys["left"] = on;
  if (code === "ArrowRight" || code === "KeyD") keys["right"] = on;
  if (on && code === "KeyR") reset();
}
window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  setKey(e.code, true);
});
window.addEventListener("keyup", (e) => setKey(e.code, false));
let drag = null;
canvas.addEventListener("pointerdown", (e) => {
  if (over || win) { reset(); return; }
  drag = e.clientX;
});
canvas.addEventListener("pointermove", (e) => {
  if (drag == null) return;
  rotV += (e.clientX - drag) * 0.0008;
  rot += (e.clientX - drag) * 0.01;
  drag = e.clientX;
});
window.addEventListener("pointerup", () => (drag = null));
