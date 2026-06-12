import * as THREE from 'three';

/**
 * Pickups - coin clusters (lines of 6 coins in a lane) plus rare fuel cans.
 * Items recycle ahead of the player when collected or left behind.
 */
const LANES = [-4, 0, 4];
const CLUSTERS = 4;
const COINS_PER_CLUSTER = 6;

export class Pickups {
  constructor(scene) {
    this.scene = scene;
    this.rot = 0;

    const coinGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.09, 18);
    coinGeo.rotateX(Math.PI / 2);
    const coinMat = new THREE.MeshStandardMaterial({
      color: 0xffd24d, emissive: 0xb98a00, emissiveIntensity: 0.7, metalness: 0.8, roughness: 0.3
    });
    this.clusters = [];
    for (let i = 0; i < CLUSTERS; i++) {
      const coins = [];
      for (let j = 0; j < COINS_PER_CLUSTER; j++) {
        const mesh = new THREE.Mesh(coinGeo, coinMat);
        scene.add(mesh);
        coins.push({ mesh, taken: false });
      }
      this.clusters.push({ coins });
    }

    const canGeo = new THREE.BoxGeometry(0.7, 0.9, 0.45);
    const canMat = new THREE.MeshStandardMaterial({
      color: 0x2ecc71, emissive: 0x0f6b38, emissiveIntensity: 0.5, roughness: 0.5
    });
    this.cans = [];
    for (let i = 0; i < 2; i++) {
      const mesh = new THREE.Mesh(canGeo, canMat);
      scene.add(mesh);
      this.cans.push({ mesh, taken: false });
    }
  }

  reset(playerZ = 0) {
    this.clusters.forEach((cl, i) => this._placeCluster(cl, playerZ - 90 - i * 100));
    this.cans.forEach((c, i) => this._placeCan(c, playerZ - 250 - i * 350));
  }

  _placeCluster(cl, z0) {
    const lane = LANES[Math.floor(Math.random() * 3)];
    cl.coins.forEach((c, j) => {
      c.taken = false;
      c.mesh.visible = true;
      c.mesh.position.set(lane, 0.9, z0 - j * 4);
    });
  }

  _placeCan(c, z0) {
    c.taken = false;
    c.mesh.visible = true;
    c.mesh.position.set(LANES[Math.floor(Math.random() * 3)], 0.5, z0 - Math.random() * 120);
  }

  update(dt, car, game) {
    this.rot += dt * 3;
    const pz = car.position.z;
    const px = car.position.x;

    for (const cl of this.clusters) {
      let allGone = true;
      for (const c of cl.coins) {
        if (c.taken) continue;
        c.mesh.rotation.y = this.rot;
        const m = c.mesh.position;
        if (m.z > pz + 20) { c.taken = true; c.mesh.visible = false; continue; }
        allGone = false;
        if (Math.abs(m.x - px) < 1.5 && Math.abs(m.z - pz) < 1.8) {
          c.taken = true;
          c.mesh.visible = false;
          game.collectCoin(m);
        }
      }
      if (allGone) this._placeCluster(cl, pz - 160 - Math.random() * 220);
    }

    for (const c of this.cans) {
      if (c.taken) continue;
      c.mesh.rotation.y = this.rot * 0.7;
      const m = c.mesh.position;
      if (m.z > pz + 20) { this._placeCan(c, pz - 300); continue; }
      if (Math.abs(m.x - px) < 1.6 && Math.abs(m.z - pz) < 1.9) {
        game.collectFuel();
        this._placeCan(c, pz - 400 - Math.random() * 200);
      }
    }
  }
}
