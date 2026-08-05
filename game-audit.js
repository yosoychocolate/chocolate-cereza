/**
 * Auditoria de FPS — somente medição, zero otimização.
 * Ativar: index.html?gameaudit=1
 * Relatório no console após ~12s na seção do mini game.
 */
(function () {
  'use strict';
  if (!new URLSearchParams(location.search).has('gameaudit')) return;

  const BUDGET_MS = 1000 / 60;
  const REPORT_AFTER_MS = 12000;

  const audit = {
    rafCallbacks: new Map(),
    rafNextId: 1,
    activeTimers: new Set(),
    activeIntervals: new Set(),
    domMutations: 0,
    domMutationsGame: 0,
    layoutReads: 0,
    layoutWrites: 0,
    drawImageCalls: 0,
    drawImagePerFrame: [],
    fillTextCalls: 0,
    clearRectCalls: 0,
    frames: 0,
    framesOverBudget: 0,
    frameTimes: [],
    stageTimes: { update: [], physics: [], collision: [], render: [], effects: [], domSync: [] },
    poolSnapshots: [],
    listenerCount: 0,
    longTasks: [],
    startedAt: performance.now(),
  };

  window.__GAME_AUDIT__ = audit;

  /* ── RAF tracking ── */
  const origRaf = window.requestAnimationFrame.bind(window);
  const origCancel = window.cancelAnimationFrame.bind(window);

  window.requestAnimationFrame = function (cb) {
    const id = audit.rafNextId++;
    const label = new Error().stack?.split('\n')[2]?.trim() || 'unknown';
    const wrapped = (t) => {
      audit.rafCallbacks.delete(id);
      return cb(t);
    };
    audit.rafCallbacks.set(id, label);
    return origRaf(wrapped);
  };

  window.cancelAnimationFrame = function (id) {
    audit.rafCallbacks.delete(id);
    return origCancel(id);
  };

  /* ── Timer tracking ── */
  const origSetTimeout = window.setTimeout.bind(window);
  const origSetInterval = window.setInterval.bind(window);
  const origClearTimeout = window.clearTimeout.bind(window);
  const origClearInterval = window.clearInterval.bind(window);

  window.setTimeout = function (fn, delay, ...args) {
    const id = origSetTimeout(() => {
      audit.activeTimers.delete(id);
      fn(...args);
    }, delay, ...args);
    audit.activeTimers.add(id);
    return id;
  };

  window.setInterval = function (fn, delay, ...args) {
    const id = origSetInterval(fn, delay, ...args);
    audit.activeIntervals.add(id);
    return id;
  };

  window.clearTimeout = function (id) {
    audit.activeTimers.delete(id);
    return origClearTimeout(id);
  };

  window.clearInterval = function (id) {
    audit.activeIntervals.delete(id);
    return origClearInterval(id);
  };

  /* ── Canvas drawImage / clearRect / fillText ── */
  const origDrawImage = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (...args) {
    audit.drawImageCalls++;
    if (window.__AUDIT_FRAME__) window.__AUDIT_FRAME__.drawImage++;
    return origDrawImage.apply(this, args);
  };

  const origClearRect = CanvasRenderingContext2D.prototype.clearRect;
  CanvasRenderingContext2D.prototype.clearRect = function (...args) {
    audit.clearRectCalls++;
    if (window.__AUDIT_FRAME__) window.__AUDIT_FRAME__.clearRect++;
    return origClearRect.apply(this, args);
  };

  const origFillText = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function (...args) {
    audit.fillTextCalls++;
    if (window.__AUDIT_FRAME__) window.__AUDIT_FRAME__.fillText++;
    return origFillText.apply(this, args);
  };

  /* ── Layout thrashing detection ── */
  const origGetBCR = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function (...args) {
    audit.layoutReads++;
    return origGetBCR.apply(this, args);
  };

  const origGCS = window.getComputedStyle;
  window.getComputedStyle = function (...args) {
    audit.layoutReads++;
    return origGCS.apply(window, args);
  };

  /* ── DOM mutations ── */
  const mo = new MutationObserver((records) => {
    audit.domMutations += records.length;
    for (let i = 0; i < records.length; i++) {
      const t = records[i].target;
      if (t.closest?.('#game-container, #main-content, #petal-rain, #ambient-bg, #music-notes')) {
        audit.domMutationsGame++;
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });

  /* ── Long tasks ── */
  if ('PerformanceObserver' in window) {
    try {
      const po = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (e.duration > 16.6) audit.longTasks.push({ name: e.name, duration: e.duration, start: e.startTime });
        }
      });
      po.observe({ entryTypes: ['longtask'] });
    } catch (_) { /* Safari */ }
  }

  /* ── Hook engine after init ── */
  function hookEngine(engine) {
    if (!engine || engine.__auditHooked) return;
    engine.__auditHooked = true;
    engine.profiling = true;

    const origFrame = engine.frame.bind(engine);
    engine.frame = function (time) {
      if (!engine.running) return;

      const frameStart = performance.now();
      window.__AUDIT_FRAME__ = { drawImage: 0, clearRect: 0, fillText: 0 };

      const dt = Math.min(time - engine.lastTime, 24);
      const t0 = performance.now();

      if (Math.abs(engine.camZoomTarget - engine.camZoom) > 0.001) {
        engine.camZoom += (engine.camZoomTarget - engine.camZoom) * 0.06;
        engine.dirty.game = true;
      } else {
        engine.camZoom = engine.camZoomTarget;
      }
      engine.quality.tick(dt);
      const t1 = performance.now();

      engine.physics(time, dt);
      const t2 = performance.now();

      engine.collision(time);
      const t3 = performance.now();

      if (time - engine.lastFxTick >= engine.FX_INTERVAL) {
        engine.updateEffects(dt);
        engine.lastFxTick = time;
      }
      const t4 = performance.now();

      engine.render(time);
      const t5 = performance.now();

      engine.lastTime = time;
      engine.animId = requestAnimationFrame((t) => engine.frame(t));

      const total = performance.now() - frameStart;
      audit.frames++;
      audit.frameTimes.push(total);
      if (total > BUDGET_MS) audit.framesOverBudget++;

      audit.stageTimes.update.push(t1 - t0);
      audit.stageTimes.physics.push(t2 - t1);
      audit.stageTimes.collision.push(t3 - t2);
      audit.stageTimes.effects.push(t4 - t3);
      audit.stageTimes.render.push(t5 - t4);

      audit.drawImagePerFrame.push(window.__AUDIT_FRAME__.drawImage);
      window.__AUDIT_FRAME__ = null;

      if (audit.frames % 60 === 0) {
        audit.poolSnapshots.push({
          t: Math.round(performance.now() - audit.startedAt),
          choco: engine.chocoPool.active.length,
          chocoFree: engine.chocoPool._free,
          particles: engine.particlePool.active.length,
          particlesFree: engine.particlePool._free,
          effects: engine.effectPool.active.length,
          hearts: engine.heartPool.active.length,
          spatialCells: engine.spatial.cells.size,
        });
      }
    };
  }

  /* ── Poll for engine instance ── */
  const enginePoll = setInterval(() => {
    if (window.__MINI_GAME_ENGINE__) {
      hookEngine(window.__MINI_GAME_ENGINE__);
      clearInterval(enginePoll);
    }
  }, 200);

  /* ── Count listeners (approximation at report time) ── */
  function countListeners() {
    /* getEventListeners só existe no DevTools; estimativa via performance */
    return '(ver DevTools → getEventListeners(document))';
  }

  function avg(arr) {
    if (!arr.length) return 0;
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    return s / arr.length;
  }

  function p95(arr) {
    if (!arr.length) return 0;
    const sorted = arr.slice().sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length * 0.95)];
  }

  function max(arr) {
    if (!arr.length) return 0;
    let m = 0;
    for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
    return m;
  }

  function report() {
    const elapsed = (performance.now() - audit.startedAt) / 1000;
    const fps = audit.frames / elapsed;
    const domPerSec = audit.domMutations / elapsed;
    const domGamePerSec = audit.domMutationsGame / elapsed;
    const avgDraw = avg(audit.drawImagePerFrame);
    const maxDraw = max(audit.drawImagePerFrame);

    const stages = {
      update: avg(audit.stageTimes.update),
      physics: avg(audit.stageTimes.physics),
      collision: avg(audit.stageTimes.collision),
      effects: avg(audit.stageTimes.effects),
      render: avg(audit.stageTimes.render),
    };
    const slowest = Object.entries(stages).sort((a, b) => b[1] - a[1])[0];

    const petalCount = document.querySelectorAll('#petal-rain > *').length;
    const ambientCount = document.querySelectorAll('#ambient-bg > *').length;
    const animatedEls = document.querySelectorAll('[style*="animation"], .petal, .rain-heart, .ambient-star, .ambient-particle, .ambient-heart').length;

    const poolFirst = audit.poolSnapshots[0];
    const poolLast = audit.poolSnapshots[audit.poolSnapshots.length - 1];
    const poolLeak = poolLast && poolFirst
      ? poolLast.choco + poolLast.particles + poolLast.hearts - (poolFirst.choco + poolFirst.particles + poolFirst.hearts)
      : 0;

    console.group('%c🔬 AUDITORIA FPS — Relatório', 'color:#FF58A8;font-weight:bold;font-size:14px');
    console.log(`Duração: ${elapsed.toFixed(1)}s | Frames engine: ${audit.frames} | FPS médio engine: ${fps.toFixed(1)}`);
    console.log(`Frames > 16.6ms: ${audit.framesOverBudget} (${((audit.framesOverBudget / audit.frames) * 100).toFixed(1)}%)`);
    console.log(`Frame time — avg: ${avg(audit.frameTimes).toFixed(2)}ms | p95: ${p95(audit.frameTimes).toFixed(2)}ms | max: ${max(audit.frameTimes).toFixed(2)}ms`);

    console.group('⏱ Tempo médio por etapa (engine)');
    console.table({
      Update: `${stages.update.toFixed(3)} ms`,
      Physics: `${stages.physics.toFixed(3)} ms`,
      Collision: `${stages.collision.toFixed(3)} ms`,
      Effects: `${stages.effects.toFixed(3)} ms`,
      Render: `${stages.render.toFixed(3)} ms`,
      TOTAL: `${avg(audit.frameTimes).toFixed(3)} ms`,
    });
    console.log(`⚠ Etapa mais lenta: ${slowest[0]} (${slowest[1].toFixed(3)} ms)`);
    console.groupEnd();

    console.group('🎨 Canvas (totais)');
    console.log(`drawImage(): ${audit.drawImageCalls} total | média/frame: ${avgDraw.toFixed(1)} | pico/frame: ${maxDraw}`);
    console.log(`clearRect(): ${audit.clearRectCalls}`);
    console.log(`fillText(): ${audit.fillTextCalls} (emoji chuva = caro)`);
    console.groupEnd();

    console.group('🌐 DOM & Compositor (fora do canvas)');
    console.log(`Mutações DOM/s (total): ${domPerSec.toFixed(1)}`);
    console.log(`Mutações DOM/s (jogo+site): ${domGamePerSec.toFixed(1)}`);
    console.log(`Layout reads (getBoundingClientRect etc.): ${audit.layoutReads}`);
    console.log(`Elementos #petal-rain: ${petalCount}`);
    console.log(`Elementos #ambient-bg: ${ambientCount}`);
    console.log(`Elementos animados CSS (est.): ${animatedEls}`);
    console.groupEnd();

    console.group('🔄 Loops & Timers (ativos no momento)');
    console.log(`requestAnimationFrame ativos: ${audit.rafCallbacks.size}`);
    for (const [id, label] of audit.rafCallbacks) console.log(`  RAF #${id}: ${label}`);
    console.log(`setTimeout pendentes: ${audit.activeTimers.size}`);
    console.log(`setInterval ativos: ${audit.activeIntervals.size}`);
    console.groupEnd();

    console.group('🧠 Pools & Memória');
    if (poolLast) {
      console.table(poolLast);
      console.log(`Crescimento líquido pool (1º→último snapshot): ${poolLeak >= 0 ? '+' : ''}${poolLeak} objetos active`);
      console.log(`Spatial hash cells (último): ${poolLast.spatialCells}`);
    }
    console.groupEnd();

    if (audit.longTasks.length) {
      console.group('🐢 Long Tasks (>16.6ms main thread)');
      console.table(audit.longTasks.slice(0, 10));
      console.groupEnd();
    }

    console.group('📋 Diagnóstico estático (pré-medido)');
    console.log(`
CAUSAS PROVÁVEIS (prioridade):

1. COMPOSITOR GPU — ${petalCount + ambientCount} elementos DOM com animation CSS infinita
   (#petal-rain + #ambient-bg). NÃO aparece no profiling do canvas.
   Custo estimado mobile: 5–15ms/frame de GPU.

2. SEGUNDO RAF — tickMusicProgress() quando música toca
   Atualiza progressFill.style.width A CADA FRAME (~60 DOM writes/s).

3. CANVAS RENDER — game layer redesenha TODO FRAME (dirty.game=true sempre)
   porque chocolates movem-se sempre. ~${avgDraw.toFixed(0)} drawImage/frame + 2-3 clearRect.

4. backdrop-filter: blur() em .game-score, .game-lives, .game-pause, overlays
   Força repintura GPU das camadas por trás.

5. fillText('❤️') na chuva cinemática (milestone 50) — ${audit.fillTextCalls} chamadas medidas.

6. updateProgressBar() — querySelectorAll + 5 classList.toggle POR chocolate coletado.
    `);
    console.groupEnd();

    console.groupEnd();
    console.log('%cCopie este relatório e envie para análise. URL: ?gameaudit=1', 'color:#888');
  }

  setTimeout(report, REPORT_AFTER_MS);

  console.log('%c[Auditoria FPS] Ativa — jogue ~12s na seção Mini Game. Relatório automático no console.', 'color:#FF58A8');
})();
