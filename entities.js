'use strict';
// needs core.js: LIMBS, ENEMY_TYPES, ZONES, CONFIG and the shared game state.

// tune these, not the code below
const TUNE = {
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
  RELOAD_LOCK: 40,
  SHOT_SPEED: 4.4,
  SHOT_DMG: 3,
  SHOT_LOUD: 1.55,
  SHOT_QUIET: 0.2,
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

function advanceZone() {
  if (!game.seen) {
    game.ghosted.push(ZONES[game.zone].name);
    game.player.hp = Math.min(game.player.hpMax, game.player.hp + CONFIG.UNSEEN_HEAL);
    audio.unseen();
    logLine('<b>nobody saw you leave.</b> you got some of yourself back.');
  }
  if (game.zone + 1 >= ZONES.length) {
    endRun(true);
    return;
  }
  loadZone(game.zone + 1);
  saveCheckpoint();
  game.fade = 1;
}

function hasGrip(p) {
  for (const id of p.arms) {
    if (id && LIMBS[id].grip) return true;
  }
  return false;
}
function updateTutorial(p) {
  if (tutorial.current >= 0) tutorial.shown[tutorial.current]++;
  for (let i = 0; i < TUTORIAL.length; i++) {
    if (!tutorial.done[i] && tutorial.shown[i] > 20 && TUTORIAL[i].done(p, tutorial.shown[i])) {
      tutorial.done[i] = true;
      if (tutorial.current === i) tutorial.hold = 55;
    }
  }
  if (tutorial.hold > 0) {
    tutorial.hold--;
    return;
  }
  tutorial.current = -1;
  for (let i = 0; i < TUTORIAL.length; i++) {
    if (!tutorial.done[i] && TUTORIAL[i].near(p)) {
      tutorial.current = i;
      break;
    }
  }
}

function kingPhase(hp) {
  let phase = KING_PHASES[KING_PHASES.length - 1];
  for (const ph of KING_PHASES) {
    if (hp > ph.above) {
      phase = ph;
      break;
    }
  }
  return phase;
}
function stepGame() {
  const p = game.player;
  game.time += CONFIG.FIXED_STEP;
  game.shake *= 0.86;
  if (game.flash > 0) game.flash--;
  if (game.fade > 0) game.fade -= 0.03;
  if (game.cardT > 0) game.cardT--;

  const g = legStats(p);
  const hum = humanity(p);
  for (const u of game.pickups) {
    if (u.taken || !u.gear || GEAR[u.gear].hold) continue;
    if (u.gear === 'rounds' && p.mags >= CONFIG.MAGS_MAX) continue;
    if (p.near(u, 12, 17)) takeGear(p, u);
  }

  const underfoot = game.pickups.find(
    u => !u.taken && (u.limb || GEAR[u.gear].hold) && p.near(u, 11, 14),
  );

  if (underfoot && keys['e'] && p.grounded) {
    p.fitting += CONFIG.FIXED_STEP;
    if (p.fitting % 0.14 < CONFIG.FIXED_STEP) {
      addParticle(p.x + randRange(-4, 4), p.y - 12, 0, -0.5, PALETTE.au2, 14, 0);
    }

    if (p.fitting >= CONFIG.FIT_TIME) {
      if (underfoot.limb) {
        p.fit(underfoot.limb);
        underfoot.taken = true;
      } else takeGear(p, underfoot);
      p.fitting = 0;
      game.freeze = 6;
      game.shake = 3;
      audio.fit();
      for (let i = 0; i < 14; i++)
        addParticle(
          p.x,
          p.y - 12,
          randRange(-1.2, 1.2),
          randRange(-1.8, 0.2),
          PALETTE.au3,
          26,
          0.09,
        );
      emitNoise(p.x, p.y, 0.25);
    }
  } else {
    p.fitting = 0;
  }
  const building =
    p.canParts.length === CAN_PARTS.length &&
    !p.silencer &&
    p.gun &&
    keys['c'] &&
    p.grounded &&
    !underfoot;
  if (building) {
    p.building += CONFIG.FIXED_STEP;
    if (p.building % 0.18 < CONFIG.FIXED_STEP) {
      audio.build();
      addParticle(
        p.x + randRange(-5, 5),
        p.y - 11,
        randRange(-0.4, 0.4),
        -0.4,
        PALETTE.st5,
        18,
        0.05,
      );
    }

    if (p.building >= TUNE.CAN_TIME) {
      p.silencer = true;
      p.building = 0;
      game.freeze = 8;
      audio.unseen();
      logLine(
        '<b>a can, out of a sleeve and a spring and a rag.</b> it will not last many shots. it does not have to.',
      );
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
      audio.footfall(g.noise);
    }
    if (world.inFoliage(p.x, p.y - 8) && Math.random() < 0.14) {
      leafBurst(p.x, p.y, 1);
    }
  }
  if (world.inFoliage(p.x, p.y - 8)) p.fernFrames++;

  p.sqx = lerp(p.sqx, 1, TUNE.SETTLE);
  p.sqy = lerp(p.sqy, 1, TUNE.SETTLE);
  if (p.iframe > 0) p.iframe--;
  if (p.atk > 0) p.atk--;
  if (p.shot > 0) p.shot--;

  if (!busy && keys['j'] && p.atk === 0) p.strike();
  if (!busy && keys['k'] && p.shot === 0 && canFire(p)) {
    if (p.ammo > 0) p.shoot();
    else if (p.mags > 0 && p.ammo === 0) p.reload();
  }

  updateTutorial(p);

  for (const f of game.enemies) {
    if (!f.alive) continue;
    f.notice(p, hum);
    f.act(p);
  }

  for (const n of notes) {
    if (!n.read && Math.abs(n.x - p.x) < 12 && p.grounded) {
      n.read = true;
      logLine(n.text);
      audio.page();
      addParticle(n.x, p.y - 14, 0, -0.4, PALETTE.bone, 24, 0);
    }
  }

  if (game.alarm > 0) {
    let watched = false;
    for (const f of game.enemies) {
      if (f.alive && f.eyes && !ENEMY_TYPES[f.type].beast) watched = true;
    }
    if (watched) game.alarm = CONFIG.HOT_TIME;
    else game.alarm--;
    if (game.alarm === 0) {
      for (const f of game.enemies)
        if (!ENEMY_TYPES[f.type].beast) {
          f.sus = Math.min(f.sus, 28);
          f.state = 'patrol';
        }
      game.huntTimer = 0;
      game.huntCount = 0;

      logLine('the shouting stops. they are drifting back to their posts.');
    }
  }

  if (game.alarm > 0 && !ZONES[game.zone].boss) {
    game.huntTimer++;
    if (game.huntTimer % CONFIG.HUNT_EVERY === 0 && game.huntCount < CONFIG.HUNT_MAX) {
      const sx = Math.max(20, p.x - 150);
      const chaser = new Enemy('guard', sx, sx - 40, zoneWidth - 40, 1);
      chaser.rouse();

      game.enemies.push(chaser);
      game.huntCount++;
      logLine('someone else is coming up the line.');
    }
  }

  if (ZONES[game.zone].boss) updateKing(p, hum);
  for (const b of game.bullets) {
    b.update(p, hum);
  }
  compact(game.bullets);

  for (const r of game.noiseRings) {
    r.r = lerp(r.r, r.max, 0.1);
    r.life -= 0.022;
  }
  compact(game.noiseRings);
  for (const q of game.particles) {
    q.vy += q.grav;
    q.x += q.vx;

    q.y += q.vy;
    q.vx *= 0.985;
    q.life--;
  }

  compact(game.particles);

  for (const m of game.motes) {
    m.x += m.vx;
    m.y += m.vy;

    if (m.y < -4) {
      m.y = CONFIG.VIEW_H + 4;
      m.x = Math.random() * (CONFIG.VIEW_W + 80);
    }
    if (m.x < -40) m.x = CONFIG.VIEW_W + 40;
  }
  for (const l of game.log) l.life--;
  compact(game.log);

  const want = clamp(
    p.x - CONFIG.VIEW_W / 2 + p.dir * CONFIG.CAM_LEAD,
    0,
    zoneWidth - CONFIG.VIEW_W,
  );
  game.cam = lerp(game.cam, want, CONFIG.CAM_LERP);

  game.camY = lerp(game.camY, clamp(p.y - GROUND, -8, 24), 0.06);

  if (game.running && p.x > zoneExit) advanceZone();
}

class Actor {
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

class Player extends Actor {
  constructor() {
    super(40, CONFIG.PLAYER_HP);
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
    this.mags = 0;
    this.silencer = false;

    this.canParts = [];

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

    game.fitted++;
    if (off) {
      game.pickups.push({ x: this.x - this.dir * 17, y: this.y, limb: off, taken: false });
    }
  }

  reload() {
    this.shot = TUNE.RELOAD_LOCK;
    this.ammo = CONFIG.MAG_SIZE;
    audio.clang();
    emitNoise(this.x, this.y, 0.3);
    logLine('fresh mag. ' + this.mags + ' left.');
  }
  shoot() {
    this.shot = TUNE.SHOT_LOCK;
    this.ammo--;
    if (this.ammo === 0) this.mags--;
    this.fired++;
    const gy = this.y - 14;
    game.bullets.push(
      new Bullet(this.x + this.dir * 8, gy, this.dir * TUNE.SHOT_SPEED, TUNE.SHOT_LIFE, true),
    );

    if (this.silencer) {
      game.shake = 1.1;

      game.freeze = 2;
      this.vx -= this.dir * 0.2;
      for (let i = 0; i < 3; i++)
        addParticle(
          this.x + this.dir * 10,
          gy,
          this.dir * randRange(0.3, 1.1),
          randRange(-0.3, 0.3),
          PALETTE.dim,
          12,
          0.02,
        );
      emitNoise(this.x, gy, TUNE.SHOT_QUIET);
      audio.cough();
      return;
    }

    game.shake = 3.4;
    game.freeze = 4;
    this.vx -= this.dir * 0.6;
    for (let i = 0; i < 8; i++)
      addParticle(
        this.x + this.dir * 10,
        gy,
        this.dir * randRange(0.4, 1.8),
        randRange(-0.5, 0.5),
        PALETTE.glow,
        12,
        0.02,
      );
    emitNoise(this.x, gy, TUNE.SHOT_LOUD);

    audio.shot();
  }

  hurt(n) {
    if (this.iframe > 0) return;
    this.hp -= n;
    this.iframe = TUNE.IFRAMES;
    game.shake = 5.5;
    game.flash = 9;
    game.freeze = 8;
    audio.hurt();
    this.vx = -this.dir * 1.9;
    this.vy = -2.0;
    bloodSpray(this.x, this.y - 12, { count: 12, spread: 1.3, lift: 2, life: 24, grav: 0.16 });

    if (this.hp <= 0) endRun(false);
  }

  move(g, busy) {
    let ax = 0;

    if (!busy) {
      if (keys['a'] || keys['arrowleft']) {
        ax -= 1;
        this.dir = -1;
      }
      if (keys['d'] || keys['arrowright']) {
        ax += 1;
        this.dir = 1;
      }
    }
    this.vx = lerp(
      this.vx,
      ax * g.speed * TUNE.RUN,
      this.grounded ? TUNE.GRIP_GROUND : TUNE.GRIP_AIR,
    );
    if (Math.abs(this.vx) < 0.02) this.vx = 0;
    if (g.hop && this.grounded) this.vx *= TUNE.HOP_DRAG;
    if (this.grounded) this.coyote = CONFIG.COYOTE;
    else this.coyote = Math.max(0, this.coyote - 1);
    const held = keys[' '] || keys['w'] || keys['arrowup'];
    if (!busy && held) this.buffer = CONFIG.BUFFER;
    else this.buffer = Math.max(0, this.buffer - 1);

    if (this.buffer > 0 && this.coyote > 0 && g.jump > 0) {
      this.vy = -CONFIG.JUMP_V * g.jump;
      this.buffer = 0;
      this.coyote = 0;
      this.grounded = false;
      this.sqx = 0.72;
      this.sqy = 1.34;
      if (g.hop) {
        this.vx = this.dir * TUNE.HOP_LAUNCH;
        this.hops++;
      }

      dustBurst(this.x, this.y, 5, 7);
      emitNoise(this.x, this.y, g.noise * 0.5);
    }
    if (this.vy < 0 && !held) this.vy *= TUNE.CUT_RISE;
    this.fellFrom = this.vy;
    this.vy = Math.min(CONFIG.TERMINAL, this.vy + CONFIG.GRAVITY);
  }
  collide(g) {
    const steps = Math.max(1, Math.ceil(Math.abs(this.vx) / 3));
    for (let i = 0; i < steps; i++) {
      this.x += this.vx / steps;
      if (world.solidAt(this.x - 3, this.y - 20, 6, 19)) {
        this.x -= this.vx / steps;
        this.vx = 0;
        break;
      }
    }
    this.x = clamp(this.x, 6, zoneWidth - 6);

    const wasAir = !this.grounded;
    this.y += this.vy;
    this.grounded = false;
    const hit = world.solidAt(this.x - 3, this.y - 20, 6, 20);
    if (hit) {
      if (this.vy > 0) {
        this.y = hit.y;
        this.grounded = true;
        if (wasAir && this.fellFrom > 2.0) {
          const f = clamp01(this.fellFrom / 6);
          this.sqx = 1 + f * TUNE.SQUASH;
          this.sqy = 1 - f * TUNE.STRETCH;
          dustBurst(this.x, this.y, (4 + f * 8) | 0, 10);

          game.shake = f * 2.4;
          audio.land(f);
          emitNoise(this.x, this.y, g.noise);
        }
      } else {
        this.y = hit.y + hit.h + 20;
      }
      this.vy = 0;
    }
    if (this.y > CONFIG.VIEW_H + 60) {
      let back = this.x - 34;
      while (back > 20 && !world.solidAt(back - 3, GROUND, 6, 4)) back -= 8;
      this.x = Math.max(20, back);
      this.y = GROUND;
      this.vy = 0;
      logLine('you went down into the cut and dragged yourself out.');
      dustBurst(this.x, this.y, 10, 14);

      this.hurt(1);
    }
  }

  strike() {
    this.atk = TUNE.ATTACK_LOCK;
    const armReach = armStats(this);
    let target = null,
      near = 1e9;
    for (const f of game.enemies) {
      const d = Math.abs(f.x - this.x);
      if (!f.alive || d >= near || d > armReach.reach || Math.abs(f.y - this.y) >= 18) continue;
      near = d;
      target = f;
    }
    if (!target) {
      dustBurst(this.x + this.dir * 8, this.y, 3, 5);
      emitNoise(this.x, this.y, 0.18);
      return;
    }
    const behind =
      (target.dir === 1 && this.x < target.x) || (target.dir === -1 && this.x > target.x);
    const F = ENEMY_TYPES[target.type];
    if (F.boss) {
      const open = target.move !== null && target.tell === 0;
      if (open) {
        target.hp -= armReach.dmg * 2;
        game.freeze = 7;
        game.shake = 4;
        audio.crunch();

        bloodSpray(target.x, target.y - 16, {
          count: 10,
          dir: this.dir,
          slow: 0.6,
          fast: 1.8,
          lift: 1.5,
          life: 22,
          grav: 0.15,
        });
      } else {
        target.hp -= 1;

        game.shake = 2;
        audio.clang();
        for (let i = 0; i < 5; i++) {
          addParticle(
            target.x - this.dir * 6,
            this.y - 16,
            -this.dir * randRange(0.5, 1.4),
            -Math.random(),
            PALETTE.au2,
            14,
            0.12,
          );
        }
      }

      emitNoise(target.x, target.y, 0.5);
      if (target.hp <= 0) {
        target.alive = false;
        game.kills++;
        target.spill();
      }
      return;
    }

    if (F.armour) {
      target.hp -= behind ? armReach.dmg * 2 : 1;
      target.rouse();
      game.shake = 4;
      game.freeze = 6;
      audio.clang();
      bloodSpray(target.x - this.dir * 6, this.y - 14, {
        count: 6,
        dir: -this.dir,
        fast: 1.5,
        lift: 1.2,
        colour: PALETTE.st5,
        life: 16,
        grav: 0.12,
      });
      emitNoise(target.x, target.y, 0.5);

      if (target.hp <= 0) {
        target.alive = false;
        game.kills++;
        target.spill();
      }
      return;
    }

    // TODO this one-shots anything not already alert, so you can fight the whole game
    // and never touch the stealth. wants a stamina cost or a wind-up.
    if (behind && target.state !== 'alert') {
      target.alive = false;

      game.kills++;
      game.quietKills++;
      target.spill();
      emitNoise(target.x, target.y, 0.12);
      game.freeze = 7;
      game.shake = 2.4;
      audio.crunch();
      bloodSpray(target.x, target.y - 12, { count: 10, life: 22 });
      return;
    }
    target.hp -= armReach.dmg;
    target.rouse();
    emitNoise(target.x, target.y, 0.62);
    game.freeze = 5;
    game.shake = 3.4;
    audio.crunch();
    bloodSpray(target.x, target.y - 12, {
      count: 8,
      dir: this.dir,
      slow: 0.6,
      fast: 1.6,
      lift: 1.4,
      life: 18,
      grav: 0.16,
    });
    if (target.hp <= 0) {
      target.alive = false;
      game.kills++;
      target.spill();
    }
  }
}
class Bullet {
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
    if (world.solidAt(this.x - 1, this.y - 1, 2, 2)) {
      this.life = 0;
      dustBurst(this.x, this.y + 3, 3, 4);
      return;
    }
    const hit = game.enemies.find(
      f => f.alive && Math.abs(f.x - this.x) < 7 && Math.abs(f.y - 14 - this.y) < 13,
    );
    if (!hit) return;
    this.life = 0;
    hit.hp -= TUNE.SHOT_DMG;
    hit.rouse();
    game.freeze = 6;
    game.shake = 3;
    audio.crunch();
    for (let i = 0; i < 9; i++) {
      addParticle(
        hit.x,
        this.y,
        sign(this.vx) * randRange(0.5, 1.7),
        randRange(-1.2, 0.4),
        PALETTE.blood,
        20,
        0.15,
      );
    }
    if (hit.hp <= 0) {
      hit.alive = false;
      game.kills++;
      hit.spill();
    }
  }

  seekPlayer(p, hum) {
    addParticle(this.x, this.y, 0, 0, PALETTE.warn, 8, 0);
    if (Math.abs(this.x - p.x) > 7 || Math.abs(this.y - (p.y - 12)) > 12 || p.iframe > 0) return;

    p.hurt(1 + (hum < 45 ? 1 : 0));
    this.life = 0;
  }
}

class Enemy extends Actor {
  constructor(type, x, x0, x1, ease) {
    super(x, ENEMY_TYPES[type].hp);
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

  rouse() {
    this.state = 'alert';
    this.sus = 100;
  }

  spill() {
    const F = ENEMY_TYPES[this.type];
    const where = { x: this.x, y: this.y, taken: false };
    if (F.boss || F.beast) {
      game.pickups.push({ ...where, limb: pick(F.drop) });
      return;
    }
    if (!game.player.gun) game.pickups.push({ ...where, gear: 'gun' });
    else {
      const spread = CONFIG.MAG_DROP_MAX - CONFIG.MAG_DROP_MIN + 1;
      game.pickups.push({
        ...where,
        gear: 'rounds',
        mags: CONFIG.MAG_DROP_MIN + ((Math.random() * spread) | 0),
      });
    }
    if (Math.random() < CONFIG.DROP_CHANCE) {
      game.pickups.push({ ...where, x: this.x + 14, limb: pick(F.drop) });
    }
  }

  notice(p, hum) {
    const F = ENEMY_TYPES[this.type];
    let range, rate;
    if (hum > 75) {
      range = 42;
      rate = 0.55;
    } else if (hum >= 40) {
      range = 96;
      rate = 1.35;
    } else {
      range = 134;
      rate = 4.2;
    }
    range *= this.ease * F.sight;
    rate *= this.ease;
    if (world.litGround(p.x)) range *= 2;
    const dx = p.x - this.x;
    const facing = (dx > 0 && this.dir === 1) || (dx < 0 && this.dir === -1);
    const hidden = world.inFoliage(p.x, p.y - 8) && this.state !== 'alert';

    this.eyes = F.beast
      ? Math.abs(dx) < 96 && !hidden
      : facing && Math.abs(dx) < range && Math.abs(this.y - p.y) < 22 && !hidden;
    if (this.eyes) this.sus = Math.min(100, this.sus + (F.beast ? 3.2 : rate));
    else this.sus = Math.max(0, this.sus - (this.state === 'alert' ? TUNE.ALERT_DECAY : 0.9));

    if (game.alarm > 0 && !F.beast) this.sus = 100;

    if (this.sus >= 100) this.state = 'alert';
    else if (this.sus > 34) this.state = 'suspicious';
    else this.state = 'patrol';
    if (this.state === 'alert' && !F.beast) game.seen = true;
  }
  act(p) {
    const F = ENEMY_TYPES[this.type];
    const dx = p.x - this.x;
    this.walk += 0.06;
    if (F.boss) return;
    if (this.state !== 'alert') {
      if (this.state === 'suspicious') {
        this.dir = dx > 0 ? 1 : -1;
        return;
      }
      this.x += this.dir * 0.32;
      if (this.x < this.x0) {
        this.x = this.x0;
        this.dir = 1;
      }
      if (this.x > this.x1) {
        this.x = this.x1;
        this.dir = -1;
      }
      return;
    }

    this.shout++;
    if (this.shout % 48 === 0) emitNoise(this.x, this.y, 0.55);

    if (F.flees) {
      if (dx > 0) this.dir = -1;
      else this.dir = 1;
      this.x = clamp(this.x + this.dir * F.speed, 20, zoneWidth - 20);
      return;
    }
    if (F.radio && !game.alarm) {
      if (this.x1 > this.x) this.dir = 1;
      else this.dir = -1;
      this.x += this.dir * F.speed * 1.25;
      if (this.shout % 26 === 0) {
        addParticle(this.x, this.y - 30, 0, -0.5, PALETTE.au2, 20, 0);
      }
      if (this.shout > CONFIG.RADIO_TIME || Math.abs(this.x - this.x1) < 6) {
        game.alarm = CONFIG.HOT_TIME;
        game.flash = 10;
        game.shake = 4;

        audio.alarm();
        logLine(
          '<b>the commander reached a radio.</b> break their line of sight and it dies down.',
        );
      }
      return;
    }
    if (dx > 0) this.dir = 1;
    else this.dir = -1;
    if (Math.abs(dx) > 12) this.x += this.dir * F.speed;
    if (this.near(p, 11, 18) && p.iframe === 0) p.hurt(F.dmg);
  }
}
function humanity(p) {
  const s = limbHum(p.legs[0]) + limbHum(p.legs[1]) + limbHum(p.arms[0]) + limbHum(p.arms[1]);
  return clamp(40 + s, 0, 100);
}
const TUTORIAL = [
  {
    key: 'move',
    text: 'A   D   to drag yourself  ·  SPACE  to hop  ·  ESC pause',
    near: () => true,
    done: p => p.hops >= 1 || p.x > 88 || game.fitted >= 1,
  },
  {
    key: 'take',
    text: 'HOLD  E   to take the leg',
    near: p => game.pickups.some(u => !u.taken && Math.abs(u.x - p.x) < 110),
    done: () => game.fitted >= 1,
  },
  {
    key: 'hide',
    text: 'stand in the ferns  ·  they cannot see you in there',
    near: p => foliage.some(f => p.x > f.x - 70 && p.x < f.x + f.w + 70),
    done: p => p.fernFrames > TUNE.FERN_LESSON,
  },
  {
    key: 'jump',
    text: 'two legs now  ·  SPACE reaches the ledge',
    near: () => game.fitted >= 1,

    done: p => p.y < GROUND - 16,
  },
  {
    key: 'kill',
    text: 'get behind him, then  J  ·  from behind it is quiet',
    near: p =>
      game.enemies.some(f => f.alive && !ENEMY_TYPES[f.type].beast && Math.abs(f.x - p.x) < 120),
    done: () => game.kills >= 1,
  },
  {
    key: 'read',
    text: 'HUM, bottom left  ·  that is how human you read  ·  low and they look twice as hard',

    near: p => humanity(p) < 72,
    done: (p, seen) => seen > 260,
  },

  {
    key: 'gun',
    text: 'K  fires it  ·  bare, the shot carries the whole zone',
    near: p => canFire(p) && (p.ammo > 0 || p.mags > 0),
    done: p => p.fired >= 1,
  },
  {
    key: 'can',
    text: 'sleeve, spring, rag  ·  HOLD C  ·  then it is quiet',
    near: p => p.canParts.length === CAN_PARTS.length && !p.silencer,
    done: p => p.silencer,
  },
  {
    key: 'cool',
    text: 'get out of their eyeline and hold  ·  the alarm burns itself out',
    near: () => game.alarm > 0,
    done: () => game.alarm === 0,
  },
];
const tutorial = { done: [], shown: [], current: -1, hold: 0 };
function legStats(p) {
  const L = [];
  for (const id of p.legs) {
    if (id) L.push(LIMBS[id]);
  }
  if (L.length === 1) {
    return {
      speed: L[0].speed * TUNE.ONE_LEG_SPEED,
      jump: L[0].jump,
      noise: L[0].noise * 1.6,
      hop: true,
    };
  }
  const matched = p.legs[0] === p.legs[1];
  return {
    speed: Math.min(L[0].speed, L[1].speed) * (matched ? 1 : TUNE.MISMATCH),
    jump: (L[0].jump + L[1].jump) / 2,
    noise: Math.max(L[0].noise, L[1].noise),

    hop: false,
  };
}
function limbHum(id) {
  return id ? LIMBS[id].hum : EMPTY_SOCKET_HUM;
}

function tearOffLimb(p) {
  let where = null;
  if (p.arms[0] && p.arms[1]) where = p.arms;
  else if (p.legs[0] && p.legs[1]) where = p.legs;
  if (!where) return null;
  const limb = where[p.side];
  where[p.side] = null;
  game.pickups.push({
    x: clamp(p.x - p.dir * 26, 20, zoneWidth - 20),
    y: GROUND,
    limb,
    taken: false,
  });
  return limb;
}
function updateKing(p, hum) {
  if (!game.bossSpawned && p.x > CONFIG.KING_AT) {
    game.bossSpawned = true;
    game.boss = new Enemy('king', 1120, 880, CONFIG.KING_WALL, 1);
    game.boss.dir = -1;
    game.boss.rouse();
    game.enemies.push(game.boss);
    game.phase = 1;

    game.cardT = 110;
    game.shake = 6;
    audio.bossOn();
    logLine('<b>the king.</b> ' + KING_LINES.enter);
  }

  const K = game.boss;
  if (K && K.alive) {
    const ph = kingPhase(K.hp);
    const at = KING_PHASES.indexOf(ph) + 1;
    if (at !== game.phase) {
      game.phase = at;
      game.shake = 5;
      game.freeze = 10;
      endKingMove(K, TUNE.CD_PHASE);
      if (at === 3) logLine('<b>the king.</b> ' + KING_LINES.turn(hum));
    }
    if (K.move) {
      runKingMove(K, p, ph);
    } else {
      K.moveTimer--;
      const gap = Math.abs(p.x - K.x);
      if (gap > TUNE.MOVE_GAP) K.x += sign(p.x - K.x) * 0.7 * ph.speed;
      else K.moveTimer -= 2;

      if (K.moveTimer <= 0) {
        K.move = pick(ph.moves);
        K.moveState = 0;
      }
    }
    K.x = clamp(K.x, 870, CONFIG.KING_WALL);
  }
  if (game.bossSpawned && K && !K.alive && !game.bossDone) {
    game.bossDone = true;
    lights = [];
    audio.bossOff();
    logLine('<b>the king.</b> ' + KING_LINES.die);
  }
  if (game.bossSpawned && K && K.alive && p.x > CONFIG.KING_WALL) {
    p.x = CONFIG.KING_WALL;
  }
}
function endKingMove(K, cooldown) {
  K.move = null;
  K.moveState = 0;

  K.windup = 0;
  K.tell = 0;
  K.moveTimer = cooldown;
}
function spawnGuard(x, dir) {
  const g = new Enemy('guard', x, 860, CONFIG.KING_WALL, 1);
  g.dir = dir;
  g.rouse();
  game.enemies.push(g);
  bloodSpray(x, GROUND - 12, { colour: PALETTE.gd3, grav: 0.1 });
}

function runKingMove(K, p, ph) {
  const dx = p.x - K.x;
  if (K.tell > 0) K.tell--;
  switch (K.move) {
    case 'lash': {
      if (K.moveState === 0) {
        K.dir = sign(dx) || K.dir;
        K.windup = TUNE.TELL_LASH;
        K.tell = TUNE.TELL_LASH;
        K.moveState = 1;
        audio.clang();
        return;
      }
      if (K.moveState === 1) {
        K.windup--;
        if (K.windup > 0) return;
        K.moveState = 2;
        K.windup = TUNE.LASH_HIT;
        game.shake = 5;
        audio.crunch();

        return;
      }
      K.x += K.dir * TUNE.LASH_SPEED * ph.speed;
      K.windup--;
      for (let i = 0; i < 2; i++) {
        addParticle(
          K.x + K.dir * 10,
          GROUND - 14 - i * 6,
          K.dir * randRange(0.4, 1.4),
          randRange(-0.4, 0.4),
          PALETTE.au2,
          12,
          0.02,
        );
      }
      if (K.near(p, TUNE.LASH_REACH, 20) && p.iframe === 0) {
        p.hurt(ENEMY_TYPES.king.dmg);
        p.vx = K.dir * TUNE.LASH_PUSH;
      }
      if (K.windup <= 0) endKingMove(K, TUNE.CD_LASH);
      return;
    }
    case 'grab': {
      if (K.moveState === 0) {
        K.dir = sign(dx) || K.dir;
        K.windup = TUNE.TELL_GRAB;
        K.tell = TUNE.TELL_GRAB;
        K.moveState = 1;
        logLine('<b>the king.</b> ' + KING_LINES.miss);
        return;
      }
      if (K.moveState === 1) {
        K.windup--;
        if (K.windup > 0) return;
        K.moveState = 2;
        K.windup = TUNE.GRAB_HIT;
        game.shake = 6;
        return;
      }

      K.x += K.dir * TUNE.GRAB_SPEED * ph.speed;
      K.windup--;

      if (K.near(p, TUNE.GRAB_REACH, 20) && p.iframe === 0) {
        const taken = tearOffLimb(p);
        p.hurt(1);
        if (taken) {
          game.freeze = 14;

          game.shake = 7;
          logLine('<b>he takes the ' + LIMBS[taken].name + '.</b> ' + KING_LINES.grab);
        }

        endKingMove(K, TUNE.CD_GRABBED);

        return;
      }
      if (K.windup <= 0) endKingMove(K, TUNE.CD_GRAB);
      return;
    }

    case 'volley': {
      if (K.moveState === 0) {
        K.dir = sign(dx) || K.dir;
        K.windup = TUNE.TELL_VOLLEY;
        K.tell = TUNE.TELL_VOLLEY;
        K.moveState = 1;
        return;
      }
      K.windup--;
      if (K.windup > 0) return;
      for (let k = -1; k <= 1; k++) {
        game.bullets.push(
          new Bullet(
            K.x,
            GROUND - 22 + k * 9,
            K.dir * TUNE.BOLT_SPEED * ph.speed,
            TUNE.BOLT_LIFE,
            false,
          ),
        );
      }
      audio.alarm();
      game.shake = 3;
      endKingMove(K, TUNE.CD_VOLLEY);
      return;
    }

    case 'sweep': {
      if (K.moveState === 0) {
        K.windup = TUNE.SWEEP_TIME;
        K.tell = TUNE.TELL_CALL;
        K.moveState = 1;
        game.sweep = 0;
        return;
      }
      K.windup--;
      game.sweep += 0.03;
      const lx = 1040 + Math.sin(game.sweep) * 150;
      lights = [{ x: lx - 40, w: 80 }];
      if (K.windup % 30 === 0 && Math.abs(p.x - lx) < 46) {
        game.bullets.push(
          new Bullet(K.x, GROUND - 22, sign(p.x - K.x) * TUNE.BOLT_HOMING, TUNE.BOLT_LIFE, false),
        );
      }
      if (K.windup <= 0) {
        lights = [];
        endKingMove(K, TUNE.CD_SWEEP);
      }

      return;
    }

    case 'call': {
      if (K.moveState === 0) {
        K.windup = TUNE.TELL_CALL;
        K.tell = TUNE.TELL_CALL;
        K.moveState = 1;

        return;
      }
      K.windup--;
      if (K.windup > 0) return;
      let standing = 0;
      for (const f of game.enemies) {
        if (f.alive && !ENEMY_TYPES[f.type].boss) standing++;
      }
      if (standing < CONFIG.FENCE_MAX) {
        spawnGuard(900, 1);
        spawnGuard(CONFIG.KING_WALL, -1);
        logLine('two more from the fence line.');
      }
      endKingMove(K, TUNE.CD_CALL);
      return;
    }
  }
}

function takeGear(p, u) {
  u.taken = true;
  const gearDef = GEAR[u.gear];

  if (u.gear === 'gun') {
    p.gun = true;
    p.mags = Math.max(p.mags, 1);
    p.ammo = Math.max(p.ammo, 3);
    logLine('<b>his sidearm.</b> three rounds in the mag. K fires.');
  } else if (u.gear === 'rounds') {
    const got = u.mags || 1;
    p.mags = Math.min(CONFIG.MAGS_MAX, p.mags + got);
    logLine(got > 1 ? 'two mags off him.' : 'a mag off him.');
  } else {
    p.canParts.push(u.gear);
    logLine(
      p.canParts.length === CAN_PARTS.length
        ? '<b>' + gearDef.name + '.</b> that is all three. hold C.'
        : gearDef.name + '. ' + p.canParts.length + ' of ' + CAN_PARTS.length + '.',
    );
  }
  audio.page();
  for (let i = 0; i < 10; i++)
    addParticle(u.x, u.y - 12, randRange(-1, 1), randRange(-1.4, 0.2), PALETTE.au3, 22, 0.09);
}

function canFire(p) {
  return p.gun && hasGrip(p);
}
