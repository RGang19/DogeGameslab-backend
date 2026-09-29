import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: Asteroids vector shooter.
// Left/Right rotate, Up thrusts, Space fires. Screen wraps. Shoot all rocks;
// big rocks split. Getting hit ends the game. R restarts.

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
const keys = {};
let ship, rocks, bullets, score, over, wave;

function reset() {
  ship = { x: WIDTH / 2, y: HEIGHT / 2, a: -Math.PI / 2, vx: 0, vy: 0, r: 14 };
  bullets = [];
  rocks = [];
  score = 0; over = false; wave = 1;
  spawnWave();
}
function spawnWave() {
  for (let i = 0; i < 3 + wave; i++) {
    rocks.push({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120, r: 42 });
  }
}
reset();

function wrap(o) {
  if (o.x < 0) o.x += WIDTH; if (o.x > WIDTH) o.x -= WIDTH;
  if (o.y < 0) o.y += HEIGHT; if (o.y > HEIGHT) o.y -= HEIGHT;
}

let fireCd = 0;
function update(dt) {
  if (over) return;
  if (keys["left"]) ship.a -= 3.4 * dt;
  if (keys["right"]) ship.a += 3.4 * dt;
  if (keys["up"]) { ship.vx += Math.cos(ship.a) * 280 * dt; ship.vy += Math.sin(ship.a) * 280 * dt; }
  ship.vx *= 0.99; ship.vy *= 0.99;
  ship.x += ship.vx * dt; ship.y += ship.vy * dt; wrap(ship);
  fireCd -= dt;
  if (keys["fire"] && fireCd <= 0) {
    fireCd = 0.25;
    bullets.push({ x: ship.x, y: ship.y, vx: Math.cos(ship.a) * 460 + ship.vx, vy: Math.sin(ship.a) * 460 + ship.vy, life: 1.1 });
  }
  for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; wrap(b); }
  bullets = bullets.filter((b) => b.life > 0);
  for (const r of rocks) { r.x += r.vx * dt; r.y += r.vy * dt; wrap(r); }
  for (const b of bullets) for (const r of rocks) {
    if (!r.dead && Math.hypot(b.x - r.x, b.y - r.y) < r.r) {
      r.dead = true; b.life = 0; score += 20;
      if (r.r > 20) for (let k = 0; k < 2; k++) rocks.push({ x: r.x, y: r.y, vx: (Math.random() - 0.5) * 160, vy: (Math.random() - 0.5) * 160, r: r.r / 2 });
    }
  }
  rocks = rocks.filter((r) => !r.dead);
  for (const r of rocks) if (Math.hypot(ship.x - r.x, ship.y - r.y) < r.r + ship.r) over = true;
  if (rocks.length === 0) { wave += 1; spawnWave(); }
}

function render() {
  ctx.fillStyle = "#05070f";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = colors[0]; ctx.lineWidth = 2;
  for (const r of rocks) {
    ctx.beginPath();
    for (let i = 0; i <= 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const rr = r.r * (0.8 + ((Math.sin(i * 7.3 + r.x) + 1) * 0.1));
      const px = r.x + Math.cos(ang) * rr, py = r.y + Math.sin(ang) * rr;
      i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
    }
    ctx.closePath(); ctx.stroke();
  }
  ctx.fillStyle = colors[2];
  for (const b of bullets) { ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.save(); ctx.translate(ship.x, ship.y); ctx.rotate(ship.a);
  ctx.strokeStyle = "#eef6ff"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-12, -10); ctx.lineTo(-6, 0); ctx.lineTo(-12, 10); ctx.closePath(); ctx.stroke();
  if (keys["up"]) { ctx.strokeStyle = colors[1]; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-18, 0); ctx.stroke(); }
  ctx.restore();
  ctx.lineWidth = 1;
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "left"; ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.fillText("Score " + score + "   Wave " + wave, 20, 36);
  if (over) {
    ctx.fillStyle = "rgba(5,7,15,0.72)"; ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
    ctx.font = "800 44px Inter, system-ui, sans-serif";
    ctx.fillText("Destroyed — " + score, WIDTH / 2, HEIGHT / 2 - 10);
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
  if (code === "ArrowLeft" || code === "KeyA") keys["left"] = on;
  if (code === "ArrowRight" || code === "KeyD") keys["right"] = on;
  if (code === "ArrowUp" || code === "KeyW") keys["up"] = on;
  if (code === "Space") keys["fire"] = on;
  if (on && code === "KeyR") reset();
}
window.addEventListener("keydown", (e) => { if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault(); setKey(e.code, true); });
window.addEventListener("keyup", (e) => setKey(e.code, false));
canvas.addEventListener("pointerdown", (e) => {
  if (over) { reset(); return; }
  const r = canvas.getBoundingClientRect();
  const x = e.clientX - r.left;
  if (x < WIDTH * 0.33) keys["left"] = true;
  else if (x > WIDTH * 0.66) keys["right"] = true;
  else keys["up"] = true;
  keys["fire"] = true;
});
canvas.addEventListener("pointerup", () => { keys["left"] = keys["right"] = keys["up"] = keys["fire"] = false; });
