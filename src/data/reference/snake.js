import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: grid snake. Arrows/WASD steer; on touch, tap the
// side of the screen relative to the head to turn. Eat food, avoid walls and
// your tail. R restarts.

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
const CELL = 30;
const COLS = Math.floor(WIDTH / CELL);
const ROWS = Math.floor((HEIGHT - 60) / CELL);
const OY = 60;
const BASE_STEP = tuning.stepTime ?? 0.13;

let snake, dir, nextDir, food, stepTimer, stepTime, score, over, started;

function reset() {
  snake = [
    { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) },
    { x: Math.floor(COLS / 2) - 1, y: Math.floor(ROWS / 2) },
    { x: Math.floor(COLS / 2) - 2, y: Math.floor(ROWS / 2) }
  ];
  dir = { x: 1, y: 0 };
  nextDir = dir;
  stepTimer = 0;
  stepTime = BASE_STEP;
  score = 0;
  over = false;
  started = false;
  placeFood();
}

function placeFood() {
  do {
    food = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some((s) => s.x === food.x && s.y === food.y));
}
reset();

function turn(x, y) {
  // disallow reversing into yourself
  if (x === -dir.x && y === -dir.y) return;
  nextDir = { x, y };
}

function update(dt) {
  if (!started || over) return;
  stepTimer += dt;
  if (stepTimer < stepTime) return;
  stepTimer = 0;

  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) {
    over = true;
    return;
  }
  if (snake.some((s) => s.x === head.x && s.y === head.y)) {
    over = true;
    return;
  }
  snake.unshift(head);
  if (head.x === food.x && head.y === food.y) {
    score += 10;
    stepTime = Math.max(0.06, stepTime * 0.98);
    placeFood();
  } else {
    snake.pop();
  }
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, OY, COLS * CELL, ROWS * CELL);

  ctx.fillStyle = colors[2];
  ctx.beginPath();
  ctx.arc(food.x * CELL + CELL / 2, OY + food.y * CELL + CELL / 2, CELL * 0.36, 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < snake.length; i += 1) {
    ctx.fillStyle = i === 0 ? "#eef6ff" : colors[0];
    ctx.fillRect(snake[i].x * CELL + 2, OY + snake[i].y * CELL + 2, CELL - 4, CELL - 4);
  }

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 26px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Score " + score, 28, 32);

  if (!started) {
    ctx.textAlign = "center";
    ctx.fillText("Arrows/WASD to move · tap a side to turn", WIDTH / 2, HEIGHT / 2);
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
  if (over) {
    reset();
    return;
  }
  started = true;
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
  const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
  const headX = snake[0].x * CELL + CELL / 2;
  const headY = OY + snake[0].y * CELL + CELL / 2;
  // turn toward the dominant axis of the tap relative to the head
  if (Math.abs(x - headX) > Math.abs(y - headY)) turn(Math.sign(x - headX), 0);
  else turn(0, Math.sign(y - headY));
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowUp" || e.code === "KeyW") turn(0, -1);
  if (e.code === "ArrowDown" || e.code === "KeyS") turn(0, 1);
  if (e.code === "ArrowLeft" || e.code === "KeyA") turn(-1, 0);
  if (e.code === "ArrowRight" || e.code === "KeyD") turn(1, 0);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
    e.preventDefault();
    started = true;
  }
  if (e.code === "KeyR") reset();
});
