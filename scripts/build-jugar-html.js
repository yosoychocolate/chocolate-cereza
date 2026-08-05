const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const fragmentPath = path.join(root, 'jugar', 'game-section.fragment.html');
const indexSrc = fs.readFileSync(indexPath, 'utf8');

function extractById(html, id) {
  const openRe = new RegExp(`<[^>]+id="${id}"[^>]*>`, 'i');
  const openMatch = html.match(openRe);
  if (!openMatch) return '';

  const start = html.indexOf(openMatch[0]);
  let depth = 0;
  let i = start;
  while (i < html.length) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose === -1) break;

    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
      continue;
    }

    depth -= 1;
    i = nextClose + 6;
    if (depth === 0) {
      return html.slice(start, i);
    }
  }

  return '';
}

const audioTag = indexSrc.match(/<audio id="song-audio"[^>]*><\/audio>/)?.[0] || '';
const musicToast = extractById(indexSrc, 'music-toast');
const musicAutoplay = extractById(indexSrc, 'music-autoplay-prompt');
const musicFloat = extractById(indexSrc, 'music-float-wrap');
const socialDock = extractById(indexSrc, 'social-dock');

if (!fs.existsSync(fragmentPath)) {
  console.error('Missing', fragmentPath, '- run scripts/extract-game-section.js first');
  process.exit(1);
}

