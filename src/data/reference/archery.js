import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: archery / target shooting.
// Drag back to aim and set power, release to fire an arrow. Hit the moving
// target; bullseye scores most. Limited arrows. R restarts.

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
const GRAVITY = tuning.gravity ?? 320;
let bow, arrow, target, score, arrows, aim, over, msg, msgT;

function reset() {
  bow = { x: 70, y: HEIGHT * 0.7 };
  arrow = null;
  target = { x: WIDTH * 0.8, y: HEIGHT * 0.4, r: 46, dir: 1 };
  score = 0; arrows = 8; over = false; aim = null; msg = ""; msgT = 0;
}
reset();

function update(dt) {
  target.y += target.dir * 70 * dt;
  if (target.y < target.r + 40) target.dir = 1;
  if (target.y > HEIGHT - target.r - 40) target.dir = -1;
  if (arrow) {
    arrow.vy += GRAVITY * dt;
    arrow.x += arrow.vx * dt; arrow.y += arrow.vy * dt;
    const d = Math.hypot(arrow.x - target.x, arrow.y - target.y);
    if (d < target.r) {
      const ring = d < target.r * 0.25 ? 10 : d < target.r * 0.5 ? 7 : d < target.r * 0.75 ? 4 : 2;
      score += ring; msg = "+" + ring; msgT = 1; arrow = null;
      if (arrows <= 0) over = true;
    } else if (arrow.x > WIDTH + 40 || arrow.y > HEIGHT + 40) {
      arrow = null; msg = "Miss"; msgT = 0.8; if (arrows <= 0) over = true;
    }
  }
  if (msgT > 0) msgT -= dt;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  // target rings
  const rings = [["#eef6ff", 1], [colors[0], 0.75], ["#eef6ff", 0.5], [colors[1], 0.25]];
  for (const [col, f] of rings) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(target.x, target.y, target.r * f, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = colors[2]; ctx.beginPath(); ctx.arc(target.x, target.y, target.r * 0.1, 0, Math.PI * 2); ctx.fill();
  // bow
  ctx.strokeStyle = "#eef6ff"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(bow.x, bow.y, 26, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.lineWidth = 1;
  if (arrow) {
    ctx.strokeStyle = colors[2]; ctx.lineWidth = 3;
    const a = Math.atan2(arrow.vy, arrow.vx);
    ctx.beginPath(); ctx.moveTo(arrow.x, arrow.y); ctx.lineTo(arrow.x - Math.cos(a) * 22, arrow.y - Math.sin(a) * 22); ctx.stroke();
    ctx.lineWidth = 1;
  }
  if (aim) {
    ctx.strokeStyle = "#eef6ff"; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(bow.x, bow.y);
    ctx.lineTo(bow.x + (bow.x - aim.x), bow.y + (bow.y - aim.y)); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Score " + score + "   Arrows " + arrows, 20, 36);
  if (msgT > 0) { ctx.textAlign = "center"; ctx.fillStyle = colors[2]; ctx.font = "800 30px Inter"; ctx.fillText(msg, target.x, target.y - target.r - 12); }
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Final " + score, WIDTH / 2, HEIGHT / 2 - 10);
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
  if (arrow) return;
  aim = at(e);
});
canvas.addEventListener("pointermove", (e) => { if (aim) aim = at(e); });
window.addEventListener("pointerup", () => {
  if (!aim || arrow) { aim = null; return; }
  arrow = { x: bow.x, y: bow.y, vx: (bow.x - aim.x) * 4, vy: (bow.y - aim.y) * 4 };
  arrows -= 1; aim = null;
});
window.addEventListener("keydown", (e) => { if (e.code === "KeyR") reset(); });
