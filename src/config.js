// Every tunable number lives here. Units: meters, seconds, m/s, m/s².
// The tuning panel edits `config` live; DEFAULTS are what "Reset" restores.

export const DEFAULTS = {
  // --- Values from the spec's tuning table ---
  ownerSpeed: 1.2,             // m/s
  dogMaxSpeed: 3.5,            // m/s
  dogAccel: 8,                 // m/s²
  dogFriction: 0.85,           // fraction of speed kept per 0.1 s while coasting (finger up)
  leashLength: 2.5,            // m
  leashSegments: 12,           // Verlet segments
  yankThreshold: 0.8,          // tension (0–1) that triggers a yank
  trustDrainFullTension: 15,   // trust per second at tension 1
  calmTrustGain: 1,            // trust per second while walking calmly at heel
  distractedMin: 3, distractedMax: 7,  // s
  alertMin: 2, alertMax: 5,            // s
  alertWarning: 0.5,           // s of telegraph before the owner turns alert
  nosePullStrength: 1.5,       // m/s²
  spawnMin: 8, spawnMax: 14,   // s between targets
  grabRadius: 0.5,             // m

  // --- Extra knobs the spec implies ---
  startTrust: 60,
  walkDistance: 180,           // m to home (~2.5 min at 1.2 m/s)
  homeBonusBase: 500,          // score for reaching home
  homeBonusPerTrust: 5,        // + this × trust left
  calmRadius: 1.3,             // m from owner that counts as "at heel"
  nosePullRadius: 2.5,         // m
  tensionResponse: 8,          // how fast tension follows the pull (1/s)
  ownerSlowAtFullTension: 0.6, // fraction of owner speed lost at tension 1
  yankHoldTime: 0.2,           // s above threshold before the yank fires
  yankImpulse: 4.5,            // m/s snap toward the owner
  yankStun: 0.35,              // s the dog ignores the finger after a yank
  yankTrustCost: 8,
  yankCooldown: 1.2,           // s
  tangleAngle: 200,            // degrees of wrap around an obstacle that counts as tangled
  grabAlertStartPenalty: 5,    // trust lost for starting a grab while watched
  leaveItChance: 0.5,          // chance the owner says "leave it" near a target
  leaveItTriggerRadius: 1.5,   // m
  leaveItEscapeRadius: 2.3,    // m from target that counts as "moved away"
  leaveItWindow: 2,            // s
  leaveItScore: 50,
  leaveItTrust: 15,
  leaveItIgnorePenalty: 15,    // extra trust lost for grabbing after "leave it"
  obstacleSpacingMin: 6, obstacleSpacingMax: 13, // m between lampposts/benches

  // --- Targets (score, trust cost alert / distracted, grab time) ---
  burgerScore: 300, burgerCostAlert: 30, burgerCostDistracted: 10, burgerGrabTime: 1.5,
  sockScore: 500, sockCostAlert: 40, sockCostDistracted: 15, sockGrabTime: 2.0,
  smellyScore: 400, smellyCostAlert: 35, smellyCostDistracted: 12, smellyGrabTime: 1.5,
};

