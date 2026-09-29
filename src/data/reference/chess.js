import { gamePackage } from "./gamePackage.js";
import "./styles.css";

// Reference implementation: Chess vs a built-in AI.
// Full legal moves, check, checkmate, stalemate, castling, en passant, promotion.
// You play White (bottom). Click a piece, then a highlighted square. Press R for a new game.

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const colors = gamePackage?.visuals?.colors ?? ["#ffd166", "#35e8ff", "#67ffb4"];
const aiDelay = gamePackage?.gameplay?.tuning?.aiDelay ?? 0.45;

const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const SOLID = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

// Responsive full-viewport layout: the canvas fills the whole game frame and
// the board is scaled and centered. On wide screens the info panel sits to the
// right of the board; on tall/mobile screens it sits below. Recomputed on
// every resize so the game always fills the screen.
let W = 960, H = 540;
let TILE = 50, BOARD_X = 96, BOARD_Y = 122;
let portrait = false, panelX = 132, panelY = 122, headerY = 40;

function layout() {
  W = canvas.width;
  H = canvas.height;
  portrait = H >= W;
  if (portrait) {
    // A square board on a tall screen is width-bound, so make it as wide as the
    // frame allows (tiny side margin) and CENTER it vertically between a compact
    // header and the info panel — fills the screen instead of leaving a big gap.
    const header = Math.min(60, Math.max(42, H * 0.06));
    const side = Math.max(4, W * 0.012);
    const footer = Math.min(110, Math.max(70, H * 0.12));
    const size = Math.max(160, Math.min(W - side * 2, H - header - footer));
    TILE = Math.floor(size / 8);
    const boardPx = TILE * 8;
    const region = H - header - footer;
    BOARD_X = Math.floor((W - boardPx) / 2);
    BOARD_Y = Math.floor(header + Math.max(0, (region - boardPx) / 2));
    panelX = BOARD_X;
    panelY = BOARD_Y + boardPx + Math.min(26, H * 0.028);
    headerY = header * 0.48;
  } else {
    const pad = Math.max(16, H * 0.06);
    const size = Math.max(220, Math.min(H - pad * 2, W * 0.62));
    TILE = Math.floor(size / 8);
    const boardPx = TILE * 8;
    BOARD_X = Math.floor(pad);
    BOARD_Y = Math.floor((H - boardPx) / 2 + pad * 0.35);
    panelX = BOARD_X + boardPx + Math.max(28, W * 0.03);
    panelY = BOARD_Y;
    headerY = Math.max(26, BOARD_Y - 34);
  }
}

function resize() {
  canvas.width = Math.max(300, Math.floor(window.innerWidth || 960));
  canvas.height = Math.max(300, Math.floor(window.innerHeight || 540));
  layout();
}

let board, turn, selected, legalForSelected, enPassant, castling, lastMove, capturedByWhite, capturedByBlack, aiTimer, over, message, score;

function inside(r, c) {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}
function cloneBoard(b) {
  return b.map((row) => row.slice());
}
function initBoard() {
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let c = 0; c < 8; c++) {
    b[0][c] = { type: back[c], color: "b" };
    b[1][c] = { type: "p", color: "b" };
    b[6][c] = { type: "p", color: "w" };
    b[7][c] = { type: back[c], color: "w" };
  }
  return b;
}
function reset() {
  board = initBoard();
  turn = "w";
  selected = null;
  legalForSelected = [];
  enPassant = null;
  castling = { w: { k: true, q: true }, b: { k: true, q: true } };
  lastMove = null;
  capturedByWhite = [];
  capturedByBlack = [];
  aiTimer = 0;
  over = false;
  score = 0;
  message = "White to move";
}

