import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: spin-the-wheel of fortune.
// Tap SPIN to flick the wheel; it decelerates and lands on a wedge under the
// pointer, awarding (or removing) credits. R resets.

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
const WEDGES = gamePackage?.gameplay?.wedges ?? [100, 25, 50, 0, 200, 25, 75, -50, 150, 25, 500, 0];
let angle, vel, spinning, credits, result, resultT;

function reset() {
  angle = 0; vel = 0; spinning = false; credits = 0; result = null; resultT = 0;
}
reset();

function spin() {
  if (spinning) return;
  spinning = true;
  vel = 9 + Math.random() * 5;
  result = null;
}

function update(dt) {
  if (spinning) {
    angle += vel * dt;
    vel *= 0.985;
    if (vel < 0.15) {
      spinning = false;
      vel = 0;
      const n = WEDGES.length;
      const seg = (Math.PI * 2) / n;
      // pointer at top (-PI/2). find wedge there.
      let a = (-Math.PI / 2 - angle) % (Math.PI * 2);
      a = (a + Math.PI * 2) % (Math.PI * 2);
      const idx = Math.floor(a / seg) % n;
      result = WEDGES[idx];
      credits += result;
      resultT = 2;
    }
  }
  if (resultT > 0) resultT -= dt;
}

function render() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const cx = WIDTH / 2, cy = HEIGHT * 0.46, R = Math.min(WIDTH, HEIGHT) * 0.32;
  const n = WEDGES.length, seg = (Math.PI * 2) / n;
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, angle + i * seg, angle + (i + 1) * seg);
    ctx.closePath();
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle + (i + 0.5) * seg);
    ctx.fillStyle = "#0a1020";
    ctx.font = "800 18px Inter, system-ui, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(String(WEDGES[i]), R - 12, 6);
    ctx.restore();
  }
  // pointer
  ctx.fillStyle = "#eef6ff";
  ctx.beginPath();
  ctx.moveTo(cx - 14, cy - R - 6); ctx.lineTo(cx + 14, cy - R - 6); ctx.lineTo(cx, cy - R + 18);
  ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
  // spin button
  ctx.fillStyle = spinning ? "#394763" : colors[2];
  ctx.fillRect(cx - 90, HEIGHT - 90, 180, 54);
  ctx.fillStyle = "#0a1020"; ctx.font = "800 24px Inter"; ctx.textAlign = "center";
  ctx.fillText("SPIN", cx, HEIGHT - 54);
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.fillText("Credits " + credits, 20, 40);
  if (resultT > 0 && result != null) {
    ctx.textAlign = "center";
    ctx.fillStyle = result >= 0 ? colors[0] : colors[1];
    ctx.font = "800 40px Inter, system-ui, sans-serif";
    ctx.fillText((result >= 0 ? "+" : "") + result, cx, cy);
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
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left, y = e.clientY - r.top;
  if (y > HEIGHT - 90 && Math.abs(x - WIDTH / 2) < 90) spin();
  else spin();
});
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") { e.preventDefault(); spin(); }
  if (e.code === "KeyR") reset();
});
