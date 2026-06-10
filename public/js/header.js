/* Profile menu + avatar — shared across all pages */

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
    window.location.href = '/login';
  });
}
