import * as THREE from 'three';
import { InputManager } from './InputManager.js';
import { AudioManager } from './AudioManager.js';
import { SaveManager } from './SaveManager.js';
import { Car } from '../vehicle/Car.js';
import { RoadGenerator } from '../world/RoadGenerator.js';
import { Traffic } from '../world/Traffic.js';
import { Pickups } from '../world/Pickups.js';
import { Checkpoints } from '../world/Checkpoints.js';
import { DayNightCycle } from '../world/DayNightCycle.js';
import { Effects } from '../effects/Particles.js';
import { CameraRig } from '../effects/CameraRig.js';
import { PostFX } from '../effects/PostProcessing.js';
import { HUD } from '../ui/HUD.js';

/**
 * Game - top-level orchestrator and state machine.
 * States: 'menu' | 'playing' | 'paused' | 'gameover'.
 * World subsystems report events back through the hook methods at the
 * bottom (onCrash, collectCoin, onCheckpoint, ...).
 */
export class Game {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 600);
    this.clock = new THREE.Clock();

    this.save = new SaveManager();
    this.input = new InputManager();
    this.audio = new AudioManager();

    this.state = 'menu';
    this.run = this._freshRun();

    // Wired by Menus
    this.onGameOver = null;
    this.onPauseChanged = null;

    this.input.onPause = () => this.togglePause();
    this.input.onCamera = () => { if (this.cameraRig) this.cameraRig.toggleMode(); };

    window.addEventListener('resize', () => this._resize());
  }

  /** Builds all world subsystems. Split out so the loading screen can show progress. */
  initWorld() {
    this.dayNight = new DayNightCycle(this.scene);
    this.road = new RoadGenerator(this.scene);
    this.car = new Car(this.scene);
    this.car.applyGarage(this.save.data.garage);
    this.traffic = new Traffic(this.scene);
    this.pickups = new Pickups(this.scene);
    this.checkpoints = new Checkpoints(this.scene);
    this.effects = new Effects(this.scene);
    this.cameraRig = new CameraRig(this.camera);
    this.hud = new HUD();
    this.postfx = new PostFX(this.renderer, this.scene, this.camera);
    this.applySettings(this.save.data.settings);
    this.traffic.reset(0);
    this.pickups.reset(0);
  }

  _freshRun() {
    return { distance: 0, time: 0, coins: 0, health: 100, fuel: 100, overtakes: 0, score: 0 };
  }

  /** Starts the requestAnimationFrame loop (runs in every state). */
  start() {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05);
      this.update(dt);
      this.render();
    };
    loop();
  }

  update(dt) {
    if (this.state === 'paused') return;

    this.dayNight.update(dt, this.car.position);
    this.effects.setRain(this.dayNight.weather === 'rain');
    this.effects.update(dt, this.camera.position);
    this.car.setHeadlights(this.dayNight.isNight);

    if (this.state === 'playing') {
      const run = this.run;
      const car = this.car;
      this.input.update(dt);
      car.update(dt, this.input, this);
      run.distance = car.distance;
      run.time += dt;

      // Fuel burn scales with speed; idling burns less.
      run.fuel -= (2.2 + car.speedNorm * 4.5) * dt * (this.input.throttle > 0 ? 1 : 0.45);
      if (run.fuel <= 0) {
        run.fuel = 0;
        this.endRun('OUT OF FUEL');
        return;
      }

      this.road.update(car.position.z);
      this.traffic.update(dt, car, this);
      this.pickups.update(dt, car, this);
      this.checkpoints.update(car, this);

      if (car.isDrifting) this.effects.smoke.spawn(car.rearPoint(), { x: 0, y: 1.2, z: 2 }, 0.8, 0.7, 2);
      if (car.nitroActive) this.effects.smoke.spawn(car.rearPoint(), { x: 0, y: 0.5, z: 3 }, 0.5, 0.4, 1);

      this.audio.update(car.speedNorm, this.input.throttle, car.isDrifting, car.nitroActive);
      this.hud.update(this);
      this.cameraRig.update(dt, car);
    } else {
      // Menu / game over: slow orbit around the car keeps the scene alive.
      this.cameraRig.menuUpdate(dt, this.car);
      this.road.update(this.car.position.z);
    }
  }

  render() {
    this.postfx.render();
  }

  // ------------------------------------------------------------------
  // State transitions
  // ------------------------------------------------------------------
  startRun() {
    this.run = this._freshRun();
    this.car.applyGarage(this.save.data.garage);
    this.car.reset();
    this.road.reset();
    this.traffic.reset(0);
    this.pickups.reset(0);
    this.checkpoints.reset();
    this.audio.init(); // requires the user gesture that triggered this
    this.audio.setEngineActive(true);
    this.hud.show();
    this.cameraRig.snap(this.car);
    this.clock.getDelta();
    this.state = 'playing';
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.audio.setEngineActive(false);
      if (this.onPauseChanged) this.onPauseChanged(true);
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.audio.setEngineActive(true);
      this.clock.getDelta(); // discard the time spent paused
      if (this.onPauseChanged) this.onPauseChanged(false);
    }
  }

  quitToMenu() {
    this.state = 'menu';
    this.audio.setEngineActive(false);
    this.hud.hide();
  }

  endRun(reason) {
    if (this.state !== 'playing') return;
    this.state = 'gameover';
    this.audio.setEngineActive(false);
    this.hud.hide();
    const run = this.run;
    run.score = Math.floor(run.distance) + run.coins * 50 + run.overtakes * 20;
    this.save.addRunResult({ score: run.score, distance: run.distance, coins: run.coins });
    if (this.onGameOver) this.onGameOver(reason, run);
  }

  // ------------------------------------------------------------------
  // World event hooks
  // ------------------------------------------------------------------
  onCrash(severity, pos) {
    this.run.health -= 18 * severity;
    this.car.onCollision();
    this.effects.sparks.spawn(pos, { x: 0, y: 3, z: 1 }, 1.0, 2.2, 14);
    this.effects.smoke.spawn(pos, { x: 0, y: 2, z: 0 }, 1.2, 1.5, 6);
    this.cameraRig.shake(0.6 * severity);
    this.audio.crash(severity);
    if (this.run.health <= 0) {
      this.run.health = 0;
      this.endRun('WRECKED');
    }
  }

  onRailScrape(pos) {
    this.run.health -= 3;
    this.effects.sparks.spawn(pos, { x: 0, y: 1.5, z: 1 }, 0.5, 1.2, 5);
    this.cameraRig.shake(0.12);
    this.audio.crash(0.25);
    if (this.run.health <= 0) {
      this.run.health = 0;
      this.endRun('WRECKED');
    }
  }

  collectCoin(pos) {
    this.run.coins++;
    this.audio.coin();
    this.effects.sparks.spawn(pos, { x: 0, y: 2.5, z: 0 }, 0.4, 0.8, 6);
  }

  collectFuel() {
    this.run.fuel = Math.min(100, this.run.fuel + 40);
    this.audio.coin();
    this.hud.flash('FUEL +40');
  }

  onCheckpoint() {
    this.run.coins += 5;
    this.run.health = Math.min(100, this.run.health + 10);
    this.run.fuel = Math.min(100, this.run.fuel + 20);
    this.hud.flash('CHECKPOINT  +5 COINS');
    this.audio.coin();
  }

  // ------------------------------------------------------------------
  // Settings / resize
  // ------------------------------------------------------------------
  applySettings(s) {
    const q = s.quality;
    const pr = q === 'low' ? 1 : q === 'medium'
      ? Math.min(window.devicePixelRatio, 1.5)
      : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== 'low';
    if (this.dayNight) {
      this.dayNight.sun.castShadow = q !== 'low';
      const size = q === 'high' ? 2048 : 1024;
      if (this.dayNight.sun.shadow.mapSize.x !== size) {
        this.dayNight.sun.shadow.mapSize.set(size, size);
        if (this.dayNight.sun.shadow.map) {
          this.dayNight.sun.shadow.map.dispose();
          this.dayNight.sun.shadow.map = null;
        }
      }
    }
    if (this.postfx) this.postfx.setEnabled(s.bloom && q !== 'low');
    this.audio.setEnabled(s.sound);
  }

  _resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.postfx) this.postfx.setSize(window.innerWidth, window.innerHeight);
  }
}
