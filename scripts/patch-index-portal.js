const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
const lines = fs.readFileSync(indexPath, 'utf8').split(/\r?\n/);

const portal = `    <!-- Mini Games — portal para /jugar/ -->
    <section class="section glass" id="section-game-portal">
      <h2>🎮 Mini Games</h2>
      <p class="portal-game-lead">El juego en pareja vive en su propia pantalla — más limpio y a pantalla completa.</p>
      <div class="portal-game-actions">
        <a href="jugar/" class="couple-btn couple-btn-primary portal-jugar-btn">Abrir juegos →</a>
      </div>
      <p class="portal-game-hint">👥 Amigos, @usuario y convites de sala siguen aquí abajo. Cuando llegue un convite, pulsa <strong>Entrar</strong> y irás al juego.</p>
    </section>`;

const before = lines.slice(0, 345);
const after = lines.slice(712);
const out = [...before, portal, ...after].join('\n');
fs.writeFileSync(indexPath, out, 'utf8');
console.log('index.html updated');
