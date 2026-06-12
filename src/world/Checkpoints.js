import * as THREE from 'three';

/**
 * Checkpoints - a glowing gate every INTERVAL meters. Passing it rewards
 * the player (handled in Game.onCheckpoint) and moves the gate forward.
 */
const INTERVAL = 600;

export class Checkpoints {
  constructor(scene) {
    this.gate = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ad, metalness: 0.6, roughness: 0.4 });
    for (const x of [-7, 7]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.45, 5, 0.45), postMat);
      post.position.set(x, 2.5, 0);
      post.castShadow = true;
      this.gate.add(post);
    }
    const banner = new THREE.Mesh(
      new THREE.BoxGeometry(14.9, 1.1, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x0c2233, emissive: 0x36d6ff, emissiveIntensity: 1.2 })
    );
    banner.position.set(0, 4.6, 0);
    this.gate.add(banner);
    scene.add(this.gate);
    this.reset();
  }

  reset() {
    this.nextZ = -INTERVAL;
    this.gate.position.z = this.nextZ;
  }

  update(car, game) {
    if (car.position.z <= this.nextZ) {
      game.onCheckpoint();
      this.nextZ -= INTERVAL;
      this.gate.position.z = this.nextZ;
    }
  }
}
