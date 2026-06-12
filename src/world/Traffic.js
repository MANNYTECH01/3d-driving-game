import * as THREE from 'three';

/**
 * Traffic - pool of AI-driven vehicles that share the road with the player.
 * Cars drive forward (-Z) in one of three lanes at varied speeds, respawn
 * ahead once they fall behind, and trigger crashes on AABB overlap.
 */
const LANES = [-4, 0, 4];
const COLORS = [0x8d99a6, 0x4a6fa5, 0x9a4a4a, 0x4a8a5d, 0xb8ad8f, 0x6b5aa3];
const POOL_SIZE = 8;

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this._glass = new THREE.MeshStandardMaterial({ color: 0x14171f, metalness: 0.8, roughness: 0.25 });
    this._tail = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 1.2 });
    this._tyre = new THREE.MeshStandardMaterial({ color: 0x141619, roughness: 1 });
    this._wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.25, 10);
    this._wheelGeo.rotateZ(Math.PI / 2);
    for (let i = 0; i < POOL_SIZE; i++) this.cars.push(this._create(i));
    this._crashPos = new THREE.Vector3();
  }

  _create(i) {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: COLORS[i % COLORS.length], metalness: 0.4, roughness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.55, 4.0), bodyMat);
    body.position.y = 0.45;
    body.castShadow = true;
    g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.8), this._glass);
    cabin.position.set(0, 0.85, 0.1);
    g.add(cabin);
    for (const x of [-0.55, 0.55]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.06), this._tail);
      t.position.set(x, 0.5, 2.01);
      g.add(t);
    }
    for (const [x, z] of [[-0.9, -1.3], [0.9, -1.3], [-0.9, 1.3], [0.9, 1.3]]) {
      const w = new THREE.Mesh(this._wheelGeo, this._tyre);
      w.position.set(x, 0.3, z);
      g.add(w);
    }
    this.scene.add(g);
    return { mesh: g, z: 0, lane: 0, speed: 15, overtaken: false };
  }

  reset(playerZ = 0) {
    this.cars.forEach((c, i) => {
      c.z = playerZ - 70 - i * 45;
      c.lane = i % 3;
      c.speed = 11 + Math.random() * 14;
      c.overtaken = false;
      this._place(c);
    });
  }

  _place(c) {
    c.mesh.position.set(LANES[c.lane], 0, c.z);
  }

  respawn(c, playerZ) {
    c.z = playerZ - 140 - Math.random() * 280;
    c.lane = Math.floor(Math.random() * 3);
    c.speed = 11 + Math.random() * 15;
    c.overtaken = false;
    // Keep spacing inside a lane to avoid impossible walls of cars.
    for (const o of this.cars) {
      if (o !== c && o.lane === c.lane && Math.abs(o.z - c.z) < 22) c.z -= 30;
    }
    this._place(c);
  }

  update(dt, car, game) {
    const pz = car.position.z;
    const px = car.position.x;
    for (const c of this.cars) {
      c.z -= c.speed * dt;
      c.mesh.position.z = c.z;
      if (c.z > pz + 30) { this.respawn(c, pz); continue; }
      if (!c.overtaken && c.z > pz + 4) {
        c.overtaken = true;
        game.run.overtakes++;
      }
      // Simple AABB collision with the player.
      if (Math.abs(LANES[c.lane] - px) < 1.95 && Math.abs(c.z - pz) < 3.9) {
        this._crashPos.set((LANES[c.lane] + px) / 2, 0.6, c.z);
        game.onCrash(1, this._crashPos);
        this.respawn(c, pz - 60); // push it far ahead to avoid repeat hits
      }
    }
  }
}
