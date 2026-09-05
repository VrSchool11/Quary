// needs core for LIMBS, FOES and G.

"use strict";

// tune these, not the code below
const FEEL = {
  GRIP_GROUND: 0.34,
  GRIP_AIR: 0.16,
  RUN: 1.75,
  HOP_LAUNCH: 1.7,
  HOP_DRAG: 0.7,
  ONE_LEG_SPEED: 0.5,
  MISMATCH: 0.86,
  CUT_RISE: 0.86,
  SQUASH: 0.42,
  STRETCH: 0.34,
  SETTLE: 0.18,
  SWING: 0.95,
  ATTACK_LOCK: 18,
  IFRAMES: 70,
  FERN_LESSON: 45,
  SHOT_LOCK: 26,
  SHOT_SPEED: 4.4,
  SHOT_DMG: 3,
  SHOT_LOUD: 1.55,
  SHOT_QUIET: 0.20,
  CAN_TIME: 1.6,
  ALERT_DECAY: 0.25,
  TELL_LASH: 34,
  TELL_GRAB: 46,
  TELL_VOLLEY: 30,
  TELL_CALL: 26,
  LASH_REACH: 30,
  LASH_PUSH: 2.6,
  GRAB_REACH: 20,
  MOVE_GAP: 34,
  LASH_SPEED: 3.1,
  LASH_HIT: 14,
  GRAB_SPEED: 3.9,
  GRAB_HIT: 20,
  SWEEP_TIME: 150,
  BOLT_SPEED: 2.4,
  BOLT_HOMING: 2.6,
  BOLT_LIFE: 150,
  SHOT_LIFE: 80,
  CD_LASH: 62,
  CD_GRAB: 74,
  CD_GRABBED: 96,
  CD_VOLLEY: 70,
  CD_SWEEP: 60,
  CD_CALL: 130,
  CD_PHASE: 40,
};

function slotHum(id) {
  return id ? LIMBS[id].hum : EMPTY_HUM;
}

function humanity(p) {
  const s = slotHum(p.legs[0]) + slotHum(p.legs[1]) + slotHum(p.arms[0]) + slotHum(p.arms[1]);
  return clamp(40 + s, 0, 100);
}

function moveStats(p) {
  const L = [];
  for (const id of p.legs) {
    if (id) L.push(LIMBS[id]);
  }
  if (L.length === 1) {
    return { speed: L[0].speed * FEEL.ONE_LEG_SPEED, jump: L[0].jump, noise: L[0].noise * 1.6, hop: true };
  }
  const matched = p.legs[0] === p.legs[1];
  return {
    speed: Math.min(L[0].speed, L[1].speed) * (matched ? 1 : FEEL.MISMATCH),
    jump: (L[0].jump + L[1].jump) / 2,
    noise: Math.max(L[0].noise, L[1].noise),
    hop: false,
  };
}

function armStats(p) {
  let dmg = 0;
  let reach = 0;
  for (const id of p.arms) {
    if (!id) continue;
    dmg = Math.max(dmg, LIMBS[id].dmg);
    reach = Math.max(reach, LIMBS[id].reach);
  }
  return { dmg, reach };
}

function canGrip(p) {
  for (const id of p.arms) {
    if (id && LIMBS[id].grip) return true;
  }
  return false;
}

function armedWithGun(p) {
  return p.gun && canGrip(p);
}

class Entity {
  constructor(x, hp) {
    this.x = x;
    this.y = GROUND;
    this.vx = 0;
    this.vy = 0;
    this.dir = 1;
    this.walk = 0;
    this.hp = hp;
    this.hpMax = hp;
  }
  near(o, wide, tall) {
    return Math.abs(o.x - this.x) < wide && Math.abs(o.y - this.y) < tall;
  }
}

class Player extends Entity {
  constructor() {
    super(40, 3);
    this.legs = ['human_leg', null];
    this.arms = ['human_arm', 'human_arm'];
    this.grounded = false;
    this.coyote = 0;
    this.buffer = 0;
    this.fitting = 0;
    this.side = 0;
    this.atk = 0;
    this.iframe = 0;
    this.sqx = 1;
    this.sqy = 1;
    this.fellFrom = 0;
    this.hops = 0;
    this.fernFrames = 0;
    this.gun = false;
    this.ammo = 0;
    this.silencer = false;
    this.parts = [];
    this.shot = 0;
    this.fired = 0;
    this.building = 0;
  }

