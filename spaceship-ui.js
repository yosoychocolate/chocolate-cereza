/**
 * Cañón Chocolate — UI e input numérico.
 */
(function (global) {
  'use strict';

  let engine = null;
  let container = null;
  let gameOver = false;
  let gamePaused = false;
  let active = false;
  let inputBuffer = '';
  let metaPanelPaused = false;
  let els = {};

  function formatTime(ms) {
    const sec = Math.floor(ms / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function loadRecords() {
    const save = global.SaveManager.getSave();
    return {
      highScore: save.records?.spaceshipHighScore || 0,
      bestTime: save.records?.spaceshipBestTime || 0,
    };
  }

  function saveRecords(score, timeMs) {
    const save = global.SaveManager.getSave();
    const rec = save.records || {};
    const next = { ...rec };
    let updated = false;
    if (score > (rec.spaceshipHighScore || 0)) {
      next.spaceshipHighScore = score;
      updated = true;
    }
    if (timeMs > (rec.spaceshipBestTime || 0)) {
      next.spaceshipBestTime = timeMs;
      updated = true;
    }
    if (updated) global.SaveManager.updateSection('records', next);
    return next;
  }

  function useNativeKeyboard() {
    try {
      return global.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
    } catch (_) {
      return global.innerWidth <= 768;
    }
  }

  function updateInputDisplay(correct = false) {
    const showNative = useNativeKeyboard();
    if (els.input && !showNative) {
      els.input.textContent = inputBuffer || '—';
      els.input.classList.toggle('has-value', !!inputBuffer);
      els.input.classList.toggle('is-correct', correct);
    }
    if (els.nativeInput && showNative) {
      els.nativeInput.value = inputBuffer;
      els.nativeInput.classList.toggle('has-value', !!inputBuffer);
      els.nativeInput.classList.toggle('is-correct', correct);
    }
    if (els.answerPanel) {
      els.answerPanel.classList.toggle('is-correct', correct);
    }
  }

  function clearInput() {
    inputBuffer = '';
    if (els.nativeInput) els.nativeInput.value = '';
    updateInputDisplay(false);
  }

  function flashCorrectAnswer(answer) {
    if (useNativeKeyboard() && els.nativeInput) {
      els.nativeInput.value = `✔ ${answer}`;
      els.nativeInput.classList.add('is-correct', 'has-value');
    } else if (els.input) {
      els.input.textContent = `✔ ${answer}`;
      updateInputDisplay(true);
    }
    if (els.answerPanel) els.answerPanel.classList.add('is-correct');
    clearTimeout(els._correctTimer);
    els._correctTimer = setTimeout(() => clearInput(), 400);
  }

  function focusNativeInput() {
    if (!useNativeKeyboard() || !els.nativeInput || !active || gameOver || gamePaused || metaPanelPaused) return;
    try {
      els.nativeInput.focus({ preventScroll: true });
    } catch (_) {
      els.nativeInput.focus();
    }
  }

  function blurNativeInput() {
    els.nativeInput?.blur();
  }

  function getVisibleAnswers() {
    if (!engine?.cherryPool?.active) return [];
    const out = [];
    const list = engine.cherryPool.active;
    for (let i = 0; i < list.length; i++) {
      if (list[i].state === 'idle') out.push(list[i].answer);
    }
    return out;
  }

  /** Há cereja na tela cujo resultado ainda pode completar este prefixo? (ex: "2" → 20) */
  function canPrefixExtend(prefix) {
    if (!prefix) return false;
    const answers = getVisibleAnswers();
    for (let i = 0; i < answers.length; i++) {
      const s = String(answers[i]);
      if (s.startsWith(prefix) && s.length > prefix.length) return true;
    }
    return false;
  }

  function appendDigit(digit) {
    if (inputBuffer.length >= 2) inputBuffer = '';
    inputBuffer += digit;
    updateInputDisplay(false);
    tryFireFromInput(false);
  }

  function tryFireFromInput(force) {
    if (!inputBuffer || !engine) return;
    const answer = parseInt(inputBuffer, 10);
    if (Number.isNaN(answer)) return;

    if (!force && inputBuffer.length < 2 && canPrefixExtend(inputBuffer)) {
      return;
    }

    const fired = engine.tryShoot(answer);
    if (fired) {
      global.GameMeta?.sounds?.playCannonLaser?.();
    } else if (force || inputBuffer.length >= 2) {
      els.answerPanel?.classList.add('is-wrong');
      clearTimeout(els._wrongTimer);
      els._wrongTimer = setTimeout(() => els.answerPanel?.classList.remove('is-wrong'), 320);
      if (force) clearInput();
    }
  }

  function updateLivesHud() {
    if (!engine || !els.lives) return;
    const full = engine.lives;
    const hearts = els.lives.querySelectorAll('.spaceship-life');
    if (hearts.length === 3) {
      hearts.forEach((el, i) => el.classList.toggle('is-full', i < full));
      return;
    }
    els.lives.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const span = document.createElement('span');
      span.className = 'spaceship-life' + (i < full ? ' is-full' : '');
      span.textContent = '❤️';
      els.lives.appendChild(span);
    }
  }

  function updateHud(full = false) {
    if (!engine) return;
    if (full || els._lastScore !== engine.score) {
      els._lastScore = engine.score;
      if (els.score) els.score.textContent = String(engine.score);
    }
    if (full || els._lastHits !== engine.hits) {
      els._lastHits = engine.hits;
      if (els.hits) els.hits.textContent = String(engine.hits);
    }
    if (full) updateLivesHud();
    if (full || els._lastTime !== Math.floor(engine.survivalMs / 1000)) {
      els._lastTime = Math.floor(engine.survivalMs / 1000);
      if (els.time) els.time.textContent = formatTime(engine.survivalMs);
    }
    if (full && els.wallet) {
      els.wallet.textContent = String(global.GameShop?.getWallet?.() ?? 0);
    }
  }

  function syncBlocked() {
    if (!engine) return;
    const blocked = gamePaused || gameOver || !active || metaPanelPaused;
    engine.setBlocked(blocked);
    if (blocked) {
      blurNativeInput();
      if (engine.running) engine.stop();
      return;
    }
    if (active && !gameOver && !document.hidden && !engine.running) {
      engine.start();
    }
  }

  function getCannonMetaPayload() {
    return {
      score: engine?.score || 0,
      hits: engine?.hits || 0,
      survivalMs: engine?.survivalMs || 0,
      inOnlineRoom: !!global.CloudManager?.getCurrentRoom?.(),
    };
  }

  function triggerGameOver() {
    gameOver = true;
    syncBlocked();
    engine?.stop();
    clearInput();

    const score = engine?.score || 0;
    const timeMs = engine?.survivalMs || 0;
    const rec = saveRecords(score, timeMs);

    global.CannonMissions?.onGameOver?.(engine);
    global.GameMeta?.onCannonGameOver?.(getCannonMetaPayload());

    els.gameOverScreen?.classList.remove('hidden');
    els.gameOverScreen?.setAttribute('aria-hidden', 'false');
    if (els.gameOverScore) els.gameOverScore.textContent = String(score);
    if (els.gameOverTime) els.gameOverTime.textContent = formatTime(timeMs);
    if (els.gameOverHits) els.gameOverHits.textContent = String(engine?.hits || 0);
    if (els.highScore) els.highScore.textContent = String(rec.highScore);

    submitOnlineScore(score);
  }

  function submitOnlineScore(finalScore) {
    if (!global.CloudManager?.getCurrentRoom?.()) return;
    const player = global.CloudManager.getLocalPlayer();
    if (!player) return;
    global.CloudManager.submitScore(player.id, player.name, finalScore)
      .then((r) => global.dispatchEvent(new CustomEvent('couple:score-submitted', { detail: r })))
      .catch(() => {});
  }

  function hideGameOver() {
    gameOver = false;
    els.gameOverScreen?.classList.add('hidden');
    els.gameOverScreen?.setAttribute('aria-hidden', 'true');
  }

  function restartGame() {
    hideGameOver();
    gamePaused = false;
    clearInput();
    global.GameMeta?.resetCannonSession?.();
    global.CannonMissions?.resetRun?.();
    engine?.resetSession();
    updateHud(true);
    syncBlocked();
    engine?.start();
    updatePauseBtn();
  }

  function togglePause() {
    if (gameOver || !active) return;
    gamePaused = !gamePaused;
    syncBlocked();
    updatePauseBtn();
    els.pauseScreen?.classList.toggle('hidden', !gamePaused);
    els.pauseScreen?.setAttribute('aria-hidden', gamePaused ? 'false' : 'true');
  }

  function updatePauseBtn() {
    if (!els.pauseBtn) return;
    const icon = els.pauseBtn.querySelector('.spaceship-pause-icon');
    const label = els.pauseBtn.querySelector('.spaceship-pause-label');
    if (icon) icon.textContent = gamePaused ? '▶' : '⏸';
    if (label) label.textContent = gamePaused ? 'Reanudar' : 'Pausar';
  }

  let resizeTimer = null;

  function resizeGame() {
    if (!container || !engine) return;
    const rect = container.getBoundingClientRect();
    const jugarCompact = global.__JUGAR_PAGE__;
    const maxW = jugarCompact ? 340 : Infinity;
    const w = Math.max(jugarCompact ? 260 : 280, Math.min(Math.floor(rect.width), maxW));
    const perfLite = global.matchMedia('(max-width: 768px)').matches;
    const mobileSm = w < 340;
    let aspect = perfLite ? (mobileSm ? 460 / 360 : 440 / 360) : 400 / 360;
    if (jugarCompact) aspect = mobileSm ? (360 / 360) : (380 / 360);
    let h = Math.max(jugarCompact ? 220 : 240, Math.floor(w * aspect));
    if (jugarCompact) h = Math.min(h, 280);
    container.classList.toggle('spaceship-mobile', perfLite);
    container.classList.toggle('spaceship-mobile-sm', mobileSm);
    engine.perfLite = perfLite;
    engine.resize(w, h, perfLite ? 1 : Math.min(global.devicePixelRatio || 1, 1.5));
    updateHud(true);
  }

  function scheduleResizeGame() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      resizeGame();
    }, 250);
  }

  function isTypingElsewhere(target) {
    const el = target instanceof Element ? target : document.activeElement;
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  function bindInput() {
    global.addEventListener('keydown', (e) => {
      if (!active || gameOver || gamePaused || metaPanelPaused || isTypingElsewhere(e.target)) return;

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        appendDigit(e.key);
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        inputBuffer = inputBuffer.slice(0, -1);
        updateInputDisplay(false);
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        tryFireFromInput(true);
        return;
      }

      if (e.key === 'd' || e.key === 'D') {
        if (!engine) return;
        engine.cannonDebug = !engine.cannonDebug;
      }
    });

    els.numpad?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-digit]');
      if (!btn || !active || gameOver || gamePaused || metaPanelPaused) return;
      appendDigit(btn.dataset.digit);
    });

    els.nativeInput?.addEventListener('input', () => {
      if (!active || gameOver || gamePaused || metaPanelPaused || !els.nativeInput) return;
      const raw = String(els.nativeInput.value || '').replace(/\D/g, '').slice(0, 2);
      if (raw !== els.nativeInput.value) els.nativeInput.value = raw;
      inputBuffer = raw;
      updateInputDisplay(false);
      if (raw) tryFireFromInput(false);
    });

    els.nativeInput?.addEventListener('keydown', (e) => {
      if (!active || gameOver || gamePaused || metaPanelPaused) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        tryFireFromInput(true);
      }
    });

    els.answerPanel?.addEventListener('click', () => {
      focusNativeInput();
    });

    els.pauseBtn?.addEventListener('click', togglePause);
    els.restartBtn?.addEventListener('click', restartGame);
    els.gameOverRestart?.addEventListener('click', restartGame);
    els.resumeBtn?.addEventListener('click', togglePause);

    global.addEventListener('resize', () => { if (active) scheduleResizeGame(); });
    global.addEventListener('gameshop:wallet-changed', () => updateHud(true));
    global.addEventListener('orientationchange', () => {
      if (active && useNativeKeyboard()) setTimeout(focusNativeInput, 400);
    });

    document.addEventListener('visibilitychange', () => {
      if (!active || gameOver) return;
      if (document.hidden) engine?.stop();
      else if (!gamePaused) engine?.start();
    });
  }

  function wireEngine() {
    engine.onCorrect = () => {
      updateHud();
      const meta = getCannonMetaPayload();
      global.GameMeta?.handleCannonHit?.(meta);
      global.CannonMissions?.onHit?.(engine);
      if (engine.hits % 5 === 0 && global.GameShop?.addCoins) {
        global.GameShop.addCoins(1);
        if (els.wallet) els.wallet.textContent = String(global.GameShop.getWallet());
      }
    };

    engine.onResolve = (answer) => {
      flashCorrectAnswer(answer);
    };

    engine.onMiss = () => {
      global.GameMeta?.handleCannonMiss?.();
      global.GameMeta?.onCannonLifeUpdate?.(engine.lives, getCannonMetaPayload());
      updateLivesHud();
      updateHud();
      container?.classList.add('spaceship-hit-flash');
      setTimeout(() => container?.classList.remove('spaceship-hit-flash'), 280);
      if (engine.lives <= 0) triggerGameOver();
    };

    engine.onActiveTick = () => {
      const meta = getCannonMetaPayload();
      global.GameMeta?.addCannonPlayTime?.(250, meta);
      global.CannonMissions?.onTick?.(engine);
      updateHud(false);
    };
  }

  function applyShopCosmetics() {
    const eq = global.GameShop?.state?.equipped;
    if (!eq || !engine) return;
    engine.setCosmetics({ shipId: eq.spaceship || 'ship_chocolate' });
  }

  function activate() {
    active = true;
    hideGameOver();
    gamePaused = false;
    clearInput();
    if (global.__JUGAR_PAGE__) {
      document.body.classList.add('jugar-game-active');
      global.__bindJugarCanvasInput__?.();
    }
    global.CannonMissions?.resetRun?.();
    syncBlocked();
    resizeGame();
    applyShopCosmetics();
    if (!engine.running) engine.start();
    updateHud(true);
    if (els.highScore) els.highScore.textContent = String(loadRecords().highScore);
    updatePauseBtn();
    if (useNativeKeyboard()) {
      setTimeout(focusNativeInput, 350);
    }
  }

  function deactivate() {
    active = false;
    gamePaused = false;
    clearInput();
    engine?.setBlocked(true);
    engine?.stop();
    els.pauseScreen?.classList.add('hidden');
  }

  function initGameRouter() {
    const tabs = document.querySelectorAll('[data-game-mode]');
    const cherryShell = document.getElementById('cherry-game-shell');
    const shipShell = document.getElementById('spaceship-shell');
    const cherryWrap = document.getElementById('game-container');
    const shipWrap = document.getElementById('spaceship-container');
    const hint = document.getElementById('game-mode-hint');
    const saved = global.SaveManager.getSave()?.settings?.activeGame || 'cherry';

    function setMode(mode) {
      const isCannon = mode === 'spaceship';
      tabs.forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.gameMode === mode);
        btn.setAttribute('aria-selected', btn.dataset.gameMode === mode ? 'true' : 'false');
      });
      if (cherryShell || shipShell) {
        cherryShell?.classList.toggle('hidden', isCannon);
        shipShell?.classList.toggle('hidden', !isCannon);
      } else {
        cherryWrap?.classList.toggle('hidden', isCannon);
        shipWrap?.classList.toggle('hidden', !isCannon);
      }
      if (hint) {
        hint.textContent = isCannon
          ? 'Escribe la respuesta (ej: 4 para 2×2) — primero ✔, luego el cañón dispara'
          : 'Controla la cereza con ← → , el mouse o tocando la pantalla';
      }
      global.SaveManager.updateSection('settings', { activeGame: mode });
      if (isCannon) {
        global.dispatchEvent(new CustomEvent('spaceship:activate'));
        global.dispatchEvent(new CustomEvent('cherrygame:deactivate'));
      } else {
        global.dispatchEvent(new CustomEvent('spaceship:deactivate'));
        global.dispatchEvent(new CustomEvent('cherrygame:activate'));
      }
    }

    tabs.forEach((btn) => btn.addEventListener('click', () => setMode(btn.dataset.gameMode)));
    setMode(saved === 'spaceship' ? 'spaceship' : 'cherry');
  }

  function observeVisibility() {
    if (global.__JUGAR_PAGE__) return;
    if (!container || !('IntersectionObserver' in global)) return;

    let hideTimer = null;
    let wasRunning = false;

    new IntersectionObserver((entries) => {
      if (!active || metaPanelPaused || gameOver || gamePaused) return;
      if (document.hidden) return;
      if (global.CloudManager?.getCurrentRoom?.()) return;

      const ratio = entries.reduce((max, e) => Math.max(max, e.intersectionRatio), 0);

      if (ratio >= 0.05) {
        if (hideTimer) {
          clearTimeout(hideTimer);
          hideTimer = null;
        }
        if (wasRunning && engine && !engine.running) {
          wasRunning = false;
          engine.start();
        }
        return;
      }

      if (!engine?.running) return;

      if (hideTimer) return;
      hideTimer = setTimeout(() => {
        hideTimer = null;
        if (!active || metaPanelPaused || gameOver || gamePaused || document.hidden) return;
        if (global.CloudManager?.getCurrentRoom?.()) return;

        const rect = container.getBoundingClientRect();
        const inViewport = rect.bottom > 8 && rect.top < global.innerHeight - 8 && rect.width > 0;
        if (!inViewport && engine?.running) {
          wasRunning = true;
          engine.stop();
        }
      }, 900);
    }, { threshold: [0, 0.05, 0.2, 0.5] }).observe(container);
  }

  function bindMetaPanelPause() {
    global.addEventListener('gamemeta:panel-change', (e) => {
      if (!active) return;
      metaPanelPaused = !!e.detail?.open;
      syncBlocked();
    });
  }

  function init() {
    container = document.getElementById('spaceship-container');
    if (!container || !global.SpaceshipEngine) return;

    els = {
      canvas: document.getElementById('spaceship-canvas'),
      bgCanvas: document.getElementById('spaceship-bg-canvas'),
      score: document.querySelector('.spaceship-score-num'),
      highScore: document.getElementById('spaceship-high-score-val'),
      lives: document.getElementById('spaceship-lives-hearts'),
      time: document.getElementById('spaceship-time-val'),
      hits: document.getElementById('spaceship-hits-val'),
      wallet: document.getElementById('spaceship-wallet-val'),
      input: document.getElementById('spaceship-answer-input'),
      nativeInput: document.getElementById('spaceship-answer-native'),
      answerPanel: document.querySelector('.spaceship-answer-panel'),
      numpad: document.getElementById('spaceship-numpad'),
      pauseScreen: document.getElementById('spaceship-pause-screen'),
      gameOverScreen: document.getElementById('spaceship-game-over-screen'),
      gameOverScore: document.getElementById('spaceship-go-score'),
      gameOverTime: document.getElementById('spaceship-go-time'),
      gameOverHits: document.getElementById('spaceship-go-hits'),
      pauseBtn: document.getElementById('spaceship-pause'),
      restartBtn: document.getElementById('spaceship-reload'),
      gameOverRestart: document.getElementById('spaceship-over-restart'),
      resumeBtn: document.getElementById('spaceship-resume'),
    };

    const qs = new URLSearchParams(global.location.search);
    engine = new global.SpaceshipEngine({
      container,
      canvas: els.canvas,
      bgCanvas: els.bgCanvas,
      perfLite: global.matchMedia('(max-width: 768px)').matches,
      useHtmlBg: !!document.getElementById('spaceship-bg'),
      cannonDebug: qs.get('cannonDebug') === '1',
    });

    resizeGame();
    engine.loadSprites().catch(() => {});

    wireEngine();
    bindInput();
    bindMetaPanelPause();
    initGameRouter();
    observeVisibility();
    global.CannonMissions?.init?.();

    global.addEventListener('spaceship:activate', activate);
    global.addEventListener('spaceship:deactivate', deactivate);
    global.addEventListener('gameshop:cosmetics-applied', applyShopCosmetics);

    if (global.SaveManager.getSave()?.settings?.activeGame === 'spaceship') activate();
    else engine.setBlocked(true);

    global.SpaceshipUI = { engine, activate, deactivate, applyShopCosmetics, restartGame };
  }

  global.SpaceshipUI = { init };
})(typeof window !== 'undefined' ? window : globalThis);
