/**
 * Loja do Chocolate — cosméticos comprados com 🍫 coletados.
 */
(function (global) {
  'use strict';

  const DEFAULT_EQUIPPED = {
    cherry: 'cherry_classic',
    theme: 'theme_classic',
    effect: 'effect_hearts',
    mascot: 'mascot_none',
    spaceship: 'ship_chocolate',
  };

  const FREE_IDS = new Set(['cherry_classic', 'theme_classic', 'effect_hearts', 'mascot_none', 'ship_chocolate']);

  const CATALOG = [
    { id: 'cherry_classic', cat: 'cherry', icon: '🍒', name: 'Cereza Clásica', desc: 'La cereza original.', price: 0 },
    { id: 'cherry_queen', cat: 'cherry', icon: '👑', name: 'Cereza Reina', desc: 'Brillo real.', price: 500, filter: 'hue-rotate(265deg) saturate(1.35) brightness(1.08)' },
    { id: 'cherry_flower', cat: 'cherry', icon: '🌸', name: 'Cereza Flor', desc: 'Suave como pétalo.', price: 800, filter: 'hue-rotate(300deg) saturate(1.2) brightness(1.12)' },
    { id: 'cherry_star', cat: 'cherry', icon: '⭐', name: 'Cereza Estelar', desc: 'Brilla en la noche.', price: 1200, filter: 'brightness(1.25) saturate(1.45) contrast(1.05)' },
    { id: 'cherry_winter', cat: 'cherry', icon: '❄️', name: 'Cereza Invierno', desc: 'Fresca y dulce.', price: 1500, filter: 'hue-rotate(185deg) saturate(0.85) brightness(1.18)' },

    { id: 'theme_classic', cat: 'theme', icon: '🌙', name: 'Noche Clásica', desc: 'Fondo romántico original.', price: 0 },
    { id: 'theme_sunset', cat: 'theme', icon: '🌅', name: 'Atardecer', desc: 'Cálido como un abrazo.', price: 400, theme: { bg: 'rgba(28, 12, 18, 0.42)', glow: 'rgba(255, 120, 80, 0.08)', star: 'rgba(255, 180, 140, 0.55)' } },
    { id: 'theme_garden', cat: 'theme', icon: '🌿', name: 'Jardín', desc: 'Verde y tranquilo.', price: 600, theme: { bg: 'rgba(10, 22, 14, 0.42)', glow: 'rgba(100, 200, 120, 0.08)', star: 'rgba(160, 230, 180, 0.5)' } },
    { id: 'theme_sakura', cat: 'theme', icon: '🌸', name: 'Sakura', desc: 'Pétalos rosados.', price: 800, theme: { bg: 'rgba(24, 12, 22, 0.4)', glow: 'rgba(255, 120, 180, 0.09)', star: 'rgba(255, 170, 210, 0.55)' } },
    { id: 'theme_galaxy', cat: 'theme', icon: '🌌', name: 'Galaxia', desc: 'Estrellas lejanas.', price: 1000, theme: { bg: 'rgba(8, 8, 28, 0.48)', glow: 'rgba(120, 80, 255, 0.1)', star: 'rgba(180, 160, 255, 0.6)' } },
    { id: 'theme_stars', cat: 'theme', icon: '✨', name: 'Lluvia de Estrellas', desc: 'Cielo profundo.', price: 1200, theme: { bg: 'rgba(6, 10, 24, 0.5)', glow: 'rgba(80, 160, 255, 0.09)', star: 'rgba(200, 220, 255, 0.65)' } },

    { id: 'effect_hearts', cat: 'effect', icon: '❤️', name: 'Corazones', desc: 'Al atrapar un chocolate.', price: 0, colors: ['#FF4FA3', '#FF80AB', '#FFD56A', '#FF6B9D'] },
    { id: 'effect_stars', cat: 'effect', icon: '✨', name: 'Estrellas', desc: 'Destellos mágicos.', price: 300, colors: ['#FFE082', '#FFF59D', '#FFECB3', '#FFD54F'] },
    { id: 'effect_petals', cat: 'effect', icon: '🌸', name: 'Pétalos', desc: 'Caen suavemente.', price: 500, colors: ['#FFB7D5', '#FFC8E0', '#FF9EC7', '#F8BBD0'] },
    { id: 'effect_cherries', cat: 'effect', icon: '🍒', name: 'Cerezas', desc: 'Mini cerezas dulces.', price: 600, colors: ['#E53935', '#FF5252', '#FF867C', '#FFAB91'] },
    { id: 'effect_choco', cat: 'effect', icon: '🍫', name: 'Chocolate', desc: 'Pedacitos de cacao.', price: 400, colors: ['#6D4C41', '#8D6E63', '#A1887F', '#BCAAA4'] },

    { id: 'mascot_none', cat: 'mascot', icon: '—', name: 'Sin mascota', desc: 'Solo tú y la cereza.', price: 0 },
    { id: 'mascot_bear_choco', cat: 'mascot', icon: '🧸', name: 'Osito Chocolate', desc: 'Te anima en la partida.', price: 700, emoji: '🧸' },
    { id: 'mascot_bear_cherry', cat: 'mascot', icon: '🍒', name: 'Osita Cereza', desc: 'Compañera kawaii.', price: 700, emoji: '🍒🧸' },
    { id: 'mascot_panda', cat: 'mascot', icon: '🐼', name: 'Panda', desc: 'Tierno y calmado.', price: 900, emoji: '🐼' },
    { id: 'mascot_plush', cat: 'mascot', icon: '🐻', name: 'Peluche', desc: 'Abrazo de peluche.', price: 1100, emoji: '🐻' },

    { id: 'letter_01', cat: 'album', icon: '💌', name: 'Carta #01', desc: '"Gracias por existir ❤️"', price: 200, letter: 'Gracias por existir ❤️' },
    { id: 'letter_02', cat: 'album', icon: '💌', name: 'Carta #02', desc: '"Eres la mejor parte de mí."', price: 350, letter: 'Eres la mejor parte de mí.' },
    { id: 'letter_03', cat: 'album', icon: '💌', name: 'Carta #03', desc: '"Nunca me cansaré de elegirte."', price: 450, letter: 'Nunca me cansaré de elegirte.' },
    { id: 'letter_04', cat: 'album', icon: '💌', name: 'Carta #04', desc: '"Mi corazón sonríe cuando pienso en ti."', price: 550, letter: 'Mi corazón sonríe cuando pienso en ti.' },
    { id: 'letter_05', cat: 'album', icon: '💌', name: 'Carta #05', desc: '"Contigo, hasta el silencio es bonito."', price: 650, letter: 'Contigo, hasta el silencio es bonito.' },
    { id: 'letter_06', cat: 'album', icon: '💌', name: 'Carta #06', desc: '"Te amo más de lo que caben las palabras."', price: 750, letter: 'Te amo más de lo que caben las palabras.' },

    { id: 'ring_love', cat: 'special', icon: '💍', name: 'Anillo del Amor', desc: 'Símbolo del amor eterno. Sin ventaja — solo amor.', price: 9999, badge: '💍' },

    { id: 'ship_chocolate', cat: 'spaceship', icon: '🚀', name: 'Cohete Clásico', desc: 'Nave genérica plateada.', price: 0 },
    { id: 'ship_cherry', cat: 'spaceship', icon: '🚀', name: 'Cohete Cereza', desc: 'Casco rojo romántico.', price: 0 },
    { id: 'ship_rosa', cat: 'spaceship', icon: '🚀', name: 'Cohete Rosa', desc: 'Rosa suave.', price: 350 },
    { id: 'ship_neon', cat: 'spaceship', icon: '🚀', name: 'Cohete Neon', desc: 'Brilla al disparar.', price: 600 },
    { id: 'ship_sakura', cat: 'spaceship', icon: '🚀', name: 'Cohete Sakura', desc: 'Pétalos dulces.', price: 850 },
    { id: 'ship_galaxy', cat: 'spaceship', icon: '🚀', name: 'Cohete Galaxia', desc: 'Entre las estrellas.', price: 1200 },
  ];

  const CAT_LABELS = {
    cherry: '🍒 Cereza',
    theme: '🌈 Temas',
    effect: '✨ Efectos',
    mascot: '🧸 Mascotas',
    album: '💌 Álbum',
    special: '💖 Especial',
    spaceship: '🍫 Cañones',
  };

  const ITEM_MAP = Object.fromEntries(CATALOG.map((i) => [i.id, i]));

  function defaultShopState() {
    return {
      wallet: 0,
      owned: [...FREE_IDS],
      equipped: { ...DEFAULT_EQUIPPED },
      ringOwned: false,
      migrated: false,
    };
  }

  function normalizeShop(raw, totalChocolates) {
    const base = defaultShopState();
    if (!raw || typeof raw !== 'object') {
      if (totalChocolates > 0) {
        base.wallet = totalChocolates;
        base.migrated = true;
      }
      return base;
    }
    const owned = Array.isArray(raw.owned) ? raw.owned.filter((id) => ITEM_MAP[id]) : [...FREE_IDS];
    for (const id of FREE_IDS) {
      if (!owned.includes(id)) owned.push(id);
    }
    const equipped = { ...DEFAULT_EQUIPPED, ...(raw.equipped || {}) };
    for (const key of Object.keys(DEFAULT_EQUIPPED)) {
      if (!ITEM_MAP[equipped[key]]) equipped[key] = DEFAULT_EQUIPPED[key];
    }
    let wallet = typeof raw.wallet === 'number' && raw.wallet >= 0 ? raw.wallet : 0;
    if (!raw.migrated && wallet === 0 && totalChocolates > 0) {
      wallet = totalChocolates;
    }
    return {
      wallet,
      owned,
      equipped,
      ringOwned: !!raw.ringOwned || owned.includes('ring_love'),
      migrated: true,
    };
  }

  const GameShop = {
    state: defaultShopState(),
    els: {},
    engine: null,
    _open: false,
    _tab: 'cherry',

    init(options) {
      this.els = options || {};
      this.engine = options.engine || null;
      const save = global.SaveManager.getSave();
      this.state = normalizeShop(save.shop, save.stats?.totalChocolates || 0);
      if (!save.shop?.migrated) this.persist();

      this.els.toggle?.addEventListener('click', () => this.togglePanel());
      this.els.backdrop?.addEventListener('click', () => this.closePanel());
      this.els.tabs?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-shop-tab]');
        if (!btn) return;
        this.setTab(btn.dataset.shopTab);
      });
      this.els.grid?.addEventListener('click', (e) => {
        const card = e.target.closest('[data-shop-id]');
        if (!card) return;
        const action = e.target.closest('[data-shop-action]')?.dataset.shopAction;
        const id = card.dataset.shopId;
        if (action === 'buy') this.buy(id);
        else if (action === 'equip') this.equip(id);
        else if (action === 'read') this.readLetter(id);
      });

      this.setTab('cherry');
      this.render();
      this.applyCosmetics();
    },

    persist() {
      global.SaveManager.updateSection('shop', {
        wallet: this.state.wallet,
        owned: this.state.owned.slice(),
        equipped: { ...this.state.equipped },
        ringOwned: this.state.ringOwned,
        migrated: true,
      });
    },

    getWallet() {
      return this.state.wallet;
    },

    addCoins(amount) {
      const n = Math.max(0, Math.floor(amount || 0));
      if (!n) return 0;
      this.state.wallet += n;
      this.persist();
      this.renderWallet();
      this._emitWalletChanged();
      return n;
    },

    spendCoins(amount) {
      const n = Math.max(0, Math.floor(amount || 0));
      if (!n) return { ok: false, reason: 'invalid', spent: 0 };
      if (this.state.wallet < n) {
        return { ok: false, reason: 'insufficient', spent: 0 };
      }
      this.state.wallet -= n;
      this.persist();
      this.renderWallet();
      this._emitWalletChanged();
      return { ok: true, reason: 'ok', spent: n };
    },

    _emitWalletChanged() {
      global.dispatchEvent(new CustomEvent('gameshop:wallet-changed', {
        detail: { wallet: this.state.wallet },
      }));
    },

    owns(id) {
      return this.state.owned.includes(id);
    },

    buy(id) {
      const item = ITEM_MAP[id];
      if (!item || this.owns(id)) return false;
      if (this.state.wallet < item.price) {
        this.toast('🍫 Chocolates insuficientes');
        return false;
      }
      this.state.wallet -= item.price;
      this.state.owned.push(id);
      if (id === 'ring_love') {
        this.state.ringOwned = true;
        this.toast('💍 Anillo del Amor — ¡para siempre!');
      } else {
        this.toast(`¡${item.name} desbloqueado!`);
      }
      if (item.cat !== 'album' && item.cat !== 'special') {
        this.equip(id, true);
      }
      this.persist();
      this.render();
      this.applyCosmetics();
      this._emitWalletChanged();
      global.GameMeta?.sounds?.playShop?.();
      return true;
    },

    equip(id, silent) {
      const item = ITEM_MAP[id];
      if (!item || !this.owns(id)) return false;
      if (item.cat === 'album' || item.cat === 'special') return false;
      this.state.equipped[item.cat] = id;
      this.persist();
      this.render();
      this.applyCosmetics();
      if (!silent) this.toast(`${item.name} equipado`);
      return true;
    },

    readLetter(id) {
      const item = ITEM_MAP[id];
      if (!item?.letter || !this.owns(id)) return;
      this.toast(item.letter, 4200);
    },

    applyCosmetics() {
      const eq = this.state.equipped;
      const cherry = ITEM_MAP[eq.cherry];
      const theme = ITEM_MAP[eq.theme];
      const effect = ITEM_MAP[eq.effect];
      const mascot = ITEM_MAP[eq.mascot];

      if (this.engine?.setCosmetics) {
        this.engine.setCosmetics({
          cherryFilter: cherry?.filter || 'none',
          theme: theme?.theme || null,
          catchColors: effect?.colors || null,
        });
      }

      if (global.SpaceshipUI?.applyShopCosmetics) {
        global.SpaceshipUI.applyShopCosmetics();
      }

      global.dispatchEvent(new CustomEvent('gameshop:cosmetics-applied'));

      const mascotEl = this.els.mascot;
      if (mascotEl) {
        const show = mascot?.emoji && eq.mascot !== 'mascot_none';
        mascotEl.textContent = show ? mascot.emoji : '';
        mascotEl.classList.toggle('hidden', !show);
        mascotEl.setAttribute('aria-hidden', show ? 'false' : 'true');
      }

      const ringEl = this.els.ringBadge;
      if (ringEl) {
        const show = this.state.ringOwned;
        ringEl.classList.toggle('hidden', !show);
        ringEl.setAttribute('aria-hidden', show ? 'false' : 'true');
      }
    },

    setTab(tab) {
      this._tab = tab;
      this.els.tabs?.querySelectorAll('[data-shop-tab]').forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.shopTab === tab);
      });
      this.renderGrid();
    },

    renderWallet() {
      const w = String(this.state.wallet);
      if (this.els.wallet) this.els.wallet.textContent = w;
      if (this.els.walletInline) this.els.walletInline.textContent = w;
    },

    renderGrid() {
      const grid = this.els.grid;
      if (!grid) return;
      const tab = this._tab;
      const items = CATALOG.filter((i) => i.cat === tab);
      grid.innerHTML = '';

      if (tab === 'album') {
        const ownedLetters = items.filter((i) => this.owns(i.id));
        if (!ownedLetters.length) {
          grid.innerHTML = '<p class="game-shop-empty">Compra cartas para llenar tu álbum de amor 💌</p>';
          return;
        }
      }

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const owned = this.owns(item.id);
        const equipped = this.state.equipped[item.cat] === item.id;
        const card = document.createElement('article');
        card.className = 'game-shop-card' + (owned ? ' is-owned' : '') + (equipped ? ' is-equipped' : '');
        card.dataset.shopId = item.id;

        let actions = '';
        if (!owned) {
          actions = `<button type="button" class="game-shop-btn" data-shop-action="buy">${item.price === 0 ? 'Gratis' : `${item.price} 🍫`}</button>`;
        } else if (item.cat === 'album') {
          actions = `<button type="button" class="game-shop-btn game-shop-btn-ghost" data-shop-action="read">Leer 💌</button>`;
        } else if (item.cat === 'special') {
          actions = '<span class="game-shop-owned-tag">💍 Tuyo para siempre</span>';
        } else if (!equipped) {
          actions = '<button type="button" class="game-shop-btn" data-shop-action="equip">Equipar</button>';
        } else {
          actions = '<span class="game-shop-equipped-tag">✓ Equipado</span>';
        }

        card.innerHTML = `
          <span class="game-shop-card-icon" aria-hidden="true">${item.icon}</span>
          <h4 class="game-shop-card-name">${item.name}</h4>
          <p class="game-shop-card-desc">${item.desc}</p>
          <div class="game-shop-card-actions">${actions}</div>
        `;
        grid.appendChild(card);
      }
    },

    render() {
      this.renderWallet();
      this.renderGrid();
    },

    toast(msg, ms = 2600) {
      const box = this.els.toast;
      if (!box) return;
      box.textContent = msg;
      box.classList.remove('hidden');
      box.classList.add('show');
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        box.classList.remove('show');
        setTimeout(() => box.classList.add('hidden'), 350);
      }, ms);
    },

    openPanel() {
      if (this._open) return;
      if (global.GameMeta?._openPanelId) {
        global.GameMeta.closePanel(global.GameMeta._openPanelId);
      }
      this._open = true;
      this.els.panel?.classList.remove('hidden');
      requestAnimationFrame(() => this.els.panel?.classList.add('is-open'));
      this.els.toggle?.setAttribute('aria-expanded', 'true');
      this.els.toggle?.classList.add('is-active');
      this._syncBrowse(true);
      this.render();
    },

    closePanel() {
      if (!this._open) return;
      this._open = false;
      this.els.panel?.classList.remove('is-open');
      this.els.toggle?.setAttribute('aria-expanded', 'false');
      this.els.toggle?.classList.remove('is-active');
      setTimeout(() => this.els.panel?.classList.add('hidden'), 280);
      this._syncBrowse(false);
    },

    togglePanel() {
      if (this._open) this.closePanel();
      else this.openPanel();
    },

    _syncBrowse(open) {
      document.body.classList.toggle('game-meta-panel-open', open);
      document.body.classList.toggle('game-shop-open', open);
      window.dispatchEvent(new CustomEvent('gamemeta:panel-change', {
        detail: { open, id: 'shop' },
      }));
    },
  };

  global.GameShop = GameShop;
})(typeof window !== 'undefined' ? window : globalThis);