  // side 0 is taken from the first frame, so honouring it here left players one-legged forever
  fit(limb) {
    const slots = LIMBS[limb].kind === 'leg' ? this.legs : this.arms;
    const empty = slots.indexOf(null);
    const at = empty >= 0 ? empty : this.side;
    const off = slots[at];
    slots[at] = limb;
    G.fitted++;
    if (off) {
      G.pickups.push({ x: this.x - this.dir * 17, y: this.y, limb: off, taken: false });
    }
  }

  shoot() {
    this.shot = FEEL.SHOT_LOCK;
    this.ammo--;
    this.fired++;
    const gy = this.y - 14;
    G.shots.push(new Shot(this.x + this.dir * 8, gy,
                          this.dir * FEEL.SHOT_SPEED, FEEL.SHOT_LIFE, true));

    if (this.silencer) {
      G.shake = 1.1;
      G.freeze = 2;
      this.vx -= this.dir * 0.2;
      for (let i = 0; i < 3; i++)
        emit(this.x + this.dir * 10, gy, this.dir * rand(0.3, 1.1), rand(-0.3, 0.3), PAL.dim, 12, 0.02);
      emitNoise(this.x, gy, FEEL.SHOT_QUIET);
      Sound.cough();
      return;
    }

    G.shake = 3.4;
    G.freeze = 4;
    this.vx -= this.dir * 0.6;
    for (let i = 0; i < 8; i++)
      emit(this.x + this.dir * 10, gy, this.dir * rand(0.4, 1.8), rand(-0.5, 0.5), PAL.glow, 12, 0.02);
    emitNoise(this.x, gy, FEEL.SHOT_LOUD);
    Sound.shot();
  }

  hurt(n) {
    if (this.iframe > 0) return;
    this.hp -= n;
    this.iframe = FEEL.IFRAMES;
    G.shake = 5.5;
    G.flash = 9;
    G.freeze = 8;
    Sound.hurt();
    this.vx = -this.dir * 1.9;
    this.vy = -2.0;
    fxBurst(this.x, this.y - 12, { count: 12, spread: 1.3, lift: 2, life: 24, grav: 0.16 });
    if (this.hp <= 0) endRun(false);
  }

  move(g, busy) {
    let ax = 0;
    if (!busy) {
      if (keys['a'] || keys['arrowleft']) { ax -= 1; this.dir = -1; }
      if (keys['d'] || keys['arrowright']) { ax += 1; this.dir = 1; }
    }
    this.vx = span(this.vx, ax * g.speed * FEEL.RUN,
                   this.grounded ? FEEL.GRIP_GROUND : FEEL.GRIP_AIR);
    if (Math.abs(this.vx) < 0.02) this.vx = 0;
    if (g.hop && this.grounded) this.vx *= FEEL.HOP_DRAG;

    if (this.grounded) this.coyote = CFG.COYOTE;
    else this.coyote = Math.max(0, this.coyote - 1);
    const held = keys[' '] || keys['w'] || keys['arrowup'];
    if (!busy && held) this.buffer = CFG.BUFFER;
    else this.buffer = Math.max(0, this.buffer - 1);

    if (this.buffer > 0 && this.coyote > 0 && g.jump > 0) {
      this.vy = -CFG.JUMP_V * g.jump;
      this.buffer = 0;
      this.coyote = 0;
      this.grounded = false;
      this.sqx = 0.72;
      this.sqy = 1.34;
      if (g.hop) { this.vx = this.dir * FEEL.HOP_LAUNCH; this.hops++; }
      fxDust(this.x, this.y, 5, 7);
      emitNoise(this.x, this.y, g.noise * 0.5);
    }
    if (this.vy < 0 && !held) this.vy *= FEEL.CUT_RISE;
    this.fellFrom = this.vy;
    this.vy = Math.min(CFG.TERMINAL, this.vy + CFG.GRAVITY);
  }

  collide(g) {
    const legs = Math.max(1, Math.ceil(Math.abs(this.vx) / 3));
    for (let i = 0; i < legs; i++) {
      this.x += this.vx / legs;
      if (World.solidAt(this.x - 3, this.y - 20, 6, 19)) { this.x -= this.vx / legs; this.vx = 0; break; }
    }
    this.x = clamp(this.x, 6, LEVEL_W - 6);

    const wasAir = !this.grounded;
    this.y += this.vy;
    this.grounded = false;
    const hit = World.solidAt(this.x - 3, this.y - 20, 6, 20);
    if (hit) {
      if (this.vy > 0) {
        this.y = hit.y;
        this.grounded = true;
        if (wasAir && this.fellFrom > 2.0) {
          const f = clamp01(this.fellFrom / 6);
          this.sqx = 1 + f * FEEL.SQUASH;
          this.sqy = 1 - f * FEEL.STRETCH;
          fxDust(this.x, this.y, 4 + (f * 8) | 0, 10);
          G.shake = f * 2.4;
          Sound.land(f);
          emitNoise(this.x, this.y, g.noise);
        }
      } else {
        this.y = hit.y + hit.h + 20;
      }
      this.vy = 0;
    }

    if (this.y > CFG.VIEW_H + 60) {
      let back = this.x - 34;
      while (back > 20 && !World.solidAt(back - 3, GROUND, 6, 4)) back -= 8;
      this.x = Math.max(20, back);
      this.y = GROUND;
      this.vy = 0;
      logLine('you went down into the cut and dragged yourself out.');
      fxDust(this.x, this.y, 10, 14);
      this.hurt(1);
    }
  }

