/**
 * AudioManager - fully procedural sound via the Web Audio API.
 * No audio files are needed: the engine is a pair of oscillators pitch-tied to
 * speed, tire screech and wind are filtered noise, coin/crash are short
 * synthesized one-shots. Swap any node for a sample-based source later.
 */
export class AudioManager {
  constructor() {
    this.enabled = true;
    this.ctx = null;
    this.engineOn = false;
  }

  /** Must be called from a user gesture (e.g. the Start button). */
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());

    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    this._noise = this._makeNoiseBuffer();

    // Engine: sawtooth + sub square through a lowpass filter.
    this.engOsc = ctx.createOscillator();
    this.engOsc.type = 'sawtooth';
    this.engOsc.frequency.value = 70;
    this.engOsc2 = ctx.createOscillator();
    this.engOsc2.type = 'square';
    this.engOsc2.frequency.value = 35;
    const engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 520;
    this.engGain = ctx.createGain();
    this.engGain.gain.value = 0;
    this.engOsc.connect(engFilter);
    this.engOsc2.connect(engFilter);
    engFilter.connect(this.engGain);
    this.engGain.connect(this.master);
    this.engOsc.start();
    this.engOsc2.start();

    // Tire screech: band-passed looping noise.
    const sc = ctx.createBufferSource();
    sc.buffer = this._noise;
    sc.loop = true;
    const scF = ctx.createBiquadFilter();
    scF.type = 'bandpass';
    scF.frequency.value = 900;
    scF.Q.value = 6;
    this.scGain = ctx.createGain();
    this.scGain.gain.value = 0;
    sc.connect(scF);
    scF.connect(this.scGain);
    this.scGain.connect(this.master);
    sc.start();

    // Wind / road ambience: lowpassed looping noise.
    const w = ctx.createBufferSource();
    w.buffer = this._noise;
    w.loop = true;
    const wF = ctx.createBiquadFilter();
    wF.type = 'lowpass';
    wF.frequency.value = 350;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    w.connect(wF);
    wF.connect(this.windGain);
    this.windGain.connect(this.master);
    w.start();
  }

  _makeNoiseBuffer() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  setEnabled(v) {
    this.enabled = v;
    if (this.ctx && !v) {
      const t = this.ctx.currentTime;
      this.engGain.gain.setTargetAtTime(0, t, 0.05);
      this.scGain.gain.setTargetAtTime(0, t, 0.05);
      this.windGain.gain.setTargetAtTime(0, t, 0.05);
    }
  }

  setEngineActive(on) {
    this.engineOn = on;
    if (this.ctx && !on) {
      const t = this.ctx.currentTime;
      this.engGain.gain.setTargetAtTime(0, t, 0.1);
      this.scGain.gain.setTargetAtTime(0, t, 0.1);
      this.windGain.gain.setTargetAtTime(0, t, 0.1);
    }
  }

  /** Continuous engine/wind/screech mix. Call once per frame while driving. */
  update(speedNorm, throttle, drifting, nitro) {
    if (!this.ctx || !this.engineOn || !this.enabled) return;
    const t = this.ctx.currentTime;
    this.engOsc.frequency.setTargetAtTime(60 + speedNorm * 170 + (nitro ? 45 : 0), t, 0.08);
    this.engOsc2.frequency.setTargetAtTime(30 + speedNorm * 85, t, 0.08);
    this.engGain.gain.setTargetAtTime(0.04 + throttle * 0.09 + speedNorm * 0.04, t, 0.1);
    this.scGain.gain.setTargetAtTime(drifting ? 0.14 : 0, t, 0.05);
    this.windGain.gain.setTargetAtTime(speedNorm * 0.1, t, 0.2);
  }

  /** Short rising blip for coin collection. */
  coin() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.09);
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.2);
  }

  /** Noise burst for impacts. Intensity scales volume and length. */
  crash(intensity = 1) {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3 * intensity, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25 + 0.2 * intensity);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.6);
  }
}
