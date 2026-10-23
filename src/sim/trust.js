// Trust meter (0–100). Continuous drains/gains plus logged one-off changes.

import { clamp } from './util.js';

export function createTrust(cfg) {
  return { value: cfg.startTrust, drainRate: 0, gainRate: 0, log: [] };
}

export function changeTrust(trust, delta, reason, time) {
  trust.value = clamp(trust.value + delta, 0, 100);
  trust.log.unshift({ time, delta, reason });
  if (trust.log.length > 6) trust.log.length = 6;
}

export function stepTrust(trust, cfg, dt, tension, calm) {
  trust.drainRate = tension > 0.05 ? tension * cfg.trustDrainFullTension : 0;
  trust.gainRate = calm ? cfg.calmTrustGain : 0;
  trust.value = clamp(trust.value + (trust.gainRate - trust.drainRate) * dt, 0, 100);
}