  strike() {
    this.atk = FEEL.ATTACK_LOCK;
    const reach = armStats(this);
    let target = null, near = 1e9;
    for (const f of G.foes) {
      const d = Math.abs(f.x - this.x);
      if (!f.alive || d >= near || d > reach.reach || Math.abs(f.y - this.y) >= 18) continue;
      near = d;
      target = f;
    }

    if (!target) {
      fxDust(this.x + this.dir * 8, this.y, 3, 5);
      emitNoise(this.x, this.y, 0.18);
      return;
    }

    const behind = (target.dir === 1 && this.x < target.x) || (target.dir === -1 && this.x > target.x);
    const F = FOES[target.type];

    if (F.boss) {
      const open = target.move !== null && target.tell === 0;
      if (open) {
        target.hp -= reach.dmg * 2;
        G.freeze = 7;
        G.shake = 4;
        Sound.crunch();
        fxBurst(target.x, target.y - 16,
          { count: 10, dir: this.dir, slow: 0.6, fast: 1.8, lift: 1.5, life: 22, grav: 0.15 });
      } else {
        target.hp -= 1;
        G.shake = 2;
        Sound.clang();
        for (let i = 0; i < 5; i++) {
          emit(target.x - this.dir * 6, this.y - 16, -this.dir * rand(0.5, 1.4), -Math.random(), PAL.au2, 14, 0.12);
        }
      }
      emitNoise(target.x, target.y, 0.5);
      if (target.hp <= 0) { target.alive = false; G.kills++; target.spill(); }
      return;
    }

    if (F.armour) {
      target.hp -= behind ? reach.dmg * 2 : 1;
      target.rouse();
      G.shake = 4;
      G.freeze = 6;
      Sound.clang();
      fxBurst(target.x - this.dir * 6, this.y - 14,
        { count: 6, dir: -this.dir, fast: 1.5, lift: 1.2, colour: PAL.st5, life: 16, grav: 0.12 });
      emitNoise(target.x, target.y, 0.5);
      if (target.hp <= 0) { target.alive = false; G.kills++; target.spill(); }
      return;
    }

    // TODO this one-shots anything not already alert, so you can fight the whole game
    // and never touch the stealth. wants a stamina cost or a wind-up.
    if (behind && target.state !== 'alert') {
      target.alive = false;
      G.kills++;
      G.quietKills++;
      target.spill();
      emitNoise(target.x, target.y, 0.12);
      G.freeze = 7;
      G.shake = 2.4;
      Sound.crunch();
      fxBurst(target.x, target.y - 12, { count: 10, life: 22 });
      return;
    }

    target.hp -= reach.dmg;
    target.rouse();
    emitNoise(target.x, target.y, 0.62);
    G.freeze = 5;
    G.shake = 3.4;
    Sound.crunch();
    fxBurst(target.x, target.y - 12,
      { count: 8, dir: this.dir, slow: 0.6, fast: 1.6, lift: 1.4, life: 18, grav: 0.16 });
    if (target.hp <= 0) { target.alive = false; G.kills++; target.spill(); }
  }
}

class Shot {
  constructor(x, y, vx, life, mine) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.life = life;
    this.mine = mine;
  }

  update(p, hum) {
    this.x += this.vx;
    this.life--;
    if (this.mine) this.seekFoe();
    else this.seekPlayer(p, hum);
  }

  seekFoe() {
    if (World.solidAt(this.x - 1, this.y - 1, 2, 2)) {
      this.life = 0;
      fxDust(this.x, this.y + 3, 3, 4);
      return;
    }
    const hit = G.foes.find(f => f.alive
      && Math.abs(f.x - this.x) < 7 && Math.abs(f.y - 14 - this.y) < 13);
    if (!hit) return;
    this.life = 0;
    hit.hp -= FEEL.SHOT_DMG;
    hit.rouse();
    G.freeze = 6;
    G.shake = 3;
    Sound.crunch();
    for (let i = 0; i < 9; i++) {
      emit(hit.x, this.y, sign(this.vx) * rand(0.5, 1.7), rand(-1.2, 0.4), PAL.blood, 20, 0.15);
    }
    if (hit.hp <= 0) { hit.alive = false; G.kills++; hit.spill(); }
  }

  seekPlayer(p, hum) {
    emit(this.x, this.y, 0, 0, PAL.warn, 8, 0);
    if (Math.abs(this.x - p.x) > 7 || Math.abs(this.y - (p.y - 12)) > 12 || p.iframe > 0) return;
    p.hurt(1 + (hum < 45 ? 1 : 0));
    this.life = 0;
  }
}

