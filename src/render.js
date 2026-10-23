// Greybox canvas renderer. Reads game state, never changes it.

import { GRASS_LEFT, SIDEWALK_LEFT, SIDEWALK_RIGHT, CURB_RIGHT, OWNER_LANE_X } from './sim/world.js';
import { TARGET_TYPES } from './sim/targets.js';
import { clamp, lerp } from './sim/util.js';

const VIEW_WIDTH_M = 6;
const VIEW_HEIGHT_M = 10;
const OWNER_SCREEN_Y = 0.68; // owner sits this far down the screen

export function createCamera() {
  return { x: OWNER_LANE_X, y: 0, ppm: 60, w: 1, h: 1 };
}

export function updateCamera(cam, game, w, h) {
  cam.w = w; cam.h = h;
  cam.ppm = Math.min(w / VIEW_WIDTH_M, h / VIEW_HEIGHT_M);
  cam.y = game.owner.y;
}

export const toScreenX = (cam, x) => (x - cam.x) * cam.ppm + cam.w / 2;
export const toScreenY = (cam, y) => (y - cam.y) * cam.ppm + cam.h * OWNER_SCREEN_Y;

export function screenToWorld(cam, sx, sy) {
  return {
    x: (sx - cam.w / 2) / cam.ppm + cam.x,
    y: (sy - cam.h * OWNER_SCREEN_Y) / cam.ppm + cam.y,
  };
}

