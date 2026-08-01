/**
 * Upload de imagens — comprime e bloqueia caminhos locais (file://).
 */
(function (global) {
  'use strict';

  const MAX_BYTES = 480000;
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
    };
    return map[reason] || 'Error con la imagen.';
  }

  global.ImageUpload = {
    MAX_BYTES,
    isBlockedSrc,
    normalizeImageUrl,
    safeSrc,
    prepareImageFromFile,
    resolveImageInput,
    reasonMessage,
  };
})(typeof window !== 'undefined' ? window : globalThis);
