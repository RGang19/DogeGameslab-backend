import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: endless runner. Jump over low obstacles, slide
// under high ones, grab coins. Space/Tap to jump, ArrowDown to slide, R restarts.

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
// Fill the whole game frame (portrait on phones): WIDTH/HEIGHT track the
// live canvas size so the playfield always fills the screen, no letterbox.
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
const BASE_SPEED = tuning.speed ? tuning.speed * 60 : 320;
const GRAVITY = tuning.gravity ? tuning.gravity * 60 : 1500;
const JUMP = tuning.jump ? -tuning.jump * 60 : -640;
const GROUND_Y = HEIGHT - 90;

let player, obstacles, coins, spawn, coinSpawn, speed, score, distance, over, started;
let coinsCollected = 0;

function reset() {
  coinsCollected = 0;
  player = { x: 160, y: GROUND_Y, vy: 0, w: 36, h: 56, sliding: false, slideTime: 0 };
  obstacles = [];
  coins = [];
  spawn = 0;
  coinSpawn = 1.2;
  speed = BASE_SPEED;
  score = 0;
  distance = 0;
  over = false;
  started = false;
}
reset();

function jump() {
  if (over) {
    reset();
    return;
  }
  started = true;
  if (player.y >= GROUND_Y - 1 && !player.sliding) player.vy = JUMP;
}

function slide() {
  if (!started || over) return;
  if (player.y >= GROUND_Y - 1) {
    player.sliding = true;
    player.slideTime = 0.6;
  }
}

function playerBox() {
  const h = player.sliding ? 28 : player.h;
  return { x: player.x - player.w / 2, y: player.y - h, w: player.w, h };
}

function update(dt) {
  if (!started || over) return;

  player.vy += GRAVITY * dt;
  player.y = Math.min(GROUND_Y, player.y + player.vy * dt);
  if (player.y >= GROUND_Y) player.vy = 0;
  if (player.sliding) {
    player.slideTime -= dt;
    if (player.slideTime <= 0) player.sliding = false;
  }

  speed += 6 * dt;
  distance += speed * dt;
  score = Math.floor(distance / 50) + coinsCollected;

  spawn -= dt;
  if (spawn <= 0) {
    spawn = 0.9 + Math.random() * 0.9;
    const overhead = Math.random() < 0.35;
    obstacles.push(
      overhead
        ? { x: WIDTH + 60, y: GROUND_Y - 86, w: 44, h: 46, overhead: true }
        : { x: WIDTH + 60, y: GROUND_Y - 40, w: 38, h: 40, overhead: false }
    );
  }
  coinSpawn -= dt;
  if (coinSpawn <= 0) {
    coinSpawn = 1.4 + Math.random() * 1.2;
    coins.push({ x: WIDTH + 30, y: GROUND_Y - 70 - Math.random() * 120, r: 11 });
  }

  const box = playerBox();
  for (const o of obstacles) {
    o.x -= speed * dt;
    if (box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.y + o.h && box.y + box.h > o.y) over = true;
  }
  for (const c of coins) {
    c.x -= speed * dt;
    const cx = Math.max(box.x, Math.min(c.x, box.x + box.w));
    const cy = Math.max(box.y, Math.min(c.y, box.y + box.h));
    if (!c.taken && (c.x - cx) ** 2 + (c.y - cy) ** 2 < c.r * c.r) {
      c.taken = true;
      coinsCollected += 5;
    }
  }
  obstacles = obstacles.filter((o) => o.x > -100);
  coins = coins.filter((c) => c.x > -40 && !c.taken);
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#11182b";
  ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
  ctx.fillStyle = colors[0];
  ctx.fillRect(0, GROUND_Y, WIDTH, 4);

  for (const o of obstacles) {
    ctx.fillStyle = o.overhead ? colors[1] : colors[0];
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }
  for (const c of coins) {
    ctx.fillStyle = colors[2];
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const box = playerBox();
  ctx.fillStyle = "#eef6ff";
  ctx.fillRect(box.x, box.y, box.w, box.h);

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 28px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Score " + score, 28, 40);

  if (!started) {
    ctx.textAlign = "center";
    ctx.fillText("Tap or Space to jump · ArrowDown to slide", WIDTH / 2, HEIGHT / 2);
  }
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillText("Game Over", WIDTH / 2, HEIGHT / 2 - 20);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Score " + score + " · Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
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
  e.preventDefault();
  if (e.clientY - canvas.getBoundingClientRect().top > canvas.clientHeight * 0.75) slide();
  else jump();
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp") {
    e.preventDefault();
    jump();
  }
  if (e.code === "ArrowDown") {
    e.preventDefault();
    slide();
  }
  if (e.code === "KeyR") reset();
});