export function render(ctx, game, cam, cfg, touch) {
  const { w, h, ppm } = cam;
  const X = (x) => toScreenX(cam, x), Y = (y) => toScreenY(cam, y);

  // Street
  ctx.fillStyle = '#3d6b3a';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#9a9a96';
  ctx.fillRect(X(SIDEWALK_LEFT), 0, (SIDEWALK_RIGHT - SIDEWALK_LEFT) * ppm, h);
  ctx.fillStyle = '#c4c4bc';
  ctx.fillRect(X(SIDEWALK_RIGHT), 0, (CURB_RIGHT - SIDEWALK_RIGHT) * ppm, h);
  ctx.fillStyle = '#3a3a40';
  ctx.fillRect(X(CURB_RIGHT), 0, w - X(CURB_RIGHT), h);
  if (X(GRASS_LEFT) > 0) { ctx.fillStyle = '#2f5530'; ctx.fillRect(0, 0, X(GRASS_LEFT), h); }

  // Sidewalk slabs scroll with the world.
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1;
  const topY = cam.y - h * OWNER_SCREEN_Y / ppm, botY = topY + h / ppm;
  ctx.beginPath();
  for (let y = Math.floor(topY); y <= botY; y++) {
    ctx.moveTo(X(SIDEWALK_LEFT), Y(y)); ctx.lineTo(X(SIDEWALK_RIGHT), Y(y));
  }
  ctx.stroke();

  // Home
  const homeY = -game.walkDistance;
  if (Y(homeY) > -4 * ppm) {
    ctx.fillStyle = '#7a4e3a';
    ctx.fillRect(X(-1), Y(homeY - 4), 6 * ppm, 4 * ppm);
    ctx.fillStyle = '#f2e6c9';
    ctx.font = `bold ${Math.round(ppm * 0.6)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('HOME', X(2), Y(homeY - 1.5));
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(X(SIDEWALK_LEFT), Y(homeY) - 2, (SIDEWALK_RIGHT - SIDEWALK_LEFT) * ppm, 4);
  }

  // Obstacles
  for (const o of game.obstacles) {
    if (o.kind === 'post') {
      circle(ctx, X(o.x), Y(o.y), o.r * ppm, game.leash.tangled === o ? '#ff5a4e' : '#222');
      circle(ctx, X(o.x), Y(o.y), o.r * ppm * 0.5, '#666');
    } else {
      ctx.fillStyle = game.leash.tangled === o ? '#a33' : '#6b4a2b';
      ctx.fillRect(X(o.x - o.w / 2), Y(o.y - o.h / 2), o.w * ppm, o.h * ppm);
    }
  }

  // Targets
  for (const t of game.targets) {
    if (t.done) continue;
    const sx = X(t.x), sy = Y(t.y);
    if (TARGET_TYPES[t.type].smelly) {
      ctx.strokeStyle = 'rgba(160,200,80,0.25)';
      ctx.setLineDash([4, 6]);
      ring(ctx, sx, sy, cfg.nosePullRadius * ppm, 1);
      ctx.setLineDash([]);
    }
    if (t.type === 'burger') {
      circle(ctx, sx, sy, 0.18 * ppm, '#d98a2b');
      ctx.fillStyle = '#5a2e14';
      ctx.fillRect(sx - 0.18 * ppm, sy - 0.03 * ppm, 0.36 * ppm, 0.06 * ppm);
    } else if (t.type === 'sock') {
      ctx.fillStyle = '#4a5a8a';
      ctx.fillRect(sx - 0.3 * ppm, sy - 0.45 * ppm, 0.6 * ppm, 0.9 * ppm);
      circle(ctx, sx, sy + 0.2 * ppm, 0.11 * ppm, '#f4f4f4');
    } else {
      circle(ctx, sx, sy, 0.35 * ppm, '#6b5a2a');
      ctx.strokeStyle = 'rgba(180,220,90,0.8)';
      ctx.lineWidth = 2;
      const wob = Math.sin(game.time * 4 + t.id) * 0.05 * ppm;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(sx + i * 0.15 * ppm, sy - 0.2 * ppm);
        ctx.quadraticCurveTo(sx + i * 0.15 * ppm + wob, sy - 0.45 * ppm, sx + i * 0.15 * ppm, sy - 0.65 * ppm);
        ctx.stroke();
      }
    }
    // Grab radius and meter
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ring(ctx, sx, sy, cfg.grabRadius * ppm, 1);
    if (t.grabbing) {
      ctx.strokeStyle = '#ffd34e';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(sx, sy, cfg.grabRadius * ppm, -Math.PI / 2, -Math.PI / 2 + t.progress * Math.PI * 2);
      ctx.stroke();
    }
    if (t.leaveIt === 'active') {
      // Where the dog has to get to for the treat.
      ctx.strokeStyle = 'rgba(255,90,78,0.45)';
      ctx.setLineDash([6, 6]);
      ring(ctx, sx, sy, cfg.leaveItEscapeRadius * ppm, 1.5);
      ctx.setLineDash([]);
    }
  }

  // Owner + attention
  const o = game.owner;
  const ox = X(o.x), oy = Y(o.y);
  if (o.attention === 'alert') {
    const a = Math.atan2(game.dog.y - o.y, game.dog.x - o.x);
    ctx.fillStyle = 'rgba(255,70,60,0.18)';
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.arc(ox, oy, 4 * ppm, a - 0.5, a + 0.5);
    ctx.closePath();
    ctx.fill();
  }
  circle(ctx, ox, oy, 0.3 * ppm, '#3b6fd6');
  circle(ctx, ox, oy - 0.05 * ppm, 0.17 * ppm, '#e8c39e');
  drawAttentionIcon(ctx, o, ox - 0.45 * ppm, oy - 0.45 * ppm, ppm, game.time);

  // Leash
  const pts = game.leash.points;
  const tension = game.leash.tension;
  ctx.strokeStyle = `rgb(${Math.round(lerp(235, 255, tension))},${Math.round(lerp(235, 40, tension))},${Math.round(lerp(220, 30, tension))})`;
  ctx.lineWidth = Math.max(2, 0.06 * ppm) + tension * 2;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(X(pts[0].x), Y(pts[0].y));
  for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i].x), Y(pts[i].y));
  ctx.stroke();

  // Dog
  const d = game.dog;
  const dx = X(d.x), dy = Y(d.y);
  const heading = Math.hypot(d.vx, d.vy) > 0.1 ? Math.atan2(d.vy, d.vx) : -Math.PI / 2;
  circle(ctx, dx, dy, d.radius * ppm, '#b07a3c');
  circle(ctx, dx + Math.cos(heading) * d.radius * ppm, dy + Math.sin(heading) * d.radius * ppm, 0.1 * ppm, '#7a4e22');
  circle(ctx, dx + Math.cos(heading) * d.radius * 1.4 * ppm, dy + Math.sin(heading) * d.radius * 1.4 * ppm, 0.04 * ppm, '#111');

  // Finger target
  if (touch) {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ring(ctx, X(touch.x), Y(touch.y), 0.25 * ppm, 2);
  }

  // Speech bubble
  if (o.speech) {
    ctx.font = `bold ${Math.round(Math.max(14, ppm * 0.32))}px system-ui, sans-serif`;
    const tw = ctx.measureText(o.speech).width + 16;
    const bx = clamp(ox - tw / 2, 4, w - tw - 4), by = oy - 1.5 * ppm;
    ctx.fillStyle = '#fff';
    roundRect(ctx, bx, by - 22, tw, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.fillText(o.speech, bx + tw / 2, by);
  }

  // Floating text
  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(Math.max(16, ppm * 0.35))}px system-ui, sans-serif`;
  for (const f of game.floaters) {
    ctx.globalAlpha = 1 - f.age / 1.4;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, X(f.x), Y(f.y) - f.age * 40);
  }
  ctx.globalAlpha = 1;

  if (game.yankFlash > 0) {
    ctx.fillStyle = `rgba(255,40,30,${game.yankFlash})`;
    ctx.fillRect(0, 0, w, h);
  }

  drawHud(ctx, game, w);
}

