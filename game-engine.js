/**
 * Mini Game Engine — desacoplado do DOM/UI do site.
 * Pipeline: Update → Physics → Collision → Render (camadas) + profiling adaptativo.
 */
(function (global) {
  'use strict';

  /* ── Object Pool ── */
  class ObjectPool {
    constructor(factory, resetFn, size = 20) {
      this._factory = factory;
      this._reset = resetFn;
      this.pool = new Array(size);
      this.active = [];
      for (let i = 0; i < size; i++) this.pool[i] = factory();
      this._free = size;
    }

    get() {
      let obj;
      if (this._free > 0) {
        obj = this.pool[--this._free];
      } else {
        obj = this._factory();
      }
      this.active.push(obj);
      return obj;
    }

    release(obj) {
      const n = this.active.length;
      for (let i = 0; i < n; i++) {
        if (this.active[i] === obj) {
          this.active[i] = this.active[n - 1];
          this.active.pop();
          this._reset(obj);
          this.pool[this._free++] = obj;
          return;
        }
      }
    }

    releaseAll() {
      while (this.active.length) this.release(this.active[0]);
    }
  }

  /* ── Spatial Hash (colisão local) ── */
  class SpatialHash {
    constructor(cellSize) {
      this.cell = cellSize;
      this.cells = new Map();
      this._seen = new Set();
    }

    clear() {
      this.cells.clear();
    }

    _key(cx, cy) {
      return `${cx},${cy}`;
    }

    insert(id, x, y, hw, hh) {
      const cs = this.cell;
      const x0 = Math.floor((x - hw) / cs);
      const x1 = Math.floor((x + hw) / cs);
      const y0 = Math.floor((y - hh) / cs);
      const y1 = Math.floor((y + hh) / cs);
      for (let gx = x0; gx <= x1; gx++) {
        for (let gy = y0; gy <= y1; gy++) {
          const k = this._key(gx, gy);
          let bucket = this.cells.get(k);
          if (!bucket) {
            bucket = [];
            this.cells.set(k, bucket);
          }
          bucket.push(id);
        }
      }
    }

    query(x, y, hw, hh, out) {
      out.length = 0;
      const cs = this.cell;
      const x0 = Math.floor((x - hw) / cs);
      const x1 = Math.floor((x + hw) / cs);
      const y0 = Math.floor((y - hh) / cs);
      const y1 = Math.floor((y + hh) / cs);
      const seen = this._seen;
      seen.clear();
      for (let gx = x0; gx <= x1; gx++) {
        for (let gy = y0; gy <= y1; gy++) {
          const bucket = this.cells.get(this._key(gx, gy));
          if (!bucket) continue;
          for (let i = 0; i < bucket.length; i++) {
            const id = bucket[i];
            if (!seen.has(id)) {
              seen.add(id);
              out.push(id);
            }
          }
        }
      }
    }
  }

  /* ── Sprite cache pré-escalado + glow ── */
  class SpriteCache {
    constructor() {
      this.cherry = null;
      this.chocolate = null;
      this.glow = null;
    }

    build(sourceCherry, sourceChocolate, spriteH, dpr, withGlow) {
      this.cherry = this._bake(sourceCherry, spriteH, dpr);
      this.chocolate = [];
      const scales = [0.88, 1.0, 1.08];
      for (let i = 0; i < scales.length; i++) {
        this.chocolate[i] = this._bake(sourceChocolate, spriteH * scales[i], dpr);
      }
      if (withGlow) {
        const g = this.cherry;
        const gc = document.createElement('canvas');
        gc.width = g.width;
        gc.height = g.height;
        const gx = gc.getContext('2d');
        gx.drawImage(g, 0, 0);
        gx.globalCompositeOperation = 'source-atop';
        const rad = Math.max(g.width, g.height) * 0.55;
        const grd = gx.createRadialGradient(g.width / 2, g.height / 2, rad * 0.1, g.width / 2, g.height / 2, rad);
        grd.addColorStop(0, 'rgba(255, 79, 163, 0.35)');
        grd.addColorStop(1, 'rgba(255, 79, 163, 0)');
        gx.fillStyle = grd;
        gx.fillRect(0, 0, gc.width, gc.height);
        this.glow = gc;
      } else {
        this.glow = null;
      }
    }

    _bake(img, targetH, dpr) {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const aspect = w / h;
      const tw = Math.round(targetH * aspect * dpr);
      const th = Math.round(targetH * dpr);
      const c = document.createElement('canvas');
      c.width = tw;
      c.height = th;
      const cx = c.getContext('2d');
      cx.imageSmoothingEnabled = false;
      cx.drawImage(img, 0, 0, tw, th);
      c._logicalW = targetH * aspect;
      c._logicalH = targetH;
      return c;
    }

    pickChocolate(size, spriteH) {
      const ratio = size / spriteH;
      if (ratio < 0.94) return this.chocolate[0];
      if (ratio > 1.04) return this.chocolate[2];
      return this.chocolate[1];
    }
  }

  /* ── Adaptive Quality ── */
  class AdaptiveQuality {
    constructor(base) {
      this.base = base;
      this.level = 0;
      this.avgFps = 60;
      this._samples = 0;
      this._acc = 0;
      this.particles = 1;
      this.glow = 1;
      this.heartRain = 1;
      this.spawnMul = 1;
      this.bgStars = 1;
    }

    tick(dt) {
      if (dt <= 0) return;
      const fps = 1000 / dt;
      this._acc += fps;
      this._samples++;
      if (this._samples >= 30) {
        this.avgFps = this._acc / this._samples;
        this._acc = 0;
        this._samples = 0;
        this._adjust();
      }
    }

    _adjust() {
      const f = this.avgFps;
      if (f < 48 && this.level < 4) {
        this.level++;
      } else if (f > 55 && this.level > 0) {
        this.level--;
      }
      this.particles = Math.max(0.25, 1 - this.level * 0.2);
      this.glow = this.level >= 2 ? 0 : 1;
      this.heartRain = this.level >= 3 ? 0 : 1;
      this.spawnMul = Math.max(0.7, 1 - this.level * 0.08);
      this.bgStars = this.level >= 1 ? 0.5 : 1;
    }

    reset() {
      this.level = 0;
      this.avgFps = 60;
      this._samples = 0;
      this._acc = 0;
      this.particles = 1;
      this.glow = 1;
      this.heartRain = 1;
      this.spawnMul = 1;
      this.bgStars = 1;
    }
  }

  /* ── Layer canvases ── */
  class LayerStack {
    constructor(container, ids) {
      this.container = container;
      this.bg = document.getElementById(ids.bg);
      this.game = document.getElementById(ids.game);
      this.fx = document.getElementById(ids.fx);
      this.bgCtx = this.bg.getContext('2d', { alpha: true });
      this.gameCtx = this.game.getContext('2d', { alpha: true });
      this.fxCtx = this.fx.getContext('2d', { alpha: true });
      this.W = 0;
      this.H = 0;
      this.dpr = 1;
    }

    resize(w, h, dpr) {
      this.W = w;
      this.H = h;
      this.dpr = dpr;
      const layers = [this.bg, this.game, this.fx];
      for (let i = 0; i < layers.length; i++) {
        const c = layers[i];
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        c.style.width = '100%';
        c.style.height = 'auto';
        const ctx = c.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.imageSmoothingEnabled = false;
      }
    }
  }

  /* ── Factories para pools ── */
  function chocolateFactory() {
    return {
      x: 0, y: 0, speed: 0, rot: 0, rotSpeed: 0, size: 0,
      wobble: 0, alpha: 1, collecting: false, collectStart: 0,
      active: false, visible: false, poolId: -1,
    };
  }

  function resetChocolate(c) {
    c.x = 0; c.y = 0; c.speed = 0; c.rot = 0; c.rotSpeed = 0;
    c.size = 0; c.wobble = 0; c.alpha = 1; c.collecting = false;
    c.collectStart = 0; c.active = false; c.visible = false;
  }

  function particleFactory() {
    return { x: 0, y: 0, vx: 0, vy: 0, life: 0, size: 0, color: '#FF4FA3', active: false };
  }

  function resetParticle(p) {
    p.x = 0; p.y = 0; p.vx = 0; p.vy = 0; p.life = 0; p.size = 0; p.active = false;
  }

  function effectFactory() {
    return { x: 0, y: 0, life: 0, scale: 0.55, active: false };
  }

  function resetEffect(e) {
    e.x = 0; e.y = 0; e.life = 0; e.scale = 0.55; e.active = false;
  }

  function heartRainFactory() {
    return { x: 0, y: 0, speed: 0, size: 0, opacity: 0, wobble: 0, active: false };
  }

  function resetHeartRain(h) {
    h.x = 0; h.y = 0; h.speed = 0; h.size = 0; h.opacity = 0; h.wobble = 0; h.active = false;
  }

  function loveWordFactory() {
    return {
      kind: 'word',
      x: 0, y: 0, speed: 0, wobble: 0, alpha: 1,
      text: '', display: '', popupText: '',
      reward: null, rewardLabel: '',
      pauseMs: 0, fx: null, sound: null, isSpecial: false, noBlock: false,
      fontSize: 14, hitW: 40, hitH: 22,
      collecting: false, collectStart: 0,
      active: false, visible: false,
    };
  }

  function resetLoveWord(w) {
    w.kind = 'word';
    w.x = 0; w.y = 0; w.speed = 0; w.wobble = 0; w.alpha = 1;
    w.text = ''; w.display = ''; w.popupText = '';
    w.reward = null; w.rewardLabel = '';
    w.pauseMs = 0; w.fx = null; w.sound = null; w.isSpecial = false; w.noBlock = false;
    w.fontSize = 14; w.hitW = 40; w.hitH = 22;
    w.collecting = false; w.collectStart = 0;
    w.active = false; w.visible = false;
  }

  /* ── Game Engine ── */
  class MiniGameEngine {
    constructor(options) {
      this.perf = options.perf;
      this.perfLite = options.perfLite;
      this.mobileEase = options.perf?.mobileEase || null;
      this.cherryBottomNorm = options.cherryBottomNorm;
      this.spriteNorm = options.spriteNorm;
      this.isCoarsePointer = options.isCoarsePointer;

      this.layers = new LayerStack(options.container, options.canvasIds);
      this.sprites = new SpriteCache();
      this.quality = new AdaptiveQuality(this.perf);
      this.spatial = new SpatialHash(64);

      this.chocoPool = new ObjectPool(chocolateFactory, resetChocolate, 12);
      this.loveWordPool = new ObjectPool(loveWordFactory, resetLoveWord, 4);
      this.particlePool = new ObjectPool(particleFactory, resetParticle, 24);
      this.effectPool = new ObjectPool(effectFactory, resetEffect, 10);
      this.heartPool = new ObjectPool(heartRainFactory, resetHeartRain, 10);

      this.cherry = { x: 0, y: 0, speed: 0 };
      this.mouseX = 0;
      this.keys = {};
      this.SPRITE_H = 85;
      this.glowPower = 0;
      this.missShield = false;
      this.fallSpeedMul = 1;
      this.heartRainActive = false;
      this.cosmetics = {
        cherryFilter: 'none',
        theme: null,
        catchColors: ['#FF4FA3', '#D81B60', '#FF80AB'],
      };
      this.camZoom = 1;
      this.camZoomTarget = 1;

      this.bgStatic = null;
      this.bgStars = [];
      this.bgGlows = [];

      this.running = false;
      this.animId = 0;
      this.lastTime = 0;
      this.lastSpawn = 0;
      this.lastLoveSpawn = 0;
      this.loveSpawnInterval = this.perfLite ? 14000 : 11000;
      this.spawnGraceUntil = 0;
      this.spritesReady = false;

      this.dirty = { bg: true, game: true, fx: true };
      this.lastBgTick = 0;
      this.lastFxTick = 0;
      this.BG_INTERVAL = 100;
      this.FX_INTERVAL = 1000 / 60;

      this.profiling = options.profiling || false;
      this.profile = { update: 0, physics: 0, collision: 0, render: 0, ui: 0 };

      this._queryBuf = [];
      this._blocked = false;
      this._score = 0;
      this.onCatch = null;
      this.onCatchLoveWord = null;
      this.onMiss = null;
      this.onActiveTick = null;
      this.loveWordProvider = null;
    }

    get W() { return this.layers.W; }
    get H() { return this.layers.H; }

    initLayout() {
      const H = this.layers.H;
      const W = this.layers.W;
      this.SPRITE_H = H * (this.spriteNorm / 400);
      this.cherry.x = W / 2;
      this.cherry.y = H - H * (this.cherryBottomNorm / 400);
      this.cherry.speed = W * (6.5 / 360);
      this.mouseX = W / 2;
      this.spatial.cell = Math.max(48, this.SPRITE_H * 0.8);
    }

    setCosmetics(partial) {
      if (!partial) return;
      if (partial.cherryFilter !== undefined) this.cosmetics.cherryFilter = partial.cherryFilter;
      if (partial.theme !== undefined) this.cosmetics.theme = partial.theme;
      if (partial.catchColors) this.cosmetics.catchColors = partial.catchColors.slice();
      this.buildBackground();
      this.markAllDirty();
    }

    _catchColors() {
      return this.cosmetics.catchColors || ['#FF4FA3', '#D81B60', '#FF80AB'];
    }

    buildBackground() {
      const W = this.layers.W;
      const H = this.layers.H;
      const dpr = this.layers.dpr;
      const theme = this.cosmetics.theme;
      if (!this.bgStatic) this.bgStatic = document.createElement('canvas');
      this.bgStatic.width = Math.round(W * dpr);
      this.bgStatic.height = Math.round(H * dpr);
      const bctx = this.bgStatic.getContext('2d');
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.imageSmoothingEnabled = false;
      bctx.fillStyle = theme?.bg || 'rgba(15, 10, 10, 0.35)';
      bctx.fillRect(0, 0, W, H);
      const glowInner = theme?.glow || 'rgba(108, 59, 255, 0.05)';
      for (let i = 0; i < this.bgGlows.length; i++) {
        const g = this.bgGlows[i];
        const grad = bctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
        grad.addColorStop(0, glowInner);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        bctx.fillStyle = grad;
        bctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
      }
      this.dirty.bg = true;
    }

    setSprites(cherryImg, chocolateImg) {
      this.sprites.build(cherryImg, chocolateImg, this.SPRITE_H, this.layers.dpr, !this.perfLite);
      this.spritesReady = true;
      this.markAllDirty();
    }

    resize(w, h, dpr) {
      const sx = this.layers.W > 0 ? w / this.layers.W : 1;
      const sy = this.layers.H > 0 ? h / this.layers.H : 1;
      this.layers.resize(w, h, dpr);
      if (this.layers.W > 0) {
        this.cherry.x *= sx;
        this.mouseX *= sx;
        const active = this.chocoPool.active;
        for (let i = 0; i < active.length; i++) {
          const c = active[i];
          c.x *= sx;
          c.y *= sy;
          c.size *= sy;
        }
        const words = this.loveWordPool.active;
        for (let i = 0; i < words.length; i++) {
          words[i].x *= sx;
          words[i].y *= sy;
          words[i].fontSize *= sy;
          words[i].hitW *= sx;
          words[i].hitH *= sy;
        }
        for (let i = 0; i < this.bgStars.length; i++) {
          this.bgStars[i].x *= sx;
          this.bgStars[i].y *= sy;
        }
        for (let i = 0; i < this.bgGlows.length; i++) {
          this.bgGlows[i].x *= sx;
          this.bgGlows[i].y *= sy;
          this.bgGlows[i].r *= Math.min(sx, sy);
        }
      }
      this.initLayout();
      this.buildBackground();
      if (this.spritesReady) {
        this.sprites.build(
          this._srcCherry,
          this._srcChocolate,
          this.SPRITE_H,
          this.layers.dpr,
          !this.perfLite && this.quality.glow > 0
        );
      }
      this.markAllDirty();
    }

    setSourceSprites(cherry, chocolate) {
      this._srcCherry = cherry;
      this._srcChocolate = chocolate;
    }

    markAllDirty() {
      this.dirty.bg = true;
      this.dirty.game = true;
      this.dirty.fx = true;
    }

    setBlocked(v) {
      this._blocked = v;
    }

    clearEntities() {
      this.chocoPool.releaseAll();
      this.loveWordPool.releaseAll();
      this.particlePool.releaseAll();
      this.effectPool.releaseAll();
      this.heartPool.releaseAll();
      this.markAllDirty();
    }

    spawnChocolate() {
      const max = this.perf.maxChocolates;
      if (this.chocoPool.active.length >= max) return;
      const c = this.chocoPool.get();
      const df = this._effectiveDiff(this._score);
      c.active = true;
      c.visible = true;
      c.x = 28 + Math.random() * (this.layers.W - 56);
      c.y = -50;
      c.speed = (1.4 + Math.random() * 3.2) * df * (this.mobileEase?.fallMul ?? 1);
      c.rot = Math.random() * Math.PI * 2;
      c.rotSpeed = (0.012 + Math.random() * 0.028) * Math.min(df, 1.35);
      c.size = this.SPRITE_H * (0.88 + Math.random() * 0.18);
      c.wobble = Math.random() * Math.PI * 2;
      c.alpha = 1;
      c.collecting = false;
      this.dirty.game = true;
    }

    spawnLoveWord(entry) {
      const max = this.perf.maxLoveWords || 1;
      if (this.loveWordPool.active.length >= max || !entry) return;
      const w = this.loveWordPool.get();
      const W = this.layers.W;
      w.active = true;
      w.visible = true;
      w.kind = entry.kind || 'word';
      w.text = entry.text || '';
      w.display = entry.display || entry.text || '❤️';
      w.popupText = entry.popupText || w.display;
      w.reward = entry.reward || { type: 'points', value: 50 };
      w.rewardLabel = entry.rewardLabel || '';
      w.pauseMs = entry.pauseMs || 0;
      w.fx = entry.fx || null;
      w.sound = entry.sound || null;
      w.isSpecial = !!entry.isSpecial;
      w.noBlock = !!entry.noBlock;
      w.x = 40 + Math.random() * (W - 80);
      w.y = -40;
      w.speed = (0.75 + Math.random() * 0.55) * (this.mobileEase?.fallMul ?? 1);
      w.wobble = Math.random() * Math.PI * 2;
      w.alpha = 1;
      w.collecting = false;
      w.fontSize = w.kind === 'word'
        ? Math.max(11, Math.min(15, W * 0.034))
        : Math.max(18, Math.min(28, W * 0.058));
      w.hitW = w.kind === 'word'
        ? Math.min(W * 0.42, Math.max(56, w.display.length * w.fontSize * 0.38))
        : w.fontSize * 1.35;
      w.hitH = w.fontSize * 1.45;
      this.dirty.game = true;
    }

    _trySpawnLoveWord(time) {
      if (!this.loveWordProvider || time < this.spawnGraceUntil) return;
      if (time - this.lastLoveSpawn < this.loveSpawnInterval) return;
      const entry = this.loveWordProvider(time);
      if (entry) {
        this.spawnLoveWord(entry);
        this.lastLoveSpawn = time;
      }
    }

    spawnLoveCatchEffects(x, y) {
      this.glowPower = 0.85;
      this.dirty.fx = true;
      const maxPt = Math.floor(this.perf.maxParticles * this.quality.particles);
      const dots = Math.max(4, Math.floor((this.perf.catchDots + 2) * this.quality.particles));

      while (this.particlePool.active.length >= maxPt - dots) {
        this.particlePool.release(this.particlePool.active[0]);
      }
      const colors = this._catchColors().slice(0, 4);
      for (let i = 0; i < dots; i++) {
        const angle = (Math.PI * 2 * i) / dots + Math.random() * 0.4;
        const speed = 1.2 + Math.random() * 2.4;
        const p = this.particlePool.get();
        p.active = true;
        p.x = x; p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - 0.5;
        p.life = 1;
        p.color = colors[i % colors.length];
        p.size = 2.5 + Math.random() * 2.5;
      }
    }

    spawnCatchEffects(x, y) {
      this.glowPower = 0.75;
      this.dirty.fx = true;
      const maxFx = Math.floor(this.perf.maxEffects * this.quality.particles);
      const maxPt = Math.floor(this.perf.maxParticles * this.quality.particles);
      const dots = Math.max(1, Math.floor(this.perf.catchDots * this.quality.particles));

      while (this.effectPool.active.length >= maxFx) {
        this.effectPool.release(this.effectPool.active[0]);
      }
      const e = this.effectPool.get();
      e.active = true;
      e.x = x; e.y = y; e.life = 1; e.scale = 0.55;

      while (this.particlePool.active.length >= maxPt - dots) {
        this.particlePool.release(this.particlePool.active[0]);
      }
      const colors = this._catchColors();
      for (let i = 0; i < dots; i++) {
        const angle = (Math.PI * 2 * i) / dots + Math.random() * 0.35;
        const speed = 1.4 + Math.random() * 2.2;
        const p = this.particlePool.get();
        p.active = true;
        p.x = x; p.y = y;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 1;
        p.color = colors[i % 3];
        p.size = 2 + Math.random() * 2.2;
      }
    }

    spawnHeartRain(initial) {
      if (this.quality.heartRain <= 0) return;
      const max = this.perf.maxHeartRain;
      if (this.heartPool.active.length >= max) return;
      const h = this.heartPool.get();
      h.active = true;
      h.x = Math.random() * this.layers.W;
      h.y = initial ? Math.random() * this.layers.H : -16;
      h.speed = 0.5 + Math.random() * 1.4;
      h.size = 9 + Math.random() * 9;
      h.opacity = 0.25 + Math.random() * 0.45;
      h.wobble = Math.random() * Math.PI * 2;
      this.dirty.fx = true;
    }

    /* ── UPDATE ── */
    update(time, dt) {
      const t0 = this.profiling ? performance.now() : 0;

      if (Math.abs(this.camZoomTarget - this.camZoom) > 0.001) {
        this.camZoom += (this.camZoomTarget - this.camZoom) * 0.06;
        this.dirty.game = true;
      } else {
        this.camZoom = this.camZoomTarget;
      }

      this.quality.tick(dt);

      const t1 = this.profiling ? performance.now() : 0;
      this.physics(time, dt);
      const t2 = this.profiling ? performance.now() : 0;
      this.collision(time);
      const t3 = this.profiling ? performance.now() : 0;

      if (time - this.lastFxTick >= this.FX_INTERVAL) {
        this.updateEffects(dt);
        this.lastFxTick = time;
      }

      if (this.profiling) {
        this.profile.update = t1 - t0;
        this.profile.physics = t2 - t1;
        this.profile.collision = t3 - t2;
      }
    }

    physics(time, dt) {
      if (this._blocked || !this.spritesReady) return;

      let moved = false;
      if (this.keys['ArrowLeft'] || this.keys['a']) {
        const nx = Math.max(this.SPRITE_H * 0.35, this.cherry.x - this.cherry.speed);
        if (nx !== this.cherry.x) { this.cherry.x = nx; moved = true; }
      }
      if (this.keys['ArrowRight'] || this.keys['d']) {
        const nx = Math.min(this.layers.W - this.SPRITE_H * 0.35, this.cherry.x + this.cherry.speed);
        if (nx !== this.cherry.x) { this.cherry.x = nx; moved = true; }
      }
      const lerp = this.isCoarsePointer ? 0.17 : 0.09;
      const mx = this.cherry.x + (this.mouseX - this.cherry.x) * lerp;
      if (Math.abs(mx - this.cherry.x) > 0.05) { this.cherry.x = mx; moved = true; }

      if (this.glowPower > 0.01) {
        this.glowPower *= 0.93;
        moved = true;
      }

      const score = this._score;
      const df = this._effectiveDiff(score);
      const easeSpawn = this.mobileEase?.spawnMul ?? 1;
      const baseRate = (score > 75 ? 780 : score > 50 ? 880 : 920) * easeSpawn;
      const spawnRate = baseRate / (this.quality.spawnMul * df);
      if (time >= this.spawnGraceUntil && time - this.lastSpawn > spawnRate) {
        this.spawnChocolate();
        this.lastSpawn = time;
        moved = true;
      }
      this._trySpawnLoveWord(time);

      const active = this.chocoPool.active;
      for (let i = 0; i < active.length; i++) {
        const c = active[i];
        if (!c.active || c.collecting) continue;
        if (c.y > this.layers.H + 60) { c.visible = false; continue; }
        if (c.y < -80) { c.visible = false; continue; }
        c.visible = true;
        c.y += c.speed * this.fallSpeedMul;
        c.rot += c.rotSpeed;
        c.x += Math.sin(c.wobble + time * 0.002) * (this.mobileEase ? 0.18 : 0.28);
        c.wobble += 0.018;
        moved = true;
      }

      const words = this.loveWordPool.active;
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (!w.active || w.collecting) continue;
        if (w.y > this.layers.H + 60) { w.visible = false; continue; }
        if (w.y < -80) { w.visible = false; continue; }
        w.visible = true;
        w.y += w.speed * this.fallSpeedMul;
        w.x += Math.sin(w.wobble + time * 0.0016) * 0.35;
        w.wobble += 0.012;
        moved = true;
      }

      if (moved) this.dirty.game = true;
    }

    collision(time) {
      if (this._blocked || !this.spritesReady) return;

      const hitMul = this.mobileEase?.hitMul ?? 1;
      const hitW = this.SPRITE_H * 0.34 * hitMul;
      const cx = this.cherry.x;
      const cy = this.cherry.y;
      this.spatial.clear();
      const active = this.chocoPool.active;
      for (let i = 0; i < active.length; i++) {
        const c = active[i];
        if (!c.active || c.collecting || !c.visible) continue;
        this.spatial.insert(i, c.x, c.y, hitW, hitW);
      }

      this.spatial.query(cx, cy, hitW, hitW, this._queryBuf);
      for (let qi = 0; qi < this._queryBuf.length; qi++) {
        const c = active[this._queryBuf[qi]];
        if (!c || c.collecting || !c.visible) continue;
        const dx = cx - c.x;
        const dy = cy - c.y;
        if (dx < 0 ? -dx : dx < hitW && (dy < 0 ? -dy : dy) < hitW) {
          this.spawnCatchEffects(c.x, c.y);
          c.collecting = true;
          c.collectStart = time;
          this.dirty.game = true;
          this.dirty.fx = true;
          if (this.onCatch) this.onCatch(c);
        }
      }

      for (let i = active.length - 1; i >= 0; i--) {
        const c = active[i];
        if (!c.active) continue;
        if (c.collecting) {
          const elapsed = time - c.collectStart;
          c.alpha = elapsed >= 200 ? 0 : 1 - elapsed / 200;
          if (elapsed >= 200) {
            this.chocoPool.release(c);
            this.dirty.game = true;
          }
          continue;
        }
        if (c.y > this.layers.H + 60) {
          this.chocoPool.release(c);
          this.dirty.game = true;
          if (this.onMiss) this.onMiss();
        }
      }

      const words = this.loveWordPool.active;
      const cherryHitW = this.SPRITE_H * 0.36;
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (!w.active || w.collecting || !w.visible) continue;
        const dx = cx - w.x;
        const dy = cy - w.y;
        const hw = w.hitW * 0.5;
        const hh = w.hitH * 0.5;
        if ((dx < 0 ? -dx : dx) < hw + cherryHitW * 0.35
            && (dy < 0 ? -dy : dy) < hh + cherryHitW * 0.35) {
          this.spawnLoveCatchEffects(w.x, w.y);
          w.collecting = true;
          w.collectStart = time;
          this.dirty.game = true;
          this.dirty.fx = true;
          if (this.onCatchLoveWord) this.onCatchLoveWord(w);
        }
      }

      for (let i = words.length - 1; i >= 0; i--) {
        const w = words[i];
        if (!w.active) continue;
        if (w.collecting) {
          const elapsed = time - w.collectStart;
          w.alpha = elapsed >= 220 ? 0 : 1 - elapsed / 220;
          if (elapsed >= 220) {
            this.loveWordPool.release(w);
            this.dirty.game = true;
          }
          continue;
        }
        if (w.y > this.layers.H + 60) {
          this.loveWordPool.release(w);
          this.dirty.game = true;
        }
      }
    }

    updateEffects(dt) {
      let fxDirty = false;
      const parts = this.particlePool.active;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        if (!p.active) continue;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.07;
        p.life -= dt * 0.0055;
        if (p.life <= 0) {
          this.particlePool.release(p);
        }
        fxDirty = true;
      }

      const effects = this.effectPool.active;
      for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i];
        if (!e.active) continue;
        e.life -= dt * 0.005;
        e.scale += dt * 0.006;
        if (e.life <= 0) this.effectPool.release(e);
        fxDirty = true;
      }

      if (this.heartRainActive && this.quality.heartRain > 0
          && this.heartPool.active.length < this.perf.maxHeartRain
          && Math.random() < 0.006) {
        this.spawnHeartRain(false);
      }

      const hearts = this.heartPool.active;
      for (let i = hearts.length - 1; i >= 0; i--) {
        const h = hearts[i];
        if (!h.active) continue;
        h.y += h.speed;
        h.wobble += 0.025;
        h.x += Math.sin(h.wobble) * 0.35;
        if (h.y > this.layers.H + 20) this.heartPool.release(h);
        fxDirty = true;
      }

      if (fxDirty) this.dirty.fx = true;
    }

    /* ── RENDER ── */
    render(time) {
      const t0 = this.profiling ? performance.now() : 0;
      const needGame = this.dirty.game || this.dirty.fx || !this.spritesReady;
      const needBg = this.dirty.bg || time - this.lastBgTick >= this.BG_INTERVAL;

      if (needBg) {
        this.renderBackground(time);
        this.lastBgTick = time;
        this.dirty.bg = false;
      }

      if (needGame && this.spritesReady) {
        this.renderGameLayer(time);
        this.dirty.game = false;
      }

      if (this.dirty.fx) {
        this.renderFxLayer();
        this.dirty.fx = false;
      }

      if (this.profiling) this.profile.render = performance.now() - t0;
    }

    renderBackground(time) {
      const ctx = this.layers.bgCtx;
      const W = this.layers.W;
      const H = this.layers.H;
      ctx.clearRect(0, 0, W, H);
      if (this.bgStatic) ctx.drawImage(this.bgStatic, 0, 0, W, H);

      const starStep = this.quality.bgStars < 1 ? 2 : 1;
      const starColor = this.cosmetics.theme?.star || 'rgba(255, 255, 255, 0.22)';
      ctx.fillStyle = starColor;
      for (let i = 0; i < this.bgStars.length; i += starStep) {
        const s = this.bgStars[i];
        const a = 0.12 + Math.sin(time * s.speed + s.phase) * 0.1;
        ctx.globalAlpha = a;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    renderGameLayer(time) {
      const ctx = this.layers.gameCtx;
      const W = this.layers.W;
      const H = this.layers.H;
      ctx.clearRect(0, 0, W, H);

      if (this.camZoom !== 1) {
        ctx.save();
        ctx.translate(W / 2, H / 2);
        ctx.scale(this.camZoom, this.camZoom);
        ctx.translate(-W / 2, -H / 2);
      }

      const active = this.chocoPool.active;
      for (let i = 0; i < active.length; i++) {
        const c = active[i];
        if (!c.active || c.alpha <= 0 || !c.visible) continue;
        this._drawCachedSprite(ctx, this.sprites.pickChocolate(c.size, this.SPRITE_H), c.x, c.y, c.alpha, c.rot);
      }

      const words = this.loveWordPool.active;
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (!w.active || w.alpha <= 0 || !w.visible) continue;
        this._drawLoveWord(ctx, w);
      }

      const floatY = Math.sin(time * 0.0035) * 2.5;
      const showGlow = this.quality.glow > 0 && this.glowPower > 0.12 && this.sprites.glow;
      if (showGlow) {
        ctx.globalAlpha = 0.18 + this.glowPower * 0.28;
        const g = this.sprites.glow;
        ctx.drawImage(g, this.cherry.x - g._logicalW / 2, this.cherry.y - g._logicalH / 2 + floatY - g._logicalH / 2, g._logicalW, g._logicalH);
        ctx.globalAlpha = 1;
      }

      if (this.missShield) {
        const pulse = 0.5 + Math.sin(time * 0.007) * 0.22;
        const r = this.SPRITE_H * 0.5;
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = '#8FD4FF';
        ctx.lineWidth = 2.2;
        ctx.shadowColor = 'rgba(120, 200, 255, 0.75)';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(this.cherry.x, this.cherry.y + floatY, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = `${Math.max(12, this.SPRITE_H * 0.22)}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.92;
        ctx.shadowBlur = 4;
        ctx.fillText('🛡️', this.cherry.x + r * 0.72, this.cherry.y + floatY - r * 0.72);
        ctx.restore();
        this.dirty.game = true;
      }

      this._drawCachedSprite(ctx, this.sprites.cherry, this.cherry.x, this.cherry.y + floatY, 1, 0, this.cosmetics.cherryFilter);

      if (this.camZoom !== 1) ctx.restore();
    }

    renderFxLayer() {
      const ctx = this.layers.fxCtx;
      const W = this.layers.W;
      const H = this.layers.H;
      ctx.clearRect(0, 0, W, H);

      const parts = this.particlePool.active;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if (!p.active) continue;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      const effects = this.effectPool.active;
      for (let i = 0; i < effects.length; i++) {
        const e = effects[i];
        if (!e.active) continue;
        ctx.globalAlpha = e.life * 0.85;
        ctx.strokeStyle = '#FF4FA3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.scale * 18, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (this.heartRainActive && this.quality.heartRain > 0) {
        const hearts = this.heartPool.active;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        for (let i = 0; i < hearts.length; i++) {
          const h = hearts[i];
          if (!h.active) continue;
          ctx.globalAlpha = h.opacity;
          ctx.font = `${h.size}px serif`;
          ctx.fillText('❤️', h.x, h.y);
        }
      }
      ctx.globalAlpha = 1;
    }

    _drawLoveWord(ctx, w) {
      const label = w.display || w.text;
      const fs = w.fontSize;
      ctx.save();
      ctx.globalAlpha = w.alpha;
      ctx.font = `700 ${fs}px "Quicksand", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const padX = 10;
      const padY = 6;
      const metrics = ctx.measureText(label);
      const tw = Math.min(this.layers.W * 0.78, metrics.width + padX * 2);
      const th = fs + padY * 2;
      const rx = w.x - tw / 2;
      const ry = w.y - th / 2;

      ctx.fillStyle = 'rgba(18, 8, 24, 0.82)';
      const premium = w.kind === 'golden' || w.kind === 'ultra' || w.kind === 'crown' || w.kind === 'easter';
      ctx.strokeStyle = premium
        ? 'rgba(255, 213, 106, 0.75)'
        : w.kind === 'couple'
          ? 'rgba(255, 120, 200, 0.65)'
          : 'rgba(255, 79, 163, 0.55)';
      ctx.lineWidth = premium ? 2 : 1.5;
      this._roundRect(ctx, rx, ry, tw, th, th * 0.35);
      ctx.fill();
      ctx.stroke();

      ctx.shadowColor = premium ? 'rgba(255, 213, 106, 0.55)' : 'rgba(255, 79, 163, 0.65)';
      ctx.shadowBlur = w.kind === 'ultra' || w.kind === 'easter' ? 14 : premium ? 10 : 8;
      ctx.fillStyle = premium ? '#FFE082' : '#FFD4EC';
      ctx.fillText(label, w.x, w.y);
      ctx.restore();
    }

    _roundRect(ctx, x, y, w, h, r) {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr);
      ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath();
    }

    _drawCachedSprite(ctx, baked, cx, cy, alpha, rot, filter) {
      if (!baked) return;
      const w = baked._logicalW;
      const h = baked._logicalH;
      ctx.save();
      ctx.globalAlpha = alpha;
      if (filter && filter !== 'none') ctx.filter = filter;
      if (rot) {
        ctx.translate(cx, cy);
        ctx.rotate(rot);
        ctx.drawImage(baked, -w / 2, -h / 2, w, h);
      } else {
        ctx.drawImage(baked, cx - w / 2, cy - h / 2, w, h);
      }
      ctx.restore();
    }

    frame(time) {
      if (!this.running) return;
      const dt = Math.min(time - this.lastTime, 24);
      this.lastTime = time;
      this.update(time, dt);
      this.render(time);
      if (!this._blocked && this.onActiveTick) this.onActiveTick(dt);
      this.animId = requestAnimationFrame((t) => this.frame(t));
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      this.lastSpawn = this.lastTime;
      this.animId = requestAnimationFrame((t) => this.frame(t));
    }

    forceRestart() {
      cancelAnimationFrame(this.animId);
      this.running = true;
      this.lastTime = performance.now();
      this.lastSpawn = this.lastTime;
      this.markAllDirty();
      this.animId = requestAnimationFrame((t) => this.frame(t));
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.animId);
    }

    setScore(v) { this._score = v; }

    _difficultyFactor(score) {
      return Math.min(1.75, 1 + score * 0.0035);
    }

    _effectiveDiff(score) {
      const df = this._difficultyFactor(score);
      if (!this.mobileEase) return df;
      const scaled = 1 + (df - 1) * this.mobileEase.diffScale;
      return Math.min(this.mobileEase.maxDiff ?? 1.75, scaled);
    }
  }

  global.MiniGameEngine = MiniGameEngine;
  global.GameObjectPool = ObjectPool;
})(typeof window !== 'undefined' ? window : globalThis);
