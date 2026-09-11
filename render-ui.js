'use strict';
// last in. owns the canvas, the DOM hud and the loop.

// the bar needs this much room before it gets space of its own, else it floats
const LAYOUT = { barMin: 108, barMax: 132, asideHold: 620, asideFade: 25 };
const sprites = {};
let ctx,
  lastFrame = 0,
  accumulator = 0;
let FAR_SIDE = false;

function loop(now) {
  requestAnimationFrame(loop);
  if (!game.running) return;
  if (game.intro < INTRO_CARDS.length) {
    game.introT++;
    if (game.introT > 210) {
      game.intro++;
      game.introT = 0;
    }
    introFrame();
    return;
  }
  $('intro').classList.remove('on');
  $('hud').classList.add('on');

  const dt = Math.min(0.1, (now - lastFrame) / 1000 || 0);
  lastFrame = now;
  accumulator += dt;

  let n = 0;
  while (accumulator >= CONFIG.FIXED_STEP && n < CONFIG.MAX_STEPS) {
    if (game.paused) {
      accumulator = 0;
      break;
    }
    if (game.freeze > 0) game.freeze--;
    else stepGame();
    accumulator -= CONFIG.FIXED_STEP;

    n++;
  }

  renderer.renderScene();
  updateHud();
  zoneCard();
  $('pause').classList.toggle('on', game.paused);
}

const bake = {
  sky() {
    const s = makeCanvas(CONFIG.VIEW_W, CONFIG.VIEW_H);
    const stops = PALETTE.sky;
    for (let y = 0; y < CONFIG.VIEW_H; y++) {
      if (y >= 152) {
        s.x.fillStyle = PALETTE.night;
        s.x.fillRect(0, y, CONFIG.VIEW_W, 1);
        continue;
      }
      const f = (y / 152) * (stops.length - 1);
      const i = Math.min(stops.length - 2, Math.floor(f));
      const frac = f - i;
      for (let x = 0; x < CONFIG.VIEW_W; x++) {
        s.x.fillStyle = frac > BAYER[y & 3][x & 3] / 16 ? stops[i + 1] : stops[i];
        s.x.fillRect(x, y, 1, 1);
      }
    }
    const sx = 232,
      sy = 104,
      r = 26;
    for (let y = -r - 12; y <= r + 12; y++) {
      for (let x = -r - 12; x <= r + 12; x++) {
        const d = Math.hypot(x, y);
        if (d > r + 12) continue;
        const th = BAYER[(sy + y) & 3][(sx + x) & 3] / 16;
        if (d <= r - 8) s.x.fillStyle = '#ffeec2';
        else if (d <= r) s.x.fillStyle = PALETTE.glow;
        else if (1 - (d - r) / 12 > th) s.x.fillStyle = '#f9cd8c';
        else continue;
        s.x.fillRect(sx + x, sy + y, 1, 1);
      }
    }
    return s.c;
  },

  tile(kind, seed) {
    const T = CONFIG.TILE;
    const s = makeCanvas(T, T),
      x = s.x;
    x.fillStyle = kind === 'top' ? PALETTE.st3 : PALETTE.st2;
    x.fillRect(0, 0, T, T);

    x.fillStyle = PALETTE.mortar;
    x.fillRect(0, T - 1, T, 1);
    x.fillRect(seed > 0.5 ? 3 : 5, 0, 1, T - 1);
    x.fillStyle = kind === 'top' ? PALETTE.st5 : PALETTE.st4;
    x.fillRect(0, 0, T, 1);
    x.fillStyle = PALETTE.st1;
    x.fillRect(0, T - 2, T, 1);
    for (let i = 0; i < 5; i++) {
      const px = ((seed * (i + 3) * 97) | 0) % T;

      const py = 1 + (((seed * (i + 7) * 53) | 0) % (T - 3));
      x.fillStyle = i % 2 ? PALETTE.st1 : PALETTE.st4;
      x.fillRect(px, py, 1, 1);
    }
    if (kind === 'top') {
      x.fillStyle = PALETTE.lf1;
      x.fillRect(0, 0, T, 2);
      x.fillStyle = PALETTE.lf2;
      x.fillRect(0, 0, T, 1);
      for (let i = 0; i < T; i += 2) {
        if (hash2d(seed * 100 + i, 3) <= 0.45) continue;
        const h = 1 + ((hash2d(seed * 31 + i, 9) * 3) | 0);
        x.fillStyle = hash2d(i, seed * 7) > 0.6 ? PALETTE.lf4 : PALETTE.lf3;
        x.fillRect(i, -h + 1, 1, h + 1);
      }
    }
    return s.c;
  },
  tree(v) {
    const w = 72,
      h = 104;
    const s = makeCanvas(w, h),
      x = s.x;
    const cx = w >> 1;
    const lean = [0, -0.1, 0.12][v];

    let tx = cx;
    for (let y = h - 1; y > 44; y--) {
      const t = (h - y) / (h - 44);
      const wid = Math.max(3, Math.round(9 - t * 5));
      tx = cx + lean * (h - y) * 0.5;
      x.fillStyle = PALETTE.bark1;
      x.fillRect(Math.round(tx - wid / 2), y, wid, 1);
      x.fillStyle = PALETTE.bark2;
      x.fillRect(Math.round(tx - wid / 2), y, 1, 1);
      x.fillStyle = PALETTE.bark0;
      x.fillRect(Math.round(tx + wid / 2) - 1, y, 1, 1);
      if (hash2d(v * 13, y) > 0.86) {
        x.fillStyle = PALETTE.bark0;
        x.fillRect(Math.round(tx), y, 1, 1);
      }
    }
    x.fillStyle = PALETTE.bark0;
    x.fillRect(cx - 8, h - 3, 16, 3);
    x.fillRect(cx - 11, h - 2, 22, 2);
    x.fillStyle = PALETTE.bark1;
    x.fillRect(cx - 14, 60, 14, 2);
    x.fillRect(cx + 3, 52, 13, 2);
    const clumps = [
      { x: cx, y: 30, r: 26 },
      { x: cx - 18, y: 42, r: 18 },
      { x: cx + 19, y: 40, r: 19 },
      { x: cx - 9, y: 18, r: 17 },
      { x: cx + 11, y: 20, r: 16 },
      { x: cx, y: 48, r: 16 },
    ];
    for (const cl of clumps) {
      const ox = cl.x,
        oy = cl.y,
        r = cl.r;
      for (let yy = -r; yy <= r; yy++) {
        for (let xx = -r; xx <= r; xx++) {
          if (Math.hypot(xx, yy * 1.18) > r) continue;
          const px = ox + xx,
            py = oy + yy;

          if (px < 0 || px >= w || py < 0 || py >= h) continue;
          const lit = (xx * 0.7 + -yy) / r;
          const n = hash2d(px + v * 40, py);
          let col = PALETTE.lf1;
          if (lit > 0.45 && n > 0.35) col = PALETTE.lf4;
          else if (lit > 0.05) col = PALETTE.lf3;
          else if (lit < -0.45) col = PALETTE.lf0;
          if (n > 0.93) col = PALETTE.lf5;
          x.fillStyle = col;
          x.fillRect(px, py, 1, 1);
        }
      }
    }
    x.fillStyle = PALETTE.lf1;
    for (let i = 0; i < 3; i++) {
      const vx = cx - 20 + i * 20;
      const len = 10 + ((hash2d(i, v) * 16) | 0);

      for (let k = 0; k < len; k++) x.fillRect(vx + (((k / 5) | 0) % 2), 56 + k, 1, 1);
    }
    return s.c;
  },
  fern() {
    const w = 22,
      h = 18;
    const s = makeCanvas(w, h),
      x = s.x;
    for (let b = 0; b < 7; b++) {
      const a = -Math.PI / 2 + (b - 3) * 0.34;
      const len = 9 + (b === 3 ? 5 : 0) + (b % 2 ? 2 : 0);
      for (let k = 0; k < len; k++) {
        const px = (w >> 1) + Math.cos(a) * k;
        const py = h - 1 + Math.sin(a) * k;
        let leaf = PALETTE.lf2;
        if (k > len - 4) leaf = PALETTE.lf4;
        else if (k > len / 2) leaf = PALETTE.lf3;
        x.fillStyle = leaf;
        x.fillRect(px | 0, py | 0, 1, 1);

        if (k % 3 === 0 && k > 2) {
          x.fillStyle = PALETTE.lf2;
          x.fillRect((px + Math.cos(a + 1.3) * 2) | 0, (py + Math.sin(a + 1.3) * 2) | 0, 1, 1);
          x.fillRect((px + Math.cos(a - 1.3) * 2) | 0, (py + Math.sin(a - 1.3) * 2) | 0, 1, 1);
        }
      }
    }
    return s.c;
  },

  canopy(colour, seed, height) {
    const w = 512;
    const s = makeCanvas(w, height),
      x = s.x;
    x.fillStyle = colour;
    for (let i = 0; i < 46; i++) {
      const bx = (i * 12 + ((hash2d(i, seed) * 8) | 0)) % w;
      const r = 7 + ((hash2d(i, seed + 5) * 11) | 0);
      const by = height - 10 - ((hash2d(i, seed + 9) * 6) | 0);
      x.beginPath();
      x.arc(bx, by, r, Math.PI, 0);
      x.fill();
      x.fillRect(bx - 1, by, 3, height - by);
    }
    x.fillRect(0, height - 10, w, 10);
    return s.c;
  },

  fronds() {
    const w = 480,
      h = 46;
    const f = makeCanvas(w, h),
      x = f.x;
    for (let i = 0; i < 34; i++) {
      const bx = (i * 15 + ((hash2d(i, 21) * 11) | 0)) % w;
      const len = 20 + ((hash2d(i, 33) * 24) | 0);
      const lean = (hash2d(i, 44) - 0.5) * 1.1;
      for (let k = 0; k < len; k++) {
        const px = bx + lean * k,
          py = h - 1 - k;
        x.fillStyle = k > len - 6 ? '#132a19' : '#0d1f13';
        x.fillRect(px | 0, py | 0, 3, 1);
        if (k % 4 === 0 && k > 3) {
          x.fillRect((px - 3 - (k % 8)) | 0, py | 0, 3, 1);
          x.fillRect((px + 3 + (k % 8)) | 0, py | 0, 3, 1);
        }
      }
    }
    return f.c;
  },
  all() {
    sprites.sky = bake.sky();
    sprites.tileTop = [0, 1].map(i => bake.tile('top', 0.2 + i * 0.6));
    sprites.tileFill = [0, 1, 2].map(i => bake.tile('fill', 0.15 + i * 0.35));
    sprites.tree = [];
    for (let i = 0; i < 3; i++) sprites.tree.push(bake.tree(i));
    sprites.fern = bake.fern();
    sprites.canopyFar = bake.canopy(PALETTE.canopyFar, 3, 32);
    sprites.canopyNear = bake.canopy(PALETTE.canopy, 8, 32);
    sprites.fronds = bake.fronds();
  },
};
const BAYER = (() => {
  let m = [[0]];
  for (let s = 1; s < 4; s *= 2) {
    const n = [];
    for (let y = 0; y < s * 2; y++) n.push([]);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const v = m[y][x] * 4;

        n[y][x] = v;

        n[y][x + s] = v + 2;
        n[y + s][x] = v + 3;
        n[y + s][x + s] = v + 1;
      }
    }
    m = n;
  }
  return m;
})();

