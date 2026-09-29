import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: timed quiz. Pick the right answer before the
// timer runs out; streaks multiply the score. Click/tap or keys 1-4. R restarts.

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
const TIME_PER_QUESTION = tuning.timePerQuestion ?? 10;

const QUESTIONS = [
  { q: "Which planet is closest to the sun?", a: ["Mercury", "Venus", "Mars", "Earth"], correct: 0 },
  { q: "How many sides does a hexagon have?", a: ["5", "6", "7", "8"], correct: 1 },
  { q: "What gas do plants absorb?", a: ["Oxygen", "Nitrogen", "CO2", "Helium"], correct: 2 },
  { q: "Which is the largest ocean?", a: ["Atlantic", "Indian", "Arctic", "Pacific"], correct: 3 },
  { q: "What is 9 x 7?", a: ["63", "56", "72", "49"], correct: 0 },
  { q: "Which metal is liquid at room temperature?", a: ["Iron", "Mercury", "Gold", "Zinc"], correct: 1 },
  { q: "How many continents are there?", a: ["5", "6", "7", "8"], correct: 2 },
  { q: "What is the fastest land animal?", a: ["Lion", "Horse", "Falcon", "Cheetah"], correct: 3 },
  { q: "Which language runs in a web browser?", a: ["JavaScript", "C++", "Rust", "Go"], correct: 0 },
  { q: "What color do you get mixing blue and yellow?", a: ["Purple", "Green", "Orange", "Brown"], correct: 1 }
];

let order, index, timer, score, streak, feedback, feedbackTimer, over;

function reset() {
  order = QUESTIONS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  index = 0;
  timer = TIME_PER_QUESTION;
  score = 0;
  streak = 0;
  feedback = null;
  feedbackTimer = 0;
  over = false;
}
reset();

function current() {
  return QUESTIONS[order[index]];
}

function answerRect(i) {
  return { x: 140 + (i % 2) * 350, y: 250 + Math.floor(i / 2) * 110, w: 330, h: 88 };
}

function advance() {
  index += 1;
  timer = TIME_PER_QUESTION;
  if (index >= order.length) over = true;
}

function answer(i) {
  if (over) {
    reset();
    return;
  }
  if (feedbackTimer > 0) return;
  const correct = i === current().correct;
  if (correct) {
    streak += 1;
    score += 100 * streak + Math.ceil(timer * 10);
    feedback = "Correct! +" + (100 * streak + Math.ceil(timer * 10));
  } else {
    streak = 0;
    feedback = "Wrong — it was " + current().a[current().correct];
  }
  feedbackTimer = 0.9;
}

function update(dt) {
  if (over) return;
  if (feedbackTimer > 0) {
    feedbackTimer -= dt;
    if (feedbackTimer <= 0) {
      feedback = null;
      advance();
    }
    return;
  }
  timer -= dt;
  if (timer <= 0) {
    streak = 0;
    feedback = "Time! It was " + current().a[current().correct];
    feedbackTimer = 0.9;
  }
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#eef6ff";
  ctx.font = "800 24px Inter, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText("Score " + score, 28, 36);
  ctx.textAlign = "right";
  ctx.fillText("Streak x" + streak, WIDTH - 28, 36);

  if (over) {
    ctx.textAlign = "center";
    ctx.font = "800 42px Inter, system-ui, sans-serif";
    ctx.fillText("Quiz Complete!", WIDTH / 2, HEIGHT / 2 - 20);
    ctx.font = "800 20px Inter, system-ui, sans-serif";
    ctx.fillText("Final score " + score + " · Press R or tap to restart", WIDTH / 2, HEIGHT / 2 + 28);
    return;
  }

  // timer bar
  const ratio = Math.max(0, timer / TIME_PER_QUESTION);
  ctx.fillStyle = "#11182b";
  ctx.fillRect(140, 70, WIDTH - 280, 12);
  ctx.fillStyle = ratio > 0.3 ? colors[0] : colors[1];
  ctx.fillRect(140, 70, (WIDTH - 280) * ratio, 12);

  ctx.fillStyle = "#eef6ff";
  ctx.textAlign = "center";
  ctx.font = "800 30px Inter, system-ui, sans-serif";
  ctx.fillText(current().q, WIDTH / 2, 160);
  ctx.font = "800 16px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#5a6781";
  ctx.fillText("Question " + (index + 1) + " of " + order.length, WIDTH / 2, 200);

  for (let i = 0; i < 4; i += 1) {
    const r = answerRect(i);
    const isCorrect = feedback && i === current().correct;
    ctx.fillStyle = isCorrect ? "#16403a" : "#11182b";
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = isCorrect ? colors[2] : colors[0];
    ctx.lineWidth = 2;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.fillStyle = "#eef6ff";
    ctx.font = "800 22px Inter, system-ui, sans-serif";
    ctx.fillText(i + 1 + ". " + current().a[i], r.x + r.w / 2, r.y + r.h / 2);
  }

  if (feedback) {
    ctx.fillStyle = colors[2];
    ctx.font = "800 22px Inter, system-ui, sans-serif";
    ctx.fillText(feedback, WIDTH / 2, HEIGHT - 30);
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
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
  const y = ((e.clientY - rect.top) / rect.height) * HEIGHT;
  if (over) {
    reset();
    return;
  }
  for (let i = 0; i < 4; i += 1) {
    const r = answerRect(i);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      answer(i);
      return;
    }
  }
});
canvas.addEventListener("touchstart", (e) => e.preventDefault(), { passive: false });
window.addEventListener("keydown", (e) => {
  if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) {
    answer(Number(e.code.slice(-1)) - 1);
  }
  if (e.code === "KeyR") reset();
});
