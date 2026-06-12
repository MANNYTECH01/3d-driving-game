/**
 * InputManager - merges keyboard, touch and gamepad input into a single state.
 * Read `steer` (-1..1), `throttle` (0..1), `brake` (0..1), `nitro`, `handbrake`
 * once per frame after calling `update(dt)`.
 */
export class InputManager {
  constructor() {
    this.steer = 0;
    this.throttle = 0;
    this.brake = 0;
    this.nitro = false;
    this.handbrake = false;
    /** Callbacks wired by Game */
    this.onPause = null;
    this.onCamera = null;

    this._keys = {};
    this._steerSmooth = 0;
    this._touch = { left: false, right: false, gas: false, brake: false, nitro: false };
    this._padButtons = {};

    window.addEventListener('keydown', (e) => this._key(e, true));
    window.addEventListener('keyup', (e) => this._key(e, false));
    this._bindTouch();
  }

  _key(e, down) {
    const k = e.code;
    if (down && (k === 'Escape' || k === 'KeyP')) { if (this.onPause) this.onPause(); return; }
    if (down && k === 'KeyC') { if (this.onCamera) this.onCamera(); return; }
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
    this._keys[k] = down;
  }

  _bindTouch() {
    const bind = (id, prop) => {
      const el = document.getElementById(id);
      if (!el) return;
      const set = (v) => (e) => { e.preventDefault(); this._touch[prop] = v; };
      el.addEventListener('pointerdown', set(true));
      el.addEventListener('pointerup', set(false));
      el.addEventListener('pointerleave', set(false));
      el.addEventListener('pointercancel', set(false));
    };
    bind('touch-left', 'left');
    bind('touch-right', 'right');
    bind('touch-gas', 'gas');
    bind('touch-brake', 'brake');
    bind('touch-nitro', 'nitro');
  }

  /** Polls the gamepad and merges all input sources. Call once per frame. */
  update(dt) {
    const k = this._keys, t = this._touch;
    let steer = 0, throttle = 0, brake = 0;
    let nitro = false, hb = false;

    if (k['ArrowLeft'] || k['KeyA'] || t.left) steer -= 1;
    if (k['ArrowRight'] || k['KeyD'] || t.right) steer += 1;
    if (k['ArrowUp'] || k['KeyW'] || t.gas) throttle = 1;
    if (k['ArrowDown'] || k['KeyS'] || t.brake) brake = 1;
    nitro = !!(k['ShiftLeft'] || k['ShiftRight'] || t.nitro);
    hb = !!k['Space'];

    // Gamepad (standard mapping): left stick steer, RT throttle, LT brake,
    // A = nitro, X = handbrake, Y = camera, Start = pause.
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && pads[0];
    if (pad) {
      const ax = pad.axes[0] || 0;
      if (Math.abs(ax) > 0.12) steer += ax;
      const rt = pad.buttons[7] ? pad.buttons[7].value : 0;
      const lt = pad.buttons[6] ? pad.buttons[6].value : 0;
      throttle = Math.max(throttle, rt);
      brake = Math.max(brake, lt);
      if (pad.buttons[0] && pad.buttons[0].pressed) nitro = true;
      if (pad.buttons[2] && pad.buttons[2].pressed) hb = true;
      this._edge(pad, 3, () => { if (this.onCamera) this.onCamera(); });
      this._edge(pad, 9, () => { if (this.onPause) this.onPause(); });
    }

    steer = Math.max(-1, Math.min(1, steer));
    // Smooth steering so keyboard input feels analog.
    const rate = dt ? Math.min(1, dt * 9) : 0.15;
    this._steerSmooth += (steer - this._steerSmooth) * rate;
    if (Math.abs(this._steerSmooth) < 0.01 && steer === 0) this._steerSmooth = 0;

    this.steer = this._steerSmooth;
    this.throttle = throttle;
    this.brake = brake;
    this.nitro = nitro;
    this.handbrake = hb;
  }

  /** Rising-edge detection for gamepad buttons. */
  _edge(pad, i, cb) {
    const pressed = !!(pad.buttons[i] && pad.buttons[i].pressed);
    const key = 'b' + i;
    if (pressed && !this._padButtons[key]) cb();
    this._padButtons[key] = pressed;
  }
}