const renderer = {
  canvas: null,

  scale: 4,

  init() {
    this.canvas = $('stage');
    ctx = this.canvas.getContext('2d');
    this.fitCanvas();
    window.addEventListener('resize', () => this.fitCanvas());
  },

  drawPlayer(p) {
    const bx = Math.round(p.x - game.cam),
      by = Math.round(p.y - game.camY);
    if (p.iframe > 0 && (p.iframe >> 2) % 2 === 0) return;
    const moving = p.grounded && Math.abs(p.vx) > 0.12;
    let sw = 0.4;
    if (moving) sw = Math.sin(p.walk) * TUNE.SWING;
    else if (p.grounded) sw = 0.12;
    const bob = moving && Math.sin(p.walk * 2) > 0 ? 1 : 0;

    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(p.sqx, p.sqy);
    ctx.translate(-bx, -by);

    const hip = by - 11 + bob,
      sho = by - 20 + bob;

    let gunSlot = -1;
    if (canFire(p) && p.atk <= 10) {
      gunSlot = 1;
      if (p.arms[0] && LIMBS[p.arms[0]].grip) gunSlot = 0;
    }

    FAR_SIDE = true;
    drawLimb(p.legs[1], bx + 2, hip, -sw, p.dir);
    if (gunSlot === 1) drawGunArm(p, bx + 2, sho);
    else drawLimb(p.arms[1], bx + 3, sho, -sw, p.dir);
    FAR_SIDE = false;

    rect(bx - 6, by - 23 + bob, 12, 13, PALETTE.ink);
    rect(bx - 5, by - 22 + bob, 10, 11, PALETTE.cl1);
    rect(bx - 5, by - 22 + bob, 10, 4, PALETTE.cl2);

    rect(bx + 2, by - 22 + bob, 3, 11, PALETTE.cl0);
    rect(bx - 5, by - 15 + bob, 10, 1, PALETTE.cl0);
    rect(bx - 5, by - 22 + bob, 10, 1, PALETTE.cl3);

    rect(bx - 3, by - 25 + bob, 6, 3, PALETTE.ink);
    rect(bx - 2, by - 25 + bob, 4, 2, PALETTE.sk2);
    rect(bx - 5, by - 33 + bob, 10, 9, PALETTE.ink);
    rect(bx - 4, by - 32 + bob, 8, 8, PALETTE.sk3);
    rect(bx + 1, by - 32 + bob, 3, 8, PALETTE.sk2);

    rect(bx - 4, by - 32 + bob, 8, 3, PALETTE.bark0);

    rect(bx - 4 + (p.dir > 0 ? 0 : 5), by - 30 + bob, 3, 2, PALETTE.bark0);
    rect(bx + (p.dir > 0 ? 1 : -3), by - 28 + bob, 2, 2, PALETTE.ink);
    rect(bx - 4, by - 32 + bob, 8, 1, PALETTE.sk4);
    drawLimb(p.legs[0], bx - 2, hip, sw, p.dir);
    if (gunSlot === 0) drawGunArm(p, bx, sho);
    else drawLimb(p.arms[0], bx - 4, sho, p.atk > 10 ? 1.5 * p.dir : sw, p.dir);

    ctx.restore();

    if (p.fitting > 0) {
      const w = Math.round(p.fitting * 22);
      rect(bx - 12, by - 38, 24, 5, PALETTE.ink);
      rect(bx - 11, by - 37, 22, 3, 'rgba(0,0,0,0.5)');
      rect(bx - 11, by - 37, w, 3, PALETTE.au3);
    }
  },
  drawBeast(f, bx, by) {
    const gait2 = Math.sin(f.walk * 1.6) * 0.7;
    const gold = f.type === 'jaguar';
    const hide = gold ? PALETTE.au2 : PALETTE.bark2;
    const under = gold ? PALETTE.au1 : PALETTE.bark1;
    const spot = gold ? PALETTE.au0 : PALETTE.bark0;
    const long = gold ? 20 : 14;
    FAR_SIDE = true;
    drawBeastLeg(bx - long * 0.25, by - 7, -gait2, f.dir, hide, under, spot);
    drawBeastLeg(bx + long * 0.35, by - 7, gait2, f.dir, hide, under, spot);
    FAR_SIDE = false;

    rect(bx - long / 2 - 1, by - 17, long + 2, 9, PALETTE.ink);
    rect(bx - long / 2, by - 16, long, 7, hide);
    rect(bx - long / 2, by - 16, long, 2, gold ? PALETTE.au3 : PALETTE.bark2);
    rect(bx - long / 2, by - 11, long, 2, under);
    for (let i = 0; i < 5; i++) rect(bx - long / 2 + 2 + i * 4, by - 14 + (i % 2) * 3, 2, 2, spot);

    const hx = bx + (f.dir > 0 ? long / 2 - 2 : -long / 2 - 3);
    rect(hx, by - 20, 5, 6, PALETTE.ink);
    rect(hx + 1, by - 19, 3, 4, hide);

    rect(hx + (f.dir > 0 ? 2 : 1), by - 18, 1, 1, gold ? PALETTE.blood : PALETTE.ink);
    rect(bx + (f.dir > 0 ? -long / 2 - 3 : long / 2 + 1), by - 16, 4, 1, under);

    drawBeastLeg(bx - long * 0.25, by - 7, gait2, f.dir, hide, under, spot);
    drawBeastLeg(bx + long * 0.35, by - 7, -gait2, f.dir, hide, under, spot);
  },
  drawTell(f, bx, by) {
    if (f.tell <= 0) return;
    const beat = ((game.time * 9) | 0) % 2;
    const ink = beat ? PALETTE.warn : PALETTE.blood;
    const w = Math.max(2, Math.round(f.tell / 2));
    rect(bx - 13, by - 49, 26, 4, PALETTE.ink);

    rect(bx - 12, by - 48, w, 2, ink);
    rect(bx - 2, by - 58, 5, 7, PALETTE.ink);

    rect(bx - 1, by - 57, 3, 3, ink);
    rect(bx - 1, by - 53, 3, 1, ink);
  },

  drawKing(f, bx, by) {
    const sw = Math.sin(f.walk) * 0.6;

    const rear = f.tell > 0;
    FAR_SIDE = true;
    LEG_ART.plate_leg(bx + 3, by - 13, -sw, f.dir);

    FAR_SIDE = false;

    LEG_ART.own_leg(bx - 3, by - 13, sw, f.dir);
    rect(bx - 8, by - 27, 16, 16, PALETTE.ink);
    rect(bx - 7, by - 26, 14, 14, '#3a2b52');
    rect(bx - 7, by - 26, 14, 4, PALETTE.au1);
    rect(bx + 3, by - 26, 3, 14, PALETTE.gd0);
    rect(bx - 7, by - 18, 14, 1, PALETTE.au0);
    rect(bx - 5, by - 35, 10, 9, PALETTE.ink);
    rect(bx - 4, by - 34, 8, 8, PALETTE.sk3);
    rect(bx + 1, by - 34, 3, 8, PALETTE.sk2);
    rect(bx + (f.dir > 0 ? 1 : -3), by - 30, 2, 2, PALETTE.blood);
    for (let i = 0; i < 5; i++) rect(bx - 5 + i * 2, by - 40 + (i % 2 ? 1 : 0), 2, 5, PALETTE.au2);
    rect(bx - 5, by - 36, 11, 2, PALETTE.au1);

    let arm = sw;
    if (rear) arm = -1.9 * f.dir;
    else if (f.state === 'alert') arm = 1.2 * f.dir;
    ARM_ART.claw_arm(bx - 5, by - 24, arm, f.dir);
    this.drawTell(f, bx, by);
  },
  drawSuspicion(f, bx, by) {
    if (f.sus <= 4) return;
    const h = Math.round((f.sus / 100) * 9);
    rect(bx - 2, by - 44, 5, 12, PALETTE.ink);

    rect(bx - 1, by - 43, 3, 10, 'rgba(0,0,0,0.55)');
    rect(bx - 1, by - 33 - h, 3, h, f.state === 'alert' ? PALETTE.blood : PALETTE.warn);
    if (f.state === 'alert' && ((game.time * 6) | 0) % 2) {
      rect(bx - 1, by - 50, 3, 5, PALETTE.blood);
      rect(bx - 1, by - 43, 3, 2, PALETTE.blood);
    }
  },

  drawFoe(f) {
    const bx = Math.round(f.x - game.cam),
      by = Math.round(f.y - game.camY);
    if (bx < -40 || bx > CONFIG.VIEW_W + 40) return;
    if (!f.alive) {
      rect(bx - 8, by - 4, 16, 4, PALETTE.ink);
      rect(bx - 7, by - 3, 14, 2, PALETTE.gd1);
      rect(bx - 3, by - 6, 5, 3, PALETTE.ink);
      rect(bx - 2, by - 5, 3, 2, PALETTE.sk1);
      return;
    }

    const F = ENEMY_TYPES[f.type];
    if (F.boss) {
      this.drawKing(f, bx, by);
      this.drawSuspicion(f, bx, by);
      return;
    }
    if (F.beast) {
      this.drawBeast(f, bx, by);
      this.drawSuspicion(f, bx, by);
      return;
    }

    const sw = Math.sin(f.walk) * 0.8;
    const wide = F.wide;

    FAR_SIDE = true;

    drawLimb(F.leg, bx + 2, by - 11, -sw, f.dir);
    FAR_SIDE = false;

    rect(bx - wide / 2, by - 23, wide, 13, PALETTE.ink);
    rect(bx - wide / 2 + 1, by - 22, wide - 2, 11, f.state === 'alert' ? '#6b2836' : F.cloth);
    rect(bx - wide / 2 + 1, by - 22, wide - 2, 4, f.state === 'alert' ? '#8f3546' : F.clothHi);
    rect(bx + 2, by - 22, 3, 11, PALETTE.gd0);
    rect(bx - wide / 2 + 1, by - 15, wide - 2, 1, PALETTE.gd0);
    if (F.radio) {
      rect(bx - 5, by - 21, 10, 1, PALETTE.au2);
      rect(bx + (f.dir > 0 ? -6 : 4), by - 20, 2, 4, PALETTE.au1);
    }
    if (F.armour) {
      rect(bx - 5, by - 20, 10, 6, PALETTE.st3);
      rect(bx - 5, by - 20, 10, 1, PALETTE.st5);
    }

    rect(bx - 3, by - 25, 6, 3, PALETTE.ink);
    rect(bx - 2, by - 25, 4, 2, PALETTE.sk2);
    rect(bx - 5, by - 33, 10, 9, PALETTE.ink);
    rect(bx - 4, by - 32, 8, 8, PALETTE.sk3);
    rect(bx + 1, by - 32, 3, 8, PALETTE.sk2);
    rect(bx - 5, by - 35, 11, 3, PALETTE.ink);
    rect(bx - 4, by - 34, 9, 2, PALETTE.gd0);

    rect(bx - 4 + (f.dir > 0 ? 8 : -2), by - 33, 3, 1, PALETTE.gd0);
    rect(bx + (f.dir > 0 ? 1 : -3), by - 28, 2, 2, PALETTE.ink);
    drawLimb(F.leg, bx - 2, by - 11, sw, f.dir);
    drawLimb(F.arm, bx - 4, by - 20, sw, f.dir);
    this.drawSuspicion(f, bx, by);
  },

  drawBackdrop() {
    ctx.drawImage(sprites.sky, 0, 0);
    ctx.fillStyle = PALETTE.ridgeFar;
    for (let i = 0; i < 10; i++) {
      const bx = i * 128 - ((game.cam * 0.1) % 1280);
      ctx.beginPath();
      ctx.moveTo(bx, 128);
      ctx.lineTo(bx + 46, 78);
      ctx.lineTo(bx + 92, 128);
      ctx.fill();
    }
    ctx.fillStyle = PALETTE.ridgeMid;
    for (let i = 0; i < 12; i++) {
      const bx = i * 104 - ((game.cam * 0.18) % 1248) - 40;
      ctx.beginPath();
      ctx.moveTo(bx, 138);
      ctx.lineTo(bx + 38, 98);
      ctx.lineTo(bx + 76, 138);
      ctx.fill();
    }
    for (let i = -1; i < 3; i++)
      ctx.drawImage(sprites.canopyFar, i * 512 - ((game.cam * 0.32) % 512), 124 - game.camY * 0.2);

    for (let i = -1; i < 3; i++)
      ctx.drawImage(sprites.canopyNear, i * 512 - ((game.cam * 0.52) % 512), 136 - game.camY * 0.4);

    for (const t of trees) {
      const sx = Math.round(t.x - game.cam * 0.86 - 36);
      if (sx > CONFIG.VIEW_W || sx < -80) continue;
      ctx.drawImage(sprites.tree[t.v], sx, Math.round(t.y - 100 - game.camY * 0.8));
    }
  },

  drawTerrain() {
    const T = CONFIG.TILE;
    for (const t of platforms) {
      const x0 = t.x - game.cam;
      if (x0 > CONFIG.VIEW_W || x0 + t.w < 0) continue;
      for (let ty = 0; ty < t.h; ty += T) {
        for (let tx = 0; tx < t.w; tx += T) {
          const wx = t.x + tx,
            wy = t.y + ty;
          const sx = Math.round(wx - game.cam);
          if (sx > CONFIG.VIEW_W || sx < -T) continue;
          const n = hash2d(wx, wy);
          const img = ty === 0 ? sprites.tileTop[(n * 2) | 0] : sprites.tileFill[(n * 3) | 0];
          ctx.drawImage(img, sx, Math.round(wy - game.camY));
        }
      }
      rect(x0, t.y + T - game.camY, t.w, 1, 'rgba(0,0,0,0.28)');
    }
  },

  drawFerns() {
    for (const f of foliage) {
      const x0 = f.x - game.cam;
      if (x0 > CONFIG.VIEW_W || x0 + f.w < 0) continue;
      for (let i = 0; i < f.w; i += 6) {
        const wob = Math.sin(game.time * 1.6 + (f.x + i) * 0.3) * 1.2;
        ctx.drawImage(
          sprites.fern,
          Math.round(x0 + i + wob),
          Math.round(f.y + f.h - 17 - game.camY),
        );
      }
      for (let i = 3; i < f.w; i += 11) {
        const h = 9 + ((hash2d(f.x + i, 2) * 8) | 0);
        rect(
          x0 + i,
          f.y + f.h - h - game.camY,
          2,
          h,
          hash2d(i, f.x) > 0.6 ? PALETTE.lf3 : PALETTE.lf2,
        );
      }
    }
  },

  drawFloodlights() {
    if (!lights.length) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const l of lights) {
      const x = l.x - game.cam;
      if (x > CONFIG.VIEW_W || x + l.w < 0) continue;
      const grd = ctx.createLinearGradient(0, -game.camY, 0, GROUND - game.camY);
      grd.addColorStop(0, 'rgba(255,232,180,0.16)');
      grd.addColorStop(1, 'rgba(255,200,120,0.05)');

      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(x + l.w * 0.34, -game.camY);
      ctx.lineTo(x + l.w * 0.66, -game.camY);
      ctx.lineTo(x + l.w, GROUND - game.camY);
      ctx.lineTo(x, GROUND - game.camY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  },

  drawTreeline() {
    const ex = zoneExit - game.cam;
    if (ex > CONFIG.VIEW_W + 60) return;
    for (let i = 0; i < 9; i++) {
      const h = 90 + (i % 3) * 8;
      rect(ex + i * 9, CONFIG.VIEW_H - h - game.camY, 7, h, i % 2 ? PALETTE.lf0 : PALETTE.lf1);
    }
    rect(ex - 4, 46 - game.camY, 90, 8, PALETTE.lf2);

    for (let i = 0; i < 40; i++)
      rect(ex - 4 + i * 2, 54 - game.camY + ((i * 7) % 5), 2, 3, PALETTE.lf1);
  },

  drawPickups() {
    for (const u of game.pickups) {
      if (u.taken) continue;
      const x = u.x - game.cam,
        y = u.y - game.camY;
      if (x < -24 || x > CONFIG.VIEW_W + 24) continue;
      const bob = Math.sin(game.time * 2.6 + u.x) * 1.6;
      rect(x - 6, y - 2, 12, 2, 'rgba(0,0,0,0.32)');
      const halo = (game.fitted === 0 ? 0.46 : 0.3) + Math.sin(game.time * 3 + u.x) * 0.12;
      ctx.globalCompositeOperation = 'lighter';

      ctx.fillStyle = `rgba(226,150,60,${halo * 0.5})`;
      ctx.beginPath();
      ctx.arc(x, y - 12 + bob, 13, 0, TAU);
      ctx.fill();
      ctx.fillStyle = `rgba(255,219,160,${halo})`;

      ctx.beginPath();
      ctx.arc(x, y - 12 + bob, 7, 0, TAU);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      if (u.limb) drawLimb(u.limb, x, y - 15 + bob, 0.85, 1);
      else GEAR_ART[u.gear](x, y - 12 + bob, false);
    }
  },

  drawParticles() {
    for (const q of game.particles) {
      ctx.globalAlpha = clamp01((q.life / q.max) * 1.6);
      rect(q.x - game.cam, q.y - game.camY, q.size, q.size, q.colour);
    }
    ctx.globalAlpha = 1;
    for (const r of game.noiseRings) {
      ctx.strokeStyle = `rgba(246,232,207,${r.life * 0.42})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(
        Math.round(r.x - game.cam),
        Math.round(r.y - 10 - game.camY),
        Math.round(r.r),
        0,
        TAU,
      );
      ctx.stroke();
    }
    for (const b of game.bullets) {
      const sx = b.x - game.cam,
        sy = b.y - game.camY;
      if (b.mine) {
        rect(sx - sign(b.vx) * 5, sy, 6, 1, 'rgba(255,219,160,0.45)');
        rect(sx - 1, sy, 3, 1, PALETTE.bone);
      } else {
        rect(sx - 2, sy - 1, 5, 3, PALETTE.ink);
        rect(sx - 1, sy, 3, 1, PALETTE.warn);
      }
    }
    ctx.fillStyle = 'rgba(255,219,160,0.30)';
    for (const m of game.motes) ctx.fillRect(m.x | 0, m.y | 0, 1, 1);
  },
  renderScene() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    ctx.translate(
      Math.round(randRange(-game.shake / 2, game.shake / 2)),
      Math.round(randRange(-game.shake / 2, game.shake / 2)),
    );
    this.drawBackdrop();
    this.drawTerrain();
    this.drawPickups();
    for (const f of game.enemies) this.drawFoe(f);
    this.drawPlayer(game.player);
    this.drawFloodlights();
    this.drawFerns();

    this.drawTreeline();

    this.drawParticles();
    for (let i = -1; i < 3; i++)
      ctx.drawImage(
        sprites.fronds,
        i * 480 - ((game.cam * 1.35) % 480),
        CONFIG.VIEW_H - 40 - game.camY * 0.2,
      );

    ctx.restore();

    const vg = ctx.createRadialGradient(
      CONFIG.VIEW_W / 2,
      CONFIG.VIEW_H * 0.46,
      CONFIG.VIEW_H * 0.62,
      CONFIG.VIEW_W / 2,
      CONFIG.VIEW_H * 0.46,
      CONFIG.VIEW_H * 1.12,
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(22,12,34,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);

    if (game.alarm) {
      ctx.fillStyle = `rgba(201,53,74,${0.06 + Math.sin(game.time * 4) * 0.04})`;
      ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    }
    if (game.flash > 0) {
      ctx.fillStyle = `rgba(201,53,74,${game.flash / 24})`;

      ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    }
    if (game.fade > 0) {
      ctx.fillStyle = `rgba(13,10,22,${game.fade})`;
      ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    }
  },

  fitCanvas() {
    const W = window.innerWidth,
      H = window.innerHeight;
    const s = Math.max(1, Math.floor(Math.min(W / CONFIG.VIEW_W, H / CONFIG.VIEW_H)));
    this.scale = s;
    const side = (W - CONFIG.VIEW_W * s) / 2,
      spare = H - CONFIG.VIEW_H * s;
    const bezel = spare >= LAYOUT.barMin;
    const bar = bezel ? Math.min(spare, LAYOUT.barMax) : 0;
    const top = bezel ? spare - bar : 0;
    const root = document.documentElement.style;
    root.setProperty('--side', (bezel ? side : 0) + 'px');
    root.setProperty('--top', top + 'px');
    root.setProperty('--strip', bar + 'px');
    document.body.classList.toggle('bezel', bezel);
    this.canvas.width = CONFIG.VIEW_W;
    this.canvas.height = CONFIG.VIEW_H;
    this.canvas.style.width = CONFIG.VIEW_W * this.scale + 'px';
    this.canvas.style.height = CONFIG.VIEW_H * this.scale + 'px';
    ctx.imageSmoothingEnabled = false;
  },
  paintPortrait(target) {
    const keep = {
      ctx,
      cam: game.cam,
      camY: game.camY,
      sqx: game.player.sqx,
      sqy: game.player.sqy,

      iframe: game.player.iframe,
      walk: game.player.walk,
      fitting: game.player.fitting,
      atk: game.player.atk,
      x: game.player.x,
      y: game.player.y,
      dir: game.player.dir,
      vx: game.player.vx,
    };

    ctx = target.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, target.width, target.height);
    game.player.sqx = 1;
    game.player.sqy = 1;
    game.player.iframe = 0;
    game.player.fitting = 0;
    game.player.atk = 0;
    game.player.walk = 0;
    game.player.dir = 1;
    game.player.vx = 0;
    game.player.x = 0;
    game.player.y = 0;
    game.cam = -(target.width / 2);
    game.camY = -(target.height - 12);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(target.width / 2, target.height - 11, 9, 2.5, 0, 0, TAU);
    ctx.fill();
    this.drawPlayer(game.player);
    ctx = keep.ctx;
    Object.assign(game.player, {
      sqx: keep.sqx,
      sqy: keep.sqy,
      iframe: keep.iframe,
      walk: keep.walk,
      fitting: keep.fitting,
      atk: keep.atk,
      x: keep.x,
      y: keep.y,

      dir: keep.dir,
      vx: keep.vx,
    });
    game.cam = keep.cam;
    game.camY = keep.camY;
  },

  titleVista() {
    const t = $('title-canvas');
    const tg = t.getContext('2d');
    tg.imageSmoothingEnabled = false;
    let k = 0;
    (function tick() {
      if (game.running) return;
      requestAnimationFrame(tick);
      k += 0.01;
      tg.drawImage(sprites.sky, 0, 0);
      tg.fillStyle = PALETTE.ridgeMid;
      for (let i = 0; i < 8; i++) {
        const bx = i * 104 - ((k * 22) % 1040) - 40;
        tg.beginPath();
        tg.moveTo(bx, 138);
        tg.lineTo(bx + 38, 98);
        tg.lineTo(bx + 76, 138);

        tg.fill();
      }
      for (let i = -1; i < 3; i++)
        tg.drawImage(sprites.canopyNear, i * 512 - ((k * 46) % 512), 132);
      tg.drawImage(sprites.tree[1], 34, 48);
      tg.drawImage(sprites.tree[2], 210, 56);
      tg.drawImage(sprites.fronds, -((k * 90) % 480), 138);

      tg.fillStyle = 'rgba(13,10,22,0.42)';
      tg.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
    })();
  },
};
function rect(x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

function readBest() {
  try {
    const raw = localStorage.getItem('quarry.best');
    if (!raw) return null;
    const best = JSON.parse(raw);
    if (typeof best.hum !== 'number' || typeof best.secs !== 'number') return null;

    return best;
  } catch (e) {
    return null;
  }
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return { c, x };
}

const DOWN = Math.PI / 2;

const LEG_ART = {
  human_leg(hx, hy, sw) {
    const knee = segment(hx, hy, DOWN + sw * 0.5, 5, 3, PALETTE.cl2, PALETTE.cl1);
    segment(knee.x, knee.y, DOWN - sw * 0.3, 6, 3, PALETTE.sk2, PALETTE.sk1);
  },
  boot_leg(hx, hy, sw, dir) {
    const knee = segment(hx, hy, DOWN + sw * 0.5, 5, 3, PALETTE.gd2, PALETTE.gd1);
    const foot = segment(knee.x, knee.y, DOWN - sw * 0.3, 5, 3, PALETTE.gd1, PALETTE.gd0);
    rect(foot.x - 3, foot.y - 1, 6, 3, PALETTE.ink);
    rect(foot.x - 2, foot.y - 1, 4 + (dir > 0 ? 1 : 0), 2, PALETTE.gd0);
  },
  plate_leg(hx, hy, sw) {
    const knee = segment(hx, hy, DOWN + sw * 0.45, 5, 4, PALETTE.st4, PALETTE.st2);
    const foot = segment(knee.x, knee.y, DOWN - sw * 0.25, 5, 4, PALETTE.st3, PALETTE.st1);
    rect(foot.x - 3, foot.y - 1, 7, 3, PALETTE.ink);
    rect(foot.x - 2, foot.y - 1, 5, 2, PALETTE.st2);
  },
  jag_leg(hx, hy, sw, dir) {
    const knee = segment(hx, hy, DOWN + sw * 0.7, 5, 4, PALETTE.au2, PALETTE.au1);
    const hock = segment(knee.x, knee.y, DOWN - sw * 0.9 - 0.5, 5, 3, PALETTE.au1, PALETTE.au0);
    const paw = segment(hock.x, hock.y, DOWN + sw * 0.4 + 0.4, 4, 3, PALETTE.au2, PALETTE.au1);
    rect(paw.x - 2 + dir, paw.y, 3, 1, PALETTE.bone);

    rect(hx - 2, hy + 2, 1, 1, PALETTE.au0);
    rect(hx + 1, hy + 5, 1, 1, PALETTE.au0);
  },
  frog_leg(hx, hy, sw) {
    const knee = segment(hx, hy, DOWN + sw * 0.4 + 0.6, 4, 4, PALETTE.fr2, PALETTE.fr1);
    const hock = segment(knee.x, knee.y, DOWN - 0.78, 7, 3, PALETTE.fr1, PALETTE.fr0);

    const web = segment(hock.x, hock.y, DOWN + 0.55, 4, 3, PALETTE.fr2, PALETTE.fr1);
    rect(web.x - 3, web.y, 7, 2, PALETTE.ink);
    rect(web.x - 2, web.y, 5, 1, PALETTE.fr3);
  },

  croc_leg(hx, hy, sw, dir) {
    const knee = segment(hx, hy, DOWN + sw * 0.22, 6, 5, PALETTE.gt2, PALETTE.gt1);
    rect(knee.x - 4, knee.y - 1, 9, 5, PALETTE.ink);
    rect(knee.x - 3, knee.y, 7, 3, PALETTE.gt1);
    rect(knee.x - 3 + (dir > 0 ? 6 : -1), knee.y + 1, 2, 1, PALETTE.gt3);
    rect(hx - 3, hy + 2, 1, 1, PALETTE.gt3);

    rect(hx + 2, hy + 4, 1, 1, PALETTE.gt3);
  },
  own_leg(hx, hy, sw) {
    const knee = segment(hx, hy, DOWN + sw * 0.4, 6, 3, PALETTE.sk1, PALETTE.sk0);
    const foot = segment(knee.x, knee.y, DOWN - sw * 0.2, 6, 3, PALETTE.sk2, PALETTE.sk1);
    for (let i = 0; i < 4; i++) rect(hx - 1, hy + 1 + i * 3, 3, 1, PALETTE.blood);
    rect(foot.x - 2, foot.y - 1, 5, 2, PALETTE.ink);
  },
};
const ARM_ART = {
  human_arm(sx, sy, sw) {
    const elbow = segment(sx, sy, DOWN + sw * 0.6, 5, 3, PALETTE.cl2, PALETTE.cl1);

    segment(elbow.x, elbow.y, DOWN + sw * 0.2, 5, 3, PALETTE.sk2, PALETTE.sk1);
  },
  officer_arm(sx, sy, sw) {
    const elbow = segment(sx, sy, DOWN + sw * 0.6, 5, 3, PALETTE.gd2, PALETTE.gd1);
    segment(elbow.x, elbow.y, DOWN + sw * 0.2, 5, 3, PALETTE.sk2, PALETTE.sk1);
    rect(sx - 2, sy + 1, 4, 1, PALETTE.au2);
  },
  claw_arm(sx, sy, sw, dir) {
    const elbow = segment(sx, sy, DOWN + sw * 0.75, 5, 4, PALETTE.au2, PALETTE.au1);

    const paw = segment(elbow.x, elbow.y, DOWN + sw * 0.3, 5, 3, PALETTE.au1, PALETTE.au0);
    for (let i = 0; i < 3; i++)
      rect(paw.x - 1 + dir * (1 + i), paw.y + i - 1, 1, 3 - i, PALETTE.bone);
  },
  jaw_arm(sx, sy, sw) {
    const hinge = segment(sx, sy, DOWN + sw * 0.5, 6, 5, PALETTE.gt2, PALETTE.gt1);
    rect(hinge.x - 4, hinge.y - 1, 9, 5, PALETTE.ink);
    rect(hinge.x - 3, hinge.y, 7, 3, PALETTE.gt1);
    for (let i = 0; i < 3; i++) rect(hinge.x - 2 + i * 2, hinge.y + 3, 1, 1, PALETTE.bone);
  },
  ape_arm(sx, sy, sw, dir) {
    const elbow = segment(sx, sy, DOWN + sw * 0.8, 7, 4, PALETTE.bark2, PALETTE.bark1);
    const hand = segment(elbow.x, elbow.y, DOWN + sw * 0.4, 7, 3, PALETTE.bark1, PALETTE.bark0);

    rect(hand.x - 2, hand.y, 5, 3, PALETTE.ink);
    rect(hand.x - 1 + dir, hand.y, 3, 2, PALETTE.sk1);
  },
};
const GEAR_ART = {
  gun(x, y, can, dir) {
    const d = dir || 1;
    rect(x - 4, y - 2, 9, 4, PALETTE.ink);
    rect(x - 3, y - 1, 7, 2, PALETTE.gd3);

    rect(x - 3, y - 1, 7, 1, PALETTE.gd2);
    rect(x - d * 3 - 1, y + 1, 3, 3, PALETTE.ink);
    rect(x - d * 3, y + 1, 2, 2, PALETTE.bark1);
    if (!can) return;
    rect(x + d * 5 - 2, y - 2, 5, 4, PALETTE.ink);
    rect(x + d * 5 - 1, y - 1, 4, 2, PALETTE.st3);
    rect(x + d * 5 - 1, y - 1, 4, 1, PALETTE.st5);
  },
  rounds(x, y) {
    rect(x - 5, y - 2, 10, 5, PALETTE.ink);
    for (let i = 0; i < 3; i++) {
      rect(x - 4 + i * 3, y, 2, 2, PALETTE.au1);
      rect(x - 4 + i * 3, y - 1, 2, 1, PALETTE.au3);
    }
  },

  sleeve(x, y) {
    rect(x - 6, y - 2, 12, 5, PALETTE.ink);
    rect(x - 5, y - 1, 10, 3, PALETTE.st3);

    rect(x - 5, y - 1, 10, 1, PALETTE.st5);
    rect(x + 3, y - 1, 2, 3, PALETTE.st1);
  },
  spring(x, y) {
    rect(x - 6, y - 3, 12, 7, PALETTE.ink);

    for (let i = 0; i < 5; i++) rect(x - 5 + i * 2, y - 2 + (i % 2) * 3, 2, 2, PALETTE.st4);
    rect(x - 5, y - 2, 1, 5, PALETTE.st2);
  },
  rag(x, y) {
    rect(x - 5, y - 3, 11, 7, PALETTE.ink);
    rect(x - 4, y - 2, 9, 5, PALETTE.bark1);
    rect(x - 4, y - 2, 9, 1, PALETTE.bark2);
    rect(x - 2, y + 1, 4, 1, PALETTE.bark0);
    rect(x + 2, y - 1, 2, 2, PALETTE.bark0);
  },
};
function startRun(fromCheckpoint) {
  const cp = fromCheckpoint ? game.checkpoint : null;
  if (!cp) game.checkpoint = null;
  game.player = new Player();
  game.time = 0;
  cacheGun = '';
  cachePrompt = '';
  cacheLog = '';
  game.kills = 0;
  game.quietKills = 0;
  game.fitted = 0;
  game.log = [];
  game.ghosted = [];
  game.intro = 0;
  if (cp) game.intro = INTRO_CARDS.length;
  game.introT = 0;
  game.paused = false;
  game.shake = 0;
  game.freeze = 0;
  game.flash = 0;
  game.fade = 1;
  tutorial.done = TUTORIAL.map(() => false);
  tutorial.shown = TUTORIAL.map(() => 0);
  tutorial.current = -1;
  tutorial.hold = 0;
  loadZone(cp ? cp.zone : 0);
  if (cp) {
    game.player.legs = cp.legs.slice();
    game.player.arms = cp.arms.slice();
    game.player.hp = cp.hp;
    game.kills = cp.kills;
    game.quietKills = cp.quietKills;
    game.fitted = cp.fitted;
    game.ghosted = cp.ghosted.slice();
    game.player.gun = cp.gun;

    game.player.ammo = cp.ammo;
    game.player.mags = cp.mags || 0;
    game.player.silencer = cp.silencer;
    game.player.canParts = cp.canParts.slice();
    game.time = cp.secs;
    logLine('back at the top of ' + ZONES[cp.zone].name.toLowerCase() + '.');
  }
  game.motes = Array.from({ length: 34 }, () => ({
    x: Math.random() * CONFIG.VIEW_W,
    y: Math.random() * CONFIG.VIEW_H,
    vx: -0.05 - Math.random() * 0.08,
    vy: -0.05 - Math.random() * 0.1,
  }));
  $('intro').classList.remove('on');
  $('menu').classList.remove('on');
  $('gameover').classList.remove('on');
  game.running = true;

  lastFrame = performance.now();
  accumulator = 0;
}
function segment(x, y, ang, len, w, col, hi) {
  const dx = Math.cos(ang),
    dy = Math.sin(ang),
    o = w >> 1;
  const body = FAR_SIDE ? shade(col, 0.58) : col;

  const edge = FAR_SIDE ? null : hi;
  for (let i = -1; i <= len; i++) rect(x + dx * i - o - 1, y + dy * i, w + 2, 1, PALETTE.ink);
  for (let i = 0; i < len; i++) {
    rect(x + dx * i - o, y + dy * i, w, 1, body);

    if (edge && w > 2) rect(x + dx * i - o, y + dy * i, 1, 1, edge);
  }
  return { x: x + dx * len, y: y + dy * len };
}

function drawLimb(id, x, y, sw, dir) {
  if (!id) return;
  const art = LIMBS[id].kind === 'leg' ? LEG_ART[id] : ARM_ART[id];
  art(x, y, sw, dir);
}
const HUM_TIERS = [
  { min: 76, cls: 'good', line: 'they see one of their own' },
  { min: 40, cls: 'warn', line: 'something is off about you' },
  { min: 0, cls: 'danger', line: 'shoot on sight' },
];
let cacheKit = '',
  cacheGun = '',
  cachePrompt = '',
  cacheLog = '';
function introFrame() {
  ctx.drawImage(sprites.sky, 0, 0);
  ctx.fillStyle = 'rgba(13,10,22,0.42)';

  ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);
  const card = $('intro-card');
  if (card.dataset.line !== String(game.intro)) {
    card.dataset.line = String(game.intro);
    card.textContent = INTRO_CARDS[game.intro];
  }
  card.classList.toggle('show', game.introT > 14 && game.introT < 186);
  $('intro').classList.add('on');
}
// TODO card runs on a timer. any key cuts it to 30 frames but it never waits for you
function endNote(won, hum, mark) {
  const p = game.player;
  if (!won && game.quietKills === 0 && game.kills > 0)
    return 'You fought them from the front every time. Get behind them.';
  if (!won && !p.fernFrames) return 'You never used the ferns. They cannot see you in there.';
  if (!won) return 'Closer than last time counts for something.';
  if (!game.ghosted.length)
    return 'You were seen in every zone. Try slipping one of them entirely.';
  if (game.fitted < 3) return `There are limbs out there. You fitted ${game.fitted}.`;
  if (hum < 40) return 'Now try getting out with more of yourself left.';
  if (mark.faster && mark.prev)
    return `${mark.prev.secs - mark.secs} seconds off your own record. Again.`;
  if (mark.prev) return `Your quickest way out is still ${mark.prev.secs} seconds. Beat that.`;
  return 'Now do it faster.';
}
function escapeRank(hum) {
  if (hum >= 85) return 'Still yourself';
  if (hum >= 60) return 'Mostly you';
  if (hum >= 35) return 'Something in between';

  return 'Not a person any more';
}

function endRun(won) {
  game.running = false;
  audio.bossOff();
  const hum = humanity(game.player);
  const secs = Math.round(game.time);
  const best = readBest();
  const prev = best && best.won ? best : null;
  const better = won && (!prev || hum > prev.hum);
  const faster = won && (!prev || secs < prev.secs);
  if (won) {
    const mark = {
      won: true,
      hum: better ? Math.round(hum) : prev.hum,
      secs: faster ? secs : prev.secs,
    };
    try {
      localStorage.setItem('quarry.best', JSON.stringify(mark));
    } catch (e) {
      /* private mode */
    }
  }

  $('hud').classList.remove('on');
  const tier = HUM_TIERS.find(t => hum >= t.min);
  const title = $('go-title');
  if (won) title.textContent = escapeRank(hum);
  else title.textContent = 'Caught';
  title.className = 'go-title ' + tier.cls;
  $('go-sub').textContent = won
    ? hum > 75
      ? 'You walked out of the trees looking like yourself.'
      : hum >= 40
        ? 'Whatever walked out was mostly you.'
        : 'Something got out. It used to have your name.'
    : 'They drag you back, and they take the parts that were theirs.';
  renderer.paintPortrait($('go-portrait'));

  const nm = id => (id ? LIMBS[id].name : 'nothing');
  $('go-kit').innerHTML =
    `<b>${nm(game.player.legs[0])}</b> · <b>${nm(game.player.legs[1])}</b><br>` +
    `<b>${nm(game.player.arms[0])}</b> · <b>${nm(game.player.arms[1])}</b>`;

  $('hum-big').textContent = Math.round(hum);
  $('hum-tier').textContent = tier.line;

  $('hum-needle').parentElement.parentElement.className = 'scale ' + tier.cls;
  $('hum-needle').style.left = clamp(hum, 1, 99) + '%';
  const rows = [];
  rows.push([
    'Ended',
    won
      ? 'past the fence'
      : `in ${ZONES[game.zone].name}, ${Math.round((game.player.x / zoneExit) * 100)}% of the way`,
  ]);
  rows.push(['Limbs fitted', String(game.fitted)]);
  rows.push([
    'Left unseen',
    game.ghosted.length ? `${game.ghosted.length} of ${ZONES.length} zones` : 'seen in every zone',
  ]);
  rows.push([
    'Killed',
    game.kills
      ? game.kills + (game.quietKills ? ` — ${game.quietKills} from behind` : '')
      : 'nobody',
  ]);
  if (game.player.gun) {
    rows.push([
      'Rounds spent',
      game.player.fired + (game.player.silencer ? ' through a can' : ', all of them heard'),
    ]);
  }
  rows.push(['Took', secs + ' seconds' + (faster && prev ? ' — quickest yet' : '')]);
  if (better) {
    rows.push(['Best escape', Math.round(hum) + ' — your best yet']);
  } else if (prev) {
    rows.push(['Best escape', prev.hum + ' — still your record']);
  }

  $('go-summary').innerHTML = rows
    .map(
      ([k, v]) =>
        `<dt>${k}</dt><dd${/nobody|every zone/.test(v) ? ' class="quiet"' : ''}>${v}</dd>`,
    )
    .join('');
  $('go-note').textContent = endNote(won, hum, { prev, secs, faster });
  const resume = $('btn-resume-cp');
  if (!won && game.checkpoint) {
    resume.textContent = 'Back to ' + ZONES[game.checkpoint.zone].name;
    resume.style.display = '';
  } else {
    resume.style.display = 'none';
  }
  $('gameover').classList.add('on');
  renderer.titleVista();
}
function drawGunArm(p, bx, sho) {
  const d = p.dir;
  const braid = p.arms.find(a => a && LIMBS[a].grip) === 'officer_arm';
  const y = sho + 3;
  const x0 = d > 0 ? bx - 4 : bx - 8;
  const tone = FAR_SIDE ? 0.58 : 1;
  rect(x0, y - 1, 12, 5, PALETTE.ink);
  rect(x0 + 1, y, 10, 3, shade(braid ? PALETTE.gd2 : PALETTE.cl2, tone));
  if (!FAR_SIDE) rect(x0 + 1, y, 10, 1, braid ? PALETTE.gd3 : PALETTE.cl3);
  rect(d > 0 ? bx + 3 : bx - 6, y, 3, 3, shade(PALETTE.sk2, tone));
  GEAR_ART.gun(bx + d * 9, y + 1, p.silencer, d);
  if (p.shot <= TUNE.SHOT_LOCK - 5 || p.silencer) return;
  rect(bx + d * 14 - 2, y - 1, 5, 5, PALETTE.glow);
  rect(bx + d * 18 - 2, y + 1, 4, 2, '#ffeec2');
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(((n >> 16) & 255) * f) | 0},${(((n >> 8) & 255) * f) | 0},${((n & 255) * f) | 0})`;
}

const TIPS = [
  'stand in the ferns. they stop looking.',
  'guards carry mags. jaguars do not.',
  'strike from behind and nobody hears it',
  '<b>Q</b> swaps the side a limb goes on before you fit it',
  'five rounds a mag. <b>K</b> again swaps a fresh one in.',
  'the alarm dies down once you are out of sight',
  'he only opens up mid-swing. before that you are chipping.',
  'frog legs get you up to the ledge. they also get you looked at.',
  'sleeve, spring, rag, then hold <b>C</b>',
  'the floodlights in the yard reach about twice as far',
  'every lock in here is on the outside of the door',
  'you need a human hand to fire the gun',
];
let cacheSector = '',
  tipBag = [],
  tipT = 0;

function nextTip() {
  if (!tipBag.length) {
    tipBag = TIPS.map((v, i) => i);
    for (let i = tipBag.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [tipBag[i], tipBag[j]] = [tipBag[j], tipBag[i]];
    }
  }
  $('tip').innerHTML = TIPS[tipBag.pop()];
}

function tickTip() {
  const tip = $('tip');
  if (tipT === 0) nextTip();
  tipT++;
  if (tipT === LAYOUT.asideHold) tip.classList.add('fading');
  else if (tipT >= LAYOUT.asideHold + LAYOUT.asideFade) {
    nextTip();
    tipT = 1;
    tip.classList.remove('fading');
  }
}

function updateHud() {
  const p = game.player;
  const hum = humanity(p);
  const tier = HUM_TIERS.find(t => hum >= t.min);
  $('hum-fill').style.transform = `scaleX(${hum / 100})`;
  $('hum-fill').className = 'vital-fill ' + tier.cls;
  $('hum-num').textContent = Math.round(hum);
  $('hp-fill').style.transform = `scaleX(${p.hp / p.hpMax})`;
  $('hp-num').textContent = p.hp + '/' + p.hpMax;

  const obj = $('objective');
  obj.textContent = tier.line;
  obj.className = 'objective ' + tier.cls;
  const nm = id => (id ? LIMBS[id].name : '—');

  const kit = `${nm(p.legs[0])} · ${nm(p.legs[1])} / ${nm(p.arms[0])} · ${nm(p.arms[1])}`;

  if (kit !== cacheKit) {
    $('worn-legs').textContent = `${nm(p.legs[0])} · ${nm(p.legs[1])}`;
    $('worn-arms').textContent = `${nm(p.arms[0])} · ${nm(p.arms[1])}`;

    cacheKit = kit;
  }
  $('vital-gun').classList.toggle('on', p.gun);
  $('gun-warn').classList.toggle('on', p.gun && !hasGrip(p));
  if (p.gun) {
    const gunLine = p.ammo + '/' + p.mags + (p.silencer ? ' canned' : ' bare');
    if (gunLine !== cacheGun) {
      cacheGun = gunLine;
      $('ammo').innerHTML = Array.from({ length: CONFIG.MAGS_MAX }, (v, i) => {
        if (i >= p.mags) return '<i></i>';
        const loaded = i === 0 && p.ammo > 0 && p.ammo < CONFIG.MAG_SIZE;
        if (loaded)
          return `<i class="live" style="--fill:${(p.ammo / CONFIG.MAG_SIZE) * 100}%"></i>`;
        return '<i class="live"></i>';
      }).join('');
      const tag = $('gun-tag');
      if (p.silencer) {
        tag.textContent = 'canned';
        tag.className = 'gun-tag quiet';
      } else {
        tag.textContent = 'bare';
        tag.className = 'gun-tag';
      }
    }
  }
  const boss = !!(game.boss && game.boss.alive);
  $('hud').classList.toggle('boss', boss);
  const alarmEl = $('alarm');
  alarmEl.classList.toggle('on', game.alarm > 0);
  $('alarm-tick').style.transform = `scaleX(${game.alarm / CONFIG.HOT_TIME})`;

  const stood = game.pickups.find(
    u => !u.taken && (u.limb || GEAR[u.gear].hold) && p.near(u, 11, 14),
  );
  const prompt = $('prompt');
  let say = '';
  if (stood && stood.limb) {
    const L = LIMBS[stood.limb];
    const slots = L.kind === 'leg' ? p.legs : p.arms;
    const where =
      slots.indexOf(null) >= 0
        ? 'fits the empty socket'
        : `[Q] replace ${p.side ? 'right' : 'left'} · the old one drops`;
    say = `hold <b>E</b> — ${L.name} <i>${L.hum > 0 ? '+' : ''}${L.hum}</i> · ${where}`;
  } else if (stood) {
    say = `hold <b>E</b> — ${GEAR[stood.gear].name}`;
  } else if (p.building > 0) {
    say = `building the can — <b>${Math.round((p.building / TUNE.CAN_TIME) * 100)}%</b>`;
  } else if (tutorial.current >= 0) {
    const t = TUTORIAL[tutorial.current];
    say = t.text;
    if (tutorial.done[tutorial.current]) say = `<i>${t.text}</i>`;
  }
  prompt.classList.toggle('on', say !== '');
  prompt.parentNode.classList.toggle('live', say !== '');
  $('tip').classList.toggle('muted', say !== '');
  if (say !== cachePrompt) {
    cachePrompt = say;
    prompt.innerHTML = say;
  }
  const lines = game.log
    .map(l => `<div class="log-line" style="opacity:${clamp01(l.life / 60)}">${l.text}</div>`)

    .join('');
  if (lines !== cacheLog) {
    cacheLog = lines;
    $('log').innerHTML = lines;
  }

  const bossBar = $('bossbar');
  if (game.boss && game.boss.alive) {
    bossBar.classList.add('on');
    $('boss-fill').style.transform = `scaleX(${Math.max(0, game.boss.hp / game.boss.hpMax)})`;
    $('boss-name').textContent = `the king · phase ${game.phase}`;
  } else {
    bossBar.classList.remove('on');
  }
  $('ghost-tally').textContent = game.ghosted.length ? `unseen ×${game.ghosted.length}` : '';
  const z = ZONES[game.zone];
  const sec = game.zone + 1 + ' / ' + ZONES.length;
  if (sec !== cacheSector) {
    cacheSector = sec;
    $('sector-num').textContent = sec;
    $('sector-name').textContent = z.name;
    $('sector-rule').textContent = z.rule;
  }
  tickTip();
}
function zoneCard() {
  const card = $('transition');
  if (game.cardT <= 0) {
    card.classList.remove('on');
    return;
  }
  const z = ZONES[game.zone];
  if (!card.classList.contains('on')) {
    $('tnum').textContent = game.zone + 1 + ' / ' + ZONES.length;
    $('tname').textContent = z.name;
    $('trule').textContent = z.rule;
    card.classList.add('on');
  }
  card.style.opacity = clamp01(game.cardT / 40);
}
function drawBeastLeg(hx, hy, sw, dir, mid, low, tip) {
  const knee = segment(hx, hy, DOWN + sw * 0.7, 5, 4, mid, low);
  const hock = segment(knee.x, knee.y, DOWN - sw * 0.9 - 0.5, 5, 3, low, tip);
  const paw = segment(hock.x, hock.y, DOWN + sw * 0.4 + 0.4, 4, 3, mid, low);
  rect(paw.x - 2 + dir, paw.y, 3, 1, PALETTE.bone);
}

const input = {
  // TODO keyboard only. no pad, no touch. the whole thing is keys[] so a pad is not hard
  init() {
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
  },
  onKey(e, down) {
    const k = e.key.toLowerCase();
    if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
    keys[k] = down;
    if (!down || !game.running) return;
    if (game.intro < INTRO_CARDS.length) {
      game.intro++;
      game.introT = 0;
      return;
    }
    if (k === 'escape') game.paused = !game.paused;
    if (k === 'm') {
      audio.sfx = !audio.sfx;
      if (!audio.sfx) audio.bossOff();
      logLine(audio.sfx ? 'sound on' : 'sound off');
    }
    if (game.cardT > 30) game.cardT = 30;
    if (k === 'q') {
      if (game.player.side) game.player.side = 0;
      else game.player.side = 1;
    }
  },
};
window.addEventListener('DOMContentLoaded', () => {
  renderer.init();
  bake.all();
  input.init();

  $('btn-start').addEventListener('click', () => {
    audio.init();
    audio.resume();
    startRun(false);
  });
  $('btn-retry').addEventListener('click', () => {
    audio.resume();
    startRun(false);
  });
  $('btn-resume-cp').addEventListener('click', () => {
    audio.resume();
    startRun(true);
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) audio.resume();
  });
  renderer.titleVista();
  requestAnimationFrame(loop);
});