function attacked(b, byColor, r, c) {
  const dir = byColor === "w" ? -1 : 1;
  for (const dc of [-1, 1]) {
    const pr = r - dir;
    const pc = c - dc;
    if (inside(pr, pc)) {
      const p = b[pr][pc];
      if (p && p.color === byColor && p.type === "p") return true;
    }
  }
  const kn = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  for (const [dr, dc] of kn) {
    const tr = r + dr;
    const tc = c + dc;
    if (inside(tr, tc)) {
      const p = b[tr][tc];
      if (p && p.color === byColor && p.type === "n") return true;
    }
  }
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const tr = r + dr;
      const tc = c + dc;
      if (inside(tr, tc)) {
        const p = b[tr][tc];
        if (p && p.color === byColor && p.type === "k") return true;
      }
    }
  }
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    let tr = r + dr;
    let tc = c + dc;
    while (inside(tr, tc)) {
      const p = b[tr][tc];
      if (p) {
        if (p.color === byColor && (p.type === "r" || p.type === "q")) return true;
        break;
      }
      tr += dr;
      tc += dc;
    }
  }
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    let tr = r + dr;
    let tc = c + dc;
    while (inside(tr, tc)) {
      const p = b[tr][tc];
      if (p) {
        if (p.color === byColor && (p.type === "b" || p.type === "q")) return true;
        break;
      }
      tr += dr;
      tc += dc;
    }
  }
  return false;
}
function findKing(b, color) {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (p && p.color === color && p.type === "k") return { r, c };
    }
  }
  return null;
}
function inCheck(b, color) {
  const king = findKing(b, color);
  if (!king) return false;
  return attacked(b, color === "w" ? "b" : "w", king.r, king.c);
}
function genPiece(b, r, c, ep) {
  const p = b[r][c];
  if (!p) return [];
  const moves = [];
  const color = p.color;
  const enemy = color === "w" ? "b" : "w";
  const add = (tr, tc, opts) => moves.push({ from: { r, c }, to: { r: tr, c: tc }, ...opts });
  if (p.type === "p") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    const addPawn = (tr, tc, opts) => {
      const promo = tr === 0 || tr === 7;
      add(tr, tc, { ...opts, promotion: promo ? "q" : null });
    };
    if (inside(r + dir, c) && !b[r + dir][c]) {
      addPawn(r + dir, c, {});
      if (r === startRow && !b[r + 2 * dir][c]) add(r + 2 * dir, c, { double: true, promotion: null });
    }
    for (const dc of [-1, 1]) {
      const tr = r + dir;
      const tc = c + dc;
      if (!inside(tr, tc)) continue;
      const target = b[tr][tc];
      if (target && target.color === enemy) addPawn(tr, tc, { capture: true });
      else if (ep && ep.r === tr && ep.c === tc) add(tr, tc, { enPassant: true, capture: true, promotion: null });
    }
  } else if (p.type === "n") {
    const kn = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (const [dr, dc] of kn) {
      const tr = r + dr;
      const tc = c + dc;
      if (inside(tr, tc) && (!b[tr][tc] || b[tr][tc].color === enemy)) add(tr, tc, { capture: !!b[tr][tc] });
    }
  } else if (p.type === "k") {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const tr = r + dr;
        const tc = c + dc;
        if (inside(tr, tc) && (!b[tr][tc] || b[tr][tc].color === enemy)) add(tr, tc, { capture: !!b[tr][tc] });
      }
    }
  } else {
    const dirs = [];
    if (p.type === "r" || p.type === "q") dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
    if (p.type === "b" || p.type === "q") dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
    for (const [dr, dc] of dirs) {
      let tr = r + dr;
      let tc = c + dc;
      while (inside(tr, tc)) {
        if (!b[tr][tc]) add(tr, tc, {});
        else {
          if (b[tr][tc].color === enemy) add(tr, tc, { capture: true });
          break;
        }
        tr += dr;
        tc += dc;
      }
    }
  }
  return moves;
}
function boardAfter(b, m) {
  const nb = cloneBoard(b);
  const p = nb[m.from.r][m.from.c];
  nb[m.to.r][m.to.c] = p;
  nb[m.from.r][m.from.c] = null;
  if (m.enPassant) nb[m.from.r][m.to.c] = null;
  if (m.promotion) nb[m.to.r][m.to.c] = { type: m.promotion, color: p.color };
  if (m.castle === "k") {
    nb[m.from.r][5] = nb[m.from.r][7];
    nb[m.from.r][7] = null;
  }
  if (m.castle === "q") {
    nb[m.from.r][3] = nb[m.from.r][0];
    nb[m.from.r][0] = null;
  }
  return nb;
}
function legalMoves(b, color, ep, cast) {
  const list = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p || p.color !== color) continue;
      for (const m of genPiece(b, r, c, ep)) {
        if (!inCheck(boardAfter(b, m), color)) list.push(m);
      }
    }
  }
  const rights = cast[color];
  const homeRow = color === "w" ? 7 : 0;
  const enemy = color === "w" ? "b" : "w";
  const king = b[homeRow][4];
  if (king && king.type === "k" && king.color === color && !attacked(b, enemy, homeRow, 4)) {
    const rk = b[homeRow][7];
    if (rights.k && !b[homeRow][5] && !b[homeRow][6] && rk && rk.type === "r" && rk.color === color &&
      !attacked(b, enemy, homeRow, 5) && !attacked(b, enemy, homeRow, 6)) {
      list.push({ from: { r: homeRow, c: 4 }, to: { r: homeRow, c: 6 }, castle: "k" });
    }
    const rq = b[homeRow][0];
    if (rights.q && !b[homeRow][1] && !b[homeRow][2] && !b[homeRow][3] && rq && rq.type === "r" && rq.color === color &&
      !attacked(b, enemy, homeRow, 3) && !attacked(b, enemy, homeRow, 2)) {
      list.push({ from: { r: homeRow, c: 4 }, to: { r: homeRow, c: 2 }, castle: "q" });
    }
  }
  return list;
}
function doMove(m) {
  const p = board[m.from.r][m.from.c];
  const captured = m.enPassant ? board[m.from.r][m.to.c] : board[m.to.r][m.to.c];
  if (captured) {
    if (captured.color === "b") capturedByWhite.push(captured);
    else capturedByBlack.push(captured);
  }
  board = boardAfter(board, m);
  if (p.type === "k") {
    castling[p.color].k = false;
    castling[p.color].q = false;
  }
  if (p.type === "r") {
    const hr = p.color === "w" ? 7 : 0;
    if (m.from.r === hr && m.from.c === 0) castling[p.color].q = false;
    if (m.from.r === hr && m.from.c === 7) castling[p.color].k = false;
  }
  const enemy = p.color === "w" ? "b" : "w";
  const ehr = enemy === "w" ? 7 : 0;
  if (m.to.r === ehr && m.to.c === 0) castling[enemy].q = false;
  if (m.to.r === ehr && m.to.c === 7) castling[enemy].k = false;
  enPassant = m.double ? { r: (m.from.r + m.to.r) / 2, c: m.to.c } : null;
  lastMove = m;
  turn = enemy;
  score = capturedByWhite.reduce((s, q) => s + VALUE[q.type], 0) * 10;
}
function updateStatus() {
  const moves = legalMoves(board, turn, enPassant, castling);
  const checked = inCheck(board, turn);
  if (moves.length === 0) {
    over = true;
    if (checked) message = turn === "b" ? "Checkmate — You win!" : "Checkmate — Black wins";
    else message = "Stalemate — Draw";
  } else {
    message = (turn === "w" ? "White" : "Black") + " to move" + (checked ? " — Check!" : "");
  }
}
function aiMove() {
  const moves = legalMoves(board, "b", enPassant, castling);
  if (!moves.length) return;
  let best = null;
  let bestScore = -Infinity;
  for (const m of moves) {
    let s = Math.random() * 0.5;
    const target = m.enPassant ? board[m.from.r][m.to.c] : board[m.to.r][m.to.c];
    if (target) s += VALUE[target.type] * 10;
    if (m.promotion) s += 8;
    const nb = boardAfter(board, m);
    if (inCheck(nb, "w")) s += legalMoves(nb, "w", null, castling).length === 0 ? 1000 : 0.6;
    if (attacked(nb, "w", m.to.r, m.to.c)) s -= VALUE[board[m.from.r][m.from.c].type] * 6;
    if (s > bestScore) {
      bestScore = s;
      best = m;
    }
  }
  doMove(best);
  updateStatus();
}
function selectSquare(r, c) {
  selected = { r, c };
  legalForSelected = legalMoves(board, "w", enPassant, castling).filter((m) => m.from.r === r && m.from.c === c);
}
function handleClick(r, c) {
  const p = board[r][c];
  if (selected) {
    const move = legalForSelected.find((m) => m.to.r === r && m.to.c === c);
    if (move) {
      doMove(move);
      selected = null;
      legalForSelected = [];
      updateStatus();
      if (!over && turn === "b") aiTimer = aiDelay;
      return;
    }
    if (p && p.color === "w") selectSquare(r, c);
    else {
      selected = null;
      legalForSelected = [];
    }
    return;
  }
  if (p && p.color === "w") selectSquare(r, c);
}