class Foe extends Entity {
  constructor(type, x, x0, x1, ease) {
    super(x, FOES[type].hp);
    this.type = type;
    this.x0 = x0;
    this.x1 = x1;
    this.ease = ease;
    this.sus = 0;
    this.state = 'patrol';
    this.alive = true;
    this.shout = 0;
    this.eyes = false;
    this.move = null;
    this.moveTimer = 90;
    this.moveState = 0;
    this.windup = 0;
    this.tell = 0;
  }

  rouse() { this.state = 'alert'; this.sus = 100; }

  spill() {
    const F = FOES[this.type];
    const loot = { x: this.x, y: this.y, taken: false };
    if (F.boss || F.beast) loot.limb = pick(F.drop);
    else if (!G.p.gun) loot.gear = 'gun';
    else if (Math.random() < CFG.AMMO_CHANCE) loot.gear = 'rounds';
    else if (Math.random() < CFG.DROP_CHANCE) loot.limb = pick(F.drop);
    else return;
    G.pickups.push(loot);
  }

  notice(p, hum) {
    const F = FOES[this.type];
    let range, rate;
    if (hum > 75) { range = 42; rate = 0.55; }
    else if (hum >= 40) { range = 96; rate = 1.35; }
    else { range = 134; rate = 4.20; }
    range *= this.ease * F.sight;
    rate *= this.ease;
    if (World.litGround(p.x)) range *= 2;

    const dx = p.x - this.x;
    const facing = (dx > 0 && this.dir === 1) || (dx < 0 && this.dir === -1);
    const hidden = World.inFoliage(p.x, p.y - 8) && this.state !== 'alert';

    this.eyes = F.beast
      ? Math.abs(dx) < 96 && !hidden
      : facing && Math.abs(dx) < range && Math.abs(this.y - p.y) < 22 && !hidden;

    if (this.eyes) this.sus = Math.min(100, this.sus + (F.beast ? 3.2 : rate));
    else this.sus = Math.max(0, this.sus - (this.state === 'alert' ? FEEL.ALERT_DECAY : 0.9));

    if (G.hot > 0 && !F.beast) this.sus = 100;
    if (this.sus >= 100) this.state = 'alert';
    else if (this.sus > 34) this.state = 'suspicious';
    else this.state = 'patrol';
    if (this.state === 'alert' && !F.beast) G.seen = true;
  }

  act(p) {
    const F = FOES[this.type];
    const dx = p.x - this.x;
    this.walk += 0.06;
    if (F.boss) return;

    if (this.state !== 'alert') {
      if (this.state === 'suspicious') { this.dir = dx > 0 ? 1 : -1; return; }
      this.x += this.dir * 0.32;
      if (this.x < this.x0) { this.x = this.x0; this.dir = 1; }
      if (this.x > this.x1) { this.x = this.x1; this.dir = -1; }
      return;
    }

    this.shout++;
    if (this.shout % 48 === 0) emitNoise(this.x, this.y, 0.55);

    if (F.flees) {
      if (dx > 0) this.dir = -1;
      else this.dir = 1;
      this.x = clamp(this.x + this.dir * F.speed, 20, LEVEL_W - 20);
      return;
    }

    if (F.radio && !G.hot) {
      if (this.x1 > this.x) this.dir = 1;
      else this.dir = -1;
      this.x += this.dir * F.speed * 1.25;
      if (this.shout % 26 === 0) {
        emit(this.x, this.y - 30, 0, -0.5, PAL.au2, 20, 0);
      }
      if (this.shout > CFG.RADIO_TIME || Math.abs(this.x - this.x1) < 6) {
        G.hot = CFG.HOT_TIME;
        G.flash = 10;
        G.shake = 4;
        Sound.alarm();
        logLine('<b>the commander reached a radio.</b> break their line of sight and it dies down.');
      }
      return;
    }

    if (dx > 0) this.dir = 1;
    else this.dir = -1;
    if (Math.abs(dx) > 12) this.x += this.dir * F.speed;
    if (this.near(p, 11, 18) && p.iframe === 0) p.hurt(F.dmg);
  }
}

