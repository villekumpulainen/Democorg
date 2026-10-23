// The leash: a Verlet rope from the owner's hand to the dog's collar.
// The rope only resists stretching (slack bunches freely). The rope is solved with both
// ends pinned; then, if its path is longer than the leash, the dog is pulled back along it.

import { pushOut, isNear } from './world.js';
import { clamp } from './util.js';

const ITERATIONS = 40;
const SETTLE_ITERATIONS = 8;
const STRAIGHTEN = 0.25;     // per pass: a hanging leash seen from above looks nearly straight
const STRAIGHTEN_PASSES = 3;
const ROPE_DAMPING = 0.5;    // velocity kept per tick for rope points (low = light rope)
const ROPE_MARGIN = 0.05;    // rope thickness for collisions
const TAUT_RATIO = 0.98;     // rope length / leash length that counts as taut
const CONTACT_DIST = 0.12;   // extra distance that counts as touching an obstacle

export function createLeash(cfg, hand, dog) {
  const n = Math.max(2, Math.round(cfg.leashSegments)) + 1;
  const points = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const x = hand.x + (dog.x - hand.x) * t, y = hand.y + (dog.y - hand.y) * t;
    points.push({ x, y, px: x, py: y });
  }
  return {
    points,
    length: 0, taut: false,
    tension: 0, rawTension: 0,
    tangled: null, winding: 0,
    yankHold: 0, yankCooldown: 0,
    ignore: null, ignoreTimer: 0, // obstacle the owner just lifted the leash over
    extra: 0, // m of slack the owner lets out (while fumbling with a tangle)
  };
}

const push = { x: 0, y: 0 };
const mid = { x: 0, y: 0 };

export function stepLeash(leash, cfg, hand, dog, obstacles, dt) {
  const pts = leash.points, last = pts.length - 1;
  const len = cfg.leashLength + leash.extra;
  const seg = len / last;
  if (leash.ignoreTimer > 0) {
    leash.ignoreTimer -= dt;
    if (leash.ignoreTimer <= 0) leash.ignore = null;
  }
  const near = obstacles.filter((o) => o !== leash.ignore && isNear(hand, o, len + 1));

  // Integrate interior points.
  for (let i = 1; i < last; i++) {
    const p = pts[i];
    const vx = (p.x - p.px) * ROPE_DAMPING, vy = (p.y - p.py) * ROPE_DAMPING;
    p.px = p.x; p.py = p.y;
    p.x += vx; p.y += vy;
  }
  pts[0].x = hand.x; pts[0].y = hand.y;
  pts[last].x = dog.x; pts[last].y = dog.y;

  // Pull each point toward its neighbours' midpoint so loose loops straighten out.
  for (let pass = 0; pass < STRAIGHTEN_PASSES; pass++) {
    for (let i = 1; i < last; i++) {
      const p = pts[i], a = pts[i - 1], b = pts[i + 1];
      p.x += ((a.x + b.x) / 2 - p.x) * STRAIGHTEN;
      p.y += ((a.y + b.y) / 2 - p.y) * STRAIGHTEN;
    }
  }

  relax(pts, seg, near, ITERATIONS);

  // The rope solve keeps both ends pinned, so a rope longer than the leash means the dog
  // has gone too far: pull it back along the rope by the excess, then let the rope settle.
  const excess = ropeLength(pts) - len;
  if (excess > 0) {
    const prev = pts[last - 1];
    const dx = prev.x - dog.x, dy = prev.y - dog.y, d = Math.hypot(dx, dy);
    if (d > 1e-6) {
      const m = Math.min(excess, d);
      applyDogCorrection(dog, (dx / d) * m, (dy / d) * m);
      pts[last].x = dog.x; pts[last].y = dog.y;
      relax(pts, seg, near, SETTLE_ITERATIONS);
    }
  }

  // Safety net: never further than the leash allows in a straight line.
  const sx = dog.x - hand.x, sy = dog.y - hand.y, sd = Math.hypot(sx, sy);
  const maxD = len * 1.06;
  if (sd > maxD) {
    applyDogCorrection(dog, (sx / sd) * maxD - sx, (sy / sd) * maxD - sy);
    pts[last].x = dog.x; pts[last].y = dog.y;
  }

  leash.length = ropeLength(pts);
  leash.taut = leash.length >= len * TAUT_RATIO;

  measureTangle(leash, near, cfg);
}