resize();
reset();

function squareCenter(r, c) {
  return { x: BOARD_X + c * TILE + TILE / 2, y: BOARD_Y + r * TILE + TILE / 2 };
}
function text(str, x, y, size, color, align) {
  ctx.fillStyle = color;
  ctx.font = "800 " + size + "px Inter, system-ui, sans-serif";
  ctx.textAlign = align || "left";
  ctx.textBaseline = "middle";
  ctx.fillText(str, x, y);
}
function drawPiece(piece, cx, cy) {
  ctx.font = (TILE - 9) + "px 'Apple Symbols','Segoe UI Symbol','Arial Unicode MS',system-ui,sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const g = SOLID[piece.type];
  ctx.lineWidth = 2;
  ctx.strokeStyle = piece.color === "w" ? "#1a2436" : "#04060b";
  ctx.fillStyle = piece.color === "w" ? "#f4f6fb" : "#11151d";
  ctx.strokeText(g, cx, cy);
  ctx.fillText(g, cx, cy);
}

function drawPanel() {
  if (portrait) {
    text("Score " + Math.floor(score), panelX, panelY + 6, 16, colors[0], "left");
    text(turn === "b" && !over ? "AI thinking…" : "Your move", W - panelX, panelY + 6, 16, "#ffd166", "right");
    const cap = capturedByWhite.map((p) => SOLID[p.type]).join(" ");
    ctx.font = "20px 'Apple Symbols','Segoe UI Symbol','Arial Unicode MS',system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f4f6fb";
    if (cap) ctx.fillText("Captured  " + cap, panelX, panelY + 34);
    text("Tap a piece, then a square  ·  tap board to restart", W / 2, panelY + (cap ? 60 : 36), 12, "#7d8ba0", "center");
  } else {
    text("Score " + Math.floor(score), panelX, panelY + 4, 18, colors[0], "left");
    text("You — White", panelX, panelY + 40, 18, "#eef6ff", "left");
    text("AI — Black", panelX, panelY + 66, 18, "#91a4b8", "left");
    text("Captured", panelX, panelY + 108, 14, "#7d8ba0", "left");
    ctx.font = "24px 'Apple Symbols','Segoe UI Symbol','Arial Unicode MS',system-ui,sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#f4f6fb";
    ctx.fillText(capturedByWhite.map((p) => SOLID[p.type]).join(" ") || "—", panelX, panelY + 134);
    ctx.fillStyle = "#11151d";
    ctx.fillText(capturedByBlack.map((p) => SOLID[p.type]).join(" ") || "—", panelX, panelY + 162);
    text(turn === "b" && !over ? "AI thinking…" : "Your move", panelX, panelY + 204, 16, colors[0], "left");
    text("Click a piece, then a square", panelX, panelY + 234, 12, "#7d8ba0", "left");
    text("R or click — new game", panelX, panelY + 256, 12, "#7d8ba0", "left");
  }
}

