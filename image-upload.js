/**
 * Upload de imagens — comprime e bloqueia caminhos locais (file://).
 */
(function (global) {
  'use strict';

  const MAX_BYTES = 280000;
  const MAX_DIM = 1400;

  function isBlockedSrc(url) {
    if (!url || typeof url !== 'string') return true;
    const t = url.trim().toLowerCase();
    return (
      t.startsWith('file:') ||
      t.startsWith('c:\\') ||
      t.startsWith('c:/') ||
      t.startsWith('\\\\')
    );
  }

  function normalizeImageUrl(url) {
    if (!url || typeof url !== 'string') return '';
    const t = url.trim();
    if (isBlockedSrc(t)) return '';
    if (t.startsWith('data:image/')) return t;
    if (/^https?:\/\//i.test(t)) return t;
    return '';
  }

  function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = () => reject(new Error('read_failed'));
      r.readAsDataURL(blob);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('decode_failed'));
      img.src = src;
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });
  }

  async function compressToDataUrl(dataUrl, maxBytes) {
    const img = await loadImage(dataUrl);
    let w = img.naturalWidth || img.width || 1;
    let h = img.naturalHeight || img.height || 1;
    let scale = Math.min(1, MAX_DIM / Math.max(w, h));
    let quality = 0.88;

    for (let attempt = 0; attempt < 12; attempt++) {
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      const blob = await canvasToBlob(canvas, quality);
      if (!blob) break;
      if (blob.size <= maxBytes) return readAsDataUrl(blob);
      if (quality > 0.4) {
        quality -= 0.08;
      } else {
        scale *= 0.82;
        quality = 0.82;
      }
    }
    throw new Error('too_large');
  }

  async function prepareImageFromFile(file) {
    if (!(file instanceof File) || !file.size) {
      return { ok: false, reason: 'no_file' };
    }
    if (!file.type.startsWith('image/')) {
      return { ok: false, reason: 'not_image' };
    }

    try {
      let dataUrl = await readAsDataUrl(file);
      const approxBytes = Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
      if (approxBytes > MAX_BYTES) {
        dataUrl = await compressToDataUrl(dataUrl, MAX_BYTES);
      }
      return { ok: true, dataUrl };
    } catch (err) {
      return { ok: false, reason: err?.message === 'too_large' ? 'too_large' : 'process_failed' };
    }
  }

  const CROP_VIEWPORT = 280;
  const CROP_OUTPUT = 512;

  function computeCoverScale(iw, ih, viewport) {
    return Math.max(viewport / iw, viewport / ih);
  }

  function clampPan(iw, ih, scale, panX, panY, viewport) {
    const dw = iw * scale;
    const dh = ih * scale;
    const maxPanX = Math.max(0, (dw - viewport) / 2);
    const maxPanY = Math.max(0, (dh - viewport) / 2);
    return {
      panX: Math.max(-maxPanX, Math.min(maxPanX, panX)),
      panY: Math.max(-maxPanY, Math.min(maxPanY, panY)),
    };
  }

  function drawCropPreview(ctx, img, scale, panX, panY, viewport) {
    ctx.clearRect(0, 0, viewport, viewport);
    ctx.save();
    ctx.beginPath();
    ctx.arc(viewport / 2, viewport / 2, viewport / 2, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(viewport / 2 + panX, viewport / 2 + panY);
    ctx.drawImage(
      img,
      (-img.naturalWidth * scale) / 2,
      (-img.naturalHeight * scale) / 2,
      img.naturalWidth * scale,
      img.naturalHeight * scale
    );
    ctx.restore();
  }

  function exportSquareCrop(img, scale, panX, panY, viewport, outputSize) {
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const left = viewport / 2 + panX - (iw * scale) / 2;
    const top = viewport / 2 + panY - (ih * scale) / 2;
    let srcX = (0 - left) / scale;
    let srcY = (0 - top) / scale;
    let srcW = viewport / scale;
    let srcH = viewport / scale;
    srcX = Math.max(0, Math.min(iw - 1, srcX));
    srcY = Math.max(0, Math.min(ih - 1, srcY));
    srcW = Math.min(srcW, iw - srcX);
    srcH = Math.min(srcH, ih - srcY);

    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outputSize, outputSize);
    return canvas.toDataURL('image/jpeg', 0.88);
  }

  /**
   * Abre recorte circular — arrastar + zoom antes de guardar.
   * @param {File} file
   * @param {{ title?: string, hint?: string }} [opts]
   */
  function openImageCropper(file, opts = {}) {
    return new Promise((resolve) => {
      if (!(file instanceof File) || !file.size) {
        resolve({ ok: false, reason: 'no_file' });
        return;
      }
      if (!file.type.startsWith('image/')) {
        resolve({ ok: false, reason: 'not_image' });
        return;
      }

      const overlay = document.createElement('div');
      overlay.className = 'image-crop-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.innerHTML = `
        <div class="image-crop-card glass">
          <h3 class="image-crop-title">${opts.title || 'Recortar foto'}</h3>
          <p class="image-crop-hint">${opts.hint || 'Arrastra la foto y usa el zoom para elegir la parte visible.'}</p>
          <div class="image-crop-stage-wrap">
            <canvas class="image-crop-stage" width="${CROP_VIEWPORT}" height="${CROP_VIEWPORT}" aria-hidden="true"></canvas>
          </div>
          <label class="image-crop-zoom-label">
            <span>Zoom</span>
            <input type="range" class="image-crop-zoom" min="100" max="300" value="100">
          </label>
          <div class="image-crop-actions">
            <button type="button" class="couple-btn couple-btn-ghost" data-crop-cancel>Cancelar</button>
            <button type="button" class="couple-btn couple-btn-primary" data-crop-confirm>Usar foto</button>
          </div>
        </div>
      `;

      const canvas = overlay.querySelector('.image-crop-stage');
      const ctx = canvas.getContext('2d');
      const zoomInput = overlay.querySelector('.image-crop-zoom');
      const cancelBtn = overlay.querySelector('[data-crop-cancel]');
      const confirmBtn = overlay.querySelector('[data-crop-confirm]');

      let img = null;
      let minScale = 1;
      let scale = 1;
      let panX = 0;
      let panY = 0;
      let dragging = false;
      let dragStartX = 0;
      let dragStartY = 0;
      let panStartX = 0;
      let panStartY = 0;
      let pinchStartDist = 0;
      let pinchStartScale = 1;
      let closed = false;

      function finish(result) {
        if (closed) return;
        closed = true;
        overlay.remove();
        document.body.classList.remove('image-crop-open');
        resolve(result);
      }

      function redraw() {
        if (!img) return;
        const clamped = clampPan(img.naturalWidth, img.naturalHeight, scale, panX, panY, CROP_VIEWPORT);
        panX = clamped.panX;
        panY = clamped.panY;
        drawCropPreview(ctx, img, scale, panX, panY, CROP_VIEWPORT);
      }

      function setScaleFromSlider() {
        const ratio = Number(zoomInput.value) / 100;
        scale = minScale * ratio;
        redraw();
      }

      readAsDataUrl(file)
        .then((src) => loadImage(src))
        .then((loaded) => {
          img = loaded;
          minScale = computeCoverScale(img.naturalWidth, img.naturalHeight, CROP_VIEWPORT);
          scale = minScale;
          panX = 0;
          panY = 0;
          zoomInput.min = '100';
          zoomInput.max = '300';
          zoomInput.value = '100';
          redraw();
        })
        .catch(() => finish({ ok: false, reason: 'process_failed' }));

      canvas.addEventListener('pointerdown', (e) => {
        if (!img) return;
        dragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        panStartX = panX;
        panStartY = panY;
        canvas.setPointerCapture(e.pointerId);
      });

      canvas.addEventListener('pointermove', (e) => {
        if (!dragging || !img) return;
        panX = panStartX + (e.clientX - dragStartX);
        panY = panStartY + (e.clientY - dragStartY);
        redraw();
      });

      canvas.addEventListener('pointerup', () => { dragging = false; });
      canvas.addEventListener('pointercancel', () => { dragging = false; });

      canvas.addEventListener('wheel', (e) => {
        if (!img) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -8 : 8;
        const next = Math.min(300, Math.max(100, Number(zoomInput.value) + delta));
        zoomInput.value = String(next);
        setScaleFromSlider();
      }, { passive: false });

      canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2 && img) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          pinchStartDist = Math.hypot(dx, dy);
          pinchStartScale = scale;
        }
      }, { passive: true });

      canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && img && pinchStartDist > 0) {
          const dx = e.touches[0].clientX - e.touches[1].clientX;
          const dy = e.touches[0].clientY - e.touches[1].clientY;
          const dist = Math.hypot(dx, dy);
          scale = pinchStartScale * (dist / pinchStartDist);
          scale = Math.max(minScale, Math.min(minScale * 3, scale));
          zoomInput.value = String(Math.round((scale / minScale) * 100));
          redraw();
        }
      }, { passive: true });

      zoomInput.addEventListener('input', setScaleFromSlider);

      cancelBtn.addEventListener('click', () => finish({ ok: false, reason: 'cancelled' }));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) finish({ ok: false, reason: 'cancelled' });
      });

      confirmBtn.addEventListener('click', async () => {
        if (!img) return;
        try {
          let dataUrl = exportSquareCrop(img, scale, panX, panY, CROP_VIEWPORT, CROP_OUTPUT);
          const approxBytes = Math.ceil((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
          if (approxBytes > MAX_BYTES) {
            dataUrl = await compressToDataUrl(dataUrl, MAX_BYTES);
          }
          finish({ ok: true, dataUrl });
        } catch (_) {
          finish({ ok: false, reason: 'process_failed' });
        }
      });

      document.body.appendChild(overlay);
      document.body.classList.add('image-crop-open');
    });
  }

  async function prepareProfilePhotoFromFile(file, opts = {}) {
    const cropped = await openImageCropper(file, {
      title: opts.title || 'Foto de perfil',
      hint: opts.hint || 'Arrastra y haz zoom para elegir qué parte se verá en tu avatar.',
    });
    if (!cropped.ok) return cropped;
    return { ok: true, dataUrl: cropped.dataUrl };
  }

  async function resolveImageInput({ file, url }) {
    if (file instanceof File && file.size) {
      return prepareImageFromFile(file);
    }
    const normalized = normalizeImageUrl(url || '');
    if (!normalized) {
      if (url && isBlockedSrc(url)) {
        return { ok: false, reason: 'local_path' };
      }
      return { ok: false, reason: 'no_image' };
    }
    return { ok: true, dataUrl: normalized };
  }

  function safeSrc(url) {
    return normalizeImageUrl(url) || '';
  }

  function reasonMessage(reason) {
    const map = {
      local_path: 'No pegues la ruta del PC — elige la foto con el botón 📷.',
      too_large: 'Imagen muy grande — prueba otra foto o más pequeña.',
      not_image: 'El archivo no es una imagen.',
      no_file: 'Elige una foto primero.',
      process_failed: 'No se pudo procesar la imagen.',
      cancelled: '',
    };
    return map[reason] || 'Error con la imagen.';
  }

  global.ImageUpload = {
    MAX_BYTES,
    isBlockedSrc,
    normalizeImageUrl,
    safeSrc,
    prepareImageFromFile,
    prepareProfilePhotoFromFile,
    openImageCropper,
    resolveImageInput,
    reasonMessage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
