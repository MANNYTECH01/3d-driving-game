import * as THREE from 'three';

/**
 * DayNightCycle - interpolates sky/fog colors, sun intensity and elevation
 * through keyframes over a repeating cycle, and runs a simple weather state
 * machine (clear / rain / fog) that adjusts fog distance.
 *
 * The directional sun follows the player so its shadow camera always covers
 * the action.
 */
const KEYS = [
  { t: 0.0, sky: 0x7ec3f2, fog: 0xbcd8ee, sun: 1.25, hemi: 0.85, elev: 0.9 },  // day
  { t: 0.35, sky: 0x86b6e8, fog: 0xc6d4e4, sun: 1.0, hemi: 0.75, elev: 0.6 },
  { t: 0.48, sky: 0xf2924a, fog: 0xe3a06b, sun: 0.55, hemi: 0.45, elev: 0.25 }, // sunset
  { t: 0.58, sky: 0x0b1026, fog: 0x0c1226, sun: 0.05, hemi: 0.16, elev: 0.05 }, // night
  { t: 0.85, sky: 0x0b1026, fog: 0x0c1226, sun: 0.05, hemi: 0.16, elev: 0.05 },
  { t: 0.93, sky: 0xd9774f, fog: 0xd2906b, sun: 0.5, hemi: 0.4, elev: 0.2 },    // dawn
  { t: 1.0, sky: 0x7ec3f2, fog: 0xbcd8ee, sun: 1.25, hemi: 0.85, elev: 0.9 }
];
const CYCLE_SECONDS = 180;

export class DayNightCycle {
  constructor(scene) {
    this.scene = scene;
    this.t = 0.1; // start mid-morning

    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3a3f35, 0.8);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff2dd, 1.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -45;
    this.sun.shadow.camera.right = 45;
    this.sun.shadow.camera.top = 45;
    this.sun.shadow.camera.bottom = -45;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 250;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun);
    scene.add(this.sun.target);

    scene.background = new THREE.Color(0x7ec3f2);
    scene.fog = new THREE.Fog(0xbcd8ee, 30, 340);

    // Weather state machine
    this.weather = 'clear';
    this._weatherTimer = 20;
    this._fogFarTarget = 340;

    this._ca = new THREE.Color();
    this._cb = new THREE.Color();
    this._sunNow = 1.2;
  }

  get isNight() { return this._sunNow < 0.25; }

  update(dt, playerPos) {
    this.t = (this.t + dt / CYCLE_SECONDS) % 1;

    // Find the surrounding keyframes and interpolate.
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++) {
      if (this.t >= KEYS[i].t && this.t <= KEYS[i + 1].t) { a = KEYS[i]; b = KEYS[i + 1]; break; }
    }
    const f = (this.t - a.t) / Math.max(1e-5, b.t - a.t);

    this._ca.setHex(a.sky);
    this._cb.setHex(b.sky);
    this.scene.background.copy(this._ca).lerp(this._cb, f);
    this._ca.setHex(a.fog);
    this._cb.setHex(b.fog);
    this.scene.fog.color.copy(this._ca).lerp(this._cb, f);

    this._sunNow = a.sun + (b.sun - a.sun) * f;
    this.sun.intensity = this._sunNow;
    this.hemi.intensity = a.hemi + (b.hemi - a.hemi) * f;

    const elev = a.elev + (b.elev - a.elev) * f;
    this.sun.position.set(playerPos.x + 35, 15 + 85 * elev, playerPos.z + 25);
    this.sun.target.position.set(playerPos.x, 0, playerPos.z - 10);

    // Weather transitions
    this._weatherTimer -= dt;
    if (this._weatherTimer <= 0) {
      const r = Math.random();
      this.weather = r < 0.5 ? 'clear' : r < 0.75 ? 'rain' : 'fog';
      this._weatherTimer = 22 + Math.random() * 20;
      this._fogFarTarget = this.weather === 'clear' ? 340 : this.weather === 'rain' ? 190 : 115;
    }
    this.scene.fog.far += (this._fogFarTarget - this.scene.fog.far) * Math.min(1, dt * 0.7);
    if (this.weather === 'rain') {
      // Overcast tint (background/fog are recopied from keyframes each frame,
      // so a one-off multiply per frame is safe).
      this.scene.background.multiplyScalar(0.8);
      this.scene.fog.color.multiplyScalar(0.85);
    }
  }
}
