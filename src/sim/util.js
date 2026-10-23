export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (lo, hi) => lo + Math.random() * (hi - lo);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
