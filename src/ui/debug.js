// Debug overlay: tension, trust deltas, owner state, FPS.

export function updateDebug(el, game, fps) {
  const { leash, trust, owner, dog } = game;
  const lines = [
    `fps        ${fps.toFixed(0)}`,
    `tension    ${leash.tension.toFixed(2)} (raw ${leash.rawTension.toFixed(2)})${leash.taut ? ' taut' : ''}`,
    `yank hold  ${leash.yankHold.toFixed(2)}  cooldown ${Math.max(0, leash.yankCooldown).toFixed(1)}`,
    `rope len   ${leash.length.toFixed(2)} m`,
    `winding    ${(leash.winding * 180 / Math.PI).toFixed(0)}°${leash.tangled ? '  TANGLED' : ''}`,
    `owner      ${owner.attention} ${owner.attentionTimer.toFixed(1)}s  ${owner.speed.toFixed(2)} m/s${owner.busy ? '  BUSY ' + owner.busy.reason : ''}`,
    `chain      x${game.chain.count} ${Math.max(0, game.chain.timer).toFixed(1)}s  critters ${game.critters.length}`,
    `dog speed  ${Math.hypot(dog.vx, dog.vy).toFixed(2)} m/s  intent ${dog.intent.toFixed(2)}`,
    `trust      ${trust.value.toFixed(1)}  -${trust.drainRate.toFixed(1)}/s  +${trust.gainRate.toFixed(1)}/s`,
    `walked     ${(-owner.y).toFixed(0)} / ${game.walkDistance} m  t=${game.time.toFixed(0)}s`,
    ...trust.log.map((e) => `  ${e.time.toFixed(1)}s ${e.delta > 0 ? '+' : ''}${e.delta.toFixed(0)} ${e.reason}`),
  ];
  el.textContent = lines.join('\n');
}