function takeGear(p, u) {
  u.taken = true;
  const G = GEAR[u.gear];
  if (u.gear === 'gun') {
    p.gun = true;
    p.ammo = Math.min(CFG.AMMO_MAX, p.ammo + 3);
    logLine('<b>his sidearm.</b> three rounds in it. K fires.');
  } else if (u.gear === 'rounds') {
    p.ammo = Math.min(CFG.AMMO_MAX, p.ammo + G.ammo);
    logLine('rounds. ' + p.ammo + ' now.');
  } else {
    p.parts.push(u.gear);
    logLine(p.parts.length === CAN_PARTS.length
      ? '<b>' + G.name + '.</b> that is all three. hold C.'
      : G.name + '. ' + p.parts.length + ' of ' + CAN_PARTS.length + '.');
  }
  Sound.page();
  for (let i = 0; i < 10; i++)
    emit(u.x, u.y - 12, rand(-1, 1), rand(-1.4, 0.2), PAL.au3, 22, 0.09);
}

const TUTORIAL = [
  { key: 'move', text: 'A   D   to drag yourself  ·  SPACE  to hop  ·  ESC pause',
    near: () => true,
    done: p => p.hops >= 1 || p.x > 88 || G.fitted >= 1 },
  { key: 'take', text: 'HOLD  E   to take the leg',
    near: p => G.pickups.some(u => !u.taken && Math.abs(u.x - p.x) < 110),
    done: () => G.fitted >= 1 },
  { key: 'hide', text: 'stand in the ferns  ·  they cannot see you in there',
    near: p => FOLIAGE.some(f => p.x > f.x - 70 && p.x < f.x + f.w + 70),
    done: p => p.fernFrames > FEEL.FERN_LESSON },
  { key: 'jump', text: 'two legs now  ·  SPACE reaches the ledge',
    near: () => G.fitted >= 1,
    done: p => p.y < GROUND - 16 },
  { key: 'kill', text: 'get behind him, then  J  ·  from behind it is quiet',
    near: p => G.foes.some(f => f.alive && !FOES[f.type].beast && Math.abs(f.x - p.x) < 120),
    done: () => G.kills >= 1 },
  { key: 'read', text: 'HUM, bottom left  ·  that is how human you read  ·  low and they look twice as hard',
    near: p => humanity(p) < 72,
    done: (p, seen) => seen > 260 },
  { key: 'gun', text: 'K  fires it  ·  bare, the shot carries the whole zone',
    near: p => armedWithGun(p) && p.ammo > 0,
    done: p => p.fired >= 1 },
  { key: 'can', text: 'sleeve, spring, rag  ·  HOLD C  ·  then it is quiet',
    near: p => p.parts.length === CAN_PARTS.length && !p.silencer,
    done: p => p.silencer },
  { key: 'cool', text: 'get out of their eyeline and hold  ·  the alarm burns itself out',
    near: () => G.hot > 0,
    done: () => G.hot === 0 },
];

const tutorial = { done: [], shown: [], current: -1, hold: 0 };

function updateTutorial(p) {
  if (tutorial.current >= 0) tutorial.shown[tutorial.current]++;
  for (let i = 0; i < TUTORIAL.length; i++) {
    if (!tutorial.done[i] && tutorial.shown[i] > 20 && TUTORIAL[i].done(p, tutorial.shown[i])) {
      tutorial.done[i] = true;
      if (tutorial.current === i) tutorial.hold = 55;
    }
  }
  if (tutorial.hold > 0) { tutorial.hold--; return; }
  tutorial.current = -1;
  for (let i = 0; i < TUTORIAL.length; i++) {
    if (!tutorial.done[i] && TUTORIAL[i].near(p)) { tutorial.current = i; break; }
  }
}

function kingPhase(hp) {
  let phase = KING_PHASES[KING_PHASES.length - 1];
  for (const ph of KING_PHASES) {
    if (hp > ph.above) { phase = ph; break; }
  }
  return phase;
}

function spawnGuard(x, dir) {
  const g = new Foe('guard', x, 860, CFG.KING_WALL, 1);
  g.dir = dir;
  g.rouse();
  G.foes.push(g);
  fxBurst(x, GROUND - 12, { colour: PAL.gd3, grav: 0.1 });
}

