/* ============================================================
   Cropper — recorte y redimension de imagenes, sin dependencias.
   API:  openCropper(file, opts) -> Promise<File|null>
         opts.maxSize  (px, lado mayor de salida; default 1600)
         opts.quality  (0..1 JPEG; default 0.85)
   Inyecta su propio overlay + estilos la primera vez.
   Devuelve un File JPEG recortado, o null si el usuario cancela.
   ============================================================ */
(function () {
  'use strict';

  const MIN_BOX = 32;          // tamano minimo del recorte en px de pantalla
  // i18n opcional: usa t() global si existe, sino fallback.
  function tx(key, fallback) {
    try {
      if (typeof t === 'function') {
        const v = t(key);
        if (v && v !== key) return v;
      }
    } catch (_) { /* noop */ }
    return fallback;
  }

  function buildOverlay() {
    const ov = document.createElement('div');
    ov.className = 'cropper-ov';
    ov.hidden = true;
    ov.innerHTML = `
      <div class="cropper-head">
        <span class="cropper-title"></span>
        <button type="button" class="cropper-btn cropper-btn--ghost" data-crop="reset"></button>
      </div>
      <div class="cropper-stage" data-crop="stage">
        <img class="cropper-img" alt="" data-crop="img">
        <div class="cropper-box cropper-grid" data-crop="box">
          <div class="cropper-h cropper-h-nw" data-h="nw"></div>
          <div class="cropper-h cropper-h-ne" data-h="ne"></div>
          <div class="cropper-h cropper-h-sw" data-h="sw"></div>
          <div class="cropper-h cropper-h-se" data-h="se"></div>
        </div>
      </div>
      <p class="cropper-hint"></p>
      <div class="cropper-foot">
        <button type="button" class="cropper-btn cropper-btn--cancel" data-crop="cancel"></button>
        <button type="button" class="cropper-btn cropper-btn--ok" data-crop="ok"></button>
      </div>`;
    document.body.appendChild(ov);
    return ov;
  }

  // Estado del recorte activo
  function openCropper(file, opts) {
    opts = opts || {};
    const maxSize = opts.maxSize || 1600;
    const quality = opts.quality || 0.85;

    return new Promise((resolve) => {
      if (!file || !file.type || !file.type.startsWith('image/')) {
        resolve(file || null);
        return;
      }
      let ov = document.querySelector('.cropper-ov');
      if (!ov) ov = buildOverlay();

      const stage = ov.querySelector('[data-crop="stage"]');
      const img   = ov.querySelector('[data-crop="img"]');
      const box   = ov.querySelector('[data-crop="box"]');

      ov.querySelector('.cropper-title').textContent      = tx('cropper.title', 'Recortar imagen');
      ov.querySelector('[data-crop="reset"]').textContent = tx('cropper.reset', 'Reiniciar');
      ov.querySelector('[data-crop="cancel"]').textContent= tx('cropper.cancel', 'Cancelar');
      ov.querySelector('[data-crop="ok"]').textContent    = tx('cropper.apply', 'Aplicar');
      ov.querySelector('.cropper-hint').textContent       = tx('cropper.hint', 'Arrastrá para mover, las esquinas para ajustar');

      const objUrl = URL.createObjectURL(file);
      let fit = 1;                 // escala natural->pantalla
      let nat = { w: 0, h: 0 };    // tamano natural
      let disp = { w: 0, h: 0, ox: 0, oy: 0 }; // imagen mostrada dentro del stage
      let crop = { x: 0, y: 0, w: 0, h: 0 };   // recorte en coords de pantalla (rel. al stage)

      function layout() {
        const sw = stage.clientWidth, sh = stage.clientHeight;
        fit = Math.min(sw / nat.w, sh / nat.h);
        disp.w = Math.round(nat.w * fit);
        disp.h = Math.round(nat.h * fit);
        disp.ox = Math.round((sw - disp.w) / 2);
        disp.oy = Math.round((sh - disp.h) / 2);
        img.style.width  = disp.w + 'px';
        img.style.height = disp.h + 'px';
        img.style.left   = disp.ox + 'px';
        img.style.top    = disp.oy + 'px';
        img.style.transform = 'none';
      }

      function resetCrop() {
        crop.x = disp.ox; crop.y = disp.oy; crop.w = disp.w; crop.h = disp.h;
        drawBox();
      }

      function clampCrop() {
        if (crop.w < MIN_BOX) crop.w = MIN_BOX;
        if (crop.h < MIN_BOX) crop.h = MIN_BOX;
        if (crop.x < disp.ox) crop.x = disp.ox;
        if (crop.y < disp.oy) crop.y = disp.oy;
        if (crop.x + crop.w > disp.ox + disp.w) crop.x = disp.ox + disp.w - crop.w;
        if (crop.y + crop.h > disp.oy + disp.h) crop.y = disp.oy + disp.h - crop.h;
        if (crop.w > disp.w) { crop.w = disp.w; crop.x = disp.ox; }
        if (crop.h > disp.h) { crop.h = disp.h; crop.y = disp.oy; }
      }

      function drawBox() {
        box.style.left   = crop.x + 'px';
        box.style.top    = crop.y + 'px';
        box.style.width  = crop.w + 'px';
        box.style.height = crop.h + 'px';
      }

      // ── Drag / resize con pointer events ──
      let drag = null; // {mode, sx, sy, ox, oy, ow, oh}

      function onDown(e) {
        const handle = e.target.closest('.cropper-h');
        const mode = handle ? handle.dataset.h : (e.target === box ? 'move' : null);
        if (!mode) return;
        e.preventDefault();
        drag = { mode, sx: e.clientX, sy: e.clientY,
                 ox: crop.x, oy: crop.y, ow: crop.w, oh: crop.h };
        stage.setPointerCapture(e.pointerId);
      }

      function onMove(e) {
        if (!drag) return;
        const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
        if (drag.mode === 'move') {
          crop.x = drag.ox + dx; crop.y = drag.oy + dy;
        } else {
          let left = drag.ox, top = drag.oy, right = drag.ox + drag.ow, bottom = drag.oy + drag.oh;
          if (drag.mode.includes('w')) left   = drag.ox + dx;
          if (drag.mode.includes('e')) right  = drag.ox + drag.ow + dx;
          if (drag.mode.includes('n')) top    = drag.oy + dy;
          if (drag.mode.includes('s')) bottom = drag.oy + drag.oh + dy;
          crop.x = Math.min(left, right - MIN_BOX);
          crop.y = Math.min(top, bottom - MIN_BOX);
          crop.w = Math.abs(right - left);
          crop.h = Math.abs(bottom - top);
        }
        clampCrop();
        drawBox();
      }

      function onUp(e) {
        if (!drag) return;
        drag = null;
        try { stage.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
      }

      function cleanup() {
        stage.removeEventListener('pointerdown', onDown);
        stage.removeEventListener('pointermove', onMove);
        stage.removeEventListener('pointerup', onUp);
        stage.removeEventListener('pointercancel', onUp);
        ov.querySelector('[data-crop="ok"]').removeEventListener('click', onOk);
        ov.querySelector('[data-crop="cancel"]').removeEventListener('click', onCancel);
        ov.querySelector('[data-crop="reset"]').removeEventListener('click', onReset);
        window.removeEventListener('resize', onResize);
        ov.hidden = true;
        URL.revokeObjectURL(objUrl);
        img.removeAttribute('src');
      }

      function onReset() { resetCrop(); }
      function onResize() { layout(); clampCrop(); drawBox(); }

      function onCancel() { cleanup(); resolve(null); }

      function onOk() {
        // Mapear recorte (pantalla) -> natural
        const nx = Math.round((crop.x - disp.ox) / fit);
        const ny = Math.round((crop.y - disp.oy) / fit);
        const nw = Math.round(crop.w / fit);
        const nh = Math.round(crop.h / fit);

        let outW = nw, outH = nh;
        const longest = Math.max(outW, outH);
        if (longest > maxSize) {
          const r = maxSize / longest;
          outW = Math.round(outW * r);
          outH = Math.round(outH * r);
        }

        const canvas = document.createElement('canvas');
        canvas.width = outW; canvas.height = outH;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(srcImg, nx, ny, nw, nh, 0, 0, outW, outH);

        canvas.toBlob((blob) => {
          if (!blob) { cleanup(); resolve(file); return; }
          const base = (file.name || 'foto').replace(/\.[^.]+$/, '');
          const out  = new File([blob], base + '.jpg', { type: 'image/jpeg' });
          cleanup();
          resolve(out);
        }, 'image/jpeg', quality);
      }

      // Imagen fuente para el canvas (decodificada a tamano natural real)
      const srcImg = new Image();
      srcImg.onload = function () {
        nat.w = srcImg.naturalWidth;
        nat.h = srcImg.naturalHeight;
        img.src = objUrl;
        ov.hidden = false;
        // esperar layout del stage
        requestAnimationFrame(() => {
          layout();
          resetCrop();
          stage.addEventListener('pointerdown', onDown);
          stage.addEventListener('pointermove', onMove);
          stage.addEventListener('pointerup', onUp);
          stage.addEventListener('pointercancel', onUp);
          ov.querySelector('[data-crop="ok"]').addEventListener('click', onOk);
          ov.querySelector('[data-crop="cancel"]').addEventListener('click', onCancel);
          ov.querySelector('[data-crop="reset"]').addEventListener('click', onReset);
          window.addEventListener('resize', onResize);
        });
      };
      srcImg.onerror = function () { URL.revokeObjectURL(objUrl); resolve(file); };
      srcImg.src = objUrl;
    });
  }

  window.openCropper = openCropper;
})();
