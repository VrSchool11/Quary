'use strict';
// load order is core -> entities -> render-ui. plain globals, not modules.

const CONFIG = {
  VIEW_W: 320,

  VIEW_H: 180,

  TILE: 8,
  GROUND: 152,
  FIXED_STEP: 1 / 60,
  MAX_STEPS: 5,
  CAM_LERP: 0.08,
  CAM_LEAD: 26,
  GRAVITY: 0.26,
  TERMINAL: 6.2,
  JUMP_V: 4.8,
  COYOTE: 6,
  BUFFER: 6,
  MAX_PARTICLES: 220,
  FIT_TIME: 1.0,
  HUNT_EVERY: 460,
  HUNT_MAX: 2,
  FENCE_MAX: 4,

  KING_AT: 820,
  KING_WALL: 1180,
  RADIO_TIME: 110,
  DROP_CHANCE: 0.5,
  MAG_DROP_MIN: 1,
  MAG_DROP_MAX: 2,
  MAG_SIZE: 5,
  MAGS_MAX: 5,
  PLAYER_HP: 6,
  UNSEEN_HEAL: 2,
  RESUME_HP: 3,
  HOT_TIME: 900,
};

const PALETTE = {
  sky: [
    '#241a37',
    '#35204b',
    '#4c2a58',
    '#6b3560',
    '#8e3f60',
    '#b34c58',
    '#d2604f',
    '#e5804a',
    '#f2a75f',
    '#f9cd8c',
  ],
  night: '#2c1f42',
  ridgeFar: '#54406f',
  ridgeMid: '#40305a',
  canopy: '#2b2040',
  canopyFar: '#3a2c52',
  st0: '#1b2c36',
  st1: '#2b414e',
  st2: '#3d6274',
  st3: '#548294',
  st4: '#6fa1ae',
  st5: '#93c2c9',
  mortar: '#101a21',

  lf0: '#102417',
  lf1: '#1a3d24',
  lf2: '#265c31',
  lf3: '#387f3e',
  lf4: '#57a44f',
  lf5: '#82c96a',
  bark0: '#241812',
  bark1: '#3d281c',
  bark2: '#5a3d29',
  sk0: '#2a1119',
  sk1: '#a85a42',
  sk2: '#e0925a',
  sk3: '#f7bc7e',
  sk4: '#ffe0b0',
  cl0: '#5c2020',
  cl1: '#a53d2b',
  cl2: '#e8683d',
  cl3: '#ffa878',
  gd0: '#171226',
  gd1: '#33284a',
  gd2: '#4f4070',
  gd3: '#6f5c96',
  au0: '#7d5714',
  au1: '#c28a26',
  au2: '#f0b845',
  au3: '#ffdd7a',
  gt0: '#16281a',
  gt1: '#356038',
  gt2: '#568a56',
  gt3: '#7fbb6f',
  fr0: '#1e3d18',
  fr1: '#4a9033',
  fr2: '#74c74e',
  fr3: '#a4e878',
  ink: '#0d0a16',
  bone: '#f6e8cf',
  dim: '#9a86a8',
  warn: '#f2c94c',

  blood: '#c9354a',
  glow: '#ffdba0',
};

const TAU = Math.PI * 2;
const GROUND = CONFIG.GROUND;

