/**
 * HUD - the in-game DOM overlay (speed, bars, timer, coins, mission text)
 * plus a canvas minimap showing the road, traffic, coins and the next
 * checkpoint relative to the player.
 */
export class HUD {
  constructor() {
    const $ = (id) => document.getElementById(id);
    this.el = $('hud');
    this.speed = $('speed-value');
    this.coin = $('coin-count');
    this.timer = $('timer');
    this.distance = $('distance');
    this.mission = $('mission-text');
    this.health = $('health-fill');
    this.fuel = $('fuel-fill');
    this.nitroBar = $('nitro-fill');
    this.map = $('minimap');
    this.ctx = this.map.getContext('2d');
    this._flashUntil = 0;
    this._flashText = '';
  }

  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }

  /** Temporarily overrides the mission line (checkpoints, fuel pickups...). */
  flash(text) {
    this._flashText = text;
    this._flashUntil = performance.now() + 2200;
  }

  update(game) {
    const run = game.run;
    const car = game.car;
    this.speed.textContent = Math.round(car.speed * 3.6);
    this.coin.textContent = run.coins;
    this.distance.textContent = (run.distance / 1000).toFixed(1) + ' km';
    const m = Math.floor(run.time / 60);
    const s = Math.floor(run.time % 60);
    this.timer.textContent = m + ':' + String(s).padStart(2, '0');
    this.health.style.width = run.health + '%';
    this.fuel.style.width = run.fuel + '%';
    this.nitroBar.style.width = (car.nitro / car.nitroMax) * 100 + '%';

    if (performance.now() < this._flashUntil) {
      this.mission.textContent = this._flashText;
      this.mission.classList.add('flash');
    } else {
      const d = Math.max(0, Math.round(-game.checkpoints.nextZ - run.distance));
      this.mission.textContent = 'Checkpoint in ' + d + ' m';
      this.mission.classList.remove('flash');
    }

    this._drawMinimap(game);
  }

  _drawMinimap(game) {
    const ctx = this.ctx;
    const W = 140, H = 190;
    const pz = game.car.position.z;
    const toX = (x) => W / 2 + x * 4;
    const toY = (z) => 150 - (pz - z) * 0.5; // ~280 m visible ahead

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(5,8,16,0.55)';
    ctx.fillRect(0, 0, W, H);
    // Road band
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(W / 2 - 28, 0, 56, H);

    // Next checkpoint
    const cy = toY(game.checkpoints.nextZ);
    if (cy > 0 && cy < H) {
      ctx.fillStyle = '#36d6ff';
      ctx.fillRect(W / 2 - 28, cy, 56, 3);
    }
    // Coins
    ctx.fillStyle = '#ffd24d';
    for (const cl of game.pickups.clusters) {
      for (const c of cl.coins) {
        if (c.taken) continue;
        const y = toY(c.mesh.position.z);
        if (y < 0 || y > H) continue;
        ctx.fillRect(toX(c.mesh.position.x) - 1.5, y - 1.5, 3, 3);
      }
    }
    // Traffic
    ctx.fillStyle = '#ff5d5d';
    for (const c of game.traffic.cars) {
      const y = toY(c.z);
      if (y < 0 || y > H) continue;
      ctx.fillRect(toX(c.mesh.position.x) - 3, y - 5, 6, 10);
    }
    // Player
    const px = toX(game.car.position.x);
    ctx.fillStyle = '#5ad1ff';
    ctx.beginPath();
    ctx.moveTo(px, 142);
    ctx.lineTo(px - 5, 156);
    ctx.lineTo(px + 5, 156);
    ctx.closePath();
    ctx.fill();
  }
}