function tearOffLimb(p) {
  let where = null;
  if (p.arms[0] && p.arms[1]) where = p.arms;
  else if (p.legs[0] && p.legs[1]) where = p.legs;
  if (!where) return null;
  const limb = where[p.side];
  where[p.side] = null;
  G.pickups.push({ x: clamp(p.x - p.dir * 26, 20, LEVEL_W - 20), y: GROUND, limb, taken: false });
  return limb;
}

function kingMove(K, p, ph) {
  const dx = p.x - K.x;
  if (K.tell > 0) K.tell--;

  switch (K.move) {
    case 'lash': {
      if (K.moveState === 0) {
        K.dir = sign(dx) || K.dir;
        K.windup = FEEL.TELL_LASH;
        K.tell = FEEL.TELL_LASH;
        K.moveState = 1;
        Sound.clang();
        return;
      }
      if (K.moveState === 1) {
        K.windup--;
        if (K.windup > 0) return;
        K.moveState = 2;
        K.windup = FEEL.LASH_HIT;
        G.shake = 5;
        Sound.crunch();
        return;
      }
      K.x += K.dir * FEEL.LASH_SPEED * ph.speed;
      K.windup--;
      for (let i = 0; i < 2; i++) {
        emit(K.x + K.dir * 10, GROUND - 14 - i * 6, K.dir * rand(0.4, 1.4), rand(-0.4, 0.4), PAL.au2, 12, 0.02);
      }
      if (K.near(p, FEEL.LASH_REACH, 20) && p.iframe === 0) {
        p.hurt(FOES.king.dmg);
        p.vx = K.dir * FEEL.LASH_PUSH;
      }
      if (K.windup <= 0) endKingMove(K, FEEL.CD_LASH);
      return;
    }

    case 'grab': {
      if (K.moveState === 0) {
        K.dir = sign(dx) || K.dir;
        K.windup = FEEL.TELL_GRAB;
        K.tell = FEEL.TELL_GRAB;
        K.moveState = 1;
        logLine('<b>the king.</b> ' + KING_LINES.miss);
        return;
      }
      if (K.moveState === 1) {
        K.windup--;
        if (K.windup > 0) return;
        K.moveState = 2;
        K.windup = FEEL.GRAB_HIT;
        G.shake = 6;
        return;
      }
      K.x += K.dir * FEEL.GRAB_SPEED * ph.speed;
      K.windup--;
      if (K.near(p, FEEL.GRAB_REACH, 20) && p.iframe === 0) {
        const taken = tearOffLimb(p);
        p.hurt(1);
        if (taken) {
          G.freeze = 14;
          G.shake = 7;
          logLine('<b>he takes the ' + LIMBS[taken].name + '.</b> ' + KING_LINES.grab);
        }
        endKingMove(K, FEEL.CD_GRABBED);
        return;
      }
      if (K.windup <= 0) endKingMove(K, FEEL.CD_GRAB);
      return;
    }

    case 'volley': {
      if (K.moveState === 0) {
        K.dir = sign(dx) || K.dir;
        K.windup = FEEL.TELL_VOLLEY;
        K.tell = FEEL.TELL_VOLLEY;
        K.moveState = 1;
        return;
      }
      K.windup--;
      if (K.windup > 0) return;
      for (let k = -1; k <= 1; k++) {
        G.shots.push(new Shot(K.x, GROUND - 22 + k * 9,
                              K.dir * FEEL.BOLT_SPEED * ph.speed, FEEL.BOLT_LIFE, false));
      }
      Sound.alarm();
      G.shake = 3;
      endKingMove(K, FEEL.CD_VOLLEY);
      return;
    }

    case 'sweep': {
      if (K.moveState === 0) {
        K.windup = FEEL.SWEEP_TIME;
        K.tell = FEEL.TELL_CALL;
        K.moveState = 1;
        G.sweep = 0;
        return;
      }
      K.windup--;
      G.sweep += 0.03;
      const lx = 1040 + Math.sin(G.sweep) * 150;
      LIGHTS = [{ x: lx - 40, w: 80 }];
      if (K.windup % 30 === 0 && Math.abs(p.x - lx) < 46) {
        G.shots.push(new Shot(K.x, GROUND - 22,
                              sign(p.x - K.x) * FEEL.BOLT_HOMING, FEEL.BOLT_LIFE, false));
      }
      if (K.windup <= 0) {
        LIGHTS = [];
        endKingMove(K, FEEL.CD_SWEEP);
      }
      return;
    }

    case 'call': {
      if (K.moveState === 0) {
        K.windup = FEEL.TELL_CALL;
        K.tell = FEEL.TELL_CALL;
        K.moveState = 1;
        return;
      }
      K.windup--;
      if (K.windup > 0) return;
      let standing = 0;
      for (const f of G.foes) {
        if (f.alive && !FOES[f.type].boss) standing++;
      }
      if (standing < CFG.FENCE_MAX) {
        spawnGuard(900, 1);
        spawnGuard(CFG.KING_WALL, -1);
        logLine('two more from the fence line.');
      }
      endKingMove(K, FEEL.CD_CALL);
      return;
    }
  }
}