function drawAttentionIcon(ctx, o, x, y, ppm, time) {
  const s = Math.max(10, ppm * 0.2);
  if (o.attention === 'alert') {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    circle(ctx, x, y, s * 0.4, '#d23');
  } else if (o.attention === 'warning') {
    if (Math.floor(time * 12) % 2 === 0) {
      ctx.fillStyle = '#ffd34e';
      ctx.font = `bold ${Math.round(s * 2)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y + s * 0.7);
    }
  } else {
    ctx.fillStyle = '#222';
    roundRect(ctx, x - s * 0.45, y - s * 0.75, s * 0.9, s * 1.5, 3);
    ctx.fill();
    ctx.fillStyle = '#6cf';
    ctx.fillRect(x - s * 0.33, y - s * 0.6, s * 0.66, s * 1.1);
  }
}

function drawHud(ctx, game, w) {
  const pad = 12, barW = Math.min(w - 2 * pad - 110, 260), barH = 16;
  // Trust bar
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  roundRect(ctx, pad - 4, pad - 4, barW + 8, barH + 26, 8);
  ctx.fill();
  ctx.fillStyle = '#333';
  ctx.fillRect(pad, pad + 18, barW, barH);
  const tv = game.trust.value / 100;
  ctx.fillStyle = tv > 0.5 ? '#5fcf6a' : tv > 0.25 ? '#f0c040' : '#e5483c';
  ctx.fillRect(pad, pad + 18, barW * tv, barH);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`TRUST ${Math.round(game.trust.value)}`, pad, pad + 12);

  // Score
  ctx.textAlign = 'right';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(String(game.score), w - pad, pad + 16);
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`mischief ${game.mischief}`, w - pad, pad + 32);

  // Walk progress
  const prog = clamp(-game.owner.y / game.walkDistance, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(pad, pad + 42, barW, 4);
  ctx.fillStyle = '#fff';
  ctx.fillRect(pad, pad + 42, barW * prog, 4);

  if (game.leash.tangled) {
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#ff5a4e';
    ctx.fillText('TANGLED!', w / 2, pad + 80);
  }
}

function circle(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
  ctx.fill();
}

function ring(ctx, x, y, r, width) {
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
