// last in. owns the canvas, the DOM hud and the loop.

"use strict";

const SPR = {};
let ctx, lastT = 0, acc = 0;
let BACK = false;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  return { c, x };
}

const BAKE = {
  sky() {
    const s = makeCanvas(CFG.VIEW_W, CFG.VIEW_H);
    const stops = PAL.sky;
    for (let y = 0; y < CFG.VIEW_H; y++) {
      if (y >= 152) { s.x.fillStyle = PAL.night; s.x.fillRect(0, y, CFG.VIEW_W, 1); continue; }
      const f = y / 152 * (stops.length - 1);
      const i = Math.min(stops.length - 2, Math.floor(f));
      const frac = f - i;
      for (let x = 0; x < CFG.VIEW_W; x++) {
        s.x.fillStyle = frac > BAYER[y & 3][x & 3] / 16 ? stops[i + 1] : stops[i];
        s.x.fillRect(x, y, 1, 1);
      }
    }
    const sx = 232, sy = 104, r = 26;
    for (let y = -r - 12; y <= r + 12; y++) {
      for (let x = -r - 12; x <= r + 12; x++) {
        const d = Math.hypot(x, y);
        if (d > r + 12) continue;
        const th = BAYER[(sy + y) & 3][(sx + x) & 3] / 16;
        if (d <= r - 8) s.x.fillStyle = '#ffeec2';
        else if (d <= r) s.x.fillStyle = PAL.glow;
        else if (1 - (d - r) / 12 > th) s.x.fillStyle = '#f9cd8c';
        else continue;
        s.x.fillRect(sx + x, sy + y, 1, 1);
      }
    }
    return s.c;
  },

  tile(kind, seed) {
    const T = CFG.TILE;
    const s = makeCanvas(T, T), x = s.x;
    x.fillStyle = kind === 'top' ? PAL.st3 : PAL.st2; x.fillRect(0, 0, T, T);
    x.fillStyle = PAL.mortar; x.fillRect(0, T - 1, T, 1);
    x.fillRect(seed > 0.5 ? 3 : 5, 0, 1, T - 1);
    x.fillStyle = kind === 'top' ? PAL.st5 : PAL.st4; x.fillRect(0, 0, T, 1);
    x.fillStyle = PAL.st1; x.fillRect(0, T - 2, T, 1);
    for (let i = 0; i < 5; i++) {
      const px = ((seed * (i + 3) * 97) | 0) % T;
      const py = 1 + ((seed * (i + 7) * 53) | 0) % (T - 3);
      x.fillStyle = i % 2 ? PAL.st1 : PAL.st4; x.fillRect(px, py, 1, 1);
    }
    if (kind === 'top') {
      x.fillStyle = PAL.lf1; x.fillRect(0, 0, T, 2);
      x.fillStyle = PAL.lf2; x.fillRect(0, 0, T, 1);
      for (let i = 0; i < T; i += 2) {
        if (hash(seed * 100 + i, 3) <= 0.45) continue;
        const h = 1 + ((hash(seed * 31 + i, 9) * 3) | 0);
        x.fillStyle = hash(i, seed * 7) > 0.6 ? PAL.lf4 : PAL.lf3; x.fillRect(i, -h + 1, 1, h + 1);
      }
    }
    return s.c;
  },

  tree(v) {
    const w = 72, h = 104;
    const s = makeCanvas(w, h), x = s.x;
    const cx = w >> 1;
    const lean = [0, -0.10, 0.12][v];

    let tx = cx;
    for (let y = h - 1; y > 44; y--) {
      const t = (h - y) / (h - 44);
      const wid = Math.max(3, Math.round(9 - t * 5));
      tx = cx + lean * (h - y) * 0.5;
      x.fillStyle = PAL.bark1; x.fillRect(Math.round(tx - wid / 2), y, wid, 1);
      x.fillStyle = PAL.bark2; x.fillRect(Math.round(tx - wid / 2), y, 1, 1);
      x.fillStyle = PAL.bark0; x.fillRect(Math.round(tx + wid / 2) - 1, y, 1, 1);
      if (hash(v * 13, y) > 0.86) { x.fillStyle = PAL.bark0; x.fillRect(Math.round(tx), y, 1, 1); }
    }
    x.fillStyle = PAL.bark0; x.fillRect(cx - 8, h - 3, 16, 3);
    x.fillRect(cx - 11, h - 2, 22, 2);
    x.fillStyle = PAL.bark1; x.fillRect(cx - 14, 60, 14, 2);
    x.fillRect(cx + 3, 52, 13, 2);

    const clumps = [
      { x: cx, y: 30, r: 26 }, { x: cx - 18, y: 42, r: 18 }, { x: cx + 19, y: 40, r: 19 },
      { x: cx - 9, y: 18, r: 17 }, { x: cx + 11, y: 20, r: 16 }, { x: cx, y: 48, r: 16 },
    ];
    for (const cl of clumps) {
      const ox = cl.x, oy = cl.y, r = cl.r;
      for (let yy = -r; yy <= r; yy++) {
        for (let xx = -r; xx <= r; xx++) {
          if (Math.hypot(xx, yy * 1.18) > r) continue;
          const px = ox + xx, py = oy + yy;
          if (px < 0 || px >= w || py < 0 || py >= h) continue;
          const lit = (xx * 0.7 + -yy) / r;
          const n = hash(px + v * 40, py);
          let col = PAL.lf1;
          if (lit > 0.45 && n > 0.35) col = PAL.lf4;
          else if (lit > 0.05) col = PAL.lf3;
          else if (lit < -0.45) col = PAL.lf0;
          if (n > 0.93) col = PAL.lf5;
          x.fillStyle = col; x.fillRect(px, py, 1, 1);
        }
      }
    }
    x.fillStyle = PAL.lf1;
    for (let i = 0; i < 3; i++) {
      const vx = cx - 20 + i * 20;
      const len = 10 + ((hash(i, v) * 16) | 0);
      for (let k = 0; k < len; k++) x.fillRect(vx + ((k / 5) | 0) % 2, 56 + k, 1, 1);
    }
    return s.c;
  },

  fern() {
    const w = 22, h = 18;
    const s = makeCanvas(w, h), x = s.x;
    for (let b = 0; b < 7; b++) {
      const a = -Math.PI / 2 + (b - 3) * 0.34;
      const len = 9 + (b === 3 ? 5 : 0) + (b % 2 ? 2 : 0);
      for (let k = 0; k < len; k++) {
        const px = (w >> 1) + Math.cos(a) * k;
        const py = h - 1 + Math.sin(a) * k;
        let leaf = PAL.lf2;
        if (k > len - 4) leaf = PAL.lf4;
        else if (k > len / 2) leaf = PAL.lf3;
        x.fillStyle = leaf; x.fillRect(px | 0, py | 0, 1, 1);
        if (k % 3 === 0 && k > 2) {
          x.fillStyle = PAL.lf2; x.fillRect((px + Math.cos(a + 1.3) * 2) | 0, (py + Math.sin(a + 1.3) * 2) | 0, 1, 1);
          x.fillRect((px + Math.cos(a - 1.3) * 2) | 0, (py + Math.sin(a - 1.3) * 2) | 0, 1, 1);
        }
      }
    }
    return s.c;
  },

  canopy(colour, seed, height) {
    const w = 512;
    const s = makeCanvas(w, height), x = s.x;
    x.fillStyle = colour;
    for (let i = 0; i < 46; i++) {
      const bx = (i * 12 + ((hash(i, seed) * 8) | 0)) % w;
      const r = 7 + ((hash(i, seed + 5) * 11) | 0);
      const by = height - 10 - ((hash(i, seed + 9) * 6) | 0);
      x.beginPath(); x.arc(bx, by, r, Math.PI, 0); x.fill();
      x.fillRect(bx - 1, by, 3, height - by);
    }
    x.fillRect(0, height - 10, w, 10);
    return s.c;
  },

  fronds() {
    const w = 480, h = 46;
    const f = makeCanvas(w, h), x = f.x;
    for (let i = 0; i < 34; i++) {
      const bx = (i * 15 + ((hash(i, 21) * 11) | 0)) % w;
      const len = 20 + ((hash(i, 33) * 24) | 0);
      const lean = (hash(i, 44) - 0.5) * 1.1;
      for (let k = 0; k < len; k++) {
        const px = bx + lean * k, py = h - 1 - k;
        x.fillStyle = k > len - 6 ? '#132a19' : '#0d1f13'; x.fillRect(px | 0, py | 0, 3, 1);
        if (k % 4 === 0 && k > 3) {
          x.fillRect((px - 3 - (k % 8)) | 0, py | 0, 3, 1);
          x.fillRect((px + 3 + (k % 8)) | 0, py | 0, 3, 1);
        }
      }
    }
    return f.c;
  },

  all() {
    SPR.sky = BAKE.sky();
    SPR.tileTop = [0, 1].map(i => BAKE.tile('top', 0.2 + i * 0.6));
    SPR.tileFill = [0, 1, 2].map(i => BAKE.tile('fill', 0.15 + i * 0.35));
    SPR.tree = [];
    for (let i = 0; i < 3; i++) SPR.tree.push(BAKE.tree(i));
    SPR.fern = BAKE.fern();
    SPR.canopyFar = BAKE.canopy(PAL.canopyFar, 3, 32);
    SPR.canopyNear = BAKE.canopy(PAL.canopy, 8, 32);
    SPR.fronds = BAKE.fronds();
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

const Renderer = {
  canvas: null,
  scale: 4,

  init() {
    this.canvas = $('stage');
    ctx = this.canvas.getContext('2d');
    this.fitCanvas();
    window.addEventListener('resize', () => this.fitCanvas());
  },

  drawPlayer(p) {
    const bx = Math.round(p.x - G.cam), by = Math.round(p.y - G.camY);
    if (p.iframe > 0 && (p.iframe >> 2) % 2 === 0) return;

    const moving = p.grounded && Math.abs(p.vx) > 0.12;
    let sw = 0.40;
    if (moving) sw = Math.sin(p.walk) * FEEL.SWING;
    else if (p.grounded) sw = 0.12;
    const bob = moving && Math.sin(p.walk * 2) > 0 ? 1 : 0;

    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(p.sqx, p.sqy);
    ctx.translate(-bx, -by);

    const hip = by - 11 + bob, sho = by - 20 + bob;

    let gunSlot = -1;
    if (armedWithGun(p) && p.atk <= 10) {
      gunSlot = 1;
      if (p.arms[0] && LIMBS[p.arms[0]].grip) gunSlot = 0;
    }

    BACK = true;
    drawLimb(p.legs[1], bx + 2, hip, -sw, p.dir);
    if (gunSlot === 1) drawGunHand(p, bx + 2, sho);
    else drawLimb(p.arms[1], bx + 3, sho, -sw, p.dir);
    BACK = false;

    px(bx - 6, by - 23 + bob, 12, 13, PAL.ink);
    px(bx - 5, by - 22 + bob, 10, 11, PAL.cl1);
    px(bx - 5, by - 22 + bob, 10, 4, PAL.cl2);
    px(bx + 2, by - 22 + bob, 3, 11, PAL.cl0);
    px(bx - 5, by - 15 + bob, 10, 1, PAL.cl0);
    px(bx - 5, by - 22 + bob, 10, 1, PAL.cl3);

    px(bx - 3, by - 25 + bob, 6, 3, PAL.ink);
    px(bx - 2, by - 25 + bob, 4, 2, PAL.sk2);
    px(bx - 5, by - 33 + bob, 10, 9, PAL.ink);
    px(bx - 4, by - 32 + bob, 8, 8, PAL.sk3);
    px(bx + 1, by - 32 + bob, 3, 8, PAL.sk2);
    px(bx - 4, by - 32 + bob, 8, 3, PAL.bark0);
    px(bx - 4 + (p.dir > 0 ? 0 : 5), by - 30 + bob, 3, 2, PAL.bark0);
    px(bx + (p.dir > 0 ? 1 : -3), by - 28 + bob, 2, 2, PAL.ink);
    px(bx - 4, by - 32 + bob, 8, 1, PAL.sk4);

    drawLimb(p.legs[0], bx - 2, hip, sw, p.dir);
    if (gunSlot === 0) drawGunHand(p, bx, sho);
    else drawLimb(p.arms[0], bx - 4, sho, p.atk > 10 ? 1.5 * p.dir : sw, p.dir);

    ctx.restore();

    if (p.fitting > 0) {
      const w = Math.round(p.fitting * 22);
      px(bx - 12, by - 38, 24, 5, PAL.ink);
      px(bx - 11, by - 37, 22, 3, 'rgba(0,0,0,0.5)');
      px(bx - 11, by - 37, w, 3, PAL.au3);
    }
  },

  drawBeast(f, bx, by) {
    const gait2 = Math.sin(f.walk * 1.6) * 0.7;
    const gold = f.type === 'jaguar';
    const hide = gold ? PAL.au2 : PAL.bark2;
    const under = gold ? PAL.au1 : PAL.bark1;
    const spot = gold ? PAL.au0 : PAL.bark0;
    const long = gold ? 20 : 14;

    BACK = true;
    drawBeastLeg(bx - long * 0.25, by - 7, -gait2, f.dir, hide, under, spot);
    drawBeastLeg(bx + long * 0.35, by - 7, gait2, f.dir, hide, under, spot);
    BACK = false;

    px(bx - long / 2 - 1, by - 17, long + 2, 9, PAL.ink);
    px(bx - long / 2, by - 16, long, 7, hide);
    px(bx - long / 2, by - 16, long, 2, gold ? PAL.au3 : PAL.bark2);
    px(bx - long / 2, by - 11, long, 2, under);
    for (let i = 0; i < 5; i++) px(bx - long / 2 + 2 + i * 4, by - 14 + (i % 2) * 3, 2, 2, spot);

    const hx = bx + (f.dir > 0 ? long / 2 - 2 : -long / 2 - 3);
    px(hx, by - 20, 5, 6, PAL.ink);
    px(hx + 1, by - 19, 3, 4, hide);
    px(hx + (f.dir > 0 ? 2 : 1), by - 18, 1, 1, gold ? PAL.blood : PAL.ink);
    px(bx + (f.dir > 0 ? -long / 2 - 3 : long / 2 + 1), by - 16, 4, 1, under);

    drawBeastLeg(bx - long * 0.25, by - 7, gait2, f.dir, hide, under, spot);
    drawBeastLeg(bx + long * 0.35, by - 7, -gait2, f.dir, hide, under, spot);
  },

  drawTell(f, bx, by) {
    if (f.tell <= 0) return;
    const beat = (G.t * 9 | 0) % 2;
    const ink = beat ? PAL.warn : PAL.blood;
    const w = Math.max(2, Math.round(f.tell / 2));
    px(bx - 13, by - 49, 26, 4, PAL.ink);
    px(bx - 12, by - 48, w, 2, ink);
    px(bx - 2, by - 58, 5, 7, PAL.ink);
    px(bx - 1, by - 57, 3, 3, ink);
    px(bx - 1, by - 53, 3, 1, ink);
  },

  drawKing(f, bx, by) {
    const sw = Math.sin(f.walk) * 0.6;
    const rear = f.tell > 0;
    BACK = true;
    LEG_ART.plate_leg(bx + 3, by - 13, -sw, f.dir);
    BACK = false;
    LEG_ART.own_leg(bx - 3, by - 13, sw, f.dir);
    px(bx - 8, by - 27, 16, 16, PAL.ink);
    px(bx - 7, by - 26, 14, 14, '#3a2b52');
    px(bx - 7, by - 26, 14, 4, PAL.au1);
    px(bx + 3, by - 26, 3, 14, PAL.gd0);
    px(bx - 7, by - 18, 14, 1, PAL.au0);
    px(bx - 5, by - 35, 10, 9, PAL.ink);
    px(bx - 4, by - 34, 8, 8, PAL.sk3);
    px(bx + 1, by - 34, 3, 8, PAL.sk2);
    px(bx + (f.dir > 0 ? 1 : -3), by - 30, 2, 2, PAL.blood);
    for (let i = 0; i < 5; i++) px(bx - 5 + i * 2, by - 40 + (i % 2 ? 1 : 0), 2, 5, PAL.au2);
    px(bx - 5, by - 36, 11, 2, PAL.au1);
    let arm = sw;
    if (rear) arm = -1.9 * f.dir;
    else if (f.state === 'alert') arm = 1.2 * f.dir;
    ARM_ART.claw_arm(bx - 5, by - 24, arm, f.dir);
    this.drawTell(f, bx, by);
  },

  drawSuspicion(f, bx, by) {
    if (f.sus <= 4) return;
    const h = Math.round((f.sus / 100) * 9);
    px(bx - 2, by - 44, 5, 12, PAL.ink);
    px(bx - 1, by - 43, 3, 10, 'rgba(0,0,0,0.55)');
    px(bx - 1, by - 33 - h, 3, h, f.state === 'alert' ? PAL.blood : PAL.warn);
    if (f.state === 'alert' && (G.t * 6 | 0) % 2) {
      px(bx - 1, by - 50, 3, 5, PAL.blood);
      px(bx - 1, by - 43, 3, 2, PAL.blood);
    }
  },

  drawFoe(f) {
    const bx = Math.round(f.x - G.cam), by = Math.round(f.y - G.camY);
    if (bx < -40 || bx > CFG.VIEW_W + 40) return;

    if (!f.alive) {
      px(bx - 8, by - 4, 16, 4, PAL.ink);
      px(bx - 7, by - 3, 14, 2, PAL.gd1);
      px(bx - 3, by - 6, 5, 3, PAL.ink);
      px(bx - 2, by - 5, 3, 2, PAL.sk1);
      return;
    }

    const F = FOES[f.type];
    if (F.boss) { this.drawKing(f, bx, by); this.drawSuspicion(f, bx, by); return; }
    if (F.beast) { this.drawBeast(f, bx, by); this.drawSuspicion(f, bx, by); return; }

    const sw = Math.sin(f.walk) * 0.8;
    const wide = F.wide;

    BACK = true;
    drawLimb(F.leg, bx + 2, by - 11, -sw, f.dir);
    BACK = false;

    px(bx - wide / 2, by - 23, wide, 13, PAL.ink);
    px(bx - wide / 2 + 1, by - 22, wide - 2, 11, f.state === 'alert' ? '#6b2836' : F.cloth);
    px(bx - wide / 2 + 1, by - 22, wide - 2, 4, f.state === 'alert' ? '#8f3546' : F.clothHi);
    px(bx + 2, by - 22, 3, 11, PAL.gd0);
    px(bx - wide / 2 + 1, by - 15, wide - 2, 1, PAL.gd0);
    if (F.radio) {
      px(bx - 5, by - 21, 10, 1, PAL.au2);
      px(bx + (f.dir > 0 ? -6 : 4), by - 20, 2, 4, PAL.au1);
    }
    if (F.armour) {
      px(bx - 5, by - 20, 10, 6, PAL.st3);
      px(bx - 5, by - 20, 10, 1, PAL.st5);
    }

    px(bx - 3, by - 25, 6, 3, PAL.ink);
    px(bx - 2, by - 25, 4, 2, PAL.sk2);
    px(bx - 5, by - 33, 10, 9, PAL.ink);
    px(bx - 4, by - 32, 8, 8, PAL.sk3);
    px(bx + 1, by - 32, 3, 8, PAL.sk2);
    px(bx - 5, by - 35, 11, 3, PAL.ink);
    px(bx - 4, by - 34, 9, 2, PAL.gd0);
    px(bx - 4 + (f.dir > 0 ? 8 : -2), by - 33, 3, 1, PAL.gd0);
    px(bx + (f.dir > 0 ? 1 : -3), by - 28, 2, 2, PAL.ink);

    drawLimb(F.leg, bx - 2, by - 11, sw, f.dir);
    drawLimb(F.arm, bx - 4, by - 20, sw, f.dir);
    this.drawSuspicion(f, bx, by);
  },

  drawBackdrop() {
    ctx.drawImage(SPR.sky, 0, 0);
    ctx.fillStyle = PAL.ridgeFar;
    for (let i = 0; i < 10; i++) {
      const bx = i * 128 - ((G.cam * 0.10) % 1280);
      ctx.beginPath();
      ctx.moveTo(bx, 128);
      ctx.lineTo(bx + 46, 78);
      ctx.lineTo(bx + 92, 128);
      ctx.fill();
    }
    ctx.fillStyle = PAL.ridgeMid;
    for (let i = 0; i < 12; i++) {
      const bx = i * 104 - ((G.cam * 0.18) % 1248) - 40;
      ctx.beginPath();
      ctx.moveTo(bx, 138);
      ctx.lineTo(bx + 38, 98);
      ctx.lineTo(bx + 76, 138);
      ctx.fill();
    }
    for (let i = -1; i < 3; i++)
      ctx.drawImage(SPR.canopyFar, i * 512 - ((G.cam * 0.32) % 512), 124 - G.camY * 0.2);
    for (let i = -1; i < 3; i++)
      ctx.drawImage(SPR.canopyNear, i * 512 - ((G.cam * 0.52) % 512), 136 - G.camY * 0.4);
    for (const t of TREES) {
      const sx = Math.round(t.x - G.cam * 0.86 - 36);
      if (sx > CFG.VIEW_W || sx < -80) continue;
      ctx.drawImage(SPR.tree[t.v], sx, Math.round(t.y - 100 - G.camY * 0.8));
    }
  },

  drawTerrain() {
    const T = CFG.TILE;
    for (const t of PLATS) {
      const x0 = t.x - G.cam;
      if (x0 > CFG.VIEW_W || x0 + t.w < 0) continue;
      for (let ty = 0; ty < t.h; ty += T) {
        for (let tx = 0; tx < t.w; tx += T) {
          const wx = t.x + tx, wy = t.y + ty;
          const sx = Math.round(wx - G.cam);
          if (sx > CFG.VIEW_W || sx < -T) continue;
          const n = hash(wx, wy);
          const img = ty === 0 ? SPR.tileTop[(n * 2) | 0] : SPR.tileFill[(n * 3) | 0];
          ctx.drawImage(img, sx, Math.round(wy - G.camY));
        }
      }
      px(x0, t.y + T - G.camY, t.w, 1, 'rgba(0,0,0,0.28)');
    }
  },

  drawFerns() {
    for (const f of FOLIAGE) {
      const x0 = f.x - G.cam;
      if (x0 > CFG.VIEW_W || x0 + f.w < 0) continue;
      for (let i = 0; i < f.w; i += 6) {
        const wob = Math.sin(G.t * 1.6 + (f.x + i) * 0.3) * 1.2;
        ctx.drawImage(SPR.fern, Math.round(x0 + i + wob), Math.round(f.y + f.h - 17 - G.camY));
      }
      for (let i = 3; i < f.w; i += 11) {
        const h = 9 + ((hash(f.x + i, 2) * 8) | 0);
        px(x0 + i, f.y + f.h - h - G.camY, 2, h, hash(i, f.x) > 0.6 ? PAL.lf3 : PAL.lf2);
      }
    }
  },

  drawFloodlights() {
    if (!LIGHTS.length) return;
    ctx.globalCompositeOperation = 'lighter';
    for (const l of LIGHTS) {
      const x = l.x - G.cam;
      if (x > CFG.VIEW_W || x + l.w < 0) continue;
      const grd = ctx.createLinearGradient(0, -G.camY, 0, GROUND - G.camY);
      grd.addColorStop(0, 'rgba(255,232,180,0.16)');
      grd.addColorStop(1, 'rgba(255,200,120,0.05)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.moveTo(x + l.w * 0.34, -G.camY);
      ctx.lineTo(x + l.w * 0.66, -G.camY);
      ctx.lineTo(x + l.w, GROUND - G.camY);
      ctx.lineTo(x, GROUND - G.camY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  },

  drawTreeline() {
    const ex = EXIT_X - G.cam;
    if (ex > CFG.VIEW_W + 60) return;
    for (let i = 0; i < 9; i++) {
      const h = 90 + (i % 3) * 8;
      px(ex + i * 9, CFG.VIEW_H - h - G.camY, 7, h, i % 2 ? PAL.lf0 : PAL.lf1);
    }
    px(ex - 4, 46 - G.camY, 90, 8, PAL.lf2);
    for (let i = 0; i < 40; i++) px(ex - 4 + i * 2, 54 - G.camY + ((i * 7) % 5), 2, 3, PAL.lf1);
  },

  drawPickups() {
    for (const u of G.pickups) {
      if (u.taken) continue;
      const x = u.x - G.cam, y = u.y - G.camY;
      if (x < -24 || x > CFG.VIEW_W + 24) continue;
      const bob = Math.sin(G.t * 2.6 + u.x) * 1.6;
      px(x - 6, y - 2, 12, 2, 'rgba(0,0,0,0.32)');
      const halo = (G.fitted === 0 ? 0.46 : 0.30) + Math.sin(G.t * 3 + u.x) * 0.12;
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
    for (const q of G.parts) {
      ctx.globalAlpha = clamp01(q.life / q.max * 1.6);
      px(q.x - G.cam, q.y - G.camY, q.size, q.size, q.colour);
    }
    ctx.globalAlpha = 1;
    for (const r of G.rings) {
      ctx.strokeStyle = `rgba(246,232,207,${r.life * 0.42})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(Math.round(r.x - G.cam), Math.round(r.y - 10 - G.camY), Math.round(r.r), 0, TAU);
      ctx.stroke();
    }
    for (const b of G.shots) {
      const sx = b.x - G.cam, sy = b.y - G.camY;
      if (b.mine) {
        px(sx - sign(b.vx) * 5, sy, 6, 1, 'rgba(255,219,160,0.45)');
        px(sx - 1, sy, 3, 1, PAL.bone);
      } else {
        px(sx - 2, sy - 1, 5, 3, PAL.ink);
        px(sx - 1, sy, 3, 1, PAL.warn);
      }
    }
    ctx.fillStyle = 'rgba(255,219,160,0.30)';
    for (const m of G.motes) ctx.fillRect(m.x | 0, m.y | 0, 1, 1);
  },

  renderScene() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.save();
    ctx.translate(Math.round(rand(-G.shake / 2, G.shake / 2)), Math.round(rand(-G.shake / 2, G.shake / 2)));

    this.drawBackdrop();
    this.drawTerrain();
    this.drawPickups();
    for (const f of G.foes) this.drawFoe(f);
    this.drawPlayer(G.p);
    this.drawFloodlights();
    this.drawFerns();
    this.drawTreeline();
    this.drawParticles();

    for (let i = -1; i < 3; i++)
      ctx.drawImage(SPR.fronds, i * 480 - ((G.cam * 1.35) % 480), CFG.VIEW_H - 40 - G.camY * 0.2);

    ctx.restore();

    const vg = ctx.createRadialGradient(CFG.VIEW_W / 2, CFG.VIEW_H * 0.46, CFG.VIEW_H * 0.62,
                                        CFG.VIEW_W / 2, CFG.VIEW_H * 0.46, CFG.VIEW_H * 1.12);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(22,12,34,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);

    if (G.hot) {
      ctx.fillStyle = `rgba(201,53,74,${0.06 + Math.sin(G.t * 4) * 0.04})`;
      ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    }
    if (G.flash > 0) {
      ctx.fillStyle = `rgba(201,53,74,${G.flash / 24})`;
      ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    }
    if (G.fade > 0) {
      ctx.fillStyle = `rgba(13,10,22,${G.fade})`;
      ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    }
  },

  fitCanvas() {
    const fit = Math.min(window.innerWidth / CFG.VIEW_W, window.innerHeight / CFG.VIEW_H);
    this.scale = Math.max(1, Math.floor(fit));
    this.canvas.width = CFG.VIEW_W;
    this.canvas.height = CFG.VIEW_H;
    this.canvas.style.width = CFG.VIEW_W * this.scale + 'px';
    this.canvas.style.height = CFG.VIEW_H * this.scale + 'px';
    ctx.imageSmoothingEnabled = false;
  },

  paintPortrait(target) {
    const keep = { ctx, cam: G.cam, camY: G.camY, sqx: G.p.sqx, sqy: G.p.sqy,
                   iframe: G.p.iframe, walk: G.p.walk, fitting: G.p.fitting,
                   atk: G.p.atk, x: G.p.x, y: G.p.y, dir: G.p.dir, vx: G.p.vx };
    ctx = target.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, target.width, target.height);
    G.p.sqx = 1;
    G.p.sqy = 1;
    G.p.iframe = 0;
    G.p.fitting = 0;
    G.p.atk = 0;
    G.p.walk = 0;
    G.p.dir = 1;
    G.p.vx = 0;
    G.p.x = 0; G.p.y = 0;
    G.cam = -(target.width / 2);
    G.camY = -(target.height - 12);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(target.width / 2, target.height - 11, 9, 2.5, 0, 0, TAU);
    ctx.fill();
    this.drawPlayer(G.p);
    ctx = keep.ctx;
    Object.assign(G.p, { sqx: keep.sqx, sqy: keep.sqy, iframe: keep.iframe, walk: keep.walk,
                         fitting: keep.fitting, atk: keep.atk, x: keep.x, y: keep.y,
                         dir: keep.dir, vx: keep.vx });
    G.cam = keep.cam; G.camY = keep.camY;
  },

  titleVista() {
    const t = $('title-canvas');
    const tg = t.getContext('2d');
    tg.imageSmoothingEnabled = false;
    let k = 0;
    (function tick() {
      if (G.running) return;
      requestAnimationFrame(tick);
      k += 0.01;
      tg.drawImage(SPR.sky, 0, 0);
      tg.fillStyle = PAL.ridgeMid;
      for (let i = 0; i < 8; i++) {
        const bx = i * 104 - ((k * 22) % 1040) - 40;
        tg.beginPath();
        tg.moveTo(bx, 138);
        tg.lineTo(bx + 38, 98);
        tg.lineTo(bx + 76, 138);
        tg.fill();
      }
      for (let i = -1; i < 3; i++) tg.drawImage(SPR.canopyNear, i * 512 - ((k * 46) % 512), 132);
      tg.drawImage(SPR.tree[1], 34, 48);
      tg.drawImage(SPR.tree[2], 210, 56);
      tg.drawImage(SPR.fronds, -((k * 90) % 480), 138);
      tg.fillStyle = 'rgba(13,10,22,0.42)';
      tg.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);
    })();
  },
};

function px(x, y, w, h, col) {
  ctx.fillStyle = col;
  ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
}

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${((n >> 16 & 255) * f) | 0},${((n >> 8 & 255) * f) | 0},${((n & 255) * f) | 0})`;
}

function seg(x, y, ang, len, w, col, hi) {
  const dx = Math.cos(ang), dy = Math.sin(ang), o = w >> 1;
  const body = BACK ? shade(col, 0.58) : col;
  const edge = BACK ? null : hi;
  for (let i = -1; i <= len; i++) px(x + dx * i - o - 1, y + dy * i, w + 2, 1, PAL.ink);
  for (let i = 0; i < len; i++) {
    px(x + dx * i - o, y + dy * i, w, 1, body);
    if (edge && w > 2) px(x + dx * i - o, y + dy * i, 1, 1, edge);
  }
  return { x: x + dx * len, y: y + dy * len };
}

const UP = Math.PI / 2;

const LEG_ART = {
  human_leg(hx, hy, sw) {
    const knee = seg(hx, hy, UP + sw * 0.5, 5, 3, PAL.cl2, PAL.cl1);
    seg(knee.x, knee.y, UP - sw * 0.3, 6, 3, PAL.sk2, PAL.sk1);
  },
  boot_leg(hx, hy, sw, dir) {
    const knee = seg(hx, hy, UP + sw * 0.5, 5, 3, PAL.gd2, PAL.gd1);
    const foot = seg(knee.x, knee.y, UP - sw * 0.3, 5, 3, PAL.gd1, PAL.gd0);
    px(foot.x - 3, foot.y - 1, 6, 3, PAL.ink);
    px(foot.x - 2, foot.y - 1, 4 + (dir > 0 ? 1 : 0), 2, PAL.gd0);
  },
  plate_leg(hx, hy, sw) {
    const knee = seg(hx, hy, UP + sw * 0.45, 5, 4, PAL.st4, PAL.st2);
    const foot = seg(knee.x, knee.y, UP - sw * 0.25, 5, 4, PAL.st3, PAL.st1);
    px(foot.x - 3, foot.y - 1, 7, 3, PAL.ink);
    px(foot.x - 2, foot.y - 1, 5, 2, PAL.st2);
  },
  jag_leg(hx, hy, sw, dir) {
    const knee = seg(hx, hy, UP + sw * 0.7, 5, 4, PAL.au2, PAL.au1);
    const hock = seg(knee.x, knee.y, UP - sw * 0.9 - 0.5, 5, 3, PAL.au1, PAL.au0);
    const paw = seg(hock.x, hock.y, UP + sw * 0.4 + 0.4, 4, 3, PAL.au2, PAL.au1);
    px(paw.x - 2 + dir, paw.y, 3, 1, PAL.bone);
    px(hx - 2, hy + 2, 1, 1, PAL.au0);
    px(hx + 1, hy + 5, 1, 1, PAL.au0);
  },
  frog_leg(hx, hy, sw) {
    const knee = seg(hx, hy, UP + sw * 0.4 + 0.6, 4, 4, PAL.fr2, PAL.fr1);
    const hock = seg(knee.x, knee.y, UP - 0.78, 7, 3, PAL.fr1, PAL.fr0);
    const web = seg(hock.x, hock.y, UP + 0.55, 4, 3, PAL.fr2, PAL.fr1);
    px(web.x - 3, web.y, 7, 2, PAL.ink);
    px(web.x - 2, web.y, 5, 1, PAL.fr3);
  },
  croc_leg(hx, hy, sw, dir) {
    const knee = seg(hx, hy, UP + sw * 0.22, 6, 5, PAL.gt2, PAL.gt1);
    px(knee.x - 4, knee.y - 1, 9, 5, PAL.ink);
    px(knee.x - 3, knee.y, 7, 3, PAL.gt1);
    px(knee.x - 3 + (dir > 0 ? 6 : -1), knee.y + 1, 2, 1, PAL.gt3);
    px(hx - 3, hy + 2, 1, 1, PAL.gt3);
    px(hx + 2, hy + 4, 1, 1, PAL.gt3);
  },
  own_leg(hx, hy, sw) {
    const knee = seg(hx, hy, UP + sw * 0.4, 6, 3, PAL.sk1, PAL.sk0);
    const foot = seg(knee.x, knee.y, UP - sw * 0.2, 6, 3, PAL.sk2, PAL.sk1);
    for (let i = 0; i < 4; i++) px(hx - 1, hy + 1 + i * 3, 3, 1, PAL.blood);
    px(foot.x - 2, foot.y - 1, 5, 2, PAL.ink);
  },
};

const ARM_ART = {
  human_arm(sx, sy, sw) {
    const elbow = seg(sx, sy, UP + sw * 0.6, 5, 3, PAL.cl2, PAL.cl1);
    seg(elbow.x, elbow.y, UP + sw * 0.2, 5, 3, PAL.sk2, PAL.sk1);
  },
  officer_arm(sx, sy, sw) {
    const elbow = seg(sx, sy, UP + sw * 0.6, 5, 3, PAL.gd2, PAL.gd1);
    seg(elbow.x, elbow.y, UP + sw * 0.2, 5, 3, PAL.sk2, PAL.sk1);
    px(sx - 2, sy + 1, 4, 1, PAL.au2);
  },
  claw_arm(sx, sy, sw, dir) {
    const elbow = seg(sx, sy, UP + sw * 0.75, 5, 4, PAL.au2, PAL.au1);
    const paw = seg(elbow.x, elbow.y, UP + sw * 0.3, 5, 3, PAL.au1, PAL.au0);
    for (let i = 0; i < 3; i++) px(paw.x - 1 + dir * (1 + i), paw.y + i - 1, 1, 3 - i, PAL.bone);
  },
  jaw_arm(sx, sy, sw) {
    const hinge = seg(sx, sy, UP + sw * 0.5, 6, 5, PAL.gt2, PAL.gt1);
    px(hinge.x - 4, hinge.y - 1, 9, 5, PAL.ink);
    px(hinge.x - 3, hinge.y, 7, 3, PAL.gt1);
    for (let i = 0; i < 3; i++) px(hinge.x - 2 + i * 2, hinge.y + 3, 1, 1, PAL.bone);
  },
  ape_arm(sx, sy, sw, dir) {
    const elbow = seg(sx, sy, UP + sw * 0.8, 7, 4, PAL.bark2, PAL.bark1);
    const hand = seg(elbow.x, elbow.y, UP + sw * 0.4, 7, 3, PAL.bark1, PAL.bark0);
    px(hand.x - 2, hand.y, 5, 3, PAL.ink);
    px(hand.x - 1 + dir, hand.y, 3, 2, PAL.sk1);
  },
};

const GEAR_ART = {
  gun(x, y, can, dir) {
    const d = dir || 1;
    px(x - 4, y - 2, 9, 4, PAL.ink);
    px(x - 3, y - 1, 7, 2, PAL.gd3);
    px(x - 3, y - 1, 7, 1, PAL.gd2);
    px(x - d * 3 - 1, y + 1, 3, 3, PAL.ink);
    px(x - d * 3, y + 1, 2, 2, PAL.bark1);
    if (!can) return;
    px(x + d * 5 - 2, y - 2, 5, 4, PAL.ink);
    px(x + d * 5 - 1, y - 1, 4, 2, PAL.st3);
    px(x + d * 5 - 1, y - 1, 4, 1, PAL.st5);
  },
  rounds(x, y) {
    px(x - 5, y - 2, 10, 5, PAL.ink);
    for (let i = 0; i < 3; i++) {
      px(x - 4 + i * 3, y, 2, 2, PAL.au1);
      px(x - 4 + i * 3, y - 1, 2, 1, PAL.au3);
    }
  },
  sleeve(x, y) {
    px(x - 6, y - 2, 12, 5, PAL.ink);
    px(x - 5, y - 1, 10, 3, PAL.st3);
    px(x - 5, y - 1, 10, 1, PAL.st5);
    px(x + 3, y - 1, 2, 3, PAL.st1);
  },
  spring(x, y) {
    px(x - 6, y - 3, 12, 7, PAL.ink);
    for (let i = 0; i < 5; i++) px(x - 5 + i * 2, y - 2 + (i % 2) * 3, 2, 2, PAL.st4);
    px(x - 5, y - 2, 1, 5, PAL.st2);
  },
  rag(x, y) {
    px(x - 5, y - 3, 11, 7, PAL.ink);
    px(x - 4, y - 2, 9, 5, PAL.bark1);
    px(x - 4, y - 2, 9, 1, PAL.bark2);
    px(x - 2, y + 1, 4, 1, PAL.bark0);
    px(x + 2, y - 1, 2, 2, PAL.bark0);
  },
};

function drawGunHand(p, bx, sho) {
  const d = p.dir;
  const braid = p.arms.find(a => a && LIMBS[a].grip) === 'officer_arm';
  const y = sho + 3;
  const x0 = d > 0 ? bx - 4 : bx - 8;
  const tone = BACK ? 0.58 : 1;
  px(x0, y - 1, 12, 5, PAL.ink);
  px(x0 + 1, y, 10, 3, shade(braid ? PAL.gd2 : PAL.cl2, tone));
  if (!BACK) px(x0 + 1, y, 10, 1, braid ? PAL.gd3 : PAL.cl3);
  px(d > 0 ? bx + 3 : bx - 6, y, 3, 3, shade(PAL.sk2, tone));
  GEAR_ART.gun(bx + d * 9, y + 1, p.silencer, d);
  if (p.shot <= FEEL.SHOT_LOCK - 5 || p.silencer) return;
  px(bx + d * 14 - 2, y - 1, 5, 5, PAL.glow);
  px(bx + d * 18 - 2, y + 1, 4, 2, '#ffeec2');
}

function drawLimb(id, x, y, sw, dir) {
  if (!id) return;
  const art = LIMBS[id].kind === 'leg' ? LEG_ART[id] : ARM_ART[id];
  art(x, y, sw, dir);
}

function drawBeastLeg(hx, hy, sw, dir, mid, low, tip) {
  const knee = seg(hx, hy, UP + sw * 0.7, 5, 4, mid, low);
  const hock = seg(knee.x, knee.y, UP - sw * 0.9 - 0.5, 5, 3, low, tip);
  const paw = seg(hock.x, hock.y, UP + sw * 0.4 + 0.4, 4, 3, mid, low);
  px(paw.x - 2 + dir, paw.y, 3, 1, PAL.bone);
}

const TIERS = [
  { min: 76, cls: 'good', line: 'they see one of their own' },
  { min: 40, cls: 'warn', line: 'something is off about you' },
  { min: 0, cls: 'danger', line: 'shoot on sight' },
];

let hudCache = '', gunCache = '', promptCache = '', logCache = '';

function refreshHud() {
  const p = G.p;
  const hum = humanity(p);
  const tier = TIERS.find(t => hum >= t.min);

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
  if (kit !== hudCache) {
    $('kit').textContent = kit;
    hudCache = kit;
  }

  $('vital-gun').classList.toggle('on', p.gun);
  $('gun-warn').classList.toggle('on', p.gun && !canGrip(p));
  if (p.gun) {
    const gunLine = p.ammo + (p.silencer ? ' canned' : ' bare');
    if (gunLine !== gunCache) {
      gunCache = gunLine;
      $('ammo').innerHTML = Array.from({ length: CFG.AMMO_MAX },
        (v, i) => `<i${i < p.ammo ? ' class="live"' : ''}></i>`).join('');
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

  const boss = !!(G.boss && G.boss.alive);
  $('hud').classList.toggle('boss', boss);
  const alarm = $('alarm');
  alarm.classList.toggle('on', G.hot > 0);
  $('alarm-tick').style.transform = `scaleX(${G.hot / CFG.HOT_TIME})`;

  const stood = G.pickups.find(u => !u.taken && (u.limb || GEAR[u.gear].hold)
    && p.near(u, 11, 14));
  const prompt = $('prompt');
  let say = '';
  if (stood && stood.limb) {
    const L = LIMBS[stood.limb];
    const slots = L.kind === 'leg' ? p.legs : p.arms;
    const where = slots.indexOf(null) >= 0
      ? 'fits the empty socket'
      : `[Q] replace ${p.side ? 'right' : 'left'} · the old one drops`;
    say = `hold <b>E</b> — ${L.name} <i>${L.hum > 0 ? '+' : ''}${L.hum}</i> · ${where}`;
  } else if (stood) {
    say = `hold <b>E</b> — ${GEAR[stood.gear].name}`;
  } else if (p.building > 0) {
    say = `building the can — <b>${Math.round(p.building / FEEL.CAN_TIME * 100)}%</b>`;
  } else if (tutorial.current >= 0) {
    const t = TUTORIAL[tutorial.current];
    say = t.text;
    if (tutorial.done[tutorial.current]) say = `<i>${t.text}</i>`;
  }
  prompt.classList.toggle('on', say !== '');
  if (say !== promptCache) {
    promptCache = say;
    prompt.innerHTML = say;
  }

  const lines = G.log
    .map(l => `<div class="log-line" style="opacity:${clamp01(l.life / 60)}">${l.text}</div>`)
    .join('');
  if (lines !== logCache) {
    logCache = lines;
    $('log').innerHTML = lines;
  }

  const bossBar = $('bossbar');
  if (G.boss && G.boss.alive) {
    bossBar.classList.add('on');
    $('boss-fill').style.transform = `scaleX(${Math.max(0, G.boss.hp / G.boss.hpMax)})`;
    $('boss-name').textContent = `the king · phase ${G.phase}`;
  } else {
    bossBar.classList.remove('on');
  }

  $('ghost-tally').textContent = G.ghosted.length ? `unseen ×${G.ghosted.length}` : '';
}

// TODO card runs on a timer. any key cuts it to 30 frames but it never waits for you
function showZoneCard() {
  const card = $('transition');
  if (G.card <= 0) { card.classList.remove('on'); return; }
  const z = ZONES[G.zone];
  if (!card.classList.contains('on')) {
    $('tnum').textContent = (G.zone + 1) + ' / ' + ZONES.length;
    $('tname').textContent = z.name;
    $('trule').textContent = z.rule;
    card.classList.add('on');
  }
  card.style.opacity = clamp01(G.card / 40);
}

function showOpening() {
  ctx.drawImage(SPR.sky, 0, 0);
  ctx.fillStyle = 'rgba(13,10,22,0.42)';
  ctx.fillRect(0, 0, CFG.VIEW_W, CFG.VIEW_H);

  const card = $('intro-card');
  if (card.dataset.line !== String(G.intro)) {
    card.dataset.line = String(G.intro);
    card.textContent = OPENING[G.intro];
  }
  card.classList.toggle('show', G.introT > 14 && G.introT < 186);
  $('intro').classList.add('on');
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!G.running) return;

  if (G.intro < OPENING.length) {
    G.introT++;
    if (G.introT > 210) { G.intro++; G.introT = 0; }
    showOpening();
    return;
  }
  $('intro').classList.remove('on');
  $('hud').classList.add('on');

  const dt = Math.min(0.1, (now - lastT) / 1000 || 0);
  lastT = now;
  acc += dt;
  let n = 0;
  while (acc >= CFG.FIXED_STEP && n < CFG.MAX_STEPS) {
    if (G.paused) { acc = 0; break; }
    if (G.freeze > 0) G.freeze--;
    else stepWorld();
    acc -= CFG.FIXED_STEP;
    n++;
  }
  Renderer.renderScene();
  refreshHud();
  showZoneCard();
  $('pause').classList.toggle('on', G.paused);
}

function startRun(fromCheckpoint) {
  const cp = fromCheckpoint ? G.checkpoint : null;
  if (!cp) G.checkpoint = null;
  G.p = new Player();
  G.t = 0;
  gunCache = '';
  promptCache = '';
  logCache = '';
  G.kills = 0;
  G.quietKills = 0;
  G.fitted = 0;
  G.log = [];
  G.ghosted = [];
  G.intro = 0;
  if (cp) G.intro = OPENING.length;
  G.introT = 0;
  G.paused = false;
  G.shake = 0;
  G.freeze = 0;
  G.flash = 0;
  G.fade = 1;
  tutorial.done = TUTORIAL.map(() => false);
  tutorial.shown = TUTORIAL.map(() => 0);
  tutorial.current = -1;
  tutorial.hold = 0;

  loadZone(cp ? cp.zone : 0);
  if (cp) {
    G.p.legs = cp.legs.slice();
    G.p.arms = cp.arms.slice();
    G.p.hp = cp.hp;
    G.kills = cp.kills;
    G.quietKills = cp.quietKills;
    G.fitted = cp.fitted;
    G.ghosted = cp.ghosted.slice();
    G.p.gun = cp.gun;
    G.p.ammo = cp.ammo;
    G.p.silencer = cp.silencer;
    G.p.parts = cp.parts.slice();
    G.t = cp.secs;
    logLine('back at the top of ' + ZONES[cp.zone].name.toLowerCase() + '.');
  }

  G.motes = Array.from({ length: 34 }, () => ({
    x: Math.random() * CFG.VIEW_W,
    y: Math.random() * CFG.VIEW_H,
    vx: -0.05 - Math.random() * 0.08,
    vy: -0.05 - Math.random() * 0.10,
  }));

  $('intro').classList.remove('on');
  $('menu').classList.remove('on');
  $('gameover').classList.remove('on');
  G.running = true;
  lastT = performance.now();
  acc = 0;
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

function rankFor(hum) {
  if (hum >= 85) return 'Still yourself';
  if (hum >= 60) return 'Mostly you';
  if (hum >= 35) return 'Something in between';
  return 'Not a person any more';
}

function retryHint(won, hum, mark) {
  const p = G.p;
  if (!won && G.quietKills === 0 && G.kills > 0) return 'You fought them from the front every time. Get behind them.';
  if (!won && !p.fernFrames) return 'You never used the ferns. They cannot see you in there.';
  if (!won) return 'Closer than last time counts for something.';
  if (!G.ghosted.length) return 'You were seen in every zone. Try slipping one of them entirely.';
  if (G.fitted < 3) return `There are limbs out there. You fitted ${G.fitted}.`;
  if (hum < 40) return 'Now try getting out with more of yourself left.';
  if (mark.faster && mark.prev) return `${mark.prev.secs - mark.secs} seconds off your own record. Again.`;
  if (mark.prev) return `Your quickest way out is still ${mark.prev.secs} seconds. Beat that.`;
  return 'Now do it faster.';
}

function endRun(won) {
  G.running = false;
  Sound.bossOff();
  const hum = humanity(G.p);
  const secs = Math.round(G.t);
  const best = readBest();
  const prev = best && best.won ? best : null;
  const better = won && (!prev || hum > prev.hum);
  const faster = won && (!prev || secs < prev.secs);
  if (won) {
    const mark = { won: true, hum: better ? Math.round(hum) : prev.hum, secs: faster ? secs : prev.secs };
    try {
      localStorage.setItem('quarry.best', JSON.stringify(mark));
    } catch (e) { /* private mode */ }
  }

  $('hud').classList.remove('on');
  const tier = TIERS.find(t => hum >= t.min);
  const title = $('go-title');
  if (won) title.textContent = rankFor(hum);
  else title.textContent = 'Caught';
  title.className = 'go-title ' + tier.cls;
  $('go-sub').textContent = won
    ? (hum > 75 ? 'You walked out of the trees looking like yourself.'
      : hum >= 40 ? 'Whatever walked out was mostly you.'
      : 'Something got out. It used to have your name.')
    : 'They drag you back, and they take the parts that were theirs.';

  Renderer.paintPortrait($('go-portrait'));

  const nm = id => (id ? LIMBS[id].name : 'nothing');
  $('go-kit').innerHTML =
    `<b>${nm(G.p.legs[0])}</b> · <b>${nm(G.p.legs[1])}</b><br>` +
    `<b>${nm(G.p.arms[0])}</b> · <b>${nm(G.p.arms[1])}</b>`;

  $('hum-big').textContent = Math.round(hum);
  $('hum-tier').textContent = tier.line;
  $('hum-needle').parentElement.parentElement.className = 'scale ' + tier.cls;
  $('hum-needle').style.left = clamp(hum, 1, 99) + '%';

  const rows = [];
  rows.push(['Ended', won ? 'past the fence' : `in ${ZONES[G.zone].name}, ${Math.round((G.p.x / EXIT_X) * 100)}% of the way`]);
  rows.push(['Limbs fitted', String(G.fitted)]);
  rows.push(['Left unseen', G.ghosted.length ? `${G.ghosted.length} of ${ZONES.length} zones` : 'seen in every zone']);
  rows.push(['Killed', G.kills ? G.kills + (G.quietKills ? ` — ${G.quietKills} from behind` : '') : 'nobody']);
  if (G.p.gun) {
    rows.push(['Rounds spent',
      G.p.fired + (G.p.silencer ? ' through a can' : ', all of them heard')]);
  }
  rows.push(['Took', secs + ' seconds' + (faster && prev ? ' — quickest yet' : '')]);
  if (better) {
    rows.push(['Best escape', Math.round(hum) + ' — your best yet']);
  } else if (prev) {
    rows.push(['Best escape', prev.hum + ' — still your record']);
  }

  $('go-summary').innerHTML = rows
    .map(([k, v]) => `<dt>${k}</dt><dd${/nobody|every zone/.test(v) ? ' class="quiet"' : ''}>${v}</dd>`)
    .join('');
  $('go-note').textContent = retryHint(won, hum, { prev, secs, faster });

  const resume = $('btn-resume-cp');
  if (!won && G.checkpoint) {
    resume.textContent = 'Back to ' + ZONES[G.checkpoint.zone].name;
    resume.style.display = '';
  } else {
    resume.style.display = 'none';
  }
  $('gameover').classList.add('on');
  Renderer.titleVista();
}

const Input = {
  // TODO keyboard only. no pad, no touch. the whole thing is keys[] so a pad is not hard
  init() {
    window.addEventListener('keydown', e => this.onKey(e, true));
    window.addEventListener('keyup', e => this.onKey(e, false));
  },

  onKey(e, down) {
    const k = e.key.toLowerCase();
    if (k === ' ' || k.startsWith('arrow')) e.preventDefault();
    keys[k] = down;
    if (!down || !G.running) return;
    if (G.intro < OPENING.length) { G.intro++; G.introT = 0; return; }
    if (k === 'escape') G.paused = !G.paused;
    if (k === 'm') {
      Sound.sfx = !Sound.sfx;
      if (!Sound.sfx) Sound.bossOff();
      logLine(Sound.sfx ? 'sound on' : 'sound off');
    }
    if (G.card > 30) G.card = 30;
    if (k === 'q') {
      if (G.p.side) G.p.side = 0;
      else G.p.side = 1;
    }
  },
};

window.addEventListener('DOMContentLoaded', () => {
  Renderer.init();
  BAKE.all();
  Input.init();
  $('btn-start').addEventListener('click', () => { Sound.init(); Sound.resume(); startRun(false); });
  $('btn-retry').addEventListener('click', () => { Sound.resume(); startRun(false); });
  $('btn-resume-cp').addEventListener('click', () => { Sound.resume(); startRun(true); });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) Sound.resume();
  });
  Renderer.titleVista();
  requestAnimationFrame(frame);
});
