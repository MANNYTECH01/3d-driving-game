import * as THREE from 'three';

/** Wheel rim styles selectable in the garage. */
export const WHEEL_STYLES = [
  { name: 'Sport', color: 0x23252b },
  { name: 'Chrome', color: 0xc4ccd8 },
  { name: 'Gold', color: 0xcaa42a }
];

/**
 * Car - the player's vehicle. Contains both the procedural mesh and the
 * arcade physics model.
 *
 * Physics model: the car keeps two angles - `yaw` (where the nose points)
 * and `travel` (the direction the chassis actually moves). `travel` chases
 * `yaw` at a rate controlled by grip; lowering grip (handbrake) makes the
 * two diverge, which is what produces drift. All physics live in this class
 * so a cannon-es RaycastVehicle could replace it without touching the rest
 * of the game.
 *
 * Conventions: the car drives toward -Z, the road is centered on X = 0.
 */
export class Car {
  constructor(scene) {
    this.scene = scene;
    this._buildMesh();
    this._railPoint = new THREE.Vector3();
    this._rearPoint = new THREE.Vector3();
    this.applyGarage({ color: '#e0312e', wheel: 0, engine: 0, handling: 0, nitro: 0 });
    this.reset();
  }

  /** Applies garage configuration: paint, wheels and upgrade-derived stats. */
  applyGarage(cfg) {
    this.bodyMat.color.set(cfg.color);
    this.wheelMat.color.setHex(WHEEL_STYLES[cfg.wheel % WHEEL_STYLES.length].color);
    this.maxSpeed = 47 + cfg.engine * 5;        // m/s (~169 to 241 km/h)
    this.accel = 16 + cfg.engine * 2.5;          // m/s^2
    this.grip = 5.5 + cfg.handling * 0.9;        // travel-follows-yaw rate
    this.nitroMax = 1 + cfg.nitro * 0.35;        // seconds of boost stored
  }

  reset() {
    this.group.position.set(0, 0, 0);
    this.group.rotation.set(0, 0, 0);
    this.speed = 0;
    this.yaw = 0;
    this.travel = 0;
    this.nitro = this.nitroMax;
    this.nitroActive = false;
    this.isDrifting = false;
  }

  get position() { return this.group.position; }
  get distance() { return -this.group.position.z; }
  get speedNorm() { return Math.min(1, this.speed / (this.maxSpeed * 1.35)); }

  /** World point behind the rear axle, used for smoke/nitro particles. */
  rearPoint() {
    return this._rearPoint.set(this.group.position.x, 0.3, this.group.position.z + 2.0);
  }

  onCollision() { this.speed *= 0.35; }

  setHeadlights(on) {
    const i = on ? 5 : 0;
    this.lampL.intensity = i;
    this.lampR.intensity = i;
    this.headMat.emissiveIntensity = on ? 2.4 : 1.2;
  }

  /** Main physics + visual step. */
  update(dt, input, game) {
    // --- Nitro: drains while active, slowly recharges otherwise ---
    this.nitroActive = input.nitro && this.nitro > 0.05 && this.speed > 5;
    if (this.nitroActive) this.nitro = Math.max(0, this.nitro - dt * 0.5);
    else this.nitro = Math.min(this.nitroMax, this.nitro + dt * 0.12);
    const nitroMul = this.nitroActive ? 1.35 : 1;

    // --- Longitudinal: throttle, brake, drag ---
    this.speed += input.throttle * this.accel * nitroMul * dt;
    this.speed -= input.brake * 30 * dt;
    this.speed -= this.speed * 0.22 * dt;                 // drag + rolling resistance
    if (input.handbrake) this.speed -= this.speed * 1.1 * dt;
    this.speed = THREE.MathUtils.clamp(this.speed, 0, this.maxSpeed * nitroMul);

    // --- Steering: less sensitive at high speed ---
    const speedFactor = 1 - Math.min(this.speed / this.maxSpeed, 1) * 0.55;
    const targetYaw = input.steer * 0.5 * speedFactor;
    this.yaw += (targetYaw - this.yaw) * Math.min(1, dt * 8);

    // --- Grip: travel direction chases the nose; handbrake breaks grip ---
    const grip = input.handbrake ? 1.6 : this.grip;
    this.travel += (this.yaw - this.travel) * Math.min(1, dt * grip);
    this.isDrifting = Math.abs(this.yaw - this.travel) > 0.08 && this.speed > 10;

    // --- Integrate position ---
    this.group.position.x += Math.sin(this.travel) * this.speed * dt;
    this.group.position.z -= Math.cos(this.travel) * this.speed * dt;

    // --- Guardrails ---
    const limit = 6.1;
    if (Math.abs(this.group.position.x) > limit) {
      const side = Math.sign(this.group.position.x);
      this.group.position.x = limit * side;
      if (this.speed > 10) {
        this.speed *= 0.92;
        game.onRailScrape(this._railPoint.set(this.group.position.x + side * 0.95, 0.5, this.group.position.z));
      }
      this.yaw *= 0.5;
      this.travel *= 0.5;
    }

    // --- Visuals: orientation, body roll, wheel spin and steer ---
    this.group.rotation.y = -this.travel;
    this.group.rotation.z = THREE.MathUtils.clamp((this.travel - this.yaw) * 1.2, -0.12, 0.12);
    this.group.rotation.x = -input.throttle * 0.015 + input.brake * 0.02;
    const spin = (this.speed * dt) / 0.34;
    for (const w of this.wheelsSpin) w.rotation.x -= spin;
    for (const p of this.frontPivots) p.rotation.y = -input.steer * 0.42;
  }

