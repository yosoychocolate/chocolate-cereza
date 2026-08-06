/**
 * Arranque da página /jugar/ — sem intro, direto ao jogo.
 */
import { goToJugarRoom } from '../site-routes.js?v=7cbf9eb';

function clearJugarBlockers() {
  document.documentElement.classList.remove('intro-lock');
  document.body.classList.remove(
    'game-meta-panel-open',
    'game-meta-sheet-open',
    'game-shop-open',
    'game-focus'
  );
  document.documentElement.style.overflow = '';
  document.body.style.overflow = '';
  document.documentElement.style.height = '';
  document.body.style.height = '';

  const petalRain = document.getElementById('petal-rain');
  if (petalRain) {
    petalRain.replaceChildren();
    petalRain.remove();
  }
}

function enableJugarGameInput() {
  if (document.body.classList.contains('jugar-game-active')) return;
  document.body.classList.add('jugar-game-active');
  window.__bindJugarCanvasInput__?.();
}

function bindJugarGameInputGate() {
  document.getElementById('game-container')?.addEventListener('pointerdown', enableJugarGameInput, { passive: true });
  document.getElementById('spaceship-container')?.addEventListener('pointerdown', enableJugarGameInput, { passive: true });
  document.querySelector('.game-chrome')?.addEventListener('pointerdown', enableJugarGameInput, { passive: true });
  document.querySelector('.spaceship-chrome')?.addEventListener('pointerdown', enableJugarGameInput, { passive: true });

  document.querySelectorAll('.game-mode-tab[data-game-mode="spaceship"]').forEach((tab) => {
    tab.addEventListener('click', () => {
      enableJugarGameInput();
    });
  });
}

function bindJugarRestartControls() {
  document.addEventListener('click', (event) => {
    const cherryRestart = event.target.closest('#game-reload, #game-over-restart');
    const cannonRestart = event.target.closest('#spaceship-reload, #spaceship-over-restart');
    const cherryContinue = event.target.closest('#game-continue, #game-endless-enter, #game-resume, #game-toast-dismiss');

    if (cherryRestart || cannonRestart || cherryContinue) {
      enableJugarGameInput();
    }

    if (cherryRestart) {
      window.__resetCherryGameSession__?.();
      event.stopPropagation();
      return;
    }
    if (cannonRestart) {
      window.SpaceshipUI?.restartGame?.();
      event.stopPropagation();
    }
  }, true);
}

function bootJugarPage() {
  clearJugarBlockers();
  document.body.classList.add('jugar-ready');
  bindJugarGameInputGate();

  if (typeof window.initMainSections === 'function') {
    window.initMainSections();
  }

  bindJugarRestartControls();
}

window.goToJugarRoom = goToJugarRoom;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootJugarPage);
} else {
  bootJugarPage();
}