// The owner gives up and lifts the leash over the obstacle: straighten the rope and let it
// pass through that obstacle for a moment.
export function liftOver(leash, obstacle, hand, dog, seconds) {
  const pts = leash.points, last = pts.length - 1;
  for (let i = 0; i <= last; i++) {
    const t = i / last;
    const p = pts[i];
    p.x = p.px = hand.x + (dog.x - hand.x) * t;
    p.y = p.py = hand.y + (dog.y - hand.y) * t;
  }
  leash.ignore = obstacle;
  leash.ignoreTimer = seconds;
  leash.tangled = null;
}

// Distance constraints (stretch only) and obstacle collisions, ends pinned.
function relax(pts, seg, near, iterations) {
  const last = pts.length - 1;
  for (let it = 0; it < iterations; it++) {
    // Alternate sweep direction: converges much faster with both ends pinned.
    const fwd = (it & 1) === 0;
    for (let j = 0; j < last; j++) {
      const i = fwd ? j : last - 1 - j;
      const a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d <= seg) continue;
      const wa = i === 0 ? 0 : 1;
      const wb = i + 1 === last ? 0 : 1;
      if (wa + wb === 0) continue;
      const k = (d - seg) / d / (wa + wb);
      a.x += dx * k * wa; a.y += dy * k * wa;
      b.x -= dx * k * wb; b.y -= dy * k * wb;
    }
    for (const o of near) {
      for (let i = 1; i < last; i++) pushOut(pts[i], o, ROPE_MARGIN);
      // Segment midpoints too, so the rope can't slip through a lamppost.
      for (let i = 0; i < last; i++) {
        const a = pts[i], b = pts[i + 1];
        mid.x = (a.x + b.x) / 2; mid.y = (a.y + b.y) / 2;
        if (pushOut(mid, o, ROPE_MARGIN, push)) {
          if (i > 0) { a.x += push.x; a.y += push.y; }
          if (i + 1 < last) { b.x += push.x; b.y += push.y; }
        }
      }
    }
  }
}

function ropeLength(pts) {
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) len += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
  return len;
}

function applyDogCorrection(dog, cx, cy) {
  const c = Math.hypot(cx, cy);
  if (c < 1e-6) return;
  dog.x += cx; dog.y += cy;
  const nx = cx / c, ny = cy / c;
  const vn = dog.vx * nx + dog.vy * ny;
  if (vn < 0) { dog.vx -= nx * vn; dog.vy -= ny * vn; }
}

// Tension = how hard the player pushes the dog away from the leash while it is taut.
export function updateTension(leash, dog, cfg, dt) {
  const pts = leash.points, last = pts.length - 1;
  let raw = 0;
  if (leash.taut && dog.intent > 0) {
    const ox = dog.x - pts[last - 1].x, oy = dog.y - pts[last - 1].y;
    const od = Math.hypot(ox, oy) || 1;
    const outward = (dog.intentX * ox + dog.intentY * oy) / od;
    raw = clamp(outward * dog.intent, 0, 1);
  }
  leash.rawTension = raw;
  leash.tension += (raw - leash.tension) * Math.min(1, cfg.tensionResponse * dt);
}

// Sum how far the rope winds around each nearby obstacle it touches.
function measureTangle(leash, near, cfg) {
  const pts = leash.points;
  const limit = (cfg.tangleAngle * Math.PI) / 180;
  leash.tangled = null;
  leash.winding = 0;
  for (const o of near) {
    if (!touches(pts, o)) continue;
    let total = 0;
    let prev = Math.atan2(pts[0].y - o.y, pts[0].x - o.x);
    for (let i = 1; i < pts.length; i++) {
      const a = Math.atan2(pts[i].y - o.y, pts[i].x - o.x);
      let d = a - prev;
      if (d > Math.PI) d -= 2 * Math.PI;
      else if (d < -Math.PI) d += 2 * Math.PI;
      total += d;
      prev = a;
    }
    if (Math.abs(total) > Math.abs(leash.winding)) leash.winding = total;
    if (Math.abs(total) >= limit) leash.tangled = o;
  }
}

function touches(pts, o) {
  const probe = { x: 0, y: 0 };
  for (let i = 1; i < pts.length - 1; i++) {
    probe.x = pts[i].x; probe.y = pts[i].y;
    if (pushOut(probe, o, ROPE_MARGIN + CONTACT_DIST)) return true;
  }
  return false;
}
