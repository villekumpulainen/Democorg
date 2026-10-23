// Entry point: fixed 60 Hz simulation, render every animation frame, input and UI wiring.

import { config } from './config.js';
import { createGame, stepGame } from './sim/game.js';
import { createCamera, updateCamera, render } from './render.js';
import { createPointer, pointerDown, pointerUp, controlTarget, drawControls } from './input.js';
import { createTuningPanel } from './ui/tuning.js';
import { updateDebug } from './ui/debug.js';

const STEP = 1 / 60;
const MAX_STEPS_PER_FRAME = 5;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const debugEl = document.getElementById('debug');
const panel = document.getElementById('panel');

let game = createGame(config);
const cam = createCamera();
const pointer = createPointer();

// --- Canvas sizing ---------------------------------------------------------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  canvas.style.width = window.innerWidth + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// --- Input: one finger (or mouse button) steers; see input.js -------------
canvas.addEventListener('pointerdown', (e) => {
  if (game.state !== 'playing') return;
  pointerDown(pointer, e.clientX, e.clientY, e.pointerId);
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== pointer.id) return;
  pointer.sx = e.clientX; pointer.sy = e.clientY;
});
const release = (e) => {
  if (e.pointerId === pointer.id) pointerUp(pointer);
};
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);

// Block scrolling, pinch zoom and pull-to-refresh on the play area.
canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

// --- Screens ---------------------------------------------------------------
function showOverlay(html) {
  overlay.innerHTML = html;
  overlay.hidden = false;
}

function showStart() {
  showOverlay(`
    <h1>Dog Walk Mischief</h1>
    <p>Touch anywhere and drag a little: the dog runs that way.<br>
    (Prefer the dog chasing your finger? Tune → Controls.)<br>
    Pull against the leash and the owner loses trust.<br>
    Grab burgers, socks and smelly spots for points —<br>
    ideally while the owner is on their phone.</p>
    <button data-action="start">Start walk</button>`);
}

function showEnd() {
  const r = game.result;
  showOverlay(`
    <h1>${r.home ? 'Home!' : 'Taken home'}</h1>
    <table>
      <tr><td>Score</td><td>${game.score}</td></tr>
      ${r.home ? `<tr><td>Home bonus</td><td>${r.bonus}</td></tr>` : ''}
      <tr><td>Mischief</td><td>${game.mischief}</td></tr>
      <tr><td>Havoc</td><td>${game.havoc}</td></tr>
      <tr><td>Best chain</td><td>x${game.bestChain}</td></tr>
      <tr><td>Treats</td><td>${game.treats}</td></tr>
      <tr><td>Yanks</td><td>${game.yanks}</td></tr>
      <tr><td>Trust left</td><td>${Math.round(game.trust.value)}</td></tr>
      <tr><td>Time</td><td>${game.time.toFixed(0)} s</td></tr>
    </table>
    <button data-action="start">Walk again</button>`);
}

function startWalk() {
  game = createGame(config);
  game.state = 'playing';
  overlay.hidden = true;
  pointerUp(pointer);
}

overlay.addEventListener('click', (e) => {
  if (e.target.closest('[data-action=start]')) startWalk();
});

// --- Panels ----------------------------------------------------------------
createTuningPanel(panel, { onRestart: startWalk });
document.getElementById('toggle-panel').addEventListener('click', () => { panel.hidden = !panel.hidden; });
document.getElementById('toggle-debug').addEventListener('click', () => { debugEl.hidden = !debugEl.hidden; });

// --- Main loop -------------------------------------------------------------
let last = performance.now();
let acc = 0;
let fps = 60, fpsFrames = 0, fpsTime = 0, debugTimer = 0;

function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;

  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) { fps = fpsFrames / fpsTime; fpsFrames = 0; fpsTime = 0; }

  const w = window.innerWidth, h = window.innerHeight;
  updateCamera(cam, game, w, h);

  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
    // Recomputed every tick: the world scrolls and the dog moves under a held finger.
    const target = controlTarget(pointer, cam, game.dog, config);
    const wasPlaying = game.state === 'playing';
    stepGame(game, config, target, STEP);
    if (wasPlaying && game.state === 'over') showEnd();
    updateCamera(cam, game, w, h);
    acc -= STEP;
    steps++;
  }
  if (steps === MAX_STEPS_PER_FRAME) acc = 0;

  render(ctx, game, cam, config);
  drawControls(ctx, pointer, cam, config);

  debugTimer -= dt;
  if (!debugEl.hidden && debugTimer <= 0) {
    updateDebug(debugEl, game, fps);
    debugTimer = 0.1;
  }

  requestAnimationFrame(frame);
}

showStart();
requestAnimationFrame(frame);