let game = fs.readFileSync(fragmentPath, 'utf8');
game = game.replace(/src="assets\//g, 'src="../assets/');

const head = `<!DOCTYPE html>
<html lang="es" class="jugar-page">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
  <title>Jugar — El Chocolate & La Cereza</title>
  <link rel="icon" type="image/png" href="../assets/app-icon-192.png?v=1">
  <link rel="manifest" href="../manifest.json?v=__APP_VERSION__">
  <meta name="theme-color" content="#ff4fa3">
  <meta name="mobile-web-app-capable" content="yes">
  <link rel="stylesheet" href="../styles.css?v=20260804jugar13">
  <style id="jugar-critical-fix">
    html.jugar-page, body.jugar-body { height: 100% !important; overflow: hidden !important; margin: 0; }
    body.jugar-body { display: flex !important; flex-direction: column !important; }
    .jugar-topbar { flex: 0 0 auto; }
    .jugar-header { flex: 0 0 auto !important; max-width: min(100%, 460px) !important; margin-left: auto !important; margin-right: auto !important; }
    .jugar-main {
      flex: 1 1 auto !important; min-height: 0 !important;
      max-width: min(100%, 460px) !important; margin-left: auto !important; margin-right: auto !important;
      overflow-x: hidden !important; overflow-y: auto !important;
      -webkit-overflow-scrolling: touch !important; touch-action: pan-y !important;
      scrollbar-width: thin !important;
      scrollbar-color: rgba(255, 79, 163, 0.45) rgba(18, 10, 28, 0.3) !important;
    }
    html.jugar-page .jugar-main::-webkit-scrollbar { width: 5px; }
    html.jugar-page .jugar-main::-webkit-scrollbar-button { display: none; height: 0; width: 0; }
    html.jugar-page #ambient-bg, html.jugar-page #ambient-bg * { pointer-events: none !important; }
    html.jugar-page #section-game > #cherry-game-shell,
    html.jugar-page #section-game > #spaceship-shell,
    html.jugar-page .game-chrome,
    html.jugar-page .spaceship-chrome { pointer-events: auto !important; touch-action: pan-y !important; }
    html.jugar-page body:not(.jugar-game-active) #game-canvas-stack,
    html.jugar-page body:not(.jugar-game-active) #game-canvas-stack .game-layer-canvas,
    html.jugar-page body:not(.jugar-game-active) #spaceship-shell:not(.hidden) .spaceship-canvas {
      pointer-events: none !important; touch-action: pan-y !important;
    }
    html.jugar-page body.jugar-game-active #game-canvas-stack,
    html.jugar-page body.jugar-game-active #game-canvas-stack .game-layer-canvas,
    html.jugar-page body.jugar-game-active #spaceship-shell:not(.hidden) .spaceship-canvas {
      pointer-events: auto !important; touch-action: none !important;
    }
    html.jugar-page #spaceship-shell:not(.hidden) .spaceship-chrome,
    html.jugar-page #spaceship-shell:not(.hidden) .spaceship-numpad,
    html.jugar-page #spaceship-shell:not(.hidden) .spaceship-numpad button,
    html.jugar-page #spaceship-shell:not(.hidden) .spaceship-answer-panel {
      pointer-events: auto !important; touch-action: manipulation !important;
    }
    html.jugar-page .couple-mode, html.jugar-page .couple-mode *,
    html.jugar-page .jugar-header, html.jugar-page .jugar-header *,
    html.jugar-page .game-mode-tabs, html.jugar-page .game-mode-tabs *,
    html.jugar-page .game-meta-wrap, html.jugar-page .game-meta-bar,
    html.jugar-page .game-meta-bar * { pointer-events: auto !important; }
  </style>
  <script>
    window.__SITE_ROOT__ = '../';
    window.__JUGAR_PAGE__ = true;
    window.__FILE_PROTOCOL__ = location.protocol === 'file:';
  </script>
  <script src="../site-assets.js?v=__APP_VERSION__"></script>
</head>
<body class="jugar-body">
  <div id="ambient-bg" aria-hidden="true"></div>
  <header class="jugar-header glass">
    <div class="jugar-topbar">
      <a href="../" class="jugar-back-link">← Volver al sitio</a>
      <span class="jugar-topbar-title">🎮 Mini Games</span>
    </div>
    <nav class="game-mode-tabs jugar-mode-tabs" aria-label="Seleccionar juego">
      <button type="button" class="game-mode-tab is-active" data-game-mode="cherry" aria-selected="true">🍒 Cereza</button>
      <button type="button" class="game-mode-tab" data-game-mode="spaceship" aria-selected="false">🍫 Cañón</button>
    </nav>
    <p id="game-mode-hint" class="game-hint jugar-mode-hint visually-hidden">Controla la cereza con ← → , el mouse o tocando la pantalla</p>
  </header>
  <main id="jugar-main" class="jugar-main">
`;

const overlays = `
  ${audioTag}
  ${musicToast}
  ${musicAutoplay}
  ${musicFloat}
  ${socialDock}
`;

const foot = `
  </main>
${overlays}
  <script src="../firebase-config.js?v=__APP_VERSION__"></script>
  <script src="../image-upload.js?v=__APP_VERSION__"></script>
  <script src="../ios-push-guide.js?v=__APP_VERSION__"></script>
  <script src="../music-playlist.js?v=__APP_VERSION__"></script>
  <script src="../save-manager.js?v=__APP_VERSION__"></script>
  <script src="../audio-manager.js?v=__APP_VERSION__"></script>
  <script src="../game-audit.js?v=__APP_VERSION__"></script>
  <script src="../love-words.js?v=__APP_VERSION__"></script>
  <script src="../game-engine.js?v=__APP_VERSION__"></script>
  <script src="../cannon-shot-system.js?v=__APP_VERSION__"></script>
  <script src="../spaceship-engine.js?v=__APP_VERSION__"></script>
  <script src="../game-meta.js?v=__APP_VERSION__"></script>
  <script src="../game-shop.js?v=__APP_VERSION__"></script>
  <script src="../daily-charge-mission.js?v=__APP_VERSION__"></script>
  <script src="../cannon-missions.js?v=__APP_VERSION__"></script>
  <script src="../spaceship-ui.js?v=__APP_VERSION__"></script>
  <script src="../script.js?v=__APP_VERSION__"></script>
  <script type="module" src="../couple-ui.js?v=__APP_VERSION__"></script>
  <script type="module" src="../friends-chat-ui.js?v=__APP_VERSION__"></script>
  <script type="module" src="../push-notifications.js?v=__APP_VERSION__"></script>
  <script type="module" src="jugar-boot.js?v=__APP_VERSION__"></script>
</body>
</html>
`;

const out = path.join(root, 'jugar', 'index.html');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, head + game + foot, 'utf8');
console.log('Built', out);
