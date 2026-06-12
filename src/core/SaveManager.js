/**
 * SaveManager - persists progress, garage configuration, settings and a
 * top-5 local leaderboard to localStorage.
 */
const KEY = 'velocity-drive-save-v1';

export class SaveManager {
  constructor() {
    this.data = this._defaults();
    this.load();
  }

  _defaults() {
    return {
      totalCoins: 0,
      best: { score: 0, distance: 0 },
      leaderboard: [],
      garage: { color: '#e0312e', wheel: 0, engine: 0, handling: 0, nitro: 0 },
      settings: { quality: this._autoQuality(), bloom: true, sound: true }
    };
  }

  /** Coarse-pointer devices (phones/tablets) default to low quality. */
  _autoQuality() {
    try {
      return matchMedia('(pointer: coarse)').matches ? 'low' : 'high';
    } catch (e) {
      return 'medium';
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      const def = this._defaults();
      this.data = {
        ...def,
        ...d,
        best: { ...def.best, ...(d.best || {}) },
        garage: { ...def.garage, ...(d.garage || {}) },
        settings: { ...def.settings, ...(d.settings || {}) }
      };
    } catch (e) {
      /* corrupted save - keep defaults */
    }
  }

  save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch (e) {
      /* storage unavailable (private mode) - ignore */
    }
  }

  /** Records a finished run: banks coins, updates best and leaderboard. */
  addRunResult({ score, distance, coins }) {
    this.data.totalCoins += coins;
    if (score > this.data.best.score) this.data.best = { score, distance };
    this.data.leaderboard.push({ score, distance, date: new Date().toISOString().slice(0, 10) });
    this.data.leaderboard.sort((a, b) => b.score - a.score);
    this.data.leaderboard = this.data.leaderboard.slice(0, 5);
    this.save();
  }
}