  // ------------------------------------------------------------------
  // Mesh construction (procedural; swap for a GLTF model if desired)
  // ------------------------------------------------------------------
  _buildMesh() {
    this.group = new THREE.Group();
    this.bodyMat = new THREE.MeshStandardMaterial({ color: 0xe0312e, metalness: 0.6, roughness: 0.35 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x10131a, metalness: 0.9, roughness: 0.15 });
    this.wheelMat = new THREE.MeshStandardMaterial({ color: 0x23252b, roughness: 0.6, metalness: 0.5 });
    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x141619, roughness: 1 });
    this.headMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3c4, emissiveIntensity: 1.2 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0x550000, emissive: 0xff2222, emissiveIntensity: 1.4 });

    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.group.add(m);
      return m;
    };

    add(new THREE.BoxGeometry(1.9, 0.5, 4.4), this.bodyMat, 0, 0.45, 0);          // chassis
    add(new THREE.BoxGeometry(1.7, 0.28, 0.9), this.bodyMat, 0, 0.36, -2.0);      // nose
    add(new THREE.BoxGeometry(1.55, 0.45, 2.0), glassMat, 0, 0.88, 0.25);          // cabin
    add(new THREE.BoxGeometry(1.8, 0.07, 0.45), this.bodyMat, 0, 1.0, 2.05);       // spoiler
    add(new THREE.BoxGeometry(0.08, 0.26, 0.08), this.bodyMat, -0.7, 0.82, 2.05);  // spoiler struts
    add(new THREE.BoxGeometry(0.08, 0.26, 0.08), this.bodyMat, 0.7, 0.82, 2.05);
    add(new THREE.BoxGeometry(0.3, 0.12, 0.06), this.headMat, -0.62, 0.5, -2.21);  // headlights
    add(new THREE.BoxGeometry(0.3, 0.12, 0.06), this.headMat, 0.62, 0.5, -2.21);
    add(new THREE.BoxGeometry(0.34, 0.12, 0.06), tailMat, -0.62, 0.55, 2.21);      // taillights
    add(new THREE.BoxGeometry(0.34, 0.12, 0.06), tailMat, 0.62, 0.55, 2.21);

    // Wheels: a steering pivot containing a spinning group (tyre + rim).
    const tyreGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.32, 18);
    tyreGeo.rotateZ(Math.PI / 2);
    const rimGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.34, 8);
    rimGeo.rotateZ(Math.PI / 2);
    this.wheelsSpin = [];
    this.frontPivots = [];
    for (const [x, z, front] of [[-0.95, -1.45, true], [0.95, -1.45, true], [-0.95, 1.45, false], [0.95, 1.45, false]]) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0.34, z);
      const spinGroup = new THREE.Group();
      const tyre = new THREE.Mesh(tyreGeo, tyreMat);
      tyre.castShadow = true;
      spinGroup.add(tyre);
      spinGroup.add(new THREE.Mesh(rimGeo, this.wheelMat));
      pivot.add(spinGroup);
      this.group.add(pivot);
      this.wheelsSpin.push(spinGroup);
      if (front) this.frontPivots.push(pivot);
    }

    // Headlight spotlights (intensity is set by setHeadlights at night).
    this.lampL = this._makeLamp(-0.6);
    this.lampR = this._makeLamp(0.6);

    this.scene.add(this.group);
  }

  _makeLamp(x) {
    const lamp = new THREE.SpotLight(0xfff2cc, 0, 55, 0.45, 0.5, 1.2);
    lamp.position.set(x, 0.7, -2.0);
    lamp.target.position.set(x, 0, -25);
    this.group.add(lamp);
    this.group.add(lamp.target);
    return lamp;
  }
}
