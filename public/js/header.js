/* Profile menu + avatar — shared across all pages */
/* eslint-disable no-unused-vars -- globals used by other page scripts via script tag */

async function loadProfileAvatar() {
  try {
    const user = await apiFetch('GET', '/api/me');
    if (!user) return;
    const initial = (user.name || '?')[0].toUpperCase();

    // Botón avatar (header)
    const av  = document.getElementById('user-avatar');
    const avp = document.getElementById('avatar-placeholder');
    if (user.photo && av) {
      av.src = user.photo; av.alt = user.name || ''; av.hidden = false;
      if (avp) avp.hidden = true;
    } else if (avp) {
      avp.textContent = initial;
    }

    // Dropdown: info de usuario
    const dn = document.getElementById('dropdown-name');
    const de = document.getElementById('dropdown-email');
    if (dn) dn.textContent = user.name  || '';
    if (de) de.textContent = user.email || '';
    const dav = document.getElementById('dropdown-avatar');
    const davp = document.getElementById('dropdown-avatar-ph');
    if (user.photo && dav) {
      dav.src = user.photo; dav.alt = user.name || ''; dav.hidden = false;
      if (davp) davp.hidden = true;
    } else if (davp) {
      davp.textContent = initial;
    }
  } catch {}
}

function initProfileMenu() {
  const btn  = document.getElementById('profile-btn');
  const menu = document.getElementById('profile-dropdown');
  const wrap = document.getElementById('profile-menu-wrap');
  if (!btn || !menu) return;

  // "Gestionar acceso" no existe en compras (no hay modal aquí) → ocultar
  const manage = document.getElementById('manage-section');
  if (manage) manage.hidden = true;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', e => {
    if (wrap && !wrap.contains(e.target)) {
      menu.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  const logout = document.getElementById('btn-logout');
  if (logout) logout.addEventListener('click', async () => {
    menu.hidden = true;
    await fetch('/auth/logout', { method: 'POST' });
    purgeApiCache();
    window.location.href = '/login';
  });

  const share = document.getElementById('btn-share');
  if (share) share.addEventListener('click', async () => {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    const url   = window.location.origin;
    const title = 'Inventario Hogar';
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        _headerToast(typeof t === 'function' ? t('profile.shareCopied') : 'Enlace copiado');
      } catch {
        _headerToast(typeof t === 'function' ? t('profile.shareError') : 'No se pudo copiar el enlace', true);
      }
    }
  });

  document.querySelectorAll('.dropdown-item[href="/settings"]').forEach(function (link) {
    link.addEventListener('click', function () {
      sessionStorage.setItem('settings_referrer', window.location.href);
    });
  });
}

function _headerToast(msg, isErr = false) {
  const c = document.getElementById('toast-container');
  if (!c) return;
  const el = document.createElement('div');
  el.className = `toast toast-${isErr ? 'error' : 'success'}`;
  el.textContent = msg;
  c.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('toast--show')));
  setTimeout(() => { el.classList.remove('toast--show'); setTimeout(() => el.remove(), 300); }, 3000);
}