const $ = id => document.getElementById(id);

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function clamp01(v) {
  return clamp(v, 0, 1);
}
function sign(v) {
  return v < 0 ? -1 : v > 0 ? 1 : 0;
}
function randRange(a, b) {
  return a + Math.random() * (b - a);
}
function pick(arr) {
  return arr[(Math.random() * arr.length) | 0];
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

function emitNoise(x, y, strength) {
  if (strength <= 0.02) return;
  game.noiseRings.push({ x, y, r: 2, max: 24 + strength * 92, life: 1 });

  for (const f of game.enemies) {
    if (!f.alive) continue;
    if (Math.hypot(f.x - x, f.y - y) < 24 + strength * 92)
      f.sus = Math.min(100, f.sus + strength * 62);
  }
}
function stairs(x, n, w = 72, gap = 16) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ x: x + i * (w + gap), y: GROUND - 32 * (i + 1), w, h: 8 });
  return out;
}
const LIMBS = {
  human_leg: { kind: 'leg', name: 'human leg', hum: +15, jump: 1.0, speed: 1.0, noise: 0.45 },
  boot_leg: { kind: 'leg', name: "guard's boot", hum: +18, jump: 1.0, speed: 1.05, noise: 1.0 },
  plate_leg: { kind: 'leg', name: 'armoured leg', hum: +20, jump: 0.88, speed: 0.9, noise: 1.2 },
  jag_leg: { kind: 'leg', name: 'jaguar haunch', hum: -20, jump: 1.48, speed: 1.22, noise: 0.08 },
  frog_leg: { kind: 'leg', name: 'frog leg', hum: -14, jump: 1.22, speed: 0.95, noise: 0.85 },
  croc_leg: { kind: 'leg', name: 'crocodile leg', hum: -24, jump: 0.62, speed: 0.82, noise: 0.3 },
  own_leg: { kind: 'leg', name: 'your own leg', hum: +30, jump: 0.7, speed: 0.7, noise: 0.55 },
  human_arm: { kind: 'arm', name: 'human arm', hum: +15, dmg: 1, reach: 11, grip: true },
  officer_arm: { kind: 'arm', name: "officer's arm", hum: +22, dmg: 2, reach: 12, grip: true },
  claw_arm: { kind: 'arm', name: 'jaguar claw', hum: -20, dmg: 3, reach: 14 },
  jaw_arm: { kind: 'arm', name: 'crocodile jaw', hum: -24, dmg: 2, reach: 12 },
  ape_arm: { kind: 'arm', name: 'ape arm', hum: -18, dmg: 2, reach: 17 },
};

const EMPTY_SOCKET_HUM = -3;

const GEAR = {
  gun: { name: "guard's sidearm", hold: true },
  rounds: { name: 'a spare magazine', mags: 1 },

  sleeve: { name: 'a length of steel sleeve' },
  spring: { name: 'a stripped spring' },
  rag: { name: 'an oiled rag' },
};
const CAN_PARTS = ['sleeve', 'spring', 'rag'];
const ENEMY_TYPES = {
  guard: {
    hp: 3,
    speed: 0.72,
    dmg: 1,
    sight: 1.0,
    name: 'guard',
    drop: ['boot_leg', 'human_arm'],
    cloth: '#33284a',
    clothHi: '#4f4070',
    leg: 'boot_leg',
    arm: 'human_arm',
    wide: 12,
  },
  commander: {
    hp: 6,
    speed: 0.88,
    dmg: 1,
    sight: 1.25,
    name: 'commander',
    drop: ['officer_arm'],
    radio: true,
    cloth: '#5a2f3a',
    clothHi: '#7d4150',
    leg: 'boot_leg',
    arm: 'officer_arm',
    wide: 12,
  },
  bodyguard: {
    hp: 9,
    speed: 0.6,
    dmg: 2,
    sight: 1.0,
    name: "the king's own",
    drop: ['plate_leg'],
    armour: true,

    cloth: '#3d6274',
    clothHi: '#6fa1ae',
    leg: 'plate_leg',
    arm: 'human_arm',
    wide: 14,
  },
  jaguar: {
    hp: 5,
    speed: 1.45,
    dmg: 1,
    sight: 0.85,
    name: 'jaguar',
    drop: ['jag_leg'],
    beast: true,
  },
  monkey: {
    hp: 2,
    speed: 1.85,
    dmg: 0,
    sight: 1.1,
    name: 'monkey',
    drop: ['ape_arm'],
    beast: true,
    flees: true,
  },
  king: {
    hp: 30,
    speed: 0.95,
    dmg: 2,
    sight: 2.0,
    name: 'the king',
    drop: ['own_leg'],
    boss: true,
  },
};

