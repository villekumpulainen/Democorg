// Mischief targets: grab meter, nose pull and "leave it".
// stepTargets reports what happened as events; game.js turns them into score/trust.

import { isAlert } from './owner.js';
import { dist, rand, pick } from './util.js';
import { pushOut } from './world.js';

export const TARGET_TYPES = {
  burger: { label: 'Burger', smelly: true, prefix: 'burger' },
  sock: { label: 'Sock', smelly: false, prefix: 'sock' },
  smelly: { label: 'Roll', smelly: true, prefix: 'smelly' },
  // Only appear from havoc: dropped by a startled owner, spilled from a tipped trash can.
  snack: { label: 'Sandwich', smelly: true, prefix: 'snack' },
  trash: { label: 'Trash', smelly: true, prefix: 'trash' },
};
const SPAWNABLE = ['burger', 'sock', 'smelly'];

const GRAB_CANCEL_FACTOR = 1.3; // hysteresis so the meter doesn't flicker at the edge

export function targetStats(type, cfg) {
  const p = TARGET_TYPES[type].prefix;
  return {
    score: cfg[p + 'Score'],
    costAlert: cfg[p + 'CostAlert'],
    costDistracted: cfg[p + 'CostDistracted'],
    grabTime: Math.max(0.05, cfg[p + 'GrabTime']),
  };
}

let nextId = 1;

export function createTarget(type, x, y) {
  return {
    id: nextId++, type, x, y,
    progress: 0, grabbing: false, done: false,
    alertPenalized: false,
    leaveItChecked: false,
    leaveIt: 'none', // 'none' | 'active' | 'obeyed' | 'ignored'
    leaveItTimer: 0,
    leaveItArmed: false, // the dog has been outside the no-go circle since "leave it"
    pickupTimer: Infinity, // dropped sandwiches: the owner picks it back up when this runs out
  };
}

// Lampposts on the grass side sometimes have a treat just past them: out of the leash's
// normal reach, reachable by tangling the owner on that post (they let out slack).
const BAIT_X = -0.95;

export function spawnTarget(targets, obstacles, y, cfg) {
  const post = obstacles.find((o) => o.kind === 'post' && o.x < 1 && !o.baited && Math.abs(o.y - y) < 5);
  if (post && Math.random() < cfg.postBaitChance) {
    post.baited = true;
    targets.push(createTarget(pick(['burger', 'smelly']), BAIT_X, post.y + rand(-0.5, 0.5)));
    return;
  }
  const type = pick(SPAWNABLE);
  let x = 2;
  for (let tries = 0; tries < 8; tries++) {
    if (type === 'sock') x = Math.random() < 0.5 ? 0.7 : 3.3;            // parked stroller
    else if (type === 'smelly') x = Math.random() < 0.5 ? rand(-0.7, -0.3) : rand(0.4, 3.6);
    else x = rand(0.4, 3.6);
    if (!obstacles.some((o) => pushOut({ x, y }, o, 0.6))) break;
  }
  targets.push(createTarget(type, x, y));
}

export function nosePull(targets, dog, cfg, out) {
  out.x = 0; out.y = 0;
  for (const t of targets) {
    if (t.done || !TARGET_TYPES[t.type].smelly) continue;
    const dx = t.x - dog.x, dy = t.y - dog.y, d = Math.hypot(dx, dy);
    if (d < cfg.nosePullRadius && d > 0.05) {
      out.x += (dx / d) * cfg.nosePullStrength;
      out.y += (dy / d) * cfg.nosePullStrength;
    }
  }
}

export function stepTargets(targets, dog, owner, cfg, dt, events) {
  for (const t of targets) {
    if (t.done) continue;
    const d = dist(dog, t);

    if (!t.leaveItChecked && d < cfg.leaveItTriggerRadius) {
      t.leaveItChecked = true;
      if (Math.random() < cfg.leaveItChance) {
        t.leaveIt = 'active';
        t.leaveItTimer = cfg.leaveItWindow;
        events.push({ type: 'leaveItSaid', target: t });
      }
    }
    // "Leave it": keep out of the no-go circle until the countdown runs out. A dog that was
    // already inside when it was said just has to get out and stay out.
    if (t.leaveIt === 'active') {
      t.leaveItTimer -= dt;
      const inside = d < cfg.leaveItNoGoRadius;
      if (!inside) t.leaveItArmed = true;
      if ((inside && t.leaveItArmed) || (t.leaveItTimer <= 0 && inside)) {
        t.leaveIt = 'ignored';
        events.push({ type: 'leaveItIgnored', target: t });
      } else if (t.leaveItTimer <= 0) {
        t.leaveIt = 'obeyed';
        events.push({ type: 'leaveItObeyed', target: t });
      }
    }

    t.pickupTimer -= dt;
    if (t.pickupTimer <= 0 && !t.grabbing) {
      t.done = true;
      events.push({ type: 'pickedUp', target: t });
      continue;
    }

    if (d < cfg.grabRadius) {
      if (!t.grabbing) {
        t.grabbing = true;
        t.progress = 0;
        if (isAlert(owner) && dog.intent > 0 && !t.alertPenalized) {
          t.alertPenalized = true;
          events.push({ type: 'grabStartAlert', target: t });
        }
      }
    } else if (t.grabbing && d > cfg.grabRadius * GRAB_CANCEL_FACTOR) {
      t.grabbing = false;
      t.progress = 0;
    }

    if (t.grabbing) {
      t.progress += dt / targetStats(t.type, cfg).grabTime;
      if (t.progress >= 1) {
        t.done = true;
        t.grabbing = false;
        events.push({
          type: 'mischief', target: t,
          alert: isAlert(owner),
          ignoredLeaveIt: t.leaveIt !== 'none',
        });
      }
    }
  }
}