function render() {
  ctx.fillStyle = "#070a12";
  ctx.fillRect(0, 0, W, H);
  text(gamePackage?.title ?? "Chess", BOARD_X, headerY, portrait ? 20 : 24, "#eef6ff", "left");
  if (!over) text(message, W - BOARD_X, headerY, portrait ? 14 : 18, "#ffd166", "right");

  const checkedColor = inCheck(board, turn) ? turn : null;
  const checkedKing = checkedColor ? findKing(board, checkedColor) : null;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? "#ede6d2" : "#5d6b7c";
      ctx.fillRect(BOARD_X + c * TILE, BOARD_Y + r * TILE, TILE, TILE);
    }
  }
  if (lastMove) {
    ctx.fillStyle = colors[1] + "40";
    ctx.fillRect(BOARD_X + lastMove.from.c * TILE, BOARD_Y + lastMove.from.r * TILE, TILE, TILE);
    ctx.fillRect(BOARD_X + lastMove.to.c * TILE, BOARD_Y + lastMove.to.r * TILE, TILE, TILE);
  }
  if (checkedKing) {
    ctx.fillStyle = "rgba(255,72,109,0.45)";
    ctx.fillRect(BOARD_X + checkedKing.c * TILE, BOARD_Y + checkedKing.r * TILE, TILE, TILE);
  }
  if (selected) {
    ctx.strokeStyle = colors[0];
    ctx.lineWidth = 3;
    ctx.strokeRect(BOARD_X + selected.c * TILE + 1.5, BOARD_Y + selected.r * TILE + 1.5, TILE - 3, TILE - 3);
  }
  for (const m of legalForSelected) {
    const center = squareCenter(m.to.r, m.to.c);
    ctx.beginPath();
    if (m.capture) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = colors[2] + "cc";
      ctx.arc(center.x, center.y, TILE / 2 - 4, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = colors[2] + "cc";
      ctx.arc(center.x, center.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece) {
        const center = squareCenter(r, c);
        drawPiece(piece, center.x, center.y);
      }
    }
  }
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  ctx.strokeRect(BOARD_X, BOARD_Y, TILE * 8, TILE * 8);

  drawPanel();

  if (over) {
    ctx.fillStyle = "rgba(7,10,18,0.72)";
    ctx.fillRect(0, 0, W, H);
    const win = message.indexOf("You win") !== -1;
    text(message, W / 2, H / 2 - 78, 22, "#ffd166", "center");
    text(win ? "Victory!" : "Game Over", W / 2, H / 2 - 24, 42, win ? "#67ffb4" : "#eef6ff", "center");
    text("Press R or tap to play again", W / 2, H / 2 + 24, 20, "#91a4b8", "center");
  }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (turn === "b" && !over) {
    aiTimer -= dt;
    if (aiTimer <= 0) aiMove();
  }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

function pointTo(event) {
  const rect = canvas.getBoundingClientRect();
  const px = ((event.clientX - rect.left) / rect.width) * W;
  const py = ((event.clientY - rect.top) / rect.height) * H;
  return { px, py };
}
function onPress(event) {
  event.preventDefault();
  if (over) {
    reset();
    return;
  }
  if (turn !== "w") return;
  const { px, py } = pointTo(event.touches ? event.touches[0] : event);
  const c = Math.floor((px - BOARD_X) / TILE);
  const r = Math.floor((py - BOARD_Y) / TILE);
  if (inside(r, c)) handleClick(r, c);
}
canvas.addEventListener("pointerdown", onPress);
canvas.addEventListener("touchstart", onPress, { passive: false });
window.addEventListener("keydown", (event) => {
  if (event.code === "KeyR") reset();
});
window.addEventListener("resize", resize);