const KING_LINES = {
  enter: 'You were supposed to be useful.',
  turn(hum) {
    if (hum < 45) return 'Look what you made of yourself. I only took the leg.';
    return 'Still wearing your own face. Sentimental.';
  },

  grab: 'That one was never yours.',
  miss: 'Hold still.',
  die: 'Take it back. It never worked properly anyway.',
};
const KING_PHASES = [
  { above: 20, speed: 0.85, moves: ['call', 'volley'] },

  { above: 10, speed: 1.0, moves: ['volley', 'sweep', 'lash'] },
  { above: -1, speed: 1.2, moves: ['lash', 'grab', 'lash', 'volley'] },
];
function addParticle(x, y, vx, vy, colour, life, grav = 0.12, size = 1) {
  if (game.particles.length > CONFIG.MAX_PARTICLES) return;
  game.particles.push({ x, y, vx, vy, colour, life, max: life, grav, size });
}
function leafBurst(x, y, n) {
  for (let i = 0; i < n; i++)
    addParticle(
      x + randRange(-6, 6),
      y - 6 - Math.random() * 10,
      randRange(-0.55, 0.55),
      -Math.random() * 0.4,
      pick([PALETTE.lf3, PALETTE.lf4, PALETTE.lf5]),
      30 + Math.random() * 20,
      0.03,
    );
}
// ground gaps stay at 20. a crocodile pair only clears 24.
const ZONES = [
  {
    name: 'The Block',
    rule: 'no cover. learn the loop.',
    ease: 0.5,
    w: 1240,
    exit: 1210,
    plats: [groundStrip(0, 620), groundStrip(640, 600), ...stairs(240, 2), ...stairs(820, 2)],
    foliage: [],
    trees: [
      { x: 120, v: 0 },
      { x: 560, v: 1 },
      { x: 1120, v: 2 },
    ],
    pickups: [
      { x: 96, y: GROUND, limb: 'frog_leg' },
      { x: 352, y: 88, limb: 'human_leg' },
      { x: 852, y: 120, gear: 'sleeve' },
    ],
    foes: [
      { t: 'guard', x: 520, x0: 470, x1: 600 },
      { t: 'guard', x: 660, x0: 640, x1: 700 },
      { t: 'guard', x: 800, x0: 740, x1: 880 },
    ],
    notes: [
      { x: 210, text: 'They kept asking for the notation. I gave them the wrong one twice.' },
      { x: 980, text: 'Third door. The lock is on the outside of every room in here.' },
    ],
  },
  {
    name: 'Undergrowth',
    rule: 'the ferns hide you. so does everything else.',
    ease: 0.75,
    w: 1520,
    exit: 1490,

    plats: [groundStrip(0, 700), groundStrip(720, 800), ...stairs(300, 3), ...stairs(900, 3)],
    foliage: [
      { x: 300, y: 120, w: 120, h: 32 },
      { x: 560, y: 120, w: 150, h: 32 },
      { x: 1000, y: 120, w: 180, h: 32 },
    ],
    trees: [
      { x: 80, v: 1 },
      { x: 420, v: 2 },
      { x: 760, v: 0 },
      { x: 1080, v: 1 },
      { x: 1400, v: 2 },
    ],
    pickups: [
      { x: 660, y: GROUND, limb: 'croc_leg' },
      { x: 1108, y: 56, limb: 'human_leg' },
      { x: 510, y: 56, gear: 'spring' },
    ],
    foes: [
      { t: 'guard', x: 400, x0: 340, x1: 470 },
      { t: 'jaguar', x: 820, x0: 760, x1: 900 },

      { t: 'monkey', x: 1010, x0: 940, x1: 1180 },
      { t: 'commander', x: 1150, x0: 1090, x1: 1250 },
    ],
    notes: [
      { x: 150, text: 'Out. Through the laundry gate. My leg is somewhere behind me.' },
      { x: 1300, text: 'The cat took a guard last night. Nobody came for the body.' },
    ],
  },
  {
    name: 'The Yard',
    rule: 'floodlit ground. they see twice as far.',
    ease: 1.0,
    w: 1520,
    exit: 1490,
    plats: [
      groundStrip(0, 560),
      groundStrip(580, 440),
      groundStrip(1040, 480),
      ...stairs(200, 3),
      ...stairs(1140, 3),
    ],
    foliage: [{ x: 600, y: 120, w: 64, h: 32 }],
    trees: [
      { x: 60, v: 2 },
      { x: 1020, v: 0 },
      { x: 1460, v: 1 },
    ],
    lights: [
      { x: 420, w: 220 },
      { x: 860, w: 260 },
      { x: 1240, w: 200 },
    ],

    pickups: [
      { x: 700, y: GROUND, limb: 'claw_arm' },
      { x: 1348, y: 56, limb: 'human_leg' },
      { x: 410, y: 56, gear: 'rag' },
    ],
    foes: [
      { t: 'guard', x: 120, x0: 80, x1: 210 },
      { t: 'guard', x: 300, x0: 240, x1: 380 },
      { t: 'commander', x: 700, x0: 640, x1: 800 },
      { t: 'jaguar', x: 960, x0: 880, x1: 1040 },
      { t: 'guard', x: 1200, x0: 1140, x1: 1300 },
    ],
    notes: [
      { x: 520, text: 'Sleeve, spring, rag. I have built worse things out of less.' },
      { x: 1320, text: 'A commander has a radio. A dead commander has a radio too.' },
    ],
  },
  {
    name: 'The Ridge',
    rule: 'straight up. your legs decide this one.',
    ease: 1.2,
    w: 1400,
    exit: 1370,
    plats: [
      groundStrip(0, 420),
      groundStrip(440, 380),
      groundStrip(840, 560),
      ...stairs(120, 3),
      ...stairs(560, 3),
      ...stairs(1000, 3),
    ],

    foliage: [
      { x: 380, y: 120, w: 90, h: 32 },
      { x: 1120, y: 120, w: 120, h: 32 },
    ],
    trees: [
      { x: 200, v: 0 },
      { x: 700, v: 1 },
      { x: 1240, v: 2 },
    ],
    lights: [
      { x: 300, w: 200 },
      { x: 640, w: 220 },
      { x: 1080, w: 200 },
    ],
    pickups: [
      { x: 600, y: GROUND, limb: 'jaw_arm' },
      { x: 1208, y: 56, limb: 'officer_arm' },
    ],
    foes: [
      { t: 'guard', x: 250, x0: 190, x1: 340 },
      { t: 'jaguar', x: 460, x0: 420, x1: 540 },
      { t: 'bodyguard', x: 640, x0: 580, x1: 740 },
      { t: 'monkey', x: 900, x0: 860, x1: 1060 },
      { t: 'guard', x: 1100, x0: 1040, x1: 1180 },
    ],
    notes: [
      { x: 260, text: 'Above the lights there is no one. They never look up.' },
      { x: 1180, text: 'The big one does not patrol. He waits where the king walks.' },
    ],
  },
  {
    name: 'The Treeline',
    rule: 'he is waiting at the fence.',
    ease: 1.4,
    w: 1240,
    exit: 1200,
    boss: true,
    plats: [
      groundStrip(0, 1240),
      ...stairs(240, 2),
      { x: 880, y: 104, w: 104, h: 8 },
      { x: 1064, y: 104, w: 104, h: 8 },
      { x: 856, y: 40, w: 24, h: 56 },
      { x: 1216, y: 40, w: 24, h: 56 },
      { x: 856, y: 40, w: 384, h: 8 },
    ],
    foliage: [{ x: 1000, y: 120, w: 72, h: 32 }],
    trees: [
      { x: 140, v: 1 },
      { x: 420, v: 0 },
      { x: 640, v: 2 },
      { x: 880, v: 1 },
      { x: 1160, v: 0 },
    ],
    lights: [
      { x: 200, w: 180 },
      { x: 940, w: 260 },
    ],
    pickups: [],

    foes: [
      { t: 'guard', x: 300, x0: 250, x1: 400 },
      { t: 'guard', x: 560, x0: 500, x1: 660 },
      { t: 'commander', x: 740, x0: 700, x1: 820 },
    ],
    notes: [
      { x: 200, text: 'Trees. Actual trees. I have not seen anything I did not build in a year.' },
    ],
  },
];
const INTRO_CARDS = [
  'I made something. They took it.',
  'I would not explain how. They took the leg.',
  'There was nothing left. I ran.',
  'Out of the room. Still in the fence.',
];

