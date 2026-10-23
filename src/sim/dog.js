// The dog: steers toward a target point with inertia, plus collision with the street.

import { pushOut, DOG_MIN_X, DOG_MAX_X } from './world.js';

export const ARRIVE_GAIN = 3; // desired speed per meter of distance to the target
const NOSE_BIAS_TIME = 0.5;  // s: nose pull acts as a velocity bias the steering can't fully cancel
const DOG_RADIUS = 0.22;

export function createDog(x, y) {
  return {
    x, y, vx: 0, vy: 0, radius: DOG_RADIUS,
    intentX: 0, intentY: 0, intent: 0, // direction and strength (0–1) the player is pushing
    stun: 0,
  };
}

// target: {x, y} in world meters to run toward, or null when the finger is up.
// noseX/noseY: nose-pull acceleration (m/s²).
export function stepDog(dog, target, cfg, dt, noseX, noseY) {
  dog.intent = 0;
  if (dog.stun > 0) dog.stun -= dt;

  if (target && dog.stun <= 0) {
    const dx = target.x - dog.x, dy = target.y - dog.y;
    const d = Math.hypot(dx, dy);
    // On (or very near) the target the dog brakes to a stop.
    const want = d > 0.02 ? Math.min(cfg.dogMaxSpeed, d * ARRIVE_GAIN) : 0;
    const ux = d > 0.02 ? dx / d : 0, uy = d > 0.02 ? dy / d : 0;
    const tvx = ux * want + noseX * NOSE_BIAS_TIME;
    const tvy = uy * want + noseY * NOSE_BIAS_TIME;
    let sx = tvx - dog.vx, sy = tvy - dog.vy;
    const s = Math.hypot(sx, sy), maxDv = cfg.dogAccel * dt;
    if (s > maxDv) { sx *= maxDv / s; sy *= maxDv / s; }
    dog.vx += sx; dog.vy += sy;
    if (want > 0) {
      dog.intentX = ux; dog.intentY = uy;
      dog.intent = want / cfg.dogMaxSpeed;
    }
  } else {
    const keep = Math.pow(cfg.dogFriction, dt / 0.1);
    dog.vx = dog.vx * keep + noseX * dt;
    dog.vy = dog.vy * keep + noseY * dt;
  }

  const sp = Math.hypot(dog.vx, dog.vy), cap = cfg.dogMaxSpeed * 2.5;
  if (sp > cap) { dog.vx *= cap / sp; dog.vy *= cap / sp; }

  dog.x += dog.vx * dt;
  dog.y += dog.vy * dt;
}

const push = { x: 0, y: 0 };

export function collideDog(dog, obstacles) {
  for (const o of obstacles) {
    if (pushOut(dog, o, dog.radius, push)) {
      const len = Math.hypot(push.x, push.y) || 1;
      const nx = push.x / len, ny = push.y / len;
      const vn = dog.vx * nx + dog.vy * ny;
      if (vn < 0) { dog.vx -= nx * vn; dog.vy -= ny * vn; }
    }
  }
  if (dog.x < DOG_MIN_X) { dog.x = DOG_MIN_X; if (dog.vx < 0) dog.vx = 0; }
  if (dog.x > DOG_MAX_X) { dog.x = DOG_MAX_X; if (dog.vx > 0) dog.vx = 0; }
}
