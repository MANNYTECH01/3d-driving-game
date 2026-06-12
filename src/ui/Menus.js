import { WHEEL_STYLES } from '../vehicle/Car.js';

/**
 * Menus - wires every DOM panel: main menu, garage (paint / wheels /
 * upgrades), settings, pause and game over. Persists choices through
 * SaveManager and applies them to the live game immediately.
 */
const COLORS = ['#e0312e', '#1f6feb', '#f2c200', '#19b35f', '#f5f5f5', '#222428', '#ff7a00', '#8e44ad'];
const UPGRADES = [
  { key: 'engine', name: 'Engine' },
  { key: 'handling', name: 'Handling' },
  { key: 'nitro', name: 'Nitro tank' }
];
const MAX_LVL = 4;
const cost = (lvl) => (lvl + 1) * 150;

export class Menus {
  constructor(game) {
    this.game = game;
    this.$ = (id) => document.getElementById(id);
    this.panels = ['main-menu', 'garage', 'settings', 'pause-menu', 'game-over'];
    this.isTouch = matchMedia('(pointer: coarse)').matches;

    this._bind();
    this._buildGarage();
    this._syncSettings();

    game.onGameOver = (reason, run) => this._gameOver(reason, run);
    game.onPauseChanged = (paused) => {
      this._showOnly(paused ? 'pause-menu' : null);
      if (!paused) this._setTouch(true);
    };
  }

  showMain() {
    this._showOnly('main-menu');
    this.$('menu-best').textContent = 'Best score: ' + this.game.save.data.best.score;
    this._setTouch(false);
  }

  _showOnly(id) {
    this.panels.forEach((p) => this.$(p).classList.toggle('hidden', p !== id));
  }

  _setTouch(on) {
    this.$('touch-controls').classList.toggle('hidden', !(on && this.isTouch));
  }

  _bind() {
    this.$('btn-start').onclick = () => { this._showOnly(null); this.game.startRun(); this._setTouch(true); };
    this.$('btn-garage').onclick = () => { this._refreshGarage(); this._showOnly('garage'); };
    this.$('btn-settings').onclick = () => { this._syncSettings(); this._showOnly('settings'); };
    this.$('btn-garage-back').onclick = () => this.showMain();
    this.$('btn-settings-back').onclick = () => { this._applySettings(); this.showMain(); };
    this.$('btn-resume').onclick = () => this.game.togglePause();
    this.$('btn-quit').onclick = () => { this.game.quitToMenu(); this.showMain(); };
    this.$('btn-restart').onclick = () => { this._showOnly(null); this.game.startRun(); this._setTouch(true); };
    this.$('btn-menu').onclick = () => { this.game.quitToMenu(); this.showMain(); };
    this.$('opt-quality').onchange = () => this._applySettings();
    this.$('opt-bloom').onchange = () => this._applySettings();
    this.$('opt-sound').onchange = () => this._applySettings();
  }

  // ---------------- Settings ----------------
  _applySettings() {
    const s = this.game.save.data.settings;
    s.quality = this.$('opt-quality').value;
    s.bloom = this.$('opt-bloom').checked;
    s.sound = this.$('opt-sound').checked;
    this.game.save.save();
    this.game.applySettings(s);
  }

  _syncSettings() {
    const s = this.game.save.data.settings;
    this.$('opt-quality').value = s.quality;
    this.$('opt-bloom').checked = s.bloom;
    this.$('opt-sound').checked = s.sound;
  }

  // ---------------- Garage ----------------
  _buildGarage() {
    const g = this.game.save.data.garage;
    const cs = this.$('color-swatches');
    COLORS.forEach((c) => {
      const d = document.createElement('div');
      d.className = 'swatch';
      d.style.background = c;
      d.dataset.color = c;
      d.onclick = () => { g.color = c; this._applyGarage(); };
      cs.appendChild(d);
    });

    const ws = this.$('wheel-swatches');
    WHEEL_STYLES.forEach((w, i) => {
      const d = document.createElement('div');
      d.className = 'swatch wheel-swatch';
      d.textContent = w.name;
      d.style.background = '#' + w.color.toString(16).padStart(6, '0');
      d.style.color = i === 0 ? '#eee' : '#222';
      d.onclick = () => { g.wheel = i; this._applyGarage(); };
      ws.appendChild(d);
    });

    const ul = this.$('upgrade-list');
    UPGRADES.forEach((u) => {
      const row = document.createElement('div');
      row.className = 'upgrade-row';
      row.dataset.key = u.key;
      const name = document.createElement('span');
      name.textContent = u.name;
      const pips = document.createElement('span');
      pips.className = 'pips';
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.onclick = () => this._buyUpgrade(u.key);
      row.appendChild(name);
      row.appendChild(pips);
      row.appendChild(btn);
      ul.appendChild(row);
    });
  }

  _buyUpgrade(key) {
    const d = this.game.save.data;
    const lvl = d.garage[key];
    if (lvl >= MAX_LVL || d.totalCoins < cost(lvl)) return;
    d.totalCoins -= cost(lvl);
    d.garage[key] = lvl + 1;
    this._applyGarage();
  }

  _applyGarage() {
    this.game.save.save();
    this.game.car.applyGarage(this.game.save.data.garage);
    this._refreshGarage();
  }

  _refreshGarage() {
    const d = this.game.save.data;
    const g = d.garage;
    this.$('garage-coins').textContent = d.totalCoins;
    document.querySelectorAll('#color-swatches .swatch').forEach((s) => {
      s.classList.toggle('active', s.dataset.color === g.color);
    });
    document.querySelectorAll('#wheel-swatches .swatch').forEach((s, i) => {
      s.classList.toggle('active', i === g.wheel);
    });
    document.querySelectorAll('.upgrade-row').forEach((row) => {
      const key = row.dataset.key;
      const lvl = g[key];
      row.querySelector('.pips').textContent = '\u25CF'.repeat(lvl) + '\u25CB'.repeat(MAX_LVL - lvl);
      const btn = row.querySelector('button');
      if (lvl >= MAX_LVL) {
        btn.textContent = 'MAX';
        btn.disabled = true;
      } else {
        btn.textContent = 'Buy ' + cost(lvl);
        btn.disabled = d.totalCoins < cost(lvl);
      }
    });
  }

  // ---------------- Game over ----------------
  _gameOver(reason, run) {
    this.$('go-title').textContent = reason;
    this.$('go-score').textContent = run.score;
    this.$('go-distance').textContent = (run.distance / 1000).toFixed(2);
    this.$('go-coins').textContent = run.coins;
    const lb = this.$('leaderboard-list');
    lb.innerHTML = '';
    this.game.save.data.leaderboard.forEach((e) => {
      const li = document.createElement('li');
      li.textContent = e.score + ' pts - ' + (e.distance / 1000).toFixed(2) + ' km (' + e.date + ')';
      lb.appendChild(li);
    });
    this._showOnly('game-over');
    this._setTouch(false);
  }
}