let platforms = [],
  foliage = [],
  trees = [],
  lights = [],
  notes = [];
let zoneWidth = 0,
  zoneExit = 0;
const game = {
  player: null,
  enemies: [],
  pickups: [],
  noiseRings: [],
  particles: [],
  motes: [],
  bullets: [],
  cam: 0,
  camY: 0,
  time: 0,
  kills: 0,
  quietKills: 0,
  fitted: 0,
  shake: 0,
  freeze: 0,
  flash: 0,
  fade: 1,
  zone: 0,
  cardT: 0,
  alarm: 0,
  huntTimer: 0,
  huntCount: 0,
  log: [],
  intro: 0,
  introT: 0,
  paused: false,

  boss: null,
  bossSpawned: false,
  bossDone: false,
  sweep: 0,
  phase: 0,
  seen: false,
  ghosted: [],
  checkpoint: null,
  running: false,
};

const keys = Object.create(null);

const world = {
  solidAt(x, y, w, h) {
    for (const t of platforms) {
      if (x + w > t.x && x < t.x + t.w && y + h > t.y && y < t.y + t.h) return t;
    }
    return null;
  },

  inFoliage(x, y) {
    for (const f of foliage) {
      if (x > f.x && x < f.x + f.w && y > f.y && y < f.y + f.h) return true;
    }
    return false;
  },

  litGround(x) {
    for (const l of lights) {
      if (x > l.x && x < l.x + l.w) return true;
    }
    return false;
  },
};

