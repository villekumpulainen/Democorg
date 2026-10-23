// The street: layout constants, obstacles (lampposts, benches, trash cans) and their collision.
// World axes: x across the street (m), y along it. Walking forward = decreasing y.

import { rand } from './util.js';

export const GRASS_LEFT = -1.5;   // grass strip from here to the sidewalk
export const SIDEWALK_LEFT = 0;
export const SIDEWALK_RIGHT = 4;
export const CURB_RIGHT = 4.3;    // road starts here
export const OWNER_LANE_X = 2;
export const DOG_MIN_X = -1.2;
export const DOG_MAX_X = 4.6;

export function createWorld() {
  return { nextObstacleY: -5, spawnTimer: 3 };
}

export function createPost(x, y) { return { kind: 'post', x, y, r: 0.15 }; }
export function createBench(x, y) { return { kind: 'bench', x, y, w: 0.55, h: 1.6 }; }
export function createTrash(x, y) { return { kind: 'trash', x, y, r: 0.28, tipped: false, seeded: false }; }

// Fill obstacles ahead of the owner, stopping short of home.
export function spawnObstacles(world, obstacles, ownerY, cfg) {
  const horizon = ownerY - 18;
  const homeY = -cfg.walkDistance + 3;
  while (world.nextObstacleY > horizon && world.nextObstacleY > homeY) {
    const y = world.nextObstacleY;
    const roll = Math.random();
    if (roll < 0.6) obstacles.push(createPost(Math.random() < 0.5 ? 0.35 : 3.75, y));
    else if (roll < 0.8) obstacles.push(createBench(3.55, y));
    else obstacles.push(createTrash(Math.random() < 0.5 ? 0.4 : 3.7, y));
    const lo = Math.min(cfg.obstacleSpacingMin, cfg.obstacleSpacingMax);
    const hi = Math.max(cfg.obstacleSpacingMin, cfg.obstacleSpacingMax);
    world.nextObstacleY -= rand(lo, hi);
  }
}

// Push point p out of obstacle o (inflated by margin). Returns true if it moved.
// Writes the push into `out` when given.
export function pushOut(p, o, margin, out) {
  if (o.r) { // round: lamppost, trash can
    const dx = p.x - o.x, dy = p.y - o.y;
    const r = o.r + margin;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) return false;
    const d = Math.sqrt(d2) || 1e-6;
    const px = (dx / d) * r - dx, py = (dy / d) * r - dy;
    if (out) { out.x = px; out.y = py; }
    p.x += px; p.y += py;
    return true;
  }
  const hw = o.w / 2 + margin, hh = o.h / 2 + margin;
  const dx = p.x - o.x, dy = p.y - o.y;
  const ox = hw - Math.abs(dx), oy = hh - Math.abs(dy);
  if (ox <= 0 || oy <= 0) return false;
  let px = 0, py = 0;
  if (ox < oy) px = dx < 0 ? -ox : ox;
  else py = dy < 0 ? -oy : oy;
  if (out) { out.x = px; out.y = py; }
  p.x += px; p.y += py;
  return true;
}

export function isNear(p, o, range) {
  return Math.abs(p.x - o.x) < range + 1 && Math.abs(p.y - o.y) < range + 1;
}
