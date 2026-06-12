import * as THREE from 'three';

/**
 * ParticlePool - a fixed-size pool rendered as a single THREE.Points.
 * Dead particles are parked far below the world. Spawning overwrites the
 * oldest slot, so the pool never allocates at runtime.
 */
export class ParticlePool {
  constructor(scene, { count = 150, color = 0xffffff, size = 0.5, gravity = 0, opacity = 0.8 } = {}) {
    this.count = count;
    this.gravity = gravity;
    this.positions = new Float32Array(count * 3);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    for (let i = 0; i < count; i++) this.positions[i * 3 + 1] = -999;

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this._next = 0;
  }

  /** Spawns n particles at pos with base velocity vel and random spread. */
  spawn(pos, vel, life, spread, n = 1) {
    for (let k = 0; k < n; k++) {
      const i = this._next;
      this._next = (this._next + 1) % this.count;
      this.positions[i * 3] = pos.x + (Math.random() - 0.5) * spread;
      this.positions[i * 3 + 1] = pos.y + (Math.random() - 0.5) * spread;
      this.positions[i * 3 + 2] = pos.z + (Math.random() - 0.5) * spread;
      this.vel[i * 3] = vel.x + (Math.random() - 0.5) * 2;
      this.vel[i * 3 + 1] = vel.y + (Math.random() - 0.5) * 1.5;
      this.vel[i * 3 + 2] = vel.z + (Math.random() - 0.5) * 2;
      this.life[i] = life * (0.6 + Math.random() * 0.6);
    }
  }

  update(dt) {
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.positions[i * 3 + 1] = -999; continue; }
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.vel[i * 3 + 1] += this.gravity * dt;
      this.positions[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
}

/**
 * Effects - owns the particle pools (tire smoke, crash sparks) and a rain
 * field of points that falls around and wraps onto the camera.
 */
export class Effects {
  constructor(scene) {
    this.smoke = new ParticlePool(scene, { count: 200, color: 0x9b9b9b, size: 0.7, gravity: 0.6, opacity: 0.5 });
    this.sparks = new ParticlePool(scene, { count: 140, color: 0xffa53d, size: 0.22, gravity: -7, opacity: 0.95 });

    const N = (this.rainN = 900);
    this.rainPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      this.rainPos[i * 3] = (Math.random() - 0.5) * 60;
      this.rainPos[i * 3 + 1] = Math.random() * 26;
      this.rainPos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    const mat = new THREE.PointsMaterial({ color: 0x9fc2dd, size: 0.12, transparent: true, opacity: 0.55, depthWrite: false });
    this.rain = new THREE.Points(geo, mat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);
  }

  setRain(on) { this.rain.visible = on; }

  update(dt, camPos) {
    this.smoke.update(dt);
    this.sparks.update(dt);
    if (this.rain.visible) {
      const p = this.rainPos;
      for (let i = 0; i < this.rainN; i++) {
        p[i * 3 + 1] -= 26 * dt;
        if (p[i * 3 + 1] < camPos.y - 4) {
          p[i * 3 + 1] = camPos.y + 22;
          p[i * 3] = camPos.x + (Math.random() - 0.5) * 60;
          p[i * 3 + 2] = camPos.z + (Math.random() - 0.5) * 60;
        }
        if (Math.abs(p[i * 3 + 2] - camPos.z) > 40) {
          p[i * 3 + 2] = camPos.z + (Math.random() - 0.5) * 60;
        }
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }
  }
}
