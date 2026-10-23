// One walk: wires the systems together in a fixed-timestep step.

import { createDog, stepDog, collideDog } from './dog.js';
import { createLeash, stepLeash, updateTension } from './leash.js';
import { createOwner, stepOwner, say } from './owner.js';
import { createTrust, changeTrust, stepTrust } from './trust.js';
import { nosePull, stepTargets, spawnTarget, targetStats, TARGET_TYPES } from './targets.js';
import { createWorld, spawnObstacles } from './world.js';
import { dist, rand } from './util.js';

export function createGame(cfg) {
  const owner = createOwner(cfg);
  const dog = createDog(owner.x - 0.5, owner.y + 0.8);
  return {
    state: 'ready', // 'ready' | 'playing' | 'over'
    result: null,   // { home: bool, bonus, ... } when over
    time: 0,
    walkDistance: cfg.walkDistance,
    score: 0, mischief: 0, treats: 0, yanks: 0,
    owner, dog,
    leash: createLeash(cfg, owner.hand, dog),
    trust: createTrust(cfg),
    world: createWorld(),
    targets: [], obstacles: [],
    floaters: [],
    yankFlash: 0,
  };
}

const pull = { x: 0, y: 0 };
const events = [];

// input: { x, y } finger position in world meters, or null.
export function stepGame(g, cfg, input, dt) {
  if (g.state !== 'playing') return;
  g.time += dt;

  if (g.leash.points.length !== Math.max(2, Math.round(cfg.leashSegments)) + 1) {
    const t = g.leash.tension;
    g.leash = createLeash(cfg, g.owner.hand, g.dog);
    g.leash.tension = t;
  }

  const { owner, dog, leash, trust } = g;

  stepOwner(owner, cfg, dt, leash.tension, !!leash.tangled);

  spawnObstacles(g.world, g.obstacles, owner.y, cfg);
  g.world.spawnTimer -= dt;
  if (g.world.spawnTimer <= 0) {
    const y = owner.y - 12;
    if (y > -g.walkDistance + 2) spawnTarget(g.targets, g.obstacles, y);
    g.world.spawnTimer = rand(Math.min(cfg.spawnMin, cfg.spawnMax), Math.max(cfg.spawnMin, cfg.spawnMax));
  }

  nosePull(g.targets, dog, cfg, pull);
  stepDog(dog, input, cfg, dt, pull.x, pull.y);
  collideDog(dog, g.obstacles);
  stepLeash(leash, cfg, owner.hand, dog, g.obstacles);
  updateTension(leash, dog, cfg, dt);
  stepYank(g, cfg, dt);

  const grabbing = g.targets.some((t) => t.grabbing);
  const calm = !grabbing && leash.tension < 0.1 && dist(dog, owner) < cfg.calmRadius;
  stepTrust(trust, cfg, dt, leash.tension, calm);

  events.length = 0;
  stepTargets(g.targets, dog, owner, cfg, dt, events);
  for (const e of events) handleEvent(g, cfg, e);

  // Forget things far behind.
  const behind = owner.y + 14;
  g.targets = g.targets.filter((t) => t.y < behind);
  g.obstacles = g.obstacles.filter((o) => o.y < behind);

  for (const f of g.floaters) f.age += dt;
  g.floaters = g.floaters.filter((f) => f.age < 1.4);
  if (g.yankFlash > 0) g.yankFlash -= dt;

  if (trust.value <= 0) {
    g.state = 'over';
    g.result = { home: false, bonus: 0 };
  } else if (owner.y <= -g.walkDistance) {
    const bonus = Math.round(cfg.homeBonusBase + cfg.homeBonusPerTrust * trust.value);
    g.score += bonus;
    g.state = 'over';
    g.result = { home: true, bonus };
  }
}

function stepYank(g, cfg, dt) {
  const { leash, dog, owner, trust } = g;
  if (leash.yankCooldown > 0) leash.yankCooldown -= dt;
  if (leash.tension >= cfg.yankThreshold && leash.yankCooldown <= 0) {
    leash.yankHold += dt;
    if (leash.yankHold >= cfg.yankHoldTime) {
      const dx = owner.hand.x - dog.x, dy = owner.hand.y - dog.y, d = Math.hypot(dx, dy) || 1;
      dog.vx = (dx / d) * cfg.yankImpulse;
      dog.vy = (dy / d) * cfg.yankImpulse;
      dog.stun = cfg.yankStun;
      leash.tension = 0;
      leash.yankHold = 0;
      leash.yankCooldown = cfg.yankCooldown;
      changeTrust(trust, -cfg.yankTrustCost, 'yank', g.time);
      g.yanks++;
      g.yankFlash = 0.3;
      floater(g, dog.x, dog.y, 'YANK!', '#ff5a4e');
    }
  } else {
    leash.yankHold = 0;
  }
}

function handleEvent(g, cfg, e) {
  const t = e.target;
  switch (e.type) {
    case 'leaveItSaid':
      say(g.owner, 'Leave it!', cfg.leaveItWindow);
      break;
    case 'leaveItObeyed':
      g.score += cfg.leaveItScore;
      g.treats++;
      changeTrust(g.trust, cfg.leaveItTrust, 'leave it', g.time);
      say(g.owner, 'Good dog!', 1.2);
      floater(g, g.dog.x, g.dog.y, `Treat +${cfg.leaveItScore}`, '#7be07b');
      break;
    case 'grabStartAlert':
      changeTrust(g.trust, -cfg.grabAlertStartPenalty, 'grab while watched', g.time);
      floater(g, t.x, t.y, 'Caught!', '#ff9a3c');
      break;
    case 'mischief': {
      const s = targetStats(t.type, cfg);
      let cost = e.alert ? s.costAlert : s.costDistracted;
      if (e.ignoredLeaveIt) cost += cfg.leaveItIgnorePenalty;
      g.score += s.score;
      g.mischief++;
      changeTrust(g.trust, -cost, TARGET_TYPES[t.type].label.toLowerCase(), g.time);
      if (e.ignoredLeaveIt) say(g.owner, 'Bad dog!', 1.2);
      floater(g, t.x, t.y, `+${s.score}`, '#ffd34e');
      break;
    }
  }
}

function floater(g, x, y, text, color) {
  g.floaters.push({ x, y, text, color, age: 0 });
}
