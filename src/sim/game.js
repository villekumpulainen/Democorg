// One walk: wires the systems together in a fixed-timestep step.

import { createDog, stepDog, collideDog } from './dog.js';
import { createLeash, stepLeash, updateTension, liftOver } from './leash.js';
import { createOwner, stepOwner, say, isAlert, startle } from './owner.js';
import { createTrust, changeTrust, stepTrust } from './trust.js';
import { nosePull, stepTargets, spawnTarget, createTarget, targetStats, TARGET_TYPES } from './targets.js';
import { stepCritters, spawnCritter, createPigeons } from './critters.js';
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
    score: 0, mischief: 0, treats: 0, yanks: 0, havoc: 0, bestChain: 0,
    owner, dog,
    leash: createLeash(cfg, owner.hand, dog),
    trust: createTrust(cfg),
    world: createWorld(),
    targets: [], obstacles: [], critters: [],
    critterTimer: 5,
    tangleTimer: 0,
    chain: { count: 0, timer: 0 },
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
  for (const o of g.obstacles) {
    if (o.kind === 'trash' && !o.seeded) { // most trash cans come with pigeons
      o.seeded = true;
      if (Math.random() < 0.7) g.critters.push(createPigeons(o.x < 2 ? o.x + 1 : o.x - 1, o.y + 0.6));
    }
  }
  g.critterTimer -= dt;
  if (g.critterTimer <= 0) {
    if (owner.y - 12 > -g.walkDistance + 2) spawnCritter(g.critters, owner.y);
    g.critterTimer = rand(Math.min(cfg.critterSpawnMin, cfg.critterSpawnMax), Math.max(cfg.critterSpawnMin, cfg.critterSpawnMax));
  }
  g.world.spawnTimer -= dt;
  if (g.world.spawnTimer <= 0) {
    const y = owner.y - 12;
    if (y > -g.walkDistance + 2) spawnTarget(g.targets, g.obstacles, y);
    g.world.spawnTimer = rand(Math.min(cfg.spawnMin, cfg.spawnMax), Math.max(cfg.spawnMin, cfg.spawnMax));
  }

  nosePull(g.targets, dog, cfg, pull);
  stepDog(dog, input, cfg, dt, pull.x, pull.y);
  const impactSpeed = Math.hypot(dog.vx, dog.vy);
  collideDog(dog, g.obstacles);
  stepLeash(leash, cfg, owner.hand, dog, g.obstacles, dt);
  updateTension(leash, dog, cfg, dt);
  stepYank(g, cfg, dt);
  stepTangle(g, cfg, dt);

  const grabbing = g.targets.some((t) => t.grabbing);
  const calm = !grabbing && leash.tension < 0.1 && dist(dog, owner) < cfg.calmRadius;
  stepTrust(trust, cfg, dt, leash.tension, calm);

  if (g.chain.timer > 0) g.chain.timer -= dt;
  events.length = 0;
  stepTargets(g.targets, dog, owner, cfg, dt, events);
  stepCritters(g.critters, g.obstacles, dog, leash, cfg, dt, impactSpeed, events);
  for (const e of events) handleEvent(g, cfg, e);

  // Forget things far behind (or far ahead, for joggers running away).
  const behind = owner.y + 14, ahead = owner.y - 25;
  g.targets = g.targets.filter((t) => t.y < behind);
  g.obstacles = g.obstacles.filter((o) => o.y < behind);
  g.critters = g.critters.filter((c) => c.state !== 'gone' && c.y < behind && c.y > ahead);

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

// While tangled the owner is busy (not watching). If the dog doesn't unwind it in time,
// the owner lifts the leash over the obstacle themselves, and is annoyed about it.
function stepTangle(g, cfg, dt) {
  const { leash, owner, dog } = g;
  if (!leash.tangled) { g.tangleTimer = 0; return; }
  if (g.tangleTimer === 0) say(owner, 'Ugh, hold on…', 1.5);
  g.tangleTimer += dt;
  if (g.tangleTimer >= cfg.tangleFumbleTime) {
    liftOver(leash, leash.tangled, owner.hand, dog, 1.5);
    owner.busy = null;
    g.tangleTimer = 0;
    changeTrust(g.trust, -cfg.untangleTrustCost, 'untangle', g.time);
    say(owner, 'Seriously?!', 1.2);
  }
}

// Score multiplier for havoc that follows other havoc within the chain window.
function chainMultiplier(g, cfg, x, y) {
  const c = g.chain;
  c.count = c.timer > 0 ? c.count + 1 : 1;
  c.timer = cfg.chainWindow;
  g.bestChain = Math.max(g.bestChain, c.count);
  if (c.count > 1) floater(g, x, y - 0.6, `CHAIN x${c.count}`, '#ff7be0');
  return 1 + cfg.chainBonus * (c.count - 1);
}

// Generic havoc: score (chained), trust cost depending on whether the owner is watching.
function havoc(g, cfg, prefix, x, y, label) {
  const score = Math.round(cfg[prefix + 'Score'] * chainMultiplier(g, cfg, x, y));
  const cost = isAlert(g.owner) ? cfg[prefix + 'CostAlert'] : cfg[prefix + 'CostDistracted'];
  g.score += score;
  g.havoc++;
  if (cost) changeTrust(g.trust, -cost, label, g.time);
  floater(g, x, y, `${label} +${score}`, '#ffd34e');
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
      const score = Math.round(s.score * chainMultiplier(g, cfg, t.x, t.y));
      g.score += score;
      g.mischief++;
      changeTrust(g.trust, -cost, TARGET_TYPES[t.type].label.toLowerCase(), g.time);
      if (e.ignoredLeaveIt) say(g.owner, 'Bad dog!', 1.2);
      floater(g, t.x, t.y, `+${score}`, '#ffd34e');
      break;
    }
    case 'trip':
      havoc(g, cfg, 'trip', e.x, e.y, 'Tripped!');
      say(g.owner, 'Oh no, sorry!!', 1.5);
      break;
    case 'squirrel':
      havoc(g, cfg, 'squirrel', e.x, e.y, 'Squirrel!');
      break;
    case 'squirrelEscaped':
      floater(g, e.x, e.y, 'escaped', '#ccc');
      break;
    case 'trashTip': {
      const o = e.obstacle;
      havoc(g, cfg, 'trashTip', o.x, o.y, 'Crash!');
      g.targets.push(createTarget('trash', o.x < 2 ? o.x + 0.6 : o.x - 0.6, o.y));
      break;
    }
    case 'pigeons': {
      const f = e.flock;
      havoc(g, cfg, 'pigeon', f.x, f.y, 'Pigeons!');
      const o = g.owner;
      if (dist(f, o) < cfg.startleRadius && o.busy?.reason !== 'startled') {
        startle(o, cfg.startleTime);
        say(o, 'Aah! My sandwich!', 1.6);
        const snack = createTarget('snack', o.x - 0.5, o.y + 0.3);
        snack.leaveItChecked = true;
        g.targets.push(snack);
        floater(g, o.x, o.y - 0.8, 'Startled!', '#ff7be0');
      }
      break;
    }
  }
}

function floater(g, x, y, text, color) {
  g.floaters.push({ x, y, text, color, age: 0 });
}
