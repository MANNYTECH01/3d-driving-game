import * as THREE from 'three';

/**
 * CameraRig - drives the perspective camera.
 * Modes: 'chase' (smooth third-person follow) and 'cockpit' (first-person).
 * Also handles the nitro FOV kick, crash screen shake and the slow orbit
 * used behind the menus.
 */
const FOV_BASE = 70;
const FOV_NITRO = 82;

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.mode = 'chase';
    this.shakeT = 0;
    this.menuAngle = 0;
    this._target = new THREE.Vector3();
  }

  toggleMode() {
    this.mode = this.mode === 'chase' ? 'cockpit' : 'chase';
  }

  /** Instantly places the camera (used when a run starts). */
  snap(car) {
    const p = car.position;
    this.camera.position.set(p.x * 0.8, 4.0, p.z + 8.5);
    this.camera.lookAt(p.x, 1.1, p.z - 10);
    this.camera.fov = FOV_BASE;
    this.camera.updateProjectionMatrix();
  }

  shake(amount) {
    this.shakeT = Math.min(1, this.shakeT + amount);
  }

  update(dt, car) {
    const p = car.position;
    if (this.mode === 'chase') {
      this._target.set(p.x * 0.8, 4.0, p.z + 8.5);
      this.camera.position.lerp(this._target, 1 - Math.exp(-6 * dt));
      this.camera.lookAt(p.x, 1.1, p.z - 10);
    } else {
      // Cockpit: sit at the windshield, look along the travel direction.
      this.camera.position.set(p.x, 1.18, p.z + 0.25);
      this.camera.lookAt(p.x + Math.sin(car.travel) * 10, 1.0, p.z - Math.cos(car.travel) * 10);
    }

    // Nitro FOV kick
    const fovT = car.nitroActive ? FOV_NITRO : FOV_BASE;
    this.camera.fov += (fovT - this.camera.fov) * Math.min(1, dt * 4);
    this.camera.updateProjectionMatrix();

    // Screen shake
    if (this.shakeT > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeT * 0.5;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeT * 0.4;
      this.shakeT = Math.max(0, this.shakeT - dt * 2);
    }
  }

  /** Slow orbit around the car for menu / garage backgrounds. */
  menuUpdate(dt, car) {
    this.menuAngle += dt * 0.25;
    const p = car.position;
    this.camera.position.set(
      p.x + Math.sin(this.menuAngle) * 9,
      3.2,
      p.z + Math.cos(this.menuAngle) * 9
    );
    this.camera.lookAt(p.x, 0.8, p.z);
    if (Math.abs(this.camera.fov - FOV_BASE) > 0.01) {
      this.camera.fov = FOV_BASE;
      this.camera.updateProjectionMatrix();
    }
  }
}
