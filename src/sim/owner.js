// The owner: walks forward at a constant pace (slowed by tension, stopped by tangles)
// and cycles distracted -> warning -> alert on a randomized timer.

import { rand } from './util.js';
import { OWNER_LANE_X } from './world.js';

export function createOwner(cfg) {
  const owner = {
    x: OWNER_LANE_X, y: 0, speed: 0,
    hand: { x: OWNER_LANE_X + 0.3, y: -0.1 },
    attention: 'distracted', // 'distracted' | 'warning' | 'alert'
    attentionTimer: 0,
    speech: null, speechTimer: 0,
  };
  owner.attentionTimer = randRange(cfg.distractedMin, cfg.distractedMax);
  return owner;
}

export const isAlert = (owner) => owner.attention === 'alert';

export function stepOwner(owner, cfg, dt, tension, tangled) {
  owner.attentionTimer -= dt;
  if (owner.attention === 'alert') {
    if (owner.attentionTimer <= 0) {
      owner.attention = 'distracted';
      owner.attentionTimer = randRange(cfg.distractedMin, cfg.distractedMax);
    }
  } else if (owner.attentionTimer <= 0) {
    owner.attention = 'alert';
    owner.attentionTimer = randRange(cfg.alertMin, cfg.alertMax);
  } else {
    owner.attention = owner.attentionTimer <= cfg.alertWarning ? 'warning' : 'distracted';
  }

  owner.speed = tangled ? 0 : cfg.ownerSpeed * Math.max(0, 1 - tension * cfg.ownerSlowAtFullTension);
  owner.y -= owner.speed * dt;
  owner.hand.x = owner.x + 0.3;
  owner.hand.y = owner.y - 0.1;

  if (owner.speechTimer > 0) {
    owner.speechTimer -= dt;
    if (owner.speechTimer <= 0) owner.speech = null;
  }
}

export function say(owner, text, seconds) {
  owner.speech = text;
  owner.speechTimer = seconds;
}

function randRange(a, b) {
  return rand(Math.min(a, b), Math.max(a, b));
}