function endKingMove(K, cooldown) {
  K.move = null;
  K.moveState = 0;
  K.windup = 0;
  K.tell = 0;
  K.moveTimer = cooldown;
}

function runBossMove(p, hum) {
  if (!G.bossSpawned && p.x > CFG.KING_AT) {
    G.bossSpawned = true;
    G.boss = new Foe('king', 1120, 880, CFG.KING_WALL, 1);
    G.boss.dir = -1;
    G.boss.rouse();
    G.foes.push(G.boss);
    G.phase = 1;
    G.card = 110;
    G.shake = 6;
    Sound.bossOn();
    logLine('<b>the king.</b> ' + KING_LINES.enter);
  }

  const K = G.boss;
  if (K && K.alive) {
    const ph = kingPhase(K.hp);
    const at = KING_PHASES.indexOf(ph) + 1;
    if (at !== G.phase) {
      G.phase = at;
      G.shake = 5;
      G.freeze = 10;
      endKingMove(K, FEEL.CD_PHASE);
      if (at === 3) logLine('<b>the king.</b> ' + KING_LINES.turn(hum));
    }
    if (K.move) {
      kingMove(K, p, ph);
    } else {
      K.moveTimer--;
      const gap = Math.abs(p.x - K.x);
      if (gap > FEEL.MOVE_GAP) K.x += sign(p.x - K.x) * 0.7 * ph.speed;
      else K.moveTimer -= 2;
      if (K.moveTimer <= 0) {
        K.move = pick(ph.moves);
        K.moveState = 0;
      }
    }
    K.x = clamp(K.x, 870, CFG.KING_WALL);
  }

  if (G.bossSpawned && K && !K.alive && !G.bossDone) {
    G.bossDone = true;
    LIGHTS = [];
    Sound.bossOff();
    logLine('<b>the king.</b> ' + KING_LINES.die);
  }
  if (G.bossSpawned && K && K.alive && p.x > CFG.KING_WALL) {
    p.x = CFG.KING_WALL;
  }
}

