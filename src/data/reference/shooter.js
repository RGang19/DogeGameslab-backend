import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: wave shooter. Move with arrows/A-D or drag,
// Space or tap fires. Survive enemy waves, every 5th wave spawns a boss.
// R restarts.

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
const PLAYER_SPEED = tuning.speed ? tuning.speed * 60 : 380;
const FIRE_COOLDOWN = tuning.fireRate ? 1 / tuning.fireRate : 0.18;
const ENEMY_SPEED = tuning.enemySpeed ? tuning.enemySpeed * 60 : 70;

let player, bullets, enemyBullets, enemies, wave, score, over, started, fireTimer, keys;

function reset() {
  player = { x: WIDTH / 2, y: HEIGHT - 60, w: 40, h: 28, hp: 3, hurt: 0 };
  bullets = [];
  enemyBullets = [];
  enemies = [];
  wave = 0;
  score = 0;
  over = false;
  started = false;
  fireTimer = 0;
  keys = {};
  spawnWave();
}

function spawnWave() {
  wave += 1;
  const boss = wave % 5 === 0;
  if (boss) {
    enemies.push({ x: WIDTH / 2, y: 90, w: 120, h: 60, hp: 18 + wave * 2, boss: true, t: 0, shoot: 0.8 });
    return;
  }
  const rows = Math.min(2 + Math.floor(wave / 2), 4);
  const cols = 7;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      enemies.push({
        x: 140 + c * 100,
        y: 70 + r * 56,
        w: 40,
        h: 28,
        hp: 1 + Math.floor(wave / 4),
        boss: false,
        t: Math.random() * Math.PI * 2,
        shoot: 2 + Math.random() * 4
      });
    }
  }
}
reset();

function fire() {
  if (over) {
    reset();
    return;
  }
  started = true;
  if (fireTimer <= 0) {
    bullets.push({ x: player.x, y: player.y - 18, vy: -560 });
    fireTimer = FIRE_COOLDOWN;
  }
}

function update(dt) {
  if (!started || over) return;

  fireTimer -= dt;
  if (keys.left) player.x -= PLAYER_SPEED * dt;
  if (keys.right) player.x += PLAYER_SPEED * dt;
  player.x = Math.max(30, Math.min(WIDTH - 30, player.x));
  if (keys.fire) fire();
  if (player.hurt > 0) player.hurt -= dt;

  for (const b of bullets) b.y += b.vy * dt;
  bullets = bullets.filter((b) => b.y > -20);

  for (const e of enemies) {
    e.t += dt;
    e.x += Math.sin(e.t * 1.3) * ENEMY_SPEED * dt;
    e.y += (e.boss ? 4 : 9) * dt;
    e.shoot -= dt;
    if (e.shoot <= 0) {
      e.shoot = e.boss ? 0.8 : 2.5 + Math.random() * 3.5;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      enemyBullets.push({ x: e.x, y: e.y + e.h / 2, vx: (dx / len) * 220, vy: (dy / len) * 220 });
    }
    if (e.y + e.h / 2 > player.y) over = true;
  }

  for (const b of bullets) {
    for (const e of enemies) {
      if (e.hp > 0 && Math.abs(b.x - e.x) < e.w / 2 && Math.abs(b.y - e.y) < e.h / 2) {
        e.hp -= 1;
        b.dead = true;
        if (e.hp <= 0) score += e.boss ? 250 : 20;
      }
    }
  }
  bullets = bullets.filter((b) => !b.dead);
  enemies = enemies.filter((e) => e.hp > 0);

  for (const b of enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (Math.abs(b.x - player.x) < player.w / 2 && Math.abs(b.y - player.y) < player.h / 2) {
      b.dead = true;
      if (player.hurt <= 0) {
        player.hp -= 1;
        player.hurt = 1.2;
        if (player.hp <= 0) over = true;
      }
    }
  }
  enemyBullets = enemyBullets.filter((b) => !b.dead && b.y < HEIGHT + 30 && b.y > -30 && b.x > -30 && b.x < WIDTH + 30);

  if (enemies.length === 0) spawnWave();
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  for (const b of bullets) {
    ctx.fillStyle = colors[2];
    ctx.fillRect(b.x - 2, b.y - 9, 4, 14);
  }
  for (const b of enemyBullets) {
    ctx.fillStyle = colors[1];
    ctx.beginPath();
    ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const e of enemies) {
    ctx.fillStyle = e.boss ? colors[1] : colors[0];
    ctx.fillRect(e.x - e.w / 2, e.y - e.h / 2, e.w, e.h);
    if (e.boss) {
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(e.x - e.w / 2 + 6, e.y - 6, e.w - 12, 8);
      ctx.fillStyle = colors[2];
      ctx.fillRect(e.x - e.w / 2 + 6, e.y - 6, (e.w - 12) * Math.max(0, e.hp / (18 + wave * 2)), 8);
    }
  }

  if (player.hurt <= 0 || Math.floor(player.hurt * 10) % 2 === 0) {
    ctx.fillStyle = "#eef6ff";
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - 18);
    ctx.lineTo(player.x - 20, player.y + 14);
    ctx.lineTo(player.x + 20, player.y + 14);
    ctx.closePath();
    ctx.fill();
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
    ctx.fillText("Arrows/A-D move · Space or tap to fire", WIDTH / 2, HEIGHT / 2);
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

function pointerX(e) {
  const rect = canvas.getBoundingClientRect();
  return ((e.clientX - rect.left) / rect.width) * WIDTH;
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  player.x = pointerX(e);
  fire();
});
canvas.addEventListener("pointermove", (e) => {
  if (e.buttons > 0) player.x = Math.max(30, Math.min(WIDTH - 30, pointerX(e)));
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = true;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = true;
  if (e.code === "Space") {
    e.preventDefault();
    keys.fire = true;
    fire();
  }
  if (e.code === "KeyR") reset();
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyA") keys.left = false;
  if (e.code === "ArrowRight" || e.code === "KeyD") keys.right = false;
  if (e.code === "Space") keys.fire = false;
});