function hash2d(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function logLine(text) {
  game.log.push({ text, life: 300 });
  if (game.log.length > 3) game.log.shift();
}
function groundStrip(x, w) {
  return { x, y: GROUND, w, h: 32 };
}

function saveCheckpoint() {
  game.checkpoint = {
    zone: game.zone,
    secs: game.time,
    legs: game.player.legs.slice(),
    arms: game.player.arms.slice(),
    hp: Math.max(CONFIG.RESUME_HP, game.player.hp),

    gun: game.player.gun,
    ammo: game.player.ammo,
    mags: game.player.mags,
    silencer: game.player.silencer,
    canParts: game.player.canParts.slice(),
    kills: game.kills,
    quietKills: game.quietKills,
    fitted: game.fitted,
    ghosted: game.ghosted.slice(),
  };
}

function bloodSpray(x, y, opts = {}) {
  const {
    count = 8,
    spread = 1,
    dir = 0,
    slow = 0.5,
    fast = 1.5,
    lift = 1.6,
    colour = PALETTE.blood,
    life = 20,
    grav = 0.14,
  } = opts;
  for (let i = 0; i < count; i++) {
    let vx;

    if (dir) vx = dir * randRange(slow, fast);
    else vx = randRange(-spread, spread);
    addParticle(x, y, vx, -Math.random() * lift, colour, life, grav);
  }
}

function loadZone(i) {
  const z = ZONES[i];
  platforms = z.plats;
  foliage = z.foliage;
  lights = z.lights || [];
  trees = [];
  for (const t of z.trees) trees.push({ x: t.x, y: GROUND, v: t.v });
  notes = [];
  for (const n of z.notes || []) notes.push({ x: n.x, text: n.text, read: false });
  zoneWidth = z.w;

  zoneExit = z.exit;
  game.zone = i;

  game.pickups = [];
  for (const o of z.pickups)
    game.pickups.push({ x: o.x, y: o.y, limb: o.limb, gear: o.gear, taken: false });
  game.enemies = [];
  for (const o of z.foes) game.enemies.push(new Enemy(o.t, o.x, o.x0, o.x1, z.ease));
  game.noiseRings = [];
  game.particles = [];
  game.bullets = [];
  game.boss = null;
  game.bossSpawned = false;
  game.bossDone = false;
  game.sweep = 0;
  game.phase = 0;

  game.cam = 0;
  game.camY = 0;
  game.alarm = 0;
  game.huntTimer = 0;
  game.huntCount = 0;
  game.seen = false;
  game.cardT = 150;

  if (game.player) {
    game.player.x = 40;
    game.player.y = GROUND;
    game.player.vx = 0;
    game.player.vy = 0;
  }
}
const audio = {
  ctx: null,
  master: null,
  drone: null,
  noise: null,
  on: false,
  sfx: true,

  init() {
    if (this.ctx) return;

    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;

    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);

    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + randRange(-1, 1) * 0.06) * 0.985;
      d[i] = last * 3;
    }
    this.noise = buf;
    this.on = true;
  },

  // TODO mute is all or nothing, no volume

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  burst(freq, dur, gain, type, sweepTo) {
    if (!this.on || !this.sfx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);

    if (sweepTo) o.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);

    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  },

  hiss(dur, gain, cut) {
    if (!this.on || !this.sfx) return;

    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = cut;
    f.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  },
  footfall(noise) {
    this.hiss(0.05 + noise * 0.06, 0.02 + noise * 0.1, 900 - noise * 300);
  },
  land(f) {
    this.burst(90 - f * 20, 0.14, 0.14, 'triangle');
    this.hiss(0.09, 0.07, 500);
  },
  fit() {
    this.burst(340, 0.09, 0.1, 'square');
    setTimeout(() => this.burst(560, 0.22, 0.09), 80);
  },
  crunch() {
    this.hiss(0.13, 0.16, 260);
    this.burst(70, 0.12, 0.1, 'sawtooth');
  },
  clang() {
    this.burst(1200, 0.1, 0.08, 'square', 700);
    this.hiss(0.06, 0.05, 2600);
  },
  hurt() {
    this.burst(200, 0.22, 0.16, 'sawtooth', 90);
  },

  page() {
    this.burst(720, 0.1, 0.06);
    setTimeout(() => this.burst(960, 0.16, 0.05), 90);
  },

  unseen() {
    this.burst(520, 0.16, 0.07);
    setTimeout(() => this.burst(780, 0.3, 0.06), 120);
  },
  shot() {
    this.burst(1500, 0.06, 0.16, 'square', 300);
    this.hiss(0.22, 0.2, 1500);
  },
  cough() {
    this.hiss(0.07, 0.07, 700);
    this.burst(180, 0.06, 0.05, 'triangle', 110);
  },

  build() {
    this.burst(260, 0.06, 0.07, 'square');
    setTimeout(() => this.burst(200, 0.08, 0.06, 'square'), 110);
  },

  alarm() {
    this.burst(440, 0.5, 0.13, 'square', 660);
    setTimeout(() => this.burst(560, 0.7, 0.12, 'square', 840), 260);
  },

  bossOn() {
    if (!this.on || !this.sfx || this.drone) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(),
      o2 = this.ctx.createOscillator(),
      g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 41;
    o2.type = 'sawtooth';

    o2.frequency.value = 41.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.11, t + 2.5);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260;
    o.connect(f);
    o2.connect(f);

    f.connect(g);
    g.connect(this.master);
    o.start(t);
    o2.start(t);
    this.drone = { o, o2, g };
  },

  bossOff() {
    if (!this.drone) return;
    const t = this.ctx.currentTime;
    this.drone.g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    this.drone.o.stop(t + 1.4);
    this.drone.o2.stop(t + 1.4);
    this.drone = null;
  },
};

function dustBurst(x, y, n, spread) {
  for (let i = 0; i < n; i++)
    addParticle(
      x + randRange(-spread / 2, spread / 2),
      y - 1,
      randRange(-0.7, 0.7),
      -Math.random() * 0.7,
      Math.random() > 0.5 ? PALETTE.st4 : PALETTE.st3,
      16 + Math.random() * 12,
      0.04,
    );
}
function compact(arr) {
  let w = 0;
  for (let r = 0; r < arr.length; r++) {
    if (arr[r].life > 0) arr[w++] = arr[r];
  }

  arr.length = w;
  return arr;
}
