/**
 * Nossa Casa — casa ilustrada com cômodos únicos (mini-jogos).
 */
(function (global) {
  'use strict';

  const HS = global.HubShared || {};
  const daysUntil = HS.daysUntil || function () { return null; };
  const daysBetween = HS.daysBetween || function () { return null; };
  const GARDEN = HS.GARDEN_ACTIONS || {};
  const STAR_DEFS = HS.STAR_DEFS || [];

  const HOTSPOTS = [
    { id: 'correio', label: 'Buzón', art: 'mailbox', x: 4, y: 52 },
    { id: 'quarto', label: 'Dormitorio', art: 'bedroom', x: 18, y: 28 },
    { id: 'observatorio', label: 'Observatorio', art: 'observatory', x: 72, y: 8 },
    { id: 'jogos', label: 'Sala de Juegos', art: 'games', x: 8, y: 68 },
    { id: 'agenda', label: 'Agenda', art: 'calendar', x: 28, y: 62 },
    { id: 'jardim', label: 'Jardín', art: 'garden', x: 78, y: 58 },
    { id: 'radio', label: 'Radio', art: 'radio', x: 48, y: 68 },
    { id: 'album', label: 'Álbum', art: 'album', x: 62, y: 38 },
    { id: 'cozinha', label: 'Cocina', art: 'kitchen', x: 38, y: 72 },
    { id: 'cinema', label: 'Cine', art: 'cinema', x: 52, y: 28 },
    { id: 'biblioteca', label: 'Biblioteca', art: 'library', x: 82, y: 38 },
    { id: 'teddy', label: 'Habitación de Teddy', art: 'teddy', x: 88, y: 68 },
    { id: 'viagem', label: 'Sala de Viaje', art: 'travel', x: 58, y: 8 },
  ];

  const ART = {
    mailbox: '📬',
    bedroom: '🛏',
    games: '🎮',
    calendar: '📅',
    garden: '🌹',
    radio: '📻',
    album: '📸',
    kitchen: '🍳',
    cinema: '🎬',
    library: '📚',
    teddy: '🧸',
    observatory: '🌌',
    travel: '🗺',
  };

  const els = {};
  let currentRoom = null;
  let togetherInterval = null;

  function $(id) { return global.document.getElementById(id); }

  function esc(text) {
    const d = global.document.createElement('div');
    d.textContent = text ?? '';
    return d.innerHTML;
  }

  function hub() { return global.CoupleHub; }

  function state() { return hub()?.getState?.() || {}; }

  function meta() { return hub()?.getMeta?.() || {}; }

  function isNight() {
    const tz = state().settings?.chargeReminder?.timezone || 'America/New_York';
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(new Date()));
    return h >= 22 || h < 6;
  }

  async function presence() {
    if (global.__FILE_PROTOCOL__ || !global.CloudManager) return null;
    const cm = global.CloudManager;
    const room = cm.getCurrentRoom?.();
    if (!room) return { inRoom: false };
    const localId = cm.getLocalPlayer?.()?.id;
    const partner = room.players?.find((p) => p.id !== localId);
    const local = room.players?.find((p) => p.id === localId);
    return {
      inRoom: true,
      partnerName: partner?.name || 'Sophie',
      localName: local?.name || 'Roberto',
      partnerOnline: partner?.presence?.online === true,
      localOnline: local?.presence?.online !== false,
      together: partner?.presence?.online && local?.presence?.online && room.players?.length >= 2,
    };
  }

  function fireplaceHtml(level) {
    const flames = level <= 0 ? '·' : '🔥'.repeat(Math.min(level, 5));
    const warm = level >= 3 ? 'is-warm' : level >= 1 ? 'is-low' : 'is-cold';
    return `<div class="casa-hearth ${warm}" aria-label="Chimenea del amor">
      <div class="casa-hearth-glow"></div>
      <div class="casa-hearth-flames">${flames}</div>
      <p class="casa-hearth-label">${level >= 3 ? '¡Llama fuerte — aparecen todos los días!' : level >= 1 ? 'Llama encendida — cuídenla entrando juntos' : 'Enciendan la chimenea — entren juntos al hogar'}</p>
    </div>`;
  }

  function buildExterior() {
    const level = hub()?.getFireplaceLevel?.() || 0;
    const unread = countUnread();
    const roomCards = HOTSPOTS.map((h) => {
      const badge = h.id === 'correio' && unread > 0
        ? `<span class="casa-room-badge">${unread > 9 ? '9+' : unread}</span>` : '';
      return `<button type="button" class="casa-room" data-room="${h.id}" aria-label="Entrar: ${esc(h.label)}">
        <span class="casa-room-emoji" aria-hidden="true">${ART[h.art] || '🏠'}</span>
        <span class="casa-room-label">${esc(h.label)}</span>
        ${badge}
      </button>`;
    }).join('');

    return `<div class="casa-exterior" id="casa-exterior">
      <div class="casa-hero">
        <div class="casa-sky ${isNight() ? 'is-night' : ''}"></div>
        <div class="casa-hill"></div>
        <div class="casa-house-body">
          <div class="casa-roof-shape"></div>
          <div class="casa-walls"></div>
          ${fireplaceHtml(level)}
        </div>
      </div>
      <div class="casa-rooms-wrap">
        <p class="casa-rooms-heading">Elige un cuarto</p>
        <div class="casa-rooms-grid">${roomCards}</div>
        <p class="casa-enter-hint">Toca un cuarto para entrar</p>
      </div>
    </div>
    <div class="casa-interior hidden" id="casa-interior">
      <header class="casa-room-header">
        <button type="button" class="casa-back-btn" id="casa-back-btn">← Salir del cuarto</button>
        <h3 id="casa-room-title" class="casa-room-title"></h3>
      </header>
      <div id="casa-room-body" class="casa-room-body"></div>
    </div>`;
  }

  function countUnread() {
    const letters = hub()?.getVisibleLetters?.(state().letters) || [];
    const readAt = meta().lettersReadAt || 0;
    return letters.filter((l) => (l.createdAt || 0) > readAt).length;
  }

  function markRead() {
    SaveManager.updateSection('nossaCasa', { lettersReadAt: Date.now() });
  }

  function enterRoom(id) {
    currentRoom = id;
    els.app?.classList.add('is-inside');
    global.document.body.classList.add('casa-inside');
    els.exterior?.classList.add('hidden');
    els.interior?.classList.remove('hidden');
    els.mascotWidget?.classList.add('hidden');
    const spot = HOTSPOTS.find((h) => h.id === id);
    if (els.roomTitle) els.roomTitle.textContent = spot?.label || id;
    renderRoom(id);
    els.interior?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function exitRoom() {
    currentRoom = null;
    els.app?.classList.remove('is-inside');
    global.document.body.classList.remove('casa-inside');
    els.exterior?.classList.remove('hidden');
    els.interior?.classList.add('hidden');
    els.mascotWidget?.classList.remove('hidden');
    if (togetherInterval) { clearInterval(togetherInterval); togetherInterval = null; }
    refreshExterior();
  }

  function refreshExterior() {
    if (!els.scene || currentRoom) return;
    els.scene.innerHTML = buildExterior();
    cacheSceneRefs();
    bindExterior();
  }

  function cacheSceneRefs() {
    els.exterior = $('casa-exterior');
    els.interior = $('casa-interior');
    els.roomBody = $('casa-room-body');
    els.roomTitle = $('casa-room-title');
  }

  function bindExterior() {
    els.exterior?.querySelectorAll('[data-room]').forEach((btn) => {
      btn.addEventListener('click', () => enterRoom(btn.dataset.room));
    });
    $('casa-back-btn')?.addEventListener('click', exitRoom);
  }

  /* —— Cômodos —— */

  function renderRoom(id) {
    if (!els.roomBody) return;
    const renderers = {
      correio: roomCorreio,
      quarto: roomQuarto,
      jogos: roomJogos,
      agenda: roomAgenda,
      jardim: roomJardim,
      radio: roomRadio,
      album: roomAlbum,
      cozinha: roomCozinha,
      cinema: roomCinema,
      biblioteca: roomBiblioteca,
      teddy: roomTeddy,
      observatorio: roomObservatorio,
      viagem: roomViagem,
    };
    (renderers[id] || roomSoon)(els.roomBody, id);
  }

  function roomCorreio(body) {
    markRead();
    const st = state();
    const visible = hub()?.getVisibleLetters?.(st.letters) || [];
    const pending = (st.letters || []).filter((l) => {
      if (l.type === 'scheduled' && l.deliverDate) {
        return new Date(l.deliverDate + 'T08:00:00').getTime() > Date.now();
      }
      if (l.type === 'capsule' && l.openAfter) {
        return new Date(l.openAfter + 'T00:00:00').getTime() > Date.now();
      }
      return false;
    });

    const inbox = visible.map((l) => {
      const reacts = Object.values(l.reactions || {}).join(' ');
      const photoSrc = global.ImageUpload?.safeSrc?.(l.photoUrl) || '';
      const photo = photoSrc ? `<img src="${esc(photoSrc)}" alt="" class="casa-mail-photo">` : '';
      const audio = l.audioUrl ? `<p class="casa-mail-audio">🎙️ Audio adjunto</p>` : '';
      return `<article class="casa-mail-card" data-letter-id="${esc(l.id)}">
        <header><strong>${esc(l.fromName)}</strong><time>${new Date(l.createdAt).toLocaleString('es')}</time></header>
        <p>${esc(l.text)}</p>${photo}${audio}
        <div class="casa-mail-reactions">${reacts ? `<span>${reacts}</span>` : ''}
          <button type="button" data-react="❤️">❤️</button>
          <button type="button" data-react="😂">😂</button>
          <button type="button" data-react="🥹">🥹</button>
        </div>
      </article>`;
    }).join('') || '<p class="casa-empty">¡Buzón vacío — escribe la primera carta!</p>';

    const scheduled = pending.map((l) => {
      const when = l.type === 'capsule' ? `Abrir en ${l.openAfter}` : `Entregar el ${l.deliverDate}`;
      return `<li>🔒 ${esc(l.text?.slice(0, 40) || '…')} — <em>${esc(when)}</em></li>`;
    }).join('');

    body.innerHTML = `<div class="casa-room-theme theme-mail">
      <div class="casa-mailbox-art">📬</div>
      <nav class="casa-subnav">
        <button type="button" class="is-active" data-mail-tab="inbox">Bandeja de entrada</button>
        <button type="button" data-mail-tab="write">Escribir</button>
        <button type="button" data-mail-tab="schedule">Programar</button>
        <button type="button" data-mail-tab="capsule">Cápsula</button>
      </nav>
      <div class="casa-mail-panel" data-mail-panel="inbox">
        <div class="casa-mail-list">${inbox}</div>
        ${pending.length ? `<ul class="casa-mail-pending"><li><strong>En espera:</strong></li>${scheduled}</ul>` : ''}
      </div>
      <form class="casa-mail-panel hidden" data-mail-panel="write">
        <textarea name="text" rows="4" maxlength="500" placeholder="Tu cartita…" required></textarea>
        <label class="casa-file">📷 Foto <input type="file" name="photo" accept="image/*"></label>
        <p class="casa-soon-note">🎙️ Audios — mantén pulsado para grabar (próximamente)</p>
        <button type="submit" class="couple-btn couple-btn-primary">Enviar 💌</button>
      </form>
      <form class="casa-mail-panel hidden" data-mail-panel="schedule">
        <textarea name="text" rows="3" maxlength="500" placeholder="Carta para el futuro…" required></textarea>
        <label>Entregar el <input type="date" name="deliverDate" required></label>
        <button type="submit" class="couple-btn couple-btn-primary">Programar 📅</button>
      </form>
      <form class="casa-mail-panel hidden" data-mail-panel="capsule">
        <textarea name="text" rows="3" maxlength="500" placeholder="Mensaje para abrir en el futuro…" required></textarea>
        <label>Abrir después del <input type="date" name="openAfter" required></label>
        <button type="submit" class="couple-btn couple-btn-primary">Sellar cápsula ⏳</button>
      </form>
    </div>`;

    body.querySelector('.casa-subnav')?.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-mail-tab]');
      if (!tab) return;
      body.querySelectorAll('[data-mail-tab]').forEach((b) => b.classList.toggle('is-active', b === tab));
      body.querySelectorAll('[data-mail-panel]').forEach((p) => {
        p.classList.toggle('hidden', p.dataset.mailPanel !== tab.dataset.mailTab);
      });
    });

    body.querySelector('[data-mail-panel="write"]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      let photoUrl = '';
      const raw = fd.get('photo');
      const file = raw instanceof File && raw.size ? raw : null;
      if (file) {
        const prepared = await global.ImageUpload?.prepareImageFromFile?.(file);
        if (!prepared?.ok) {
          hub()?.showToast?.(global.ImageUpload?.reasonMessage?.(prepared?.reason) || 'Error con la foto');
          return;
        }
        photoUrl = prepared.dataUrl;
      }
      await hub()?.addLetterExtended?.({ text: fd.get('text'), type: 'inbox', photoUrl });
      hub()?.showToast?.('Carta enviada 💌');
      renderRoom('correio');
    });

    body.querySelector('[data-mail-panel="schedule"]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await hub()?.addLetterExtended?.({ text: fd.get('text'), type: 'scheduled', deliverDate: fd.get('deliverDate') });
      hub()?.showToast?.('Carta programada 📅');
      renderRoom('correio');
    });

    body.querySelector('[data-mail-panel="capsule"]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await hub()?.addLetterExtended?.({ text: fd.get('text'), type: 'capsule', openAfter: fd.get('openAfter') });
      hub()?.showToast?.('Cápsula sellada ⏳');
      renderRoom('correio');
    });

    body.querySelector('.casa-mail-list')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-react]');
      if (!btn) return;
      const card = btn.closest('[data-letter-id]');
      hub()?.reactToLetter?.(card.dataset.letterId, btn.dataset.react);
      renderRoom('correio');
    });
  }

  async function roomQuarto(body) {
    const pres = await presence();
    const nc = meta();
    const night = isNight();
    const together = pres?.together;
    let togetherHtml = '';

    if (together) {
      const since = nc.togetherSince || Date.now();
      if (!nc.togetherSince) SaveManager.updateSection('nossaCasa', { togetherSince: since });
      const elapsed = Date.now() - since;
      const mins = Math.floor(elapsed / 60000);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      togetherHtml = `<p class="casa-together-time">Tiempo en línea juntos: <strong>${h}h ${String(m).padStart(2, '0')}min</strong></p>`;
      hub()?.logGardenAction?.('together');
    } else {
      SaveManager.updateSection('nossaCasa', { togetherSince: null });
    }

    body.innerHTML = `<div class="casa-room-theme theme-bedroom ${night ? 'is-night' : ''}">
      <div class="casa-bedroom-art">${night ? '🌙' : '🛏'}</div>
      <h4>${night ? 'Luces apagadas…' : 'Dormitorio'}</h4>
      ${pres?.inRoom ? `
        <div class="casa-presence">
          <p>${esc(pres.localName)} ${pres.localOnline ? '🟢' : '🔴'}</p>
          <p>${esc(pres.partnerName)} ${pres.partnerOnline ? '🟢' : '🔴'}</p>
        </div>
        ${together ? '<p class="casa-together-msg">❤️ Los dos están juntos ahora.</p>' + togetherHtml : '<p class="casa-wait-msg">💤 Esperando que entre el otro…</p>'}
      ` : '<p class="casa-empty">Entren en la <strong>sala del casal</strong> (Mini Games) para ver presencia en vivo.</p>'}
      <ul class="casa-last-activity">
        <li>🎵 Última canción: ${esc(nc.lastMusic || '—')}</li>
        <li>🎮 Último juego: ${esc(nc.lastGame || '—')}</li>
        <li>💌 Último mensaje: ${esc(nc.lastMessage || '—')}</li>
      </ul>
    </div>`;

    if (together && !togetherInterval) {
      togetherInterval = setInterval(() => { if (currentRoom === 'quarto') roomQuarto(body); }, 60000);
    }
  }

  async function roomJogos(body) {
    const rank = global.CloudManager?.getCoupleRanking ? await global.CloudManager.getCoupleRanking() : null;
    const rows = rank?.success ? rank.ranking : [];
    const list = rows.length ? rows.map((r) =>
      `<li><strong>${esc(r.name)}</strong> <span>${r.bestScore || 0} pts</span></li>`
    ).join('') : '<li>Entren en la sala online para ranking en vivo</li>';

    body.innerHTML = `<div class="casa-room-theme theme-games">
      <div class="casa-games-art">🎮</div>
      <h4>🏆 Última partida / Ranking</h4>
      <ol class="casa-rank-list">${list}</ol>
      <p class="casa-challenge">Desafío: ¿quién llega primero a <strong>10.000</strong> puntos? 🏅</p>
      <button type="button" class="couple-btn couple-btn-primary" id="casa-go-games">Entrar a la sala de juegos</button>
    </div>`;
    body.querySelector('#casa-go-games')?.addEventListener('click', () => {
      $('section-game')?.scrollIntoView({ behavior: 'smooth' });
      exitRoom();
    });
  }

  function roomAgenda(body) {
    const tasks = [...(state().tasks || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    const today = new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
    const list = tasks.map((t) => {
      const pri = t.priority === 'high' ? '🔴' : t.priority === 'low' ? '🟢' : '🟡';
      return `<li class="casa-task${t.done ? ' is-done' : ''}" data-task-id="${esc(t.id)}">
        <label><input type="checkbox" ${t.done ? 'checked' : ''}> ${pri} ${esc(t.emoji || '')} ${esc(t.text)}</label>
      </li>`;
    }).join('') || '<li class="casa-empty">Ninguna tarea hoy</li>';

    body.innerHTML = `<div class="casa-room-theme theme-agenda">
      <div class="casa-agenda-art">📅</div>
      <h4>Hoy — ${esc(today)}</h4>
      <ul class="casa-task-list">${list}</ul>
      <form id="casa-task-form" class="casa-inline-form">
        <select name="priority"><option value="normal">🟡 Normal</option><option value="high">🔴 Urgente</option><option value="low">🟢 Después</option></select>
        <input name="text" placeholder="Nueva tarea…" maxlength="80" required>
        <button type="submit" class="couple-btn couple-btn-small">+</button>
      </form>
    </div>`;

    body.querySelector('.casa-task-list')?.addEventListener('change', async (e) => {
      if (e.target.type !== 'checkbox') return;
      await hub()?.toggleTask?.(e.target.closest('[data-task-id]').dataset.taskId, e.target.checked);
      roomAgenda(body);
    });

    body.querySelector('#casa-task-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await hub()?.addTask?.(fd.get('text'), '✓', { priority: fd.get('priority') });
      roomAgenda(body);
    });
  }

  function roomJardim(body) {
    const log = meta().gardenLog || [];
    const flowers = log.slice(-80).map((g) => `<span class="casa-flower" title="${esc(g.label)}">${g.emoji}</span>`).join('');
    const count = log.length;
    const stage = count >= 100 ? 'Jardín enorme 🌺' : count >= 50 ? 'Jardín florecido 🌸' : count >= 20 ? 'Creciendo 🌿' : 'Empezando a florecer 🌱';

    body.innerHTML = `<div class="casa-room-theme theme-garden">
      <div class="casa-garden-art">🌹</div>
      <h4>${stage}</h4>
      <p class="casa-garden-count">${count} flores · cada acción de ustedes planta una flor</p>
      <div class="casa-garden-bed">${flowers || '<span class="casa-empty">¡Hagan cosas juntos para florecer!</span>'}</div>
      <ul class="casa-garden-legend">${Object.keys(GARDEN).map((k) => `<li>${GARDEN[k].emoji} ${GARDEN[k].label}</li>`).join('')}</ul>
    </div>`;
  }

  function roomRadio(body) {
    const nc = meta();
    const title = global.document.getElementById('music-track-title')?.textContent || nc.lastMusic || 'Nuestra canción';
    body.innerHTML = `<div class="casa-room-theme theme-radio">
      <div class="casa-radio-art">📻</div>
      <h4>🎵 Sonando ahora</h4>
      <p class="casa-now-playing">${esc(title)}</p>
      <p class="casa-radio-hint">🎧 Entren en la misma canción — abran el radio abajo.</p>
      <button type="button" class="couple-btn couple-btn-primary" id="casa-go-music">Abrir radio</button>
    </div>`;
    body.querySelector('#casa-go-music')?.addEventListener('click', () => {
      $('section-music')?.scrollIntoView({ behavior: 'smooth' });
      hub()?.logGardenAction?.('music');
      SaveManager.updateSection('nossaCasa', { lastMusic: title });
      exitRoom();
    });
  }

  function roomAlbum(body) {
    const memories = state().memories || [];
    const byYear = {};
    memories.forEach((m) => {
      const y = new Date(m.createdAt || Date.now()).getFullYear();
      if (!byYear[y]) byYear[y] = [];
      byYear[y].push(m);
    });
    const years = Object.keys(byYear).sort((a, b) => b - a);
    const html = years.length ? years.map((y) => {
      const items = byYear[y].map((m) =>
        `<figure class="casa-album-item">${global.ImageUpload?.safeSrc?.(m.imageUrl) ? `<img src="${esc(global.ImageUpload.safeSrc(m.imageUrl))}" alt="">` : '<div class="casa-album-ph">📷</div>'}
        <figcaption>${esc(m.title)}</figcaption></figure>`
      ).join('');
      return `<section class="casa-album-year"><h5>${y}</h5><div class="casa-album-grid">${items}</div></section>`;
    }).join('') : '<p class="casa-empty">Ninguna foto todavía</p>';

    body.innerHTML = `<div class="casa-room-theme theme-album">
      <div class="casa-album-art">📸</div>
      <h4>Álbum de recuerdos</h4>
      ${html}
      <form id="casa-album-form" class="casa-stack-form">
        <input name="title" placeholder="Título (Playa, Cine…)" maxlength="60">
        <input name="url" type="url" placeholder="URL de la foto">
        <button type="submit" class="couple-btn couple-btn-small">Añadir foto</button>
      </form>
    </div>`;

    body.querySelector('#casa-album-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      await hub()?.addMemory?.(fd.get('title') || 'Recuerdo', fd.get('url') || '');
      roomAlbum(body);
    });
  }

  function roomCozinha(body) {
    const recipes = meta().recipes || [];
    const list = recipes.map((r) =>
      `<li><label><input type="checkbox" data-recipe="${esc(r.id)}" ${r.done ? 'checked' : ''}> ${esc(r.text)}</label></li>`
    ).join('');
    body.innerHTML = `<div class="casa-room-theme theme-kitchen">
      <div class="casa-kitchen-art">🍳</div>
      <h4>Recetas que queremos hacer</h4>
      <ul class="casa-recipe-list">${list}</ul>
    </div>`;
    body.querySelector('.casa-recipe-list')?.addEventListener('change', (e) => {
      if (e.target.type !== 'checkbox') return;
      const nc = meta();
      const recipes = (nc.recipes || []).map((r) =>
        r.id === e.target.dataset.recipe ? { ...r, done: e.target.checked } : r
      );
      SaveManager.updateSection('nossaCasa', { recipes });
    });
  }

  function roomCinema(body) {
    const movies = meta().movies || [];
    const list = movies.map((m) => {
      const stars = '★'.repeat(m.rating || 0) + '☆'.repeat(5 - (m.rating || 0));
      return `<li class="casa-movie${m.watched ? ' is-watched' : ''}">
        <label><input type="checkbox" data-movie="${esc(m.id)}" ${m.watched ? 'checked' : ''}> ${esc(m.title)}</label>
        <span class="casa-stars">${stars}</span>
      </li>`;
    }).join('');
    body.innerHTML = `<div class="casa-room-theme theme-cinema">
      <div class="casa-cinema-art">🎬</div>
      <h4>Lista de películas</h4>
      <ul class="casa-movie-list">${list}</ul>
    </div>`;
    body.querySelector('.casa-movie-list')?.addEventListener('change', (e) => {
      if (e.target.type !== 'checkbox') return;
      const movies = (meta().movies || []).map((m) =>
        m.id === e.target.dataset.movie ? { ...m, watched: e.target.checked } : m
      );
      SaveManager.updateSection('nossaCasa', { movies });
    });
  }

  function roomBiblioteca(body) {
    const letters = hub()?.getVisibleLetters?.(state().letters) || [];
    const fav = letters.slice(0, 5).map((l) => `<blockquote>"${esc(l.text?.slice(0, 120))}" — ${esc(l.fromName)}</blockquote>`).join('');
    body.innerHTML = `<div class="casa-room-theme theme-library">
      <div class="casa-library-art">📚</div>
      <h4>Frases favoritas de las cartas</h4>
      ${fav || '<p class="casa-empty">Escriban cartas en el buzón…</p>'}
    </div>`;
  }

  function roomTeddy(body) {
    body.innerHTML = `<div class="casa-room-theme theme-teddy">
      <div class="casa-teddy-art">🧸</div>
      <h4>Habitación de Teddy</h4>
      <p>El osito vive aquí. Próximamente: cama, juguetes, ropa y sombrero con 🍫.</p>
      <div class="casa-teddy-items"><span>🛏</span><span>🎾</span><span>🎩</span><span>👕</span></div>
    </div>`;
  }

  function roomObservatorio(body) {
    SaveManager.init();
    const save = SaveManager.getSave();
    const st = state();
    const ctx = {
      letters: st.letters,
      stats: save.stats,
      daysTogether: daysBetween(st.settings?.relationshipStart),
      gardenCount: (meta().gardenLog || []).length,
    };
    const stars = STAR_DEFS.filter((s) => {
      if (s.id === 'first_letter') return (ctx.letters?.length || 0) >= 1;
      if (s.id === 'games_10') return ((save.stats?.cannonGamesPlayed || 0) + (save.stats?.totalGames || 0)) >= 10;
      if (s.id === 'games_100') return ((save.stats?.cannonGamesPlayed || 0) + (save.stats?.totalGames || 0)) >= 100;
      if (s.id === 'choco_1000') return (save.stats?.totalChocolates || 0) >= 1000;
      if (s.id === 'days_100') return (ctx.daysTogether || 0) >= 100;
      if (s.id === 'days_365') return (ctx.daysTogether || 0) >= 365;
      if (s.id === 'garden_50') return ctx.gardenCount >= 50;
      return false;
    });
    const sky = stars.length ? stars.map((s) => `<span class="casa-star" title="${esc(s.label)}">${s.emoji}</span>`).join('')
      : '<p class="casa-empty">Los logros se convierten en estrellas en el cielo ⭐</p>';
    body.innerHTML = `<div class="casa-room-theme theme-observatory">
      <div class="casa-observatory-art">🌌</div>
      <h4>Constelación del casal</h4>
      <div class="casa-night-sky">${sky}</div>
      <ul class="casa-star-legend">${STAR_DEFS.map((s) => `<li>${s.emoji} ${esc(s.label)}</li>`).join('')}</ul>
    </div>`;
  }

  function roomViagem(body) {
    const until = daysUntil(state().settings?.nextMeetingDate);
    const checklist = meta().travelChecklist || [];
    body.innerHTML = `<div class="casa-room-theme theme-travel">
      <div class="casa-travel-art">🗺</div>
      <div class="casa-travel-map">🇧🇷 Roberto <span>✈️</span> 🇺🇸 Sophie</div>
      <p class="casa-travel-count">${until !== null && until >= 0 ? (until === 0 ? '¡Hoy es el día!' : `Faltan ${until} días ❤️`) : 'Marquen la fecha del encuentro'}</p>
      <form id="casa-travel-form" class="casa-inline-form">
        <input name="item" placeholder="Lista del viaje…" maxlength="60">
        <button type="submit" class="couple-btn couple-btn-small">+</button>
      </form>
      <ul id="casa-travel-list" class="casa-travel-list">${checklist.map((c, i) =>
        `<li><label><input type="checkbox" data-idx="${i}" ${c.done ? 'checked' : ''}> ${esc(c.text)}</label></li>`
      ).join('')}</ul>
      <button type="button" class="couple-btn couple-btn-small" id="casa-set-meeting">Definir fecha del encuentro</button>
    </div>`;

    body.querySelector('#casa-travel-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const list = (meta().travelChecklist || []).concat([{ text: fd.get('item'), done: false }]);
      SaveManager.updateSection('nossaCasa', { travelChecklist: list });
      roomViagem(body);
    });

    body.querySelector('#casa-travel-list')?.addEventListener('change', (e) => {
      if (e.target.type !== 'checkbox') return;
      const list = (meta().travelChecklist || []).map((c, i) =>
        i === Number(e.target.dataset.idx) ? { ...c, done: e.target.checked } : c
      );
      SaveManager.updateSection('nossaCasa', { travelChecklist: list });
    });

    body.querySelector('#casa-set-meeting')?.addEventListener('click', () => {
      const d = global.prompt('Fecha del próximo encuentro (AAAA-MM-DD):', state().settings?.nextMeetingDate || '');
      if (d) hub()?.persistSettings?.({ nextMeetingDate: d });
      roomViagem(body);
    });
  }

  function roomSoon(body, id) {
    body.innerHTML = `<div class="casa-room-theme"><p class="casa-empty">Cuarto en construcción…</p></div>`;
  }


  /* —— Mascote flutuante —— */

  async function refreshMascot() {
    if (!els.mascotBubble) return;
    const pres = await presence();
    const unread = countUnread();
    if (unread) {
      els.mascotEmoji.textContent = '💌';
      els.mascotBubble.textContent = `${unread} carta(s) nueva(s)!`;
      return;
    }
    if (pres?.together) {
      els.mascotEmoji.textContent = '😍';
      els.mascotBubble.textContent = '¡Los dos están en línea en el dormitorio!';
      return;
    }
    if (isNight()) {
      els.mascotEmoji.textContent = '🌙';
      els.mascotBubble.textContent = 'Buenas noches… el hogar está tranquilo.';
      return;
    }
    els.mascotEmoji.textContent = '🐻';
    els.mascotBubble.textContent = 'Explora la casa — ¡cada cuarto es especial!';
  }

  function logActivity(kind, name) {
    const partial = {};
    if (kind === 'letter') partial.lastMessage = `${name} envió una carta`;
    SaveManager.updateSection('nossaCasa', partial);
  }

  function init() {
    els.app = $('nossa-casa-app');
    els.scene = $('nossa-casa-scene');
    els.mascotWidget = $('casa-mascot-widget');
    els.mascotEmoji = $('casa-mascot-emoji');
    els.mascotBubble = $('casa-mascot-bubble');
    if (!els.scene) return;

    els.scene.innerHTML = `<div id="nossa-casa-app" class="casa-app">${buildExterior()}</div>`;
    els.app = els.scene.querySelector('.casa-app');
    cacheSceneRefs();
    bindExterior();

    global.addEventListener('hub:updated', () => {
      if (!currentRoom) refreshExterior();
      else renderRoom(currentRoom);
      refreshMascot();
    });
    global.addEventListener('couple:roomChanged', refreshMascot);
    global.addEventListener('cherrygame:activate', () => {
      hub()?.logGardenAction?.('game');
      SaveManager.updateSection('nossaCasa', { lastGame: 'Cereza 🍒' });
    });
    global.addEventListener('spaceship:activate', () => {
      hub()?.logGardenAction?.('game');
      SaveManager.updateSection('nossaCasa', { lastGame: 'Cañón 🍫' });
    });

    els.mascotWidget?.addEventListener('click', () => {
      $('section-couple-hub')?.scrollIntoView({ behavior: 'smooth' });
      if (currentRoom) exitRoom();
    });

    const main = $('main-content');
    const obs = new MutationObserver(() => {
      if (main && !main.classList.contains('hidden')) els.mascotWidget?.classList.remove('hidden');
      else els.mascotWidget?.classList.add('hidden');
    });
    if (main) obs.observe(main, { attributes: true, attributeFilter: ['class'] });
    if (main && !main.classList.contains('hidden')) els.mascotWidget?.classList.remove('hidden');

    refreshMascot();
  }

  global.NossaCasa = { refresh: refreshExterior, logActivity, enterRoom, exitRoom };

  if (global.document.readyState === 'loading') {
    global.document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