// Slider definitions for the tuning panel.
export const SCHEMA = [
  ['Movement', [
    ['ownerSpeed', 'Owner walk speed', 0.3, 3, 0.05],
    ['dogMaxSpeed', 'Dog max speed', 1, 8, 0.1],
    ['dogAccel', 'Dog acceleration', 1, 30, 0.5],
    ['dogFriction', 'Dog friction (kept / 0.1 s)', 0.2, 0.99, 0.01],
    ['nosePullStrength', 'Nose pull strength', 0, 6, 0.1],
    ['nosePullRadius', 'Nose pull radius', 0.5, 5, 0.1],
  ]],
  ['Leash', [
    ['leashLength', 'Leash length', 1, 5, 0.1],
    ['leashSegments', 'Leash segments', 4, 30, 1],
    ['tensionResponse', 'Tension response', 1, 30, 0.5],
    ['ownerSlowAtFullTension', 'Owner slowdown at full tension', 0, 1, 0.05],
    ['yankThreshold', 'Yank threshold', 0.3, 1, 0.01],
    ['yankHoldTime', 'Yank hold time', 0, 1, 0.05],
    ['yankImpulse', 'Yank impulse', 0, 10, 0.1],
    ['yankStun', 'Yank stun', 0, 1.5, 0.05],
    ['yankCooldown', 'Yank cooldown', 0, 4, 0.1],
    ['tangleAngle', 'Tangle wrap angle (°)', 90, 400, 5],
  ]],
  ['Trust', [
    ['startTrust', 'Start trust (next walk)', 1, 100, 1],
    ['trustDrainFullTension', 'Drain / s at full tension', 0, 50, 0.5],
    ['calmTrustGain', 'Calm walking gain / s', 0, 10, 0.1],
    ['calmRadius', 'Calm radius', 0.3, 3, 0.1],
    ['yankTrustCost', 'Yank trust cost', 0, 30, 1],
    ['grabAlertStartPenalty', 'Grab-while-watched penalty', 0, 30, 1],
  ]],
  ['Owner attention', [
    ['distractedMin', 'Distracted min', 0.5, 15, 0.5],
    ['distractedMax', 'Distracted max', 0.5, 15, 0.5],
    ['alertMin', 'Alert min', 0.5, 15, 0.5],
    ['alertMax', 'Alert max', 0.5, 15, 0.5],
    ['alertWarning', 'Alert warning time', 0, 2, 0.05],
  ]],
  ['Leave it', [
    ['leaveItChance', 'Chance', 0, 1, 0.05],
    ['leaveItTriggerRadius', 'Trigger radius', 0.5, 4, 0.1],
    ['leaveItEscapeRadius', 'Escape radius', 0.5, 5, 0.1],
    ['leaveItWindow', 'Window', 0.5, 5, 0.1],
    ['leaveItScore', 'Treat score', 0, 300, 10],
    ['leaveItTrust', 'Treat trust', 0, 40, 1],
    ['leaveItIgnorePenalty', 'Ignore penalty', 0, 40, 1],
  ]],
  ['Targets', [
    ['spawnMin', 'Spawn interval min', 1, 30, 0.5],
    ['spawnMax', 'Spawn interval max', 1, 30, 0.5],
    ['grabRadius', 'Grab radius', 0.2, 1.5, 0.05],
    ['burgerScore', 'Burger score', 0, 1000, 10],
    ['burgerCostAlert', 'Burger cost (alert)', 0, 80, 1],
    ['burgerCostDistracted', 'Burger cost (distracted)', 0, 80, 1],
    ['burgerGrabTime', 'Burger grab time', 0.2, 5, 0.1],
    ['sockScore', 'Sock score', 0, 1000, 10],
    ['sockCostAlert', 'Sock cost (alert)', 0, 80, 1],
    ['sockCostDistracted', 'Sock cost (distracted)', 0, 80, 1],
    ['sockGrabTime', 'Sock grab time', 0.2, 5, 0.1],
    ['smellyScore', 'Smelly score', 0, 1000, 10],
    ['smellyCostAlert', 'Smelly cost (alert)', 0, 80, 1],
    ['smellyCostDistracted', 'Smelly cost (distracted)', 0, 80, 1],
    ['smellyGrabTime', 'Smelly grab time', 0.2, 5, 0.1],
  ]],
  ['Walk', [
    ['walkDistance', 'Walk distance (next walk)', 30, 400, 5],
    ['homeBonusBase', 'Home bonus', 0, 2000, 50],
    ['homeBonusPerTrust', 'Home bonus per trust', 0, 50, 1],
    ['obstacleSpacingMin', 'Obstacle spacing min', 2, 30, 0.5],
    ['obstacleSpacingMax', 'Obstacle spacing max', 2, 30, 0.5],
  ]],
];

const STORAGE_KEY = 'dogwalk.config.v1';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const out = {};
    for (const k of Object.keys(DEFAULTS)) if (typeof saved[k] === 'number') out[k] = saved[k];
    return out;
  } catch { return {}; }
}

export const config = { ...DEFAULTS, ...load() };

export function saveConfig() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch { /* storage unavailable */ }
}

export function resetConfig() {
  Object.assign(config, DEFAULTS);
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* storage unavailable */ }
}
