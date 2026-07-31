/**
 * Cañón Chocolate — visual polish: sprites, laser, explosões, fluxo ✔ → tiro.
 */
(function (global) {
  'use strict';

  class ObjectPool {
    constructor(factory, resetFn, size) {
      this._factory = factory;
      this._reset = resetFn;
      this.pool = new Array(size);
      this.active = [];
      for (let i = 0; i < size; i++) this.pool[i] = factory();
      this._free = size;
    }

    get() {
      let obj;
      if (this._free > 0) obj = this.pool[--this._free];
      else obj = this._factory();
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

  const VARIANTS = {
    normal: { scale: 1, tint: null, sparkle: false },
    small: { scale: 0.72, tint: null, sparkle: false },
    medium: { scale: 1.18, tint: null, sparkle: false },
    golden: { scale: 1, tint: 'rgba(255, 200, 60, 0.38)', sparkle: true },
    frozen: { scale: 0.92, tint: 'rgba(120, 210, 255, 0.42)', sparkle: false },
    rainbow: { scale: 1.05, tint: 'rainbow', sparkle: true },
  };

  const VARIANT_WEIGHTS = [
    ['normal', 46], ['small', 14], ['medium', 14],
    ['golden', 10], ['frozen', 10], ['rainbow', 6],
  ];

  const RESOLVE_MS = global.CannonShotTiming?.RESOLVE_MS ?? 150;

  /**
   * Definição por sprite — único lugar ao trocar foguete/canhao.
   * Espaço local: origem = pivot (centro de rotação).
   * A matriz translate(pivot) → rotate aplica-se a pivot, nose e flame.
   */
  const ROCKET_PALETTES = {
    silver: {
      nose: ['#EEF2F8', '#A8B4C8'],
      body: ['#C2CEDE', '#8496AE', '#5E7088'],
      stroke: '#4A5868',
      window: '#5CE1FF',
      windowStroke: '#2A8899',
      fin: ['#788AA0', '#8FA0B4'],
      engine: '#3D4856',
    },
    chocolate: {
      nose: ['#FFF8E1', '#D7CCC8'],
      body: ['#A1887F', '#6D4C41', '#4E342E'],
      stroke: '#3E2723',
      window: '#FFCC80',
      windowStroke: '#E65100',
      fin: ['#5D4037', '#795548'],
      engine: '#2D1B14',
    },
    cherry: {
      nose: ['#FFD0D0', '#E57373'],
      body: ['#FF8A80', '#E53935', '#B71C1C'],
      stroke: '#8E0000',
      window: '#FFCDD2',
      windowStroke: '#C62828',
      fin: ['#D32F2F', '#EF5350'],
      engine: '#5D1A1A',
    },
    rose: {
      nose: ['#FFE4F0', '#F48FB1'],
      body: ['#FFB6D5', '#F06292', '#C2185B'],
      stroke: '#880E4F',
      window: '#FCE4EC',
      windowStroke: '#AD1457',
      fin: ['#EC407A', '#F48FB1'],
      engine: '#6A1B4A',
    },
    neon: {
      nose: ['#E0FFFF', '#00E5FF'],
      body: ['#4DD0E1', '#0097A7', '#006064'],
      stroke: '#004D40',
      window: '#84FFFF',
      windowStroke: '#00B8D4',
      fin: ['#00ACC1', '#26C6DA'],
      engine: '#00363A',
    },
    sakura: {
      nose: ['#FFF0F5', '#F8BBD0'],
      body: ['#F8BBD0', '#F06292', '#AD1457'],
      stroke: '#880E4F',
      window: '#FFFFFF',
      windowStroke: '#EC407A',
      fin: ['#F48FB1', '#F8BBD0'],
      engine: '#6A1B3A',
    },
    galaxy: {
      nose: ['#E8EAF6', '#9FA8DA'],
      body: ['#7986CB', '#5C6BC0', '#3949AB'],
      stroke: '#283593',
      window: '#B388FF',
      windowStroke: '#651FFF',
      fin: ['#5E35B1', '#7E57C2'],
      engine: '#1A237E',
    },
  };

  /** Nave genérica desenhada em canvas — sem PNG externo. */
  function bakeGenericRocketSprite(targetH, paletteKey) {
    const pal = ROCKET_PALETTES[paletteKey] || ROCKET_PALETTES.silver;
    const aspect = 0.44;
    const w = Math.max(8, Math.ceil(targetH * aspect));
    const h = Math.max(8, Math.ceil(targetH));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const cx = w / 2;

    function fillGrad(y0, y1, colors) {
      const g = ctx.createLinearGradient(0, y0, 0, y1);
      colors.forEach((col, i) => g.addColorStop(i / (colors.length - 1), col));
      return g;
    }

    // Cone (nariz)
    const noseBot = h * 0.21;
    ctx.beginPath();
    ctx.moveTo(cx, h * 0.015);
    ctx.lineTo(cx - w * 0.21, noseBot);
    ctx.lineTo(cx + w * 0.21, noseBot);
    ctx.closePath();
    ctx.fillStyle = fillGrad(0, noseBot, pal.nose);
    ctx.fill();
    ctx.strokeStyle = pal.stroke;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Corpo
    const bodyTop = h * 0.19;
    const bodyBot = h * 0.87;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.22, bodyTop);
    ctx.lineTo(cx - w * 0.27, bodyBot);
    ctx.lineTo(cx + w * 0.27, bodyBot);
    ctx.lineTo(cx + w * 0.22, bodyTop);
    ctx.closePath();
    ctx.fillStyle = fillGrad(bodyTop, bodyBot, pal.body);
    ctx.fill();
    ctx.strokeStyle = pal.stroke;
    ctx.stroke();

    // Faixa decorativa
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(cx - w * 0.06, h * 0.52, w * 0.12, h * 0.055);

    // Janela
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.36, w * 0.085, h * 0.048, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.window;
    ctx.fill();
    ctx.strokeStyle = pal.windowStroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.025, h * 0.345, w * 0.022, h * 0.012, -0.4, 0, Math.PI * 2);
    ctx.fill();

    // Aletas
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + side * w * 0.25, h * 0.7);
      ctx.lineTo(cx + side * w * 0.4, h * 0.97);
      ctx.lineTo(cx + side * w * 0.2, h * 0.86);
      ctx.closePath();
      ctx.fillStyle = pal.fin[i];
      ctx.fill();
      ctx.strokeStyle = pal.stroke;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }

    // Bocal do motor (base = pivô em y=h)
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.91, w * 0.11, h * 0.032, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.engine;
    ctx.fill();
    ctx.strokeStyle = pal.stroke;
    ctx.stroke();

    c._logicalW = w;
    c._logicalH = h;
    c._bakeScale = 1;
    c._opaqueW = w;
    c._opaqueH = h;
    c._procedural = true;
    return c;
  }

  const ROCKET_SPRITE_REGISTRY = {
    ship_chocolate: {
      src: 'assets/cannon-unit.png',
      fallbackSrc: 'assets/cannon-ship.png',
      combinedUnit: true,
      hidePlatform: true,
      hideProceduralFlame: true,
      unitScale: 1.42,
      procedural: 'generic',
      palette: 'chocolate',
      flameBurstMs: 80,
      drawOffset: { x: 0, y: 0 },
      socketUnit: 'height',
      sockets: {
        pivot: { x: 0, y: 0 },
        nose: { x: 0, y: -0.985 },
        flame: { x: 0, y: -0.92 },
      },
    },
    ship_cherry: {
      procedural: 'generic',
      palette: 'cherry',
      flameBurstMs: 80,
      drawOffset: { x: 0, y: 0 },
      socketUnit: 'height',
      sockets: {
        pivot: { x: 0, y: 0 },
        nose: { x: 0, y: -0.985 },
        flame: { x: 0, y: 0.04 },
      },
    },
    ship_rosa: {
      procedural: 'generic',
      palette: 'rose',
      flameBurstMs: 80,
      drawOffset: { x: 0, y: 0 },
      socketUnit: 'height',
      sockets: {
        pivot: { x: 0, y: 0 },
        nose: { x: 0, y: -0.985 },
        flame: { x: 0, y: 0.04 },
      },
    },
    ship_neon: {
      procedural: 'generic',
      palette: 'neon',
      flameBurstMs: 80,
      drawOffset: { x: 0, y: 0 },
      socketUnit: 'height',
      sockets: {
        pivot: { x: 0, y: 0 },
        nose: { x: 0, y: -0.985 },
        flame: { x: 0, y: 0.04 },
      },
    },
    ship_sakura: {
      procedural: 'generic',
      palette: 'sakura',
      flameBurstMs: 80,
      drawOffset: { x: 0, y: 0 },
      socketUnit: 'height',
      sockets: {
        pivot: { x: 0, y: 0 },
        nose: { x: 0, y: -0.985 },
        flame: { x: 0, y: 0.04 },
      },
    },
    ship_galaxy: {
      procedural: 'generic',
      palette: 'galaxy',
      flameBurstMs: 80,
      drawOffset: { x: 0, y: 0 },
      socketUnit: 'height',
      sockets: {
        pivot: { x: 0, y: 0 },
        nose: { x: 0, y: -0.985 },
        flame: { x: 0, y: 0.04 },
      },
    },
  };

  const DEFAULT_ROCKET_ID = 'ship_chocolate';

  /** Base do canhão (carriage) — deck = superfície onde o cano encaixa. */
  const CANNON_BASE_REGISTRY = {
    default: {
      src: 'assets/cannon-base.png',
      fallbackSrc: 'assets/cannon-platform.png',
      widthRatio: 0.82,
      /** null = detecta automaticamente no bake */
      deckY: null,
      /** Sobrepõe cano na base (px) */
      mountOverlap: 10,
    },
  };

  /** Plataforma + canhão — ratios por viewport (desktop / mobile / mobile pequeno). */
  const LAYOUT_PROFILES = {
    desktop: {
      floorRatio: 0.72,
      deckRatio: 0.12,
      shipRatio: 0.26,
      platformWidth: 0.82,
      platformLift: 12,
      cherryScale: 0.065,
    },
    mobile: {
      floorRatio: 0.69,
      deckRatio: 0.12,
      shipRatio: 0.23,
      platformWidth: 0.86,
      platformLift: 10,
      cherryScale: 0.06,
    },
    mobileSm: {
      floorRatio: 0.67,
      deckRatio: 0.12,
      shipRatio: 0.21,
      platformWidth: 0.88,
      platformLift: 8,
      cherryScale: 0.055,
    },
  };

  /** Comprimento do eixo vermelho no teste de transformação (coords locais). */
  const AXIS_TEST_LEN = 220;

  /**
   * rot alinha eixo local −Y com o vetor de mira (cos θ, sin θ) no Canvas (Y↓).
   * −sin(rot)=cos(θ), −cos(rot)=sin(θ) → rot = −θ − π/2.
   */
  function cannonRotFromAim(aimAngle) {
    return -aimAngle - Math.PI / 2;
  }

  /** Modos errados — teclas 1–4 só em transformValidate (comparar). */
  const ROT_TEST_MODES = [
    {
      id: 'canonical',
      label: '−θ − π/2 (correto)',
      fn: (aim) => cannonRotFromAim(aim),
    },
    { id: 'aim', label: 'rot = θ (errado)', fn: (aim) => aim },
    { id: 'neg_aim', label: 'rot = −θ (espelho)', fn: (aim) => -aim },
    { id: 'aim_pi2', label: 'rot = θ+π/2', fn: (aim) => aim + Math.PI / 2 },
    { id: 'neg_aim_pi2', label: 'rot = −θ+π/2', fn: (aim) => -aim + Math.PI / 2 },
  ];

  /** Detecta região opaca real do PNG (ignora margens transparentes). */
  function measureImageOpaqueBounds(img, iw, ih) {
    const c = document.createElement('canvas');
    c.width = iw;
    c.height = ih;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0, iw, ih);
    let minX = iw;
    let minY = ih;
    let maxX = -1;
    let maxY = -1;
    try {
      const data = cx.getImageData(0, 0, iw, ih).data;
      for (let y = 0; y < ih; y++) {
        for (let x = 0; x < iw; x++) {
          if (data[(y * iw + x) * 4 + 3] > 12) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
    } catch (e) {
      console.warn('[Cañón] opaque bounds skipped', e);
      return { minX: 0, minY: 0, maxX: iw - 1, maxY: ih - 1, w: iw, h: ih };
    }
    if (maxX < minX) {
      return { minX: 0, minY: 0, maxX: iw - 1, maxY: ih - 1, w: iw, h: ih };
    }
    return {
      minX, minY, maxX, maxY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
    };
  }

  function cherryFactory() {
    return {
      id: 0, x: 0, y: 0, speed: 0, a: 0, b: 0, answer: 0, label: '',
      r: 18, drawH: 0, variant: 'normal', state: 'idle', resolveUntil: 0,
      resolvedAnswer: 0, sequenceStarted: false, popScale: 1, sparkle: 0, active: false,
      _released: false,
    };
  }

  function resetCherry(c) {
    c.id = 0; c.x = 0; c.y = 0; c.speed = 0;
    c.a = 0; c.b = 0; c.answer = 0; c.label = '';
    c.r = 18; c.drawH = 0; c.variant = 'normal'; c.state = 'idle';
    c.resolveUntil = 0; c.resolvedAnswer = 0; c.sequenceStarted = false;
    c.popScale = 1; c.sparkle = 0; c.active = false;
    c._released = false;
  }

  function shotFactory() {
    return {
      x: 0, y: 0, sx: 0, sy: 0, tx: 0, ty: 0, progress: 0, targetId: 0,
      trail: [], active: false,
    };
  }

  function resetShot(s) {
    s.x = 0; s.y = 0; s.sx = 0; s.sy = 0; s.tx = 0; s.ty = 0;
    s.progress = 0; s.targetId = 0;
    s.trail.length = 0; s.active = false;
  }

  function fxFactory() {
    return {
      x: 0, y: 0, life: 0, maxLife: 500, vx: 0, vy: 0, size: 3,
      color: '#FFD56A', kind: 'spark', rot: 0, active: false,
    };
  }

  function resetFx(p) {
    p.x = 0; p.y = 0; p.life = 0; p.maxLife = 500; p.vx = 0; p.vy = 0;
    p.size = 3; p.color = '#FFD56A'; p.kind = 'spark'; p.rot = 0; p.active = false;
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  function assetUrl(relativePath) {
    try {
      return new URL(relativePath, global.location.href).href;
    } catch (_) {
      return relativePath;
    }
  }

  /** Rebake: remove fundo das bordas, recorta margens transparentes, escala por altura opaca. */
  function bakeCannonSpriteAligned(img, targetH) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return bakeSprite(img, targetH, 1);

    const probe = document.createElement('canvas');
    probe.width = iw;
    probe.height = ih;
    const pctx = probe.getContext('2d');
    pctx.imageSmoothingEnabled = true;
    pctx.imageSmoothingQuality = 'high';
    pctx.drawImage(img, 0, 0, iw, ih);
    stripEdgeBackground(probe);

    const opaque = measureImageOpaqueBounds(probe, iw, ih);
    const scale = targetH / opaque.h;
    const sw = Math.ceil(opaque.w * scale);
    const sh = Math.ceil(opaque.h * scale);

    const c = document.createElement('canvas');
    c.width = Math.max(1, sw);
    c.height = Math.max(1, sh);
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(
      probe,
      opaque.minX, opaque.minY, opaque.w, opaque.h,
      0, 0, sw, sh
    );

    c._logicalW = sw;
    c._logicalH = sh;
    c._bakeScale = scale;
    c._opaqueW = opaque.w;
    c._opaqueH = opaque.h;
    c._procedural = false;
    return c;
  }

  function bakeSprite(img, targetH, dpr) {
    const aspect = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
    const tw = Math.round(targetH * aspect * dpr);
    const th = Math.round(targetH * dpr);
    const c = document.createElement('canvas');
    c.width = tw;
    c.height = th;
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, tw, th);
    c._logicalH = targetH;
    c._logicalW = targetH * aspect;
    return c;
  }

  function isSpriteBackgroundPixel(r, g, b) {
    const isWhite = r > 235 && g > 235 && b > 235;
    const isBlack = r < 40 && g < 40 && b < 40;
    const isChecker = Math.abs(r - g) < 12 && Math.abs(g - b) < 12 && r > 170 && r < 250;
    return isWhite || isBlack || isChecker;
  }

  /** Remove só o fundo conectado às bordas (preserva chocolate escuro interno). */
  function stripEdgeBackground(canvas) {
    try {
      const cx = canvas.getContext('2d', { willReadFrequently: true });
      const w = canvas.width;
      const h = canvas.height;
      const imgData = cx.getImageData(0, 0, w, h);
      const px = imgData.data;
      const visited = new Uint8Array(w * h);
      const stack = [];

      for (let x = 0; x < w; x++) {
        stack.push(x, 0, x, h - 1);
      }
      for (let y = 0; y < h; y++) {
        stack.push(0, y, w - 1, y);
      }

      while (stack.length) {
        const y = stack.pop();
        const x = stack.pop();
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const pi = y * w + x;
        if (visited[pi]) continue;
        const idx = pi * 4;
        if (!isSpriteBackgroundPixel(px[idx], px[idx + 1], px[idx + 2])) continue;
        visited[pi] = 1;
        px[idx + 3] = 0;
        stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
      }

      cx.putImageData(imgData, 0, 0);
    } catch (e) {
      console.warn('[Cañón] edge alpha bake skipped', e);
    }
    return canvas;
  }

  /** Remove fundo preto ou branco sólido de sprites PNG. */
  function stripSolidBackground(canvas) {
    return stripEdgeBackground(canvas);
  }

  /** @deprecated use stripSolidBackground */
  function stripBlackBackground(canvas) {
    return stripSolidBackground(canvas);
  }

  /** Remove fundo preto do PNG da cereja-planeta. */
  function bakeCherrySprite(img, targetH, dpr) {
    return stripBlackBackground(bakeSprite(img, targetH, dpr));
  }

  /** Detecta a fileira “deck” (superfície plana onde o cano encaixa). */
  function measurePlatformDeckRatio(canvas, fallback) {
    try {
      const w = canvas.width;
      const h = canvas.height;
      if (!w || !h) return fallback;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const data = ctx.getImageData(0, 0, w, h).data;
      const minSpan = w * 0.42;
      const maxScanY = Math.floor(h * 0.55);
      let bestY = -1;
      let bestSpan = 0;

      for (let y = 0; y < maxScanY; y++) {
        let xmin = w;
        let xmax = -1;
        for (let x = 0; x < w; x++) {
          const a = data[(y * w + x) * 4 + 3];
          if (a > 24) {
            if (x < xmin) xmin = x;
            if (x > xmax) xmax = x;
          }
        }
        const span = xmax >= xmin ? xmax - xmin + 1 : 0;
        if (span >= minSpan && span >= bestSpan) {
          bestSpan = span;
          bestY = y;
        }
      }

      if (bestY >= 0) {
        return Math.max(0.04, Math.min(0.45, bestY / h));
      }
    } catch (e) {
      console.warn('[Cañón] deck measure skipped', e);
    }
    return fallback;
  }

  /** Base baixa estilo carriagem de canhão (fallback procedural). */
  function bakeProceduralCannonBase(targetW) {
    const w = Math.max(48, Math.ceil(targetW));
    const h = Math.max(14, Math.ceil(w * 0.2));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;

    const cx = w / 2;
    const deckY = h * 0.08;

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, h * 0.92, w * 0.36, h * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();

    const grad = ctx.createLinearGradient(0, deckY, 0, h);
    grad.addColorStop(0, '#6D4C41');
    grad.addColorStop(0.45, '#5D4037');
    grad.addColorStop(1, '#3E2723');

    ctx.beginPath();
    ctx.moveTo(w * 0.1, deckY + h * 0.06);
    ctx.lineTo(w * 0.9, deckY + h * 0.06);
    ctx.lineTo(w * 0.78, h * 0.94);
    ctx.lineTo(w * 0.22, h * 0.94);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 200, 120, 0.25)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 220, 160, 0.18)';
    ctx.fillRect(w * 0.18, deckY + h * 0.1, w * 0.64, h * 0.07);

    ctx.beginPath();
    ctx.ellipse(cx, deckY + h * 0.03, w * 0.11, h * 0.055, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#4E342E';
    ctx.fill();

    c._logicalW = w;
    c._logicalH = h;
    c._deckY = deckY / h;
    c._procedural = true;
    return c;
  }

  function bakeCannonBaseSprite(img, targetW, dpr, baseDef) {
    const def = baseDef || CANNON_BASE_REGISTRY.default;
    const fallbackDeck = def.deckY ?? 0.12;

    if (!img) {
      return bakeProceduralCannonBase(targetW);
    }

    const aspect = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
    const logicalH = targetW / aspect;
    const tw = Math.round(targetW * dpr);
    const th = Math.round(logicalH * dpr);
    const c = document.createElement('canvas');
    c.width = Math.max(1, tw);
    c.height = Math.max(1, th);
    const cx = c.getContext('2d');
    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, tw, th);
    stripEdgeBackground(c);

    c._logicalW = targetW;
    c._logicalH = logicalH;
    c._deckY = def.deckY != null ? def.deckY : measurePlatformDeckRatio(c, fallbackDeck);
    c._procedural = false;
    return c;
  }

  /** @deprecated use bakeCannonBaseSprite */
  function bakePlatformSprite(img, targetW, dpr) {
    return bakeCannonBaseSprite(img, targetW, dpr, CANNON_BASE_REGISTRY.default);
  }

  function cherryVisualH(r) {
    return r * 2.1;
  }

  /** Desenha imagem cobrindo o canvas (object-fit: cover). */
  function drawImageCover(ctx, img, W, H, focusY) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const scale = Math.max(W / iw, H / ih);
    const sw = iw * scale;
    const sh = ih * scale;
    const sx = (W - sw) / 2;
    const sy = (H - sh) * (focusY != null ? focusY : 0.12);
    ctx.drawImage(img, sx, sy, sw, sh);
  }

  class SpaceshipEngine {
    constructor(options) {
      this.container = options.container;
      this.canvas = options.canvas;
      this.ctx = this.canvas.getContext('2d', { alpha: true, desynchronized: true });
      this.bgCanvas = options.bgCanvas || null;
      this.bgCtx = this.bgCanvas
        ? this.bgCanvas.getContext('2d', { alpha: true, desynchronized: true })
        : null;
      this.useHtmlBg = !!options.useHtmlBg;
      this.perfLite = !!options.perfLite;
      this.cannonDebug = !!options.cannonDebug;
      this.transformValidate = !!options.transformValidate;
      this.rotTestMode = 0;

      this.W = 0;
      this.H = 0;
      this.dpr = 1;
      this.bgCache = null;
      this.groundY = 0;

      this.sprites = { ship: null, cherry: null, platform: null, ready: false };
      this.platformTopY = 0;
      this.platformDrawY = 0;
      this.bgImage = null;
      this.cannon = { x: 0, y: 0, w: 0, h: 0, angle: -Math.PI / 2, flashUntil: 0, flameUntil: 0 };
      this.shotSystem = global.CannonShotSystem
        ? new global.CannonShotSystem(this)
        : null;

      this.cherryPool = new ObjectPool(cherryFactory, resetCherry, 16);
      this.shotPool = new ObjectPool(shotFactory, resetShot, 10);
      this.fxPool = new ObjectPool(fxFactory, resetFx, this.perfLite ? 32 : 52);

      this.bgStars = [];
      this.bgDrift = [];

      this._nextId = 1;
      this.score = 0;
      this.hits = 0;
      this.lives = 3;
      this.survivalMs = 0;
      this.difficulty = 0;

      this.lastSpawn = 0;
      this.spawnInterval = this.perfLite ? 2700 : 2200;
      this.baseFall = this.perfLite ? 1.15 : 1.4;
      this.maxCherries = 6;

      this.running = false;
      this._blocked = false;
      this.animId = 0;
      this.lastTime = 0;
      this._tickAcc = 0;
      this._fallCached = 1.4;

      this.cosmetics = { shipId: 'ship_chocolate' };

      this.onMiss = null;
      this.onCorrect = null;
      this.onResolve = null;
      this.onActiveTick = null;
    }

    setCosmetics(partial) {
      const nextId = partial?.shipId;
      if (nextId && nextId !== this.cosmetics.shipId) {
        this.cosmetics.shipId = nextId;
        if (this.sprites.ready || this._loadingSprites) this.loadSprites();
      } else if (nextId) {
        this.cosmetics.shipId = nextId;
      }
    }

    _rocketDef() {
      const id = this.cosmetics?.shipId || DEFAULT_ROCKET_ID;
      return ROCKET_SPRITE_REGISTRY[id] ?? ROCKET_SPRITE_REGISTRY[DEFAULT_ROCKET_ID];
    }

    _usesCombinedUnit() {
      const def = this._rocketDef();
      return !!(def.combinedUnit && this.sprites.ship && this.sprites.ship._combinedUnit);
    }

    async loadSprites() {
      if (this._loadingSprites) return this._loadingSprites;

      this._loadingSprites = (async () => {
        const dpr = this.dpr || 1;
        const profile = this._getLayoutProfile();
        const rocketDef = ROCKET_SPRITE_REGISTRY[this.cosmetics?.shipId || DEFAULT_ROCKET_ID]
          ?? ROCKET_SPRITE_REGISTRY[DEFAULT_ROCKET_ID];
        const cherryPath = assetUrl('assets/cherry-planet.png');
        const baseDef = this._cannonBaseDef();
        const bgPath = assetUrl('assets/cannon-bg.png');

        if (!this.useHtmlBg && !this.bgImage) {
          try {
            this.bgImage = await loadImage(bgPath);
            this._buildBgCache();
          } catch (e) {
            console.warn('[Cañón] bg load failed', e);
          }
        }

        try {
          this.sprites.ship = null;
          const srcList = [rocketDef.src, rocketDef.fallbackSrc].filter(Boolean);
          for (let si = 0; si < srcList.length; si++) {
            try {
              const shipImg = await loadImage(assetUrl(srcList[si]));
              const unitScale = rocketDef.unitScale ?? 1;
              const targetH = (this.cannon.h || 48) * unitScale;
              this.sprites.ship = bakeCannonSpriteAligned(shipImg, targetH);
              this.sprites.ship._combinedUnit = !!(rocketDef.combinedUnit && si === 0);
              console.log(
                '[Cañón] canhão PNG',
                srcList[si],
                `${this.sprites.ship._logicalW}x${this.sprites.ship._logicalH}`,
                this.sprites.ship._combinedUnit ? '(unidade completa)' : ''
              );
              break;
            } catch (pngErr) {
              if (si === srcList.length - 1) {
                console.warn('[Cañón] PNG canhão indisponível, usando procedural', pngErr);
              }
            }
          }
          if (!this.sprites.ship && rocketDef.procedural === 'generic') {
            this.sprites.ship = bakeGenericRocketSprite(
              this.cannon.h || 48,
              rocketDef.palette || 'chocolate'
            );
          } else if (!this.sprites.ship) {
            this.sprites.ship = bakeGenericRocketSprite(this.cannon.h || 48, 'chocolate');
          }
        } catch (e) {
          console.warn('[Cañón] ship load failed', e);
          this.sprites.ship = bakeGenericRocketSprite(this.cannon.h || 48, 'chocolate');
        }

        try {
          const cherryImg = await loadImage(cherryPath);
          this.sprites.cherry = bakeCherrySprite(
            cherryImg,
            this.W * profile.cherryScale * 2.1 || 48,
            dpr
          );
        } catch (e) {
          console.warn('[Cañón] cherry load failed', e);
          this.sprites.cherry = null;
        }

        if (this.sprites.ship?._combinedUnit) {
          this.sprites.platform = null;
        } else {
          try {
            let baseImg = null;
            if (baseDef.src) {
              try {
                baseImg = await loadImage(assetUrl(baseDef.src));
                console.log('[Cañón] base PNG', baseDef.src);
              } catch (baseErr) {
                console.warn('[Cañón] cannon-base indisponível, tentando fallback', baseErr);
              }
            }
            if (!baseImg && baseDef.fallbackSrc) {
              try {
                baseImg = await loadImage(assetUrl(baseDef.fallbackSrc));
                console.log('[Cañón] base fallback', baseDef.fallbackSrc);
              } catch (fallbackErr) {
                console.warn('[Cañón] base fallback indisponível', fallbackErr);
              }
            }
            this.sprites.platform = bakeCannonBaseSprite(
              baseImg,
              this.W * profile.platformWidth || 320,
              dpr,
              baseDef
            );
          } catch (e) {
            console.warn('[Cañón] base load failed', e);
            this.sprites.platform = bakeProceduralCannonBase(this.W * profile.platformWidth || 320);
          }
        }

        this._syncCannonAnchor();
        this.sprites.ready = !!(this.sprites.ship || this.sprites.cherry);
        if (!this.useHtmlBg && this.bgImage) this._buildBgCache();
      })().finally(() => {
        this._loadingSprites = null;
      });

      return this._loadingSprites;
    }

    resize(w, h, dpr) {
      this.W = w;
      this.H = h;
      this.dpr = dpr;
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
      this.canvas.style.width = '100%';
      this.canvas.style.height = 'auto';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.imageSmoothingEnabled = true;

      if (this.bgCanvas && this.bgCtx) {
        this.bgCanvas.width = Math.round(w * dpr);
        this.bgCanvas.height = Math.round(h * dpr);
        this.bgCanvas.style.width = '100%';
        this.bgCanvas.style.height = '100%';
        this.bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.bgCtx.imageSmoothingEnabled = true;
      }

      this.groundY = h * 0.72;
      const profile = this._getLayoutProfile();
      this.cannon.h = h * profile.shipRatio;
      this.cannon.w = this.cannon.h * 0.72;
      this.cannon.x = w / 2;
      this._layoutCannonFloor();
      this.maxCherries = this.perfLite ? 5 : 7;

      this._initBgMotion();
      if (!this.useHtmlBg) this._buildBgCache();
      if (this.sprites.ready || this.sprites.ship || this.sprites.cherry) this.loadSprites();
    }

    _initBgMotion() {
      const W = this.W;
      const H = this.groundY;
      const n = this.perfLite ? 10 : 16;
      this.bgStars = [];
      for (let i = 0; i < n; i++) {
        this.bgStars.push({
          x: ((i * 97) % 100) / 100 * W,
          y: ((i * 53) % 100) / 100 * H,
          r: 0.5 + (i % 2) * 0.35,
          tw: (i * 0.7) % 6.28,
        });
      }
      const dn = this.perfLite ? 4 : 7;
      this.bgDrift = [];
      for (let i = 0; i < dn; i++) {
        this.bgDrift.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.12,
          vy: 0.06 + Math.random() * 0.1,
          r: 1.5 + Math.random() * 1.5,
          a: 0.12 + Math.random() * 0.15,
        });
      }
    }

    _buildBgCache() {
      const W = this.W;
      const H = this.H;
      const dpr = this.dpr;
      if (!this.bgCache) this.bgCache = document.createElement('canvas');
      this.bgCache.width = Math.round(W * dpr);
      this.bgCache.height = Math.round(H * dpr);
      const bctx = this.bgCache.getContext('2d');
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bctx.imageSmoothingEnabled = true;
      bctx.imageSmoothingQuality = 'high';

      if (this.bgImage) {
        drawImageCover(bctx, this.bgImage, W, H, 0.08);
        const fade = bctx.createLinearGradient(0, this.groundY - H * 0.2, 0, H);
        fade.addColorStop(0, 'rgba(12, 6, 24, 0)');
        fade.addColorStop(0.55, 'rgba(12, 6, 24, 0.35)');
        fade.addColorStop(1, 'rgba(12, 6, 24, 0.72)');
        bctx.fillStyle = fade;
        bctx.fillRect(0, 0, W, H);
      } else {
        const grad = bctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0c0618');
        grad.addColorStop(0.45, '#1a0e2e');
        grad.addColorStop(0.82, '#241535');
        grad.addColorStop(1, '#1a1028');
        bctx.fillStyle = grad;
        bctx.fillRect(0, 0, W, H);
      }
    }

    resetSession() {
      this.cherryPool.releaseAll();
      this.shotPool.releaseAll();
      this.fxPool.releaseAll();
      this.score = 0;
      this.hits = 0;
      this.lives = 3;
      this.survivalMs = 0;
      this.difficulty = 0;
      this.lastSpawn = 0;
      this.spawnInterval = this.perfLite ? 2700 : 2200;
      this._nextId = 1;
      this.cannon.angle = -Math.PI / 2;
      this.cannon.flashUntil = 0;
      this.cannon.flameUntil = 0;
      this.shotSystem?.reset();
      this._tickAcc = 0;
    }

    start() {
      if (this.running) return;
      this.running = true;
      this.lastTime = performance.now();
      this.animId = requestAnimationFrame((t) => this.frame(t));
    }

    stop() {
      this.running = false;
      if (this.animId) cancelAnimationFrame(this.animId);
      this.animId = 0;
    }

    setBlocked(blocked) {
      this._blocked = blocked;
    }

    _pickVariant() {
      const roll = Math.random() * 100;
      let acc = 0;
      for (let i = 0; i < VARIANT_WEIGHTS.length; i++) {
        acc += VARIANT_WEIGHTS[i][1];
        if (roll < acc) return VARIANT_WEIGHTS[i][0];
      }
      return 'normal';
    }

    _fallSpeed() {
      return this.baseFall * (1 + this.difficulty * 0.12) * (this.perfLite ? 0.78 : 1);
    }

    _spawnCherry() {
      if (this._countLiveCherries() >= this.maxCherries) return;

      const maxTable = Math.min(9, 4 + this.difficulty);
      const minTable = 2;
      const a = minTable + ((Math.random() * (maxTable - minTable + 1)) | 0);
      const b = minTable + ((Math.random() * (maxTable - minTable + 1)) | 0);

      const variant = this._pickVariant();
      const vDef = VARIANTS[variant];
      const profile = this._getLayoutProfile();
      const c = this.cherryPool.get();
      c.id = this._nextId++;
      c.a = a;
      c.b = b;
      c.answer = a * b;
      c.label = `${a}×${b}`;
      c.variant = variant;
      c.r = this.W * profile.cherryScale * vDef.scale;
      c.drawH = cherryVisualH(c.r);
      c.x = c.r + Math.random() * (this.W - c.r * 2);
      c.y = -(c.drawH * 0.65);
      c.speed = this._fallCached;
      c.state = 'idle';
      c.sparkle = Math.random() * 6.28;
      c.active = true;
    }

    _countLiveCherries() {
      let n = 0;
      const list = this.cherryPool.active;
      for (let i = 0; i < list.length; i++) {
        if (!list[i]._released) n++;
      }
      return n;
    }

    _purgeStuckCherries(time) {
      const list = this.cherryPool.active;
      for (let i = list.length - 1; i >= 0; i--) {
        const c = list[i];
        if (c.state !== 'resolved' && c.state !== 'popping') continue;
        if (c.resolveUntil && time - c.resolveUntil > 1800) {
          this.cherryPool.release(c);
        }
      }
    }

    tryShoot(answer) {
      if (!Number.isFinite(answer) || answer < 0) return false;

      const cherries = this.cherryPool.active;
      let target = null;
      for (let i = 0; i < cherries.length; i++) {
        const c = cherries[i];
        if (c.state !== 'idle' || c.answer !== answer) continue;
        if (!target || c.y > target.y) target = c;
      }
      if (!target) return false;

      target.state = 'resolved';
      target.resolvedAnswer = answer;
      const now = performance.now();
      if (this.shotSystem) {
        this.shotSystem.beginResolve(target, now);
      } else {
        target.resolveUntil = now + RESOLVE_MS;
        target.sequenceStarted = false;
      }
      if (this.onResolve) this.onResolve(answer);
      return true;
    }

    /** Bitmap rebaked + drawOffset do registry (sockets ficam no registry). */
    _cannonMeta() {
      const def = this._rocketDef();
      const sprite = this.sprites.ship;
      const h = this.cannon.h;
      const drawOffset = def.drawOffset ?? { x: 0, y: 0 };
      if (!sprite || !sprite._logicalH) {
        return {
          drawW: h * 0.72,
          drawH: h,
          drawOffset,
          bakeScale: 1,
          canvasW: 0,
          canvasH: 0,
        };
      }
      return {
        drawW: sprite._logicalW,
        drawH: sprite._logicalH,
        drawOffset,
        bakeScale: sprite._bakeScale ?? 1,
        canvasW: sprite.width,
        canvasH: sprite.height,
      };
    }

    /** Socket local (pivot | nose | flame) — lê o registry do sprite ativo. */
    _socketLocal(name) {
      const def = this._rocketDef();
      const s = def.sockets[name];
      if (!s) return { x: 0, y: 0 };
      if (def.socketUnit === 'height') {
        const h = this._cannonMeta().drawH;
        return { x: s.x * h, y: s.y * h };
      }
      return { x: s.x, y: s.y };
    }

    _socketWorld(name, transform) {
      const pt = this._socketLocal(name);
      return this._worldFromLocal(pt.x, pt.y, transform);
    }

    _socketWorldAt(name, aimAngle, recoil, shake) {
      return this._socketWorld(name, this._cannonTransform(aimAngle, recoil, shake));
    }

    /** Matriz única: pivô + base local (−Y = direção da mira). */
    _cannonTransform(aimAngle, recoil, shake) {
      const pivot = this._cannonPivotWorld(recoil);
      const ux = Math.cos(aimAngle);
      const uy = Math.sin(aimAngle);
      return {
        px: pivot.x + (shake?.x || 0),
        py: pivot.y + (shake?.y || 0),
        ux,
        uy,
        aimAngle,
        rot: this._cannonRot(aimAngle),
      };
    }

    /** local −Y = nariz; +X = direita — derivado de (cos θ, sin θ). */
    _worldFromLocal(localX, localY, t) {
      return {
        x: t.px + localX * t.uy - localY * t.ux,
        y: t.py - localX * t.ux - localY * t.uy,
      };
    }

    _applyCannonCtxTransform(ctx, t) {
      ctx.transform(t.uy, -t.ux, -t.ux, -t.uy, t.px, t.py);
    }

    /** Retângulo local do drawImage (bitmap alinhado à base do pivô). */
    _spriteDrawRect(meta) {
      const ox = meta.drawOffset?.x ?? 0;
      const oy = meta.drawOffset?.y ?? 0;
      return {
        left: -meta.drawW / 2 + ox,
        top: -meta.drawH + oy,
        w: meta.drawW,
        h: meta.drawH,
      };
    }

    _cannonDrawLocalCorners(meta) {
      const r = this._spriteDrawRect(meta);
      return [
        [r.left, r.top],
        [r.left + r.w, r.top],
        [r.left + r.w, r.top + r.h],
        [r.left, r.top + r.h],
      ];
    }

    /** Cantos da AABB mundial — mesma matriz do sprite. */
    _cannonWorldBounds(aimAngle, recoil, shake) {
      const meta = this._cannonMeta();
      const t = this._cannonTransform(aimAngle, recoil, shake);
      const corners = this._cannonDrawLocalCorners(meta);
      const out = [];
      for (let i = 0; i < corners.length; i++) {
        out.push(this._worldFromLocal(corners[i][0], corners[i][1], t));
      }
      return out;
    }

    _boundsAabb(points) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < points.length; i++) {
        minX = Math.min(minX, points[i].x);
        minY = Math.min(minY, points[i].y);
        maxX = Math.max(maxX, points[i].x);
        maxY = Math.max(maxY, points[i].y);
      }
      return { minX, minY, maxX, maxY };
    }

    /** Quanto o sprite desce abaixo do pivô para um dado ângulo de mira. */
    _cannonExtentBelowPivot(aimAngle) {
      const m = this._cannonMeta();
      const t = this._cannonTransform(aimAngle, 0, null);
      const corners = this._cannonDrawLocalCorners(m);
      let maxDown = 0;
      for (let i = 0; i < corners.length; i++) {
        const w = this._worldFromLocal(corners[i][0], corners[i][1], t);
        const wy = w.y - t.py;
        if (wy > maxDown) maxDown = wy;
      }
      return maxDown;
    }

    _platformDeckY() {
      return this.platformTopY;
    }

    _getLayoutProfile() {
      if (!this.perfLite) return LAYOUT_PROFILES.desktop;
      return this.W < 340 ? LAYOUT_PROFILES.mobileSm : LAYOUT_PROFILES.mobile;
    }

    _cannonBaseDef() {
      return CANNON_BASE_REGISTRY.default;
    }

    _layoutCannonFloor() {
      const h = this.H || 400;
      const profile = this._getLayoutProfile();

      if (this._usesCombinedUnit()) {
        this.mountY = h * profile.floorRatio;
        this.platformTopY = this.mountY;
        this.cannon.y = this.mountY;
        this.platformDrawY = null;
        this.groundY = this.mountY + Math.max(10, (this.sprites.ship?._logicalH ?? 0) * 0.03);
        return;
      }

      const baseDef = this._cannonBaseDef();
      const plat = this.sprites.platform;
      const platH = plat?._logicalH ?? h * (this.perfLite ? 0.07 : 0.08);
      const deckY = plat?._deckY ?? baseDef.deckY ?? profile.deckRatio;
      const overlap = (baseDef.mountOverlap ?? 0) + (profile.platformLift ?? 0);

      this.mountY = h * profile.floorRatio;
      this.platformTopY = this.mountY;
      this.cannon.y = this.mountY;
      this.platformDrawY = this.mountY - platH * deckY - overlap;
      this.groundY = this.platformDrawY + platH;
    }

    _syncCannonAnchor() {
      this._layoutCannonFloor();
    }

    _cannonRot(aimAngle) {
      if (this.transformValidate && this.rotTestMode > 0) {
        return ROT_TEST_MODES[this.rotTestMode].fn(aimAngle);
      }
      return cannonRotFromAim(aimAngle);
    }

    setRotTestMode(index) {
      const i = Math.max(0, Math.min(ROT_TEST_MODES.length - 1, index | 0));
      this.rotTestMode = i;
      return ROT_TEST_MODES[i].label;
    }

    toggleTransformValidate() {
      this.transformValidate = !this.transformValidate;
      if (this.transformValidate) this.rotTestMode = 0;
      return this.transformValidate;
    }

    _drawTransformValidateOverlay(ctx, time) {
      const aimAngle = this.shotSystem?.getCannonAngle() ?? this.cannon.angle;
      const recoil = this.shotSystem?.getRecoil() ?? 0;
      const shake = this.shotSystem?.getShakeOffset(time) ?? { x: 0, y: 0 };
      const t = this._cannonTransform(aimAngle, recoil, shake);
      const aim = this._debugAimPoint();
      const mode = ROT_TEST_MODES[this.rotTestMode];
      const tip = this._worldFromLocal(0, -AXIS_TEST_LEN, t);
      const adx = tip.x - t.px;
      const ady = tip.y - t.py;
      const alen = Math.hypot(adx, ady) || 1;
      const dot = (adx / alen) * t.ux + (ady / alen) * t.uy;

      if (aim) {
        ctx.strokeStyle = 'rgba(64, 196, 255, 0.95)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(t.px, t.py);
        ctx.lineTo(aim.x, aim.y);
        ctx.stroke();
      }

      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.arc(t.px, t.py, 8, 0, Math.PI * 2);
      ctx.fill();

      const aligned = dot > 0.999;
      const lines = [
        'VALIDAÇÃO [V] volta ao jogo normal',
        `modo [0] ${ROT_TEST_MODES[0].label}${this.rotTestMode ? ` · teste ${this.rotTestMode}` : ''}`,
        `aim ${(aimAngle * 180 / Math.PI).toFixed(1)}°  rot ${(t.rot * 180 / Math.PI).toFixed(1)}°`,
        `alinhamento ${(dot * 100).toFixed(1)}%${aligned ? ' ✓' : ' ✗'}`,
        'vermelho = eixo −Y na nave · azul = mira',
        'Tecla 0 = correto · 1–4 = erros',
      ];
      ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
      ctx.fillRect(8, 8, 320, lines.length * 14 + 10);
      ctx.fillStyle = '#FF5252';
      ctx.font = '700 11px monospace';
      ctx.textAlign = 'left';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillStyle = i === 0 ? '#FF5252' : '#E0E0E0';
        ctx.fillText(lines[i], 14, 24 + i * 14);
      }
    }

    _drawCannonAxisTest(ctx) {
      ctx.strokeStyle = '#FF1744';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -AXIS_TEST_LEN);
      ctx.stroke();
      ctx.fillStyle = '#FF1744';
      ctx.beginPath();
      ctx.arc(0, -AXIS_TEST_LEN, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    /** Direção unitária do disparo (= atan2 do laser, sem offsets). */
    _barrelUnit(aimAngle) {
      return { x: Math.cos(aimAngle), y: Math.sin(aimAngle) };
    }

    /** Pivô mundial — base da torre sobre a plataforma. */
    _cannonPivotWorld(recoil) {
      const aimAngle = this.shotSystem?.getCannonAngle() ?? this.cannon.angle;
      const r = recoil != null ? recoil : (this.shotSystem?.getRecoil() || 0);
      const barrel = this._barrelUnit(aimAngle);
      return {
        x: this.cannon.x - barrel.x * r,
        y: this.cannon.y - barrel.y * r,
      };
    }

    getCherryAimPoint(c) {
      const drawH = c.drawH || cherryVisualH(c.r);
      return { x: c.x, y: c.y - drawH * 0.22 };
    }

    _muzzlePosAt(aimAngle, recoil, shake) {
      return this._socketWorldAt('nose', aimAngle, recoil, shake);
    }

    _muzzlePos() {
      const aimAngle = this.shotSystem?.getCannonAngle() ?? this.cannon.angle;
      return this._muzzlePosAt(aimAngle);
    }

    /** Alvo de mira atual (sequência ativa ou cereja resolvida). */
    _debugAimPoint() {
      if (this.shotSystem?.sequences?.length) {
        for (let i = 0; i < this.shotSystem.sequences.length; i++) {
          const seq = this.shotSystem.sequences[i];
          if (seq.aimPoint) return seq.aimPoint;
        }
      }
      const cherries = this.cherryPool.active;
      for (let i = 0; i < cherries.length; i++) {
        const c = cherries[i];
        if (c.state === 'resolved' || c.state === 'popping') {
          return this.getCherryAimPoint(c);
        }
      }
      return null;
    }

    _drawCannonDebug(ctx, time) {
      const aimAngle = this.shotSystem?.getCannonAngle() ?? this.cannon.angle;
      const recoil = this.shotSystem?.getRecoil() ?? 0;
      const shake = this.shotSystem?.getShakeOffset(time) ?? { x: 0, y: 0 };
      const meta = this._cannonMeta();
      const t = this._cannonTransform(aimAngle, recoil, shake);
      const bounds = this._cannonWorldBounds(aimAngle, recoil, shake);
      const aabb = this._boundsAabb(bounds);
      const muzzle = this._muzzlePosAt(aimAngle, recoil, shake);
      const flame = this._socketWorldAt('flame', aimAngle, recoil, shake);
      const aim = this._debugAimPoint();
      const barrel = this._barrelUnit(aimAngle);
      const def = this._rocketDef();
      const sprite = this.sprites.ship;

      ctx.save();

      ctx.strokeStyle = 'rgba(255, 193, 7, 0.9)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(aabb.minX, aabb.minY, aabb.maxX - aabb.minX, aabb.maxY - aabb.minY);
      ctx.setLineDash([]);
      ctx.beginPath();
      for (let i = 0; i < bounds.length; i++) {
        const p = bounds[i];
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 235, 59, 0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.strokeStyle = 'rgba(244, 67, 54, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, this.groundY);
      ctx.lineTo(this.W, this.groundY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 152, 0, 0.9)';
      ctx.beginPath();
      ctx.moveTo(0, this.platformTopY);
      ctx.lineTo(this.W, this.platformTopY);
      ctx.stroke();

      if (aim) {
        ctx.strokeStyle = 'rgba(64, 196, 255, 0.95)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(t.px, t.py);
        ctx.lineTo(aim.x, aim.y);
        ctx.stroke();

        ctx.fillStyle = '#FFEB3B';
        ctx.beginPath();
        ctx.arc(aim.x, aim.y, 7, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = 'rgba(64, 196, 255, 0.55)';
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(muzzle.x, muzzle.y);
      ctx.lineTo(muzzle.x + barrel.x * 48, muzzle.y + barrel.y * 48);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.arc(t.px, t.py, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#2196F3';
      ctx.beginPath();
      ctx.arc(muzzle.x, muzzle.y, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FF9800';
      ctx.beginPath();
      ctx.arc(flame.x, flame.y, 6, 0, Math.PI * 2);
      ctx.fill();

      const noseLoc = this._socketLocal('nose');
      const flameLoc = this._socketLocal('flame');
      const offScreen = aabb.maxY < 0 || aabb.minY > this.H || aabb.maxX < 0 || aabb.minX > this.W;
      const lines = [
        'DEBUG FOGUETE [D] desliga',
        `sprite ${this.cosmetics.shipId}${sprite?._procedural ? ' (procedural)' : ''}`,
        `nose   (${noseLoc.x.toFixed(0)}, ${noseLoc.y.toFixed(0)})  flame (${flameLoc.x.toFixed(0)}, ${flameLoc.y.toFixed(0)})`,
        `pivot  world (${t.px.toFixed(0)}, ${t.py.toFixed(0)})  deckY=${this.platformTopY.toFixed(0)}`,
        `draw   ${meta.drawW.toFixed(0)}×${meta.drawH.toFixed(0)}  off (${meta.drawOffset?.x ?? 0},${meta.drawOffset?.y ?? 0})`,
        `AABB   (${aabb.minX.toFixed(0)},${aabb.minY.toFixed(0)})–(${aabb.maxX.toFixed(0)},${aabb.maxY.toFixed(0)})`,
        `screen ${this.W}×${this.H}  burst ${def.flameBurstMs ?? 80}ms`,
        sprite?._opaqueW ? `bitmap ${sprite._opaqueW}×${sprite._opaqueH}px` : '',
        offScreen ? '⚠ FORA DO CANVAS' : '✓ visível no canvas',
        `aim ${(aimAngle * 180 / Math.PI).toFixed(1)}°  rot ${(t.rot * 180 / Math.PI).toFixed(1)}°`,
      ].filter(Boolean);

      ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
      ctx.fillRect(8, 8, 340, lines.length * 14 + 10);
      ctx.fillStyle = '#E0E0E0';
      ctx.font = '600 11px monospace';
      ctx.textAlign = 'left';
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 14, 24 + i * 14);
      }

      ctx.restore();
    }

    _spawnExplosion(x, y) {
      const flash = this.fxPool.get();
      flash.x = x;
      flash.y = y;
      flash.vx = 0;
      flash.vy = 0;
      flash.life = 110;
      flash.maxLife = 110;
      flash.size = 5;
      flash.kind = 'flash';
      flash.active = true;

      const colors = ['#FF4FA3', '#FFD56A', '#FF80AB', '#E53935', '#FFF59D', '#C62828'];
      const sparkCount = this.perfLite ? 8 : 14;
      for (let i = 0; i < sparkCount; i++) {
        const p = this.fxPool.get();
        const ang = (Math.PI * 2 * i) / sparkCount + Math.random() * 0.5;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(ang) * (2.5 + Math.random() * 3.5);
        p.vy = Math.sin(ang) * (2.5 + Math.random() * 3.5);
        p.life = 380 + Math.random() * 220;
        p.maxLife = p.life;
        p.size = 2 + Math.random() * 2.5;
        p.color = colors[i % colors.length];
        p.kind = 'spark';
        p.active = true;
      }

      const fragCount = this.perfLite ? 5 : 9;
      const fragColors = ['#E53935', '#FF5252', '#AD1457', '#880E4F'];
      for (let i = 0; i < fragCount; i++) {
        const p = this.fxPool.get();
        const ang = Math.random() * Math.PI * 2;
        p.x = x + (Math.random() - 0.5) * 6;
        p.y = y + (Math.random() - 0.5) * 6;
        p.vx = Math.cos(ang) * (1.5 + Math.random() * 4);
        p.vy = Math.sin(ang) * (1.5 + Math.random() * 4) - 1.2;
        p.life = 420 + Math.random() * 180;
        p.maxLife = p.life;
        p.size = 2.5 + Math.random() * 3;
        p.color = fragColors[i % fragColors.length];
        p.kind = 'fragment';
        p.rot = Math.random() * Math.PI * 2;
        p.active = true;
      }

      const smokeCount = this.perfLite ? 3 : 5;
      for (let i = 0; i < smokeCount; i++) {
        const p = this.fxPool.get();
        const ang = Math.random() * Math.PI * 2;
        p.x = x + (Math.random() - 0.5) * 10;
        p.y = y + (Math.random() - 0.5) * 8;
        p.vx = Math.cos(ang) * 0.35;
        p.vy = Math.sin(ang) * 0.35 - 0.6;
        p.life = 520 + Math.random() * 200;
        p.maxLife = p.life;
        p.size = 6 + Math.random() * 8;
        p.color = 'rgba(160, 100, 180, 0.4)';
        p.kind = 'smoke';
        p.active = true;
      }

      for (let i = 0; i < 3; i++) {
        const p = this.fxPool.get();
        p.x = x;
        p.y = y;
        p.vx = 0;
        p.vy = 0;
        p.life = 320;
        p.maxLife = 320;
        p.size = 6 + i * 12;
        p.color = 'rgba(255, 120, 180, 0.5)';
        p.kind = 'ring';
        p.active = true;
      }
    }

    frame(time) {
      if (!this.running) return;
      if (typeof document !== 'undefined' && document.hidden) {
        this.animId = requestAnimationFrame((t) => this.frame(t));
        return;
      }

      const dt = Math.min(time - this.lastTime, 32);
      this.lastTime = time;

      if (!this._blocked) {
        this.update(time, dt);
        this.renderBg(time);
        this.render(time);
      }

      this.animId = requestAnimationFrame((t) => this.frame(t));
    }

    update(time, dt) {
      this.survivalMs += dt;
      this._fallCached = this._fallSpeed();

      const newDiff = Math.floor(this.survivalMs / 45000);
      if (newDiff > this.difficulty) {
        this.difficulty = newDiff;
        const baseSpawn = this.perfLite ? 2700 : 2200;
        this.spawnInterval = Math.max(this.perfLite ? 1500 : 1200, baseSpawn - this.difficulty * 180);
      }

      if (time - this.lastSpawn >= this.spawnInterval) {
        this.lastSpawn = time;
        this._spawnCherry();
      }

      this._purgeStuckCherries(time);

      const fall = this._fallCached * (dt / 16);
      const cherries = this.cherryPool.active;

      for (let i = cherries.length - 1; i >= 0; i--) {
        const c = cherries[i];

        if (c.state === 'resolved' || c.state === 'popping') {
          continue;
        }

        c.y += fall;
        if (c.y + c.r * 0.5 >= this.groundY) {
          this.cherryPool.release(c);
          this.lives--;
          if (this.onMiss) this.onMiss();
        }
      }

      if (this.shotSystem) {
        this.shotSystem.update(time);
      }

      const fx = this.fxPool.active;
      for (let i = fx.length - 1; i >= 0; i--) {
        const p = fx[i];
        p.life -= dt;
        if (p.kind === 'spark' || p.kind === 'fragment') {
          p.x += p.vx * (dt / 16);
          p.y += p.vy * (dt / 16);
          p.vy += 0.05 * (dt / 16);
          if (p.kind === 'fragment') p.rot += 0.14 * (dt / 16);
        } else if (p.kind === 'smoke') {
          p.x += p.vx * (dt / 16);
          p.y += p.vy * (dt / 16);
          p.size += 0.45 * (dt / 16);
        } else if (p.kind === 'flash') {
          p.size += 1.4 * (dt / 16);
        } else {
          p.size += 0.35 * (dt / 16);
        }
        if (p.life <= 0) this.fxPool.release(p);
      }

      for (let i = 0; i < this.bgDrift.length; i++) {
        const d = this.bgDrift[i];
        d.x += d.vx * (dt / 16);
        d.y += d.vy * (dt / 16);
        if (d.y > this.groundY) {
          d.y = -4;
          d.x = Math.random() * this.W;
        }
      }

      this._tickAcc += dt;
      if (this._tickAcc >= 250) {
        this._tickAcc = 0;
        if (this.onActiveTick) this.onActiveTick();
      }
    }

    _drawBgMotion(ctx, time) {
      for (let i = 0; i < this.bgStars.length; i++) {
        const s = this.bgStars[i];
        s.tw += 0.025;
        const a = 0.25 + Math.sin(s.tw) * 0.2;
        ctx.fillStyle = `rgba(220, 210, 255, ${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < this.bgDrift.length; i++) {
        const d = this.bgDrift[i];
        ctx.fillStyle = `rgba(255, 140, 190, ${d.a})`;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    _drawGround(ctx) {
      const W = this.W;
      const gy = this.groundY;
      const gh = this.H - gy;

      const g = ctx.createLinearGradient(0, gy, 0, this.H);
      g.addColorStop(0, 'rgba(42, 24, 56, 0.45)');
      g.addColorStop(0.25, 'rgba(26, 16, 40, 0.62)');
      g.addColorStop(1, 'rgba(12, 8, 18, 0.88)');
      ctx.fillStyle = g;
      ctx.fillRect(0, gy, W, gh);
    }

    _drawCombinedUnitShadow(ctx) {
      const W = this.W;
      const y = this.mountY ?? this.cannon.y;
      const w = (this.sprites.ship?._logicalW ?? this.cannon.w) * 0.55;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.34)';
      ctx.beginPath();
      ctx.ellipse(this.cannon.x, y + 4, w, Math.max(8, w * 0.12), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      ctx.beginPath();
      ctx.ellipse(this.cannon.x, y + 7, w * 1.12, Math.max(10, w * 0.15), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    _drawPlatform(ctx) {
      if (this._usesCombinedUnit()) {
        this._drawCombinedUnitShadow(ctx);
        return;
      }

      const W = this.W;
      const plat = this.sprites.platform;
      if (plat) {
        const platW = plat._logicalW;
        const platH = plat._logicalH;
        const px = (W - platW) / 2;
        const deckY = plat?._deckY ?? this._cannonBaseDef().deckY ?? this._getLayoutProfile().deckRatio;
        const py = this.platformDrawY ?? (this.platformTopY - platH * deckY);
        const shadowY = py + platH * 0.9;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
        ctx.beginPath();
        ctx.ellipse(px + platW / 2, shadowY, platW * 0.4, platH * 0.07, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
        ctx.beginPath();
        ctx.ellipse(px + platW / 2, shadowY + 3, platW * 0.47, platH * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.drawImage(plat, px, py, platW, platH);
      } else {
        const gy = this.groundY;
        const gh = this.H - gy;
        ctx.strokeStyle = 'rgba(255, 79, 163, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(120, 80, 255, 0.2)';
        for (let i = 0; i < 6; i++) {
          const y = gy + 8 + i * (gh / 6);
          ctx.beginPath();
          ctx.moveTo(W * 0.08, y);
          ctx.lineTo(W * 0.92, y);
          ctx.stroke();
        }

        const cx = this.cannon.x;
        const gw = this.cannon.w * 1.6;
        ctx.fillStyle = 'rgba(255, 79, 163, 0.08)';
        ctx.beginPath();
        ctx.ellipse(cx, gy + 6, gw, 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    _drawCherry(ctx, c, time) {
      const vDef = VARIANTS[c.variant] || VARIANTS.normal;
      const sprite = this.sprites.cherry;
      const drawH = c.drawH || cherryVisualH(c.r);
      const drawW = sprite ? (sprite._logicalW / sprite._logicalH) * drawH : drawH;
      const topY = c.y - drawH * 0.55;
      const bottomY = c.y + c.r * 1.1;

      if (bottomY < 0 || topY > this.groundY) return;

      const showLabel = topY > -drawH * 0.15;

      ctx.save();
      ctx.translate(c.x, c.y);

      const popScale = c.state === 'popping' ? (c.popScale ?? 1) : 1;
      if (c.state === 'popping') {
        ctx.globalAlpha = Math.max(0, Math.min(1, popScale));
      }
      if (popScale !== 1) ctx.scale(popScale, popScale);

      if (showLabel) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(0, c.r * 0.55, drawW * 0.42, c.r * 0.18, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (showLabel && c.state !== 'popping') {
        const glow = ctx.createRadialGradient(0, -drawH * 0.15, 0, 0, -drawH * 0.15, drawW * 0.55);
        glow.addColorStop(0, 'rgba(255, 110, 160, 0.24)');
        glow.addColorStop(0.55, 'rgba(255, 90, 150, 0.08)');
        glow.addColorStop(1, 'rgba(255, 90, 150, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, -drawH * 0.15, drawW * 0.52, 0, Math.PI * 2);
        ctx.fill();
      }

      if (vDef.sparkle && showLabel) {
        const sp = 0.5 + Math.sin(time * 0.006 + c.sparkle) * 0.5;
        ctx.fillStyle = `rgba(255, 240, 180, ${0.35 + sp * 0.35})`;
        ctx.font = `${c.r * 0.5}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✨', 0, -c.r * 1.05);
      }

      if (sprite) {
        ctx.save();
        if (c.variant === 'rainbow') {
          const hue = (time * 0.08 + c.sparkle * 40) % 360;
          ctx.filter = `hue-rotate(${hue}deg) saturate(1.3)`;
        } else if (c.variant === 'frozen') {
          ctx.filter = 'hue-rotate(180deg) saturate(0.9) brightness(1.1)';
        } else if (c.variant === 'golden') {
          ctx.filter = 'sepia(0.35) saturate(1.4) brightness(1.08)';
        }
        ctx.drawImage(sprite, -drawW / 2, -drawH * 0.55, drawW, drawH);
        ctx.restore();
      } else {
        ctx.fillStyle = '#E53935';
        ctx.beginPath();
        ctx.arc(0, 0, c.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }

      if (showLabel && c.state === 'idle') {
        const bandW = Math.max(drawW * 0.85, c.r * 1.8);
        const bandH = c.r * 0.68;
        const by = c.r * 0.58;
        const bx = -bandW / 2;
        const by0 = by - bandH / 2;

        ctx.fillStyle = 'rgba(8, 4, 18, 0.82)';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(bx, by0, bandW, bandH, 6);
          ctx.fill();
        } else {
          ctx.fillRect(bx, by0, bandW, bandH);
        }
        ctx.strokeStyle = 'rgba(100, 200, 255, 0.28)';
        ctx.lineWidth = 1;
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(bx, by0, bandW, bandH, 6);
          ctx.stroke();
        } else {
          ctx.strokeRect(bx, by0, bandW, bandH);
        }

        const fs = Math.max(this.perfLite ? 10 : 11, c.r * (this.perfLite ? 0.72 : 0.78));
        ctx.font = `700 ${fs}px Quicksand, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText(c.label, 1, by + 1);
        ctx.fillStyle = '#FFF8F0';
        ctx.fillText(c.label, 0, by);
      } else if (showLabel && c.state === 'resolved') {
        const bandW = Math.max(drawW * 0.72, c.r * 1.6);
        const bandH = c.r * 0.62;
        const by = c.r * 0.6;
        const bx = -bandW / 2;
        const by0 = by - bandH / 2;
        ctx.fillStyle = 'rgba(8, 4, 18, 0.78)';
        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(bx, by0, bandW, bandH, 5);
          ctx.fill();
        } else {
          ctx.fillRect(bx, by0, bandW, bandH);
        }

        const fs = Math.max(this.perfLite ? 10 : 12, c.r * (this.perfLite ? 0.78 : 0.85));
        ctx.font = `700 ${fs}px Quicksand, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillText(`✔ ${c.resolvedAnswer}`, 1, by + 1);
        ctx.fillStyle = '#69F0AE';
        ctx.fillText(`✔ ${c.resolvedAnswer}`, 0, by);
      } else if (c.state === 'popping') {
        const popT = c.popScale ?? 1;
        const burst = Math.max(0, popT - 0.95) * 20;
        const flashA = popT > 1 ? Math.min(0.55, (popT - 1) * 1.4) : 0;
        if (flashA > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${flashA})`;
          ctx.beginPath();
          ctx.arc(0, -drawH * 0.1, drawW * 0.35, 0, Math.PI * 2);
          ctx.fill();
        }
        const glow = Math.max(0, popT - 0.5);
        if (glow > 0) {
          ctx.fillStyle = `rgba(105, 240, 174, ${Math.min(0.45, glow * 0.5)})`;
          ctx.beginPath();
          ctx.arc(0, 0, c.r * (1 + burst * 0.15), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();
    }

    _drawLaser(ctx, s, time) {
      if (!s.active) return;

      ctx.save();
      ctx.lineCap = 'round';

      const sx = s.sx ?? s.x;
      const sy = s.sy ?? s.y;
      const dx = s.x - sx;
      const dy = s.y - sy;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const trailMs = 120;

      if (!this.perfLite) {
        for (let i = 0; i < s.trail.length; i++) {
          const pt = s.trail[i];
          const age = time - (pt.t ?? time);
          if (age > trailMs) continue;
          const fade = 1 - age / trailMs;
          const segLen = 8 + fade * 18;
          ctx.strokeStyle = `rgba(64, 196, 255, ${fade * 0.35})`;
          ctx.lineWidth = 1.5 + fade * 2.5;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x - ux * segLen, pt.y - uy * segLen);
          ctx.stroke();
        }
      }

      if (!this.perfLite) {
        ctx.shadowColor = '#40C4FF';
        ctx.shadowBlur = 14;
      }

      ctx.strokeStyle = 'rgba(40, 160, 255, 0.22)';
      ctx.lineWidth = this.perfLite ? 10 : 14;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();

      const beamGrad = ctx.createLinearGradient(sx, sy, s.x, s.y);
      beamGrad.addColorStop(0, 'rgba(64, 196, 255, 0.08)');
      beamGrad.addColorStop(0.35, 'rgba(64, 196, 255, 0.55)');
      beamGrad.addColorStop(0.75, 'rgba(160, 230, 255, 0.92)');
      beamGrad.addColorStop(1, '#FFFFFF');
      ctx.shadowBlur = 0;
      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = this.perfLite ? 5 : 6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();

      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = this.perfLite ? 1.5 : 2;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(s.x, s.y);
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(s.x, s.y, this.perfLite ? 2.5 : 3.5, 0, Math.PI * 2);
      ctx.fill();

      const flashUntil = this.shotSystem?.getFlashUntil() ?? 0;
      if (time < flashUntil) {
        const pulse = 0.6 + Math.sin(time * 0.05) * 0.3;
        this._drawAxisGlow(ctx, sx, sy, Math.atan2(uy, ux), 18, 5.5, pulse);
      }

      ctx.restore();
    }

    /** Glow elíptico ao longo do eixo (canhão local ou direção do laser). */
    _drawAxisGlow(ctx, x, y, axisAngle, halfLen, halfW, pulse) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(axisAngle);
      ctx.scale(1, halfLen / halfW);
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, halfW);
      grd.addColorStop(0, `rgba(255, 255, 255, ${0.95 * pulse})`);
      grd.addColorStop(0.35, `rgba(120, 220, 255, ${0.55 * pulse})`);
      grd.addColorStop(1, 'rgba(64, 196, 255, 0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, 0, halfW, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    _drawCannonFlame(ctx, flameLocal, dh, time) {
      const c = this.cannon;
      const burstMs = this._rocketDef().flameBurstMs ?? 80;
      const burstLeft = Math.max(0, (c.flameUntil ?? 0) - time);
      const burstT = burstLeft > 0 ? 1 - burstLeft / burstMs : 0;
      const burst = burstT * burstT;
      const fl = flameLocal;
      const flicker = 0.88 + Math.sin(time * 0.014) * 0.12;

      const idleRx = dh * 0.045;
      const idleRy = dh * 0.07;
      const idleA = 0.24 * flicker;

      const rx = idleRx * (1 + burst * 1.6);
      const ry = idleRy * (1 + burst * 2.4);
      const a = idleA + burst * 0.52;

      ctx.save();
      ctx.translate(fl.x, fl.y + ry * 0.12);
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(rx, ry));
      grd.addColorStop(0, `rgba(255, 240, 200, ${a})`);
      grd.addColorStop(0.35, `rgba(255, 160, 60, ${a * 0.85})`);
      grd.addColorStop(0.7, `rgba(255, 90, 20, ${a * 0.4})`);
      grd.addColorStop(1, 'rgba(255, 60, 0, 0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      if (burst > 0.08) {
        const grd2 = ctx.createRadialGradient(0, -ry * 0.2, 0, 0, -ry * 0.2, ry * 1.1);
        grd2.addColorStop(0, `rgba(255, 255, 220, ${burst * 0.7})`);
        grd2.addColorStop(0.4, `rgba(255, 120, 30, ${burst * 0.45})`);
        grd2.addColorStop(1, 'rgba(255, 60, 0, 0)');
        ctx.fillStyle = grd2;
        ctx.beginPath();
        ctx.ellipse(0, -ry * 0.15, rx * 1.3, ry * 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    _drawCannonShip(ctx, time, opts) {
      const c = this.cannon;
      const sprite = this.sprites.ship;
      const aimAngle = opts?.aimAngle ?? this.shotSystem?.getCannonAngle() ?? c.angle;
      const recoil = opts?.recoil ?? this.shotSystem?.getRecoil() ?? 0;
      const shake = opts?.shake ?? this.shotSystem?.getShakeOffset(time) ?? { x: 0, y: 0 };
      const t = opts?.transform ?? this._cannonTransform(aimAngle, recoil, shake);
      const meta = this._cannonMeta();
      const nose = this._socketLocal('nose');
      const flame = this._socketLocal('flame');
      const rect = this._spriteDrawRect(meta);
      const dh = meta.drawH;
      const flashUntil = this.shotSystem?.getFlashUntil() ?? c.flashUntil;
      const flashing = time < flashUntil;

      if (!sprite) {
        const pivot = this._cannonPivotWorld(recoil);
        const muzzle = this._muzzlePosAt(aimAngle, recoil, shake);
        ctx.fillStyle = '#6D4C41';
        ctx.beginPath();
        ctx.moveTo(pivot.x - c.w * 0.3, pivot.y + c.h * 0.2);
        ctx.lineTo(pivot.x + c.w * 0.3, pivot.y + c.h * 0.2);
        ctx.lineTo(muzzle.x, muzzle.y);
        ctx.fill();
        return;
      }

      ctx.save();
      this._applyCannonCtxTransform(ctx, t);

      if (recoil > 0.3) {
        const kick = Math.min(0.035, recoil * 0.004);
        ctx.scale(1 - kick, 1 + kick * 0.6);
      }

      if (flashing) {
        ctx.shadowColor = '#40C4FF';
        ctx.shadowBlur = 20;
      } else if (recoil > 2) {
        ctx.shadowColor = 'rgba(255, 160, 80, 0.35)';
        ctx.shadowBlur = 8 + recoil * 0.6;
      }

      if (!this._rocketDef().hideProceduralFlame) {
        this._drawCannonFlame(ctx, flame, dh, time);
      }
      const srcW = meta.canvasW || sprite.width || rect.w;
      const srcH = meta.canvasH || sprite.height || rect.h;
      ctx.drawImage(sprite, 0, 0, srcW, srcH, rect.left, rect.top, rect.w, rect.h);

      if (this.cannonDebug) {
        this._drawCannonAxisTest(ctx);
        ctx.strokeStyle = 'rgba(255, 0, 255, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(rect.left, rect.top, rect.w, rect.h);
        ctx.setLineDash([]);
        ctx.fillStyle = '#4CAF50';
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FF9800';
        ctx.beginPath();
        ctx.arc(flame.x, flame.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2196F3';
        ctx.beginPath();
        ctx.arc(nose.x, nose.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      if (flashing) {
        ctx.shadowBlur = 0;
        const pulse = 0.65 + Math.sin(time * 0.05) * 0.3;
        this._drawAxisGlow(ctx, nose.x, nose.y, 0, dh * 0.17, dh * 0.048, pulse);
      }
      ctx.restore();
    }

    _drawCannon(ctx, time) {
      this._drawCannonShip(ctx, time);
    }

    renderBg(time) {
      if (!this.bgCtx) return;
      const W = this.W;
      const H = this.H;
      this.bgCtx.clearRect(0, 0, W, H);
      this._drawBgMotion(this.bgCtx, time);
    }

    _drawFx(ctx, p) {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'flash') {
        ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1.5 - a * 0.4), 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (p.kind === 'smoke') {
        ctx.fillStyle = `rgba(150, 95, 175, ${a * 0.32})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      if (p.kind === 'fragment') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot || 0);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size, -p.size * 0.55, p.size * 2, p.size * 1.1);
        ctx.restore();
        return;
      }
      if (p.kind === 'ring') {
        ctx.strokeStyle = `rgba(255, 120, 180, ${a * 0.55})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
        return;
      }
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
    }

    render(time) {
      const ctx = this.ctx;
      const W = this.W;

      ctx.clearRect(0, 0, W, this.H);
      if (!this.useHtmlBg && this.bgCache) ctx.drawImage(this.bgCache, 0, 0, W, this.H);
      this._drawGround(ctx);
      this._drawPlatform(ctx);

      const cherries = this.cherryPool.active;
      for (let i = 0; i < cherries.length; i++) {
        this._drawCherry(ctx, cherries[i], time);
      }

      const shots = this.shotPool.active;
      for (let i = 0; i < shots.length; i++) {
        this._drawLaser(ctx, shots[i], time);
      }

      const fx = this.fxPool.active;
      for (let i = 0; i < fx.length; i++) {
        this._drawFx(ctx, fx[i]);
      }
      ctx.globalAlpha = 1;

      this._drawCannon(ctx, time);
      if (this.cannonDebug) {
        this._drawCannonDebug(ctx, time);
      }
    }
  }

  global.SpaceshipEngine = SpaceshipEngine;
  global.RocketSpriteRegistry = ROCKET_SPRITE_REGISTRY;
  global.CannonBaseRegistry = CANNON_BASE_REGISTRY;
  global.RotTestModes = ROT_TEST_MODES;
  global.cannonRotFromAim = cannonRotFromAim;
})(typeof window !== 'undefined' ? window : globalThis);
