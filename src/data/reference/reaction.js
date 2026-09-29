import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: reflex / reaction-time tester.
// Wait for the screen to turn green, then tap as fast as you can. Tapping early
// is a fault. Five rounds, lower average is better. R restarts.

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
let state, waitUntil, goAt, times, round, lastMs;
const ROUNDS = 5;

function reset() { state = "idle"; times = []; round = 0; lastMs = 0; }
reset();

function arm() {
  state = "wait";
  waitUntil = performance.now() + 1000 + Math.random() * 2500;
}
function update() {
  if (state === "wait" && performance.now() >= waitUntil) { state = "go"; goAt = performance.now(); }
}

function tap() {
  if (state === "idle") { arm(); return; }
  if (state === "wait") { state = "early"; return; }
  if (state === "go") {
    lastMs = Math.round(performance.now() - goAt);
    times.push(lastMs);
    round++;
    if (round >= ROUNDS) state = "done";
    else state = "result";
    return;
  }
  if (state === "result" || state === "early") { arm(); return; }
  if (state === "done") { reset(); }
}

function render() {
  let bg = "#0a1020", title = "", sub = "";
  if (state === "idle") { title = "Reaction Test"; sub = "Tap to start"; }
  else if (state === "wait") { bg = "#7a1d2e"; title = "Wait for green..."; }
  else if (state === "early") { bg = "#5a1020"; title = "Too early!"; sub = "Tap to retry this round"; }
  else if (state === "go") { bg = "#1d7a3e"; title = "TAP!"; }
  else if (state === "result") { title = lastMs + " ms"; sub = "Tap for next round (" + round + "/" + ROUNDS + ")"; }
  else if (state === "done") {
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    title = "Avg " + avg + " ms"; sub = "Tap to play again";
  }
  ctx.fillStyle = bg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = "#eef6ff"; ctx.textAlign = "center";
  ctx.font = "800 52px Inter, system-ui, sans-serif";
  ctx.fillText(title, WIDTH / 2, HEIGHT / 2);
  ctx.font = "800 22px Inter, system-ui, sans-serif";
  ctx.fillText(sub, WIDTH / 2, HEIGHT / 2 + 44);
  if (times.length) {
    ctx.font = "800 18px Inter, system-ui, sans-serif"; ctx.fillStyle = colors[2];
    ctx.fillText(times.join("ms  ") + "ms", WIDTH / 2, HEIGHT - 40);
  }
}

let last = performance.now();
function frame() { update(); render(); requestAnimationFrame(frame); }
requestAnimationFrame(frame);

canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); tap(); });
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR") { reset(); return; }
  if (e.code === "Space") { e.preventDefault(); tap(); }
});