function stepWorld() {
  const p = G.p;
  G.t += CFG.FIXED_STEP;
  G.shake *= 0.86;
  if (G.flash > 0) G.flash--;
  if (G.fade > 0) G.fade -= 0.03;
  if (G.card > 0) G.card--;

  const g = moveStats(p);
  const hum = humanity(p);

  for (const u of G.pickups) {
    if (u.taken || !u.gear || GEAR[u.gear].hold) continue;
    if (u.gear === 'rounds' && p.ammo >= CFG.AMMO_MAX) continue;
    if (p.near(u, 12, 17)) takeGear(p, u);
  }

  const underfoot = G.pickups.find(u => !u.taken && (u.limb || GEAR[u.gear].hold)
    && p.near(u, 11, 14));

  if (underfoot && keys['e'] && p.grounded) {
    p.fitting += CFG.FIXED_STEP;
    if (p.fitting % 0.14 < CFG.FIXED_STEP) {
      emit(p.x + rand(-4, 4), p.y - 12, 0, -0.5, PAL.au2, 14, 0);
    }
    if (p.fitting >= CFG.FIT_TIME) {
      if (underfoot.limb) { p.fit(underfoot.limb); underfoot.taken = true; }
      else takeGear(p, underfoot);
      p.fitting = 0;
      G.freeze = 6;
      G.shake = 3;
      Sound.fit();
      for (let i = 0; i < 14; i++)
        emit(p.x, p.y - 12, rand(-1.2, 1.2), rand(-1.8, 0.2), PAL.au3, 26, 0.09);
      emitNoise(p.x, p.y, 0.25);
    }
  } else {
    p.fitting = 0;
  }

  const building = p.parts.length === CAN_PARTS.length && !p.silencer && p.gun
    && keys['c'] && p.grounded && !underfoot;
  if (building) {
    p.building += CFG.FIXED_STEP;
    if (p.building % 0.18 < CFG.FIXED_STEP) {
      Sound.build();
      emit(p.x + rand(-5, 5), p.y - 11, rand(-0.4, 0.4), -0.4, PAL.st5, 18, 0.05);
    }
    if (p.building >= FEEL.CAN_TIME) {
      p.silencer = true;
      p.building = 0;
      G.freeze = 8;
      Sound.unseen();
      logLine('<b>a can, out of a sleeve and a spring and a rag.</b> it will not last many shots. it does not have to.');
    }
  } else {
    p.building = 0;
  }

  const busy = p.fitting > 0 || building;
  p.move(g, busy);
  p.collide(g);

  if (p.grounded && Math.abs(p.vx) > 0.1) {
    const before = p.walk;
    p.walk += Math.abs(p.vx) * 0.22;
    if (Math.floor(before / Math.PI) !== Math.floor(p.walk / Math.PI)) {
      Sound.footfall(g.noise);
    }
    if (World.inFoliage(p.x, p.y - 8) && Math.random() < 0.14) {
      fxLeaves(p.x, p.y, 1);
    }
  }
  if (World.inFoliage(p.x, p.y - 8)) p.fernFrames++;

  p.sqx = span(p.sqx, 1, FEEL.SETTLE);
  p.sqy = span(p.sqy, 1, FEEL.SETTLE);
  if (p.iframe > 0) p.iframe--;
  if (p.atk > 0) p.atk--;
  if (p.shot > 0) p.shot--;
  if (!busy && keys['j'] && p.atk === 0) p.strike();
  if (!busy && keys['k'] && p.shot === 0 && p.ammo > 0 && armedWithGun(p)) {
    p.shoot();
  }

  updateTutorial(p);

  for (const f of G.foes) {
    if (!f.alive) continue;
    f.notice(p, hum);
    f.act(p);
  }

  for (const n of NOTES) {
    if (!n.read && Math.abs(n.x - p.x) < 12 && p.grounded) {
      n.read = true;
      logLine(n.text);
      Sound.page();
      emit(n.x, p.y - 14, 0, -0.4, PAL.bone, 24, 0);
    }
  }

  if (G.hot > 0) {
    let watched = false;
    for (const f of G.foes) {
      if (f.alive && f.eyes && !FOES[f.type].beast) watched = true;
    }
    if (watched) G.hot = CFG.HOT_TIME;
    else G.hot--;
    if (G.hot === 0) {
      for (const f of G.foes)
        if (!FOES[f.type].beast) { f.sus = Math.min(f.sus, 28); f.state = 'patrol'; }
      G.hunt = 0;
      G.hunted = 0;
      logLine('the shouting stops. they are drifting back to their posts.');
    }
  }

  if (G.hot > 0 && !ZONES[G.zone].boss) {
    G.hunt++;
    if (G.hunt % CFG.HUNT_EVERY === 0 && G.hunted < CFG.HUNT_MAX) {
      const sx = Math.max(20, p.x - 150);
      const chaser = new Foe('guard', sx, sx - 40, LEVEL_W - 40, 1);
      chaser.rouse();
      G.foes.push(chaser);
      G.hunted++;
      logLine('someone else is coming up the line.');
    }
  }

  if (ZONES[G.zone].boss) runBossMove(p, hum);

  for (const b of G.shots) {
    b.update(p, hum);
  }
  prune(G.shots);

  for (const r of G.rings) {
    r.r = span(r.r, r.max, 0.10);
    r.life -= 0.022;
  }
  prune(G.rings);

  for (const q of G.parts) {
    q.vy += q.grav;
    q.x += q.vx;
    q.y += q.vy;
    q.vx *= 0.985;
    q.life--;
  }
  prune(G.parts);

  for (const m of G.motes) {
    m.x += m.vx;
    m.y += m.vy;
    if (m.y < -4) { m.y = CFG.VIEW_H + 4; m.x = Math.random() * (CFG.VIEW_W + 80); }
    if (m.x < -40) m.x = CFG.VIEW_W + 40;
  }

  for (const l of G.log) l.life--;
  prune(G.log);

  const want = clamp(p.x - CFG.VIEW_W / 2 + p.dir * CFG.CAM_LEAD, 0, LEVEL_W - CFG.VIEW_W);
  G.cam = span(G.cam, want, CFG.CAM_LERP);
  G.camY = span(G.camY, clamp(p.y - GROUND, -8, 24), 0.06);

  if (G.running && p.x > EXIT_X) leaveZone();
}

function leaveZone() {
  if (!G.seen) {
    G.ghosted.push(ZONES[G.zone].name);
    G.p.hp = Math.min(G.p.hpMax, G.p.hp + 1);
    Sound.unseen();
    logLine('<b>nobody saw you leave.</b> you got some of yourself back.');
  }
  if (G.zone + 1 >= ZONES.length) { endRun(true); return; }
  loadZone(G.zone + 1);
  saveCheckpoint();
  G.fade = 1;
}
