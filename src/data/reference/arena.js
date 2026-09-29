import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: top-down arena survival. WASD/arrows to move,
// aim with the pointer, hold click or Space to shoot. Survive waves of
// chasing enemies, grab health pickups. R restarts.

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
const PLAYER_SPEED = tuning.speed ? tuning.speed * 60 : 260;
const ENEMY_SPEED = tuning.enemySpeed ? tuning.enemySpeed * 60 : 95;
const FIRE_COOLDOWN = tuning.fireRate ? 1 / tuning.fireRate : 0.16;

let player, bullets, enemies, pickups, wave, waveTimer, score, over, started, keys, aim, firing, fireTimer;

function reset() {
  player = { x: WIDTH / 2, y: HEIGHT / 2, r: 16, hp: 5, hurt: 0 };
  bullets = [];
  enemies = [];
  pickups = [];
  wave = 0;
  waveTimer = 0;
  score = 0;
  over = false;
  started = false;
  keys = {};
  aim = { x: WIDTH / 2, y: 0 };
  firing = false;
  fireTimer = 0;
  spawnWave();
}

function spawnWave() {
  wave += 1;
  const count = 4 + wave * 2;
  for (let i = 0; i < count; i += 1) {
    // spawn on the arena edge
    const side = Math.floor(Math.random() * 4);
    const x = side === 0 ? -20 : side === 1 ? WIDTH + 20 : Math.random() * WIDTH;
    const y = side === 2 ? -20 : side === 3 ? HEIGHT + 20 : Math.random() * HEIGHT;
    enemies.push({ x, y, r: 14, hp: 1 + Math.floor(wave / 3), speed: ENEMY_SPEED * (0.85 + Math.random() * 0.4) });
  }
  if (wave % 3 === 0) {
    pickups.push({ x: 80 + Math.random() * (WIDTH - 160), y: 80 + Math.random() * (HEIGHT - 160), r: 12 });
  }
}
reset();

function shoot() {
  if (fireTimer > 0) return;
  const dx = aim.x - player.x;
  const dy = aim.y - player.y;
  const len = Math.hypot(dx, dy) || 1;
  bullets.push({ x: player.x, y: player.y, vx: (dx / len) * 520, vy: (dy / len) * 520, r: 4 });
  fireTimer = FIRE_COOLDOWN;
}

function update(dt) {
  if (!started || over) return;

  fireTimer -= dt;
  if (player.hurt > 0) player.hurt -= dt;
  if (firing || keys.fire) shoot();

  let mx = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  let my = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  const mlen = Math.hypot(mx, my) || 1;
  player.x = Math.max(player.r, Math.min(WIDTH - player.r, player.x + (mx / mlen) * PLAYER_SPEED * dt));
  player.y = Math.max(player.r, Math.min(HEIGHT - player.r, player.y + (my / mlen) * PLAYER_SPEED * dt));

  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  bullets = bullets.filter((b) => b.x > -20 && b.x < WIDTH + 20 && b.y > -20 && b.y < HEIGHT + 20);

  for (const e of enemies) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    e.x += (dx / len) * e.speed * dt;
    e.y += (dy / len) * e.speed * dt;

    for (const b of bullets) {
      if (!b.dead && Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) {
        b.dead = true;
        e.hp -= 1;
        if (e.hp <= 0) score += 15;
      }
    }
    if (Math.hypot(player.x - e.x, player.y - e.y) < player.r + e.r && player.hurt <= 0) {
      player.hp -= 1;
      player.hurt = 1;
      if (player.hp <= 0) over = true;
    }
  }
  bullets = bullets.filter((b) => !b.dead);
  enemies = enemies.filter((e) => e.hp > 0);

  for (const p of pickups) {
    if (!p.taken && Math.hypot(player.x - p.x, player.y - p.y) < player.r + p.r) {
      p.taken = true;
      player.hp = Math.min(5, player.hp + 2);
    }
  }
  pickups = pickups.filter((p) => !p.taken);

  if (enemies.length === 0) {
    waveTimer += dt;
    if (waveTimer > 1.2) {
      waveTimer = 0;
      spawnWave();
    }
  }
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.strokeStyle = "#1c2742";
  ctx.lineWidth = 4;
  ctx.strokeRect(8, 8, WIDTH - 16, HEIGHT - 16);

  for (const p of pickups) {
    ctx.fillStyle = colors[2];
    ctx.fillRect(p.x - p.r, p.y - 3, p.r * 2, 6);
    ctx.fillRect(p.x - 3, p.y - p.r, 6, p.r * 2);
  }

  for (const b of bullets) {
    ctx.fillStyle = colors[2];
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of enemies) {
    ctx.fillStyle = colors[1];
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (player.hurt <= 0 || Math.floor(player.hurt * 10) % 2 === 0) {
    ctx.fillStyle = "#eef6ff";
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();
    const dx = aim.x - player.x;
    const dy = aim.y - player.y;
    const len = Math.hypot(dx, dy) || 1;
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + (dx / len) * 26, player.y + (dy / len) * 26);
    ctx.stroke();
  }

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Score " + score, 28, 36);
  ctx.textAlign = "right";
  ctx.fillText("Wave " + wave + " · HP " + Math.max(0, player.hp), WIDTH - 28, 36);

  if (!started) {
    ctx.textAlign = "center";
    ctx.fillText("WASD/arrows move · aim with pointer · click or Space to shoot", WIDTH / 2, HEIGHT / 2 + 60);
  }
  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = "#eef6ff";
    ctx.textAlign = "center";
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillText("You Fell", WIDTH / 2, HEIGHT / 2 - 20);
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

function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * WIDTH,
    y: ((e.clientY - rect.top) / rect.height) * HEIGHT
  };
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (over) {
    reset();
    return;
  }
  started = true;
  aim = pointerPos(e);
  firing = true;
});
canvas.addEventListener("pointermove", (e) => {
  aim = pointerPos(e);
});
window.addEventListener("pointerup", () => {
  firing = false;
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") keys.up = true;
  if (e.code === "ArrowDown" || e.code === "KeyS") keys.down = true;
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "Space") {
    e.preventDefault();
    started = true;
    keys.fire = true;
  }
  if (e.code === "KeyR") reset();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") keys.up = false;
  if (e.code === "ArrowDown" || e.code === "KeyS") keys.down = false;
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  if (e.code === "Space") keys.fire = false;
});
