// Moving havoc: joggers (trip them with a taut leash), squirrels (chase and catch),
// pigeon flocks (scatter them), plus trash cans the dog can knock over.
// stepCritters reports what happened as events; game.js scores them and chains them.

import { dist, rand, pick, clamp } from './util.js';

const JOGGER_LANES = [1.1, 3.1];
const TRIP_TAUT_RATIO = 0.85;   // leash must be at least this stretched to trip someone
const PIGEON_COUNT = 6;
const PIGEON_FLY_TIME = 1.5;
const SQUIRREL_RUN = 0.6, SQUIRREL_PAUSE = 0.3; // s: squirrels run in bursts
const SQUIRREL_TREE_X = -1.3;   // squirrels bolt for the trees on the grass

export function createJogger(x, y, dir) {
  return { kind: 'jogger', x, y, dir, r: 0.25, state: 'run', timer: 0, tripped: false, phase: Math.random() * 6 };
}

export function createSquirrel(x, y) {
  return {
    kind: 'squirrel', x, y, vx: 0, vy: 0, r: 0.12, state: 'idle', timer: rand(0.5, 1.5), fleeTime: 0,
    treeX: SQUIRREL_TREE_X, treeY: y - rand(1, 3),
  };
}

export function createPigeons(x, y) {
  const birds = [];
  for (let i = 0; i < PIGEON_COUNT; i++) {
    const a = rand(0, Math.PI * 2), d = rand(0.1, 0.6);
    birds.push({ dx: Math.cos(a) * d, dy: Math.sin(a) * d, vx: 0, vy: 0 });
  }
  return { kind: 'pigeons', x, y, birds, state: 'peck', timer: 0 };
}

export function spawnCritter(critters, ownerY) {
  const kind = pick(['jogger', 'squirrel', 'pigeons']);
  if (kind === 'jogger') {
    const fromAhead = Math.random() < 0.5;
    critters.push(createJogger(pick(JOGGER_LANES), fromAhead ? ownerY - 14 : ownerY + 10, fromAhead ? 1 : -1));
  } else if (kind === 'squirrel') {
    critters.push(createSquirrel(rand(1.2, 3.6), ownerY - 11)); // foraging on the sidewalk
  } else {
    critters.push(createPigeons(rand(0.7, 3.3), ownerY - 12));
  }
}

export function burstPigeons(flock, fromX, fromY, events) {
  if (flock.state !== 'peck') return;
  flock.state = 'fly';
  flock.timer = 0;
  for (const b of flock.birds) {
    const a = Math.atan2(flock.y + b.dy - fromY, flock.x + b.dx - fromX) + rand(-0.8, 0.8);
    const s = rand(4, 6);
    b.vx = Math.cos(a) * s; b.vy = Math.sin(a) * s;
  }
  events.push({ type: 'pigeons', flock });
}

// impactSpeed: the dog's speed before obstacle collisions this tick (for knocking trash over).
export function stepCritters(critters, obstacles, dog, leash, cfg, dt, impactSpeed, events) {
  for (const c of critters) {
    if (c.kind === 'jogger') stepJogger(c, leash, cfg, dt, events);
    else if (c.kind === 'squirrel') stepSquirrel(c, dog, cfg, dt, events);
    else stepPigeons(c, dog, cfg, dt, events);
  }

  for (const o of obstacles) {
    if (o.kind !== 'trash' || o.tipped) continue;
    if (impactSpeed >= cfg.trashTipSpeed && dist(dog, o) < o.r + dog.radius + 0.06) {
      o.tipped = true;
      events.push({ type: 'trashTip', obstacle: o });
      for (const f of critters) {
        if (f.kind === 'pigeons' && dist(f, o) < 3) burstPigeons(f, o.x, o.y, events);
      }
    }
  }
}

function stepJogger(j, leash, cfg, dt, events) {
  j.phase += dt * 10;
  if (j.state === 'down') {
    j.timer -= dt;
    if (j.timer <= 0) j.state = 'run';
    return;
  }
  j.y += j.dir * cfg.joggerSpeed * dt;
  if (j.tripped || leash.length < cfg.leashLength * TRIP_TAUT_RATIO) return;
  const pts = leash.points;
  for (let i = 0; i < pts.length - 1; i++) {
    if (segmentDist(j, pts[i], pts[i + 1]) < j.r + 0.05) {
      j.state = 'down';
      j.tripped = true;
      j.timer = 2.5;
      events.push({ type: 'trip', x: j.x, y: j.y });
      return;
    }
  }
}

function stepSquirrel(s, dog, cfg, dt, events) {
  const d = dist(dog, s);
  if (d < dog.radius + s.r + 0.12) {
    s.state = 'gone';
    events.push({ type: 'squirrel', x: s.x, y: s.y });
    return;
  }
  if (s.state === 'idle') {
    s.timer -= dt;
    if (s.timer <= 0) { // little hop
      s.timer = rand(0.6, 1.6);
      s.x += rand(-0.2, 0.2); s.y += rand(-0.2, 0.2);
    }
    if (d < cfg.squirrelFleeRadius) s.state = 'flee';
    return;
  }
  if (s.state === 'flee') {
    s.fleeTime += dt;
    const running = s.fleeTime % (SQUIRREL_RUN + SQUIRREL_PAUSE) < SQUIRREL_RUN;
    if (running) {
      // Head for the tree, veering away from the dog when it gets close, zigzagging.
      const tx = s.treeX - s.x, ty = s.treeY - s.y, td = Math.hypot(tx, ty) || 1;
      const away = Math.max(0, 1.5 - d) * 1.5;
      let ux = tx / td + ((s.x - dog.x) / (d || 1)) * away;
      let uy = ty / td + ((s.y - dog.y) / (d || 1)) * away;
      const zig = Math.sin(s.fleeTime * 9) * 0.6;
      const ax = ux - uy * zig, ay = uy + ux * zig;
      const n = Math.hypot(ax, ay) || 1;
      s.vx = (ax / n) * cfg.squirrelSpeed; s.vy = (ay / n) * cfg.squirrelSpeed;
    } else {
      s.vx = 0; s.vy = 0;
    }
    s.x = clamp(s.x + s.vx * dt, -1.4, 4.4);
    s.treeY = Math.min(s.treeY, s.y + 2); // keep the tree roughly alongside
    s.y += s.vy * dt;
    if (Math.hypot(s.treeX - s.x, s.treeY - s.y) < 0.3) {
      s.state = 'gone';
      events.push({ type: 'squirrelEscaped', x: s.x, y: s.y });
    }
  }
}

function stepPigeons(f, dog, cfg, dt, events) {
  if (f.state === 'peck') {
    for (const b of f.birds) {
      if (Math.random() < dt * 2) { b.dx += rand(-0.05, 0.05); b.dy += rand(-0.05, 0.05); }
    }
    const speed = Math.hypot(dog.vx, dog.vy);
    if (dist(dog, f) < cfg.pigeonScareRadius && speed > 1.2) burstPigeons(f, dog.x, dog.y, events);
    return;
  }
  f.timer += dt;
  for (const b of f.birds) { b.dx += b.vx * dt; b.dy += b.vy * dt; }
  if (f.timer > PIGEON_FLY_TIME) f.state = 'gone';
}

function segmentDist(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1), 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}
