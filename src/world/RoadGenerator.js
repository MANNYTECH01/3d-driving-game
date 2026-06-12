import * as THREE from 'three';

/**
 * RoadGenerator - endless road built from a pool of segments.
 *
 * A fixed number of segments are laid out along -Z. When a segment falls
 * behind the player it is teleported to the front of the chain and its props
 * are rebuilt for whatever environment theme that distance belongs to.
 * Geometries and materials are shared, so recycling is cheap.
 */
const SEG_LEN = 60;
const SEG_COUNT = 10;

export const ROAD_HALF = 6.5;

const THEMES = [
  { name: 'Highway', ground: 0x2f3b2e },
  { name: 'City', ground: 0x33363c },
  { name: 'Desert', ground: 0xc9a36a },
  { name: 'Mountain', ground: 0x44563f }
];

export class RoadGenerator {
  constructor(scene) {
    this.scene = scene;
    this._initShared();

    // Ground plane follows the player; its color lerps toward the theme.
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, SEG_LEN * SEG_COUNT + 300),
      new THREE.MeshStandardMaterial({ color: THEMES[0].ground, roughness: 1 })
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.06;
    this.ground.receiveShadow = true;
    scene.add(this.ground);

    this.segments = [];
    for (let i = 0; i < SEG_COUNT; i++) {
      const s = this._buildSegment();
      this.segments.push(s);
      scene.add(s);
    }
    this._tmpColor = new THREE.Color();
    this.reset();
  }

  themeIndexAt(z) {
    const d = Math.max(0, -z);
    return Math.floor(d / 900) % THEMES.length;
  }

  themeAt(z) { return THEMES[this.themeIndexAt(z)]; }

  reset() {
    for (let i = 0; i < SEG_COUNT; i++) {
      this.segments[i].position.z = -i * SEG_LEN;
      this._populate(this.segments[i]);
    }
    this.ground.material.color.setHex(THEMES[0].ground);
    this.ground.position.z = 0;
  }

  /** Recycles segments that fell behind and keeps the ground centered. */
  update(playerZ) {
    for (const s of this.segments) {
      if (s.position.z - playerZ > SEG_LEN) {
        s.position.z -= SEG_LEN * SEG_COUNT;
        this._populate(s);
      }
    }
    this.ground.position.z = playerZ;
    this.ground.material.color.lerp(this._tmpColor.setHex(this.themeAt(playerZ).ground), 0.02);
  }

  // ------------------------------------------------------------------
  // Shared geometry / materials
  // ------------------------------------------------------------------
  _initShared() {
    this.geo = {
      box: new THREE.BoxGeometry(1, 1, 1),
      cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
      cone: new THREE.ConeGeometry(0.5, 1, 8),
      rock: new THREE.IcosahedronGeometry(1, 0)
    };
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
    this.mat = {
      buildings: [std(0x4a5260), std(0x3a4150), std(0x5d6675)],
      trunk: std(0x6b4a2f),
      leaf: std(0x2d5a2f),
      cactus: std(0x3f7a44),
      rock: std(0x8a7f70),
      pole: std(0x9aa3ad, { metalness: 0.6 }),
      lampHead: new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 1.4 }),
      mountain: std(0x6f7d72)
    };
  }

  _buildSegment() {
    const g = new THREE.Group();
    // Asphalt
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(14, SEG_LEN),
      new THREE.MeshStandardMaterial({ color: 0x26262b, roughness: 0.95 })
    );
    road.rotation.x = -Math.PI / 2;
    road.receiveShadow = true;
    g.add(road);
    // Solid edge lines
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.8 });
    for (const x of [-6.45, 6.45]) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.25, SEG_LEN), lineMat);
      l.rotation.x = -Math.PI / 2;
      l.position.set(x, 0.01, 0);
      g.add(l);
    }
    // Dashed lane dividers (3 lanes at x = -4, 0, 4)
    for (const x of [-2, 2]) {
      for (let j = 0; j < 6; j++) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 2.6), lineMat);
        d.rotation.x = -Math.PI / 2;
        d.position.set(x, 0.012, -SEG_LEN / 2 + 5 + j * 10);
        g.add(d);
      }
    }
    // Guardrails
    const railMat = new THREE.MeshStandardMaterial({ color: 0x99a1ad, metalness: 0.7, roughness: 0.4 });
    for (const x of [-7.35, 7.35]) {
      const r = new THREE.Mesh(this.geo.box, railMat);
      r.scale.set(0.25, 0.55, SEG_LEN);
      r.position.set(x, 0.45, 0);
      r.castShadow = true;
      g.add(r);
    }
    // Per-theme props live in their own sub-group.
    g.userData.props = new THREE.Group();
    g.add(g.userData.props);
    return g;
  }

  // ------------------------------------------------------------------
  // Theme props
  // ------------------------------------------------------------------
  _populate(seg) {
    const props = seg.userData.props;
    while (props.children.length) props.remove(props.children[0]);
    const theme = THEMES[this.themeIndexAt(seg.position.z)];
    if (theme.name === 'Highway') this._lamps(props);
    else if (theme.name === 'City') this._buildings(props);
    else if (theme.name === 'Desert') this._desert(props);
    else this._mountain(props);
  }

  _mesh(parent, geo, mat, x, y, z, sx, sy, sz, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    m.castShadow = shadow;
    parent.add(m);
    return m;
  }

  _lamps(p) {
    for (const side of [-1, 1]) {
      for (const z of [-20, 10]) {
        this._mesh(p, this.geo.cyl, this.mat.pole, side * 8.2, 2.5, z, 0.32, 5, 0.32);
        this._mesh(p, this.geo.box, this.mat.pole, side * 7.5, 4.9, z, 1.6, 0.12, 0.12);
        this._mesh(p, this.geo.box, this.mat.lampHead, side * 7.0, 4.8, z, 0.5, 0.15, 0.3, false);
      }
    }
  }

  _buildings(p) {
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1;
      const w = 4 + Math.random() * 5;
      const h = 7 + Math.random() * 20;
      const d = 4 + Math.random() * 5;
      const mat = this.mat.buildings[i % this.mat.buildings.length];
      this._mesh(p, this.geo.box, mat, side * (11 + Math.random() * 16), h / 2, -SEG_LEN / 2 + Math.random() * SEG_LEN, w, h, d);
    }
  }

  _desert(p) {
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (9 + Math.random() * 18);
      const z = -SEG_LEN / 2 + Math.random() * SEG_LEN;
      this._mesh(p, this.geo.cyl, this.mat.cactus, x, 1.2, z, 0.5, 2.4, 0.5);
      this._mesh(p, this.geo.cyl, this.mat.cactus, x + 0.6, 1.6, z, 0.3, 1.0, 0.3);
    }
    for (let i = 0; i < 4; i++) {
      const side = i % 2 ? 1 : -1;
      const s = 0.6 + Math.random();
      this._mesh(p, this.geo.rock, this.mat.rock, side * (9 + Math.random() * 22), s * 0.4, -SEG_LEN / 2 + Math.random() * SEG_LEN, s, s * 0.8, s);
    }
  }

  _mountain(p) {
    for (let i = 0; i < 9; i++) {
      const side = i % 2 ? 1 : -1;
      const x = side * (9 + Math.random() * 20);
      const z = -SEG_LEN / 2 + Math.random() * SEG_LEN;
      const s = 0.8 + Math.random() * 0.7;
      this._mesh(p, this.geo.cyl, this.mat.trunk, x, 0.5 * s, z, 0.25 * s, s, 0.25 * s);
      this._mesh(p, this.geo.cone, this.mat.leaf, x, 2.2 * s, z, 1.7 * s, 3.2 * s, 1.7 * s);
    }
    // Distant peaks (no shadows: they sit outside the shadow camera anyway)
    for (const side of [-1, 1]) {
      this._mesh(p, this.geo.cone, this.mat.mountain, side * (45 + Math.random() * 25), 12, -SEG_LEN / 2 + Math.random() * SEG_LEN, 36, 30, 36, false);
    }
  }
}
