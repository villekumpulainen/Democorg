// Touch/mouse controls. Turns the pointer into a world-space target for the dog.
//
// Stick (controlMode 0): a floating joystick. Touch anywhere, drag a short way; direction and
//   drag distance set where and how fast the dog runs. The base trails the finger when you
//   drag past its rim, so reversing is quick. Your finger never has to cover the dog.
// Follow (controlMode 1): the dog runs toward the finger.

import { ARRIVE_GAIN } from './sim/dog.js';
import { screenToWorld } from './render.js';
import { clamp } from './sim/util.js';

export const CONTROL_STICK = 0;
export const CONTROL_FOLLOW = 1;
export const CONTROL_NAMES = ['Stick', 'Follow'];

export function createPointer() {
  return { active: false, id: null, sx: 0, sy: 0, ox: 0, oy: 0, strength: 0 };
}

export function pointerDown(p, x, y, id) {
  p.active = true;
  p.id = id;
  p.sx = p.ox = x;
  p.sy = p.oy = y;
  p.strength = 0;
}

export function pointerUp(p) {
  p.active = false;
  p.id = null;
}

// World target for this tick, or null when nothing is held.
export function controlTarget(p, cam, dog, cfg) {
  if (!p.active) return null;
  if (cfg.controlMode === CONTROL_FOLLOW) return screenToWorld(cam, p.sx, p.sy);

  const r = cfg.stickRadius;
  let dx = p.sx - p.ox, dy = p.sy - p.oy;
  let len = Math.hypot(dx, dy);
  if (len > r) {
    // Drag the base along so it stays under the finger's rim.
    p.ox = p.sx - (dx / len) * r;
    p.oy = p.sy - (dy / len) * r;
    dx = p.sx - p.ox; dy = p.sy - p.oy;
    len = r;
  }
  const dead = clamp(cfg.stickDeadZone, 0, 0.9);
  p.strength = clamp((len / r - dead) / (1 - dead), 0, 1);
  if (p.strength === 0) return { x: dog.x, y: dog.y }; // centred stick = stop
  // A point this far ahead makes the dog's steering ask for strength × max speed.
  const reach = (p.strength * cfg.dogMaxSpeed) / ARRIVE_GAIN;
  return { x: dog.x + (dx / len) * reach, y: dog.y + (dy / len) * reach };
}

export function drawControls(ctx, p, cam, cfg) {
  if (!p.active) return;
  if (cfg.controlMode === CONTROL_FOLLOW) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ring(ctx, p.sx, p.sy, 0.25 * cam.ppm, 2);
    return;
  }
  const r = cfg.stickRadius;
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.arc(p.ox, p.oy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ring(ctx, p.ox, p.oy, r, 2);
  const kx = p.ox + clamp(p.sx - p.ox, -r, r), ky = p.oy + clamp(p.sy - p.oy, -r, r);
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(kx, ky, r * 0.4, 0, Math.PI * 2);
  ctx.fill();
}

function ring(ctx, x, y, r, width) {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}
