// Collapsible tuning panel: a control-scheme toggle, a live slider per config value,
// copy-as-JSON and reset.

import { config, SCHEMA, saveConfig, resetConfig } from '../config.js';
import { CONTROL_NAMES } from '../input.js';

export function createTuningPanel(root, { onRestart }) {
  const inputs = {};
  const body = root.querySelector('.panel-body');

  for (const [group, params] of SCHEMA) {
    const h = document.createElement('h3');
    h.textContent = group;
    body.appendChild(h);
    for (const [key, label, min, max, step] of params) {
      const row = document.createElement('label');
      row.className = 'row';
      row.innerHTML = `<span class="name"></span><input type="range"><output></output>`;
      row.querySelector('.name').textContent = label;
      const input = row.querySelector('input');
      const out = row.querySelector('output');
      Object.assign(input, { min, max, step });
      input.addEventListener('input', () => {
        config[key] = Number(input.value);
        out.textContent = format(config[key]);
        saveConfig();
      });
      inputs[key] = { input, out };
      body.appendChild(row);
    }
  }

  const controls = root.querySelector('[data-action=controls]');
  const sync = () => {
    controls.textContent = `Controls: ${CONTROL_NAMES[config.controlMode] ?? CONTROL_NAMES[0]}`;
    for (const [key, { input, out }] of Object.entries(inputs)) {
      input.value = config[key];
      out.textContent = format(config[key]);
    }
  };
  sync();

  controls.addEventListener('click', () => {
    config.controlMode = (config.controlMode + 1) % CONTROL_NAMES.length;
    saveConfig();
    sync();
  });
  root.querySelector('[data-action=copy]').addEventListener('click', async (e) => {
    const json = JSON.stringify(config, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      flash(e.currentTarget, 'Copied!');
    } catch {
      window.prompt('Copy the config:', json);
    }
  });
  root.querySelector('[data-action=reset]').addEventListener('click', (e) => {
    resetConfig();
    sync();
    flash(e.currentTarget, 'Reset');
  });
  root.querySelector('[data-action=restart]').addEventListener('click', onRestart);
}

function format(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, '');
}

function flash(button, text) {
  const old = button.textContent;
  button.textContent = text;
  setTimeout(() => { button.textContent = old; }, 900);
}
