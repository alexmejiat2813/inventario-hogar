(async function () {
  await I18N.init();
  I18N.apply();

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso.replace(' ', 'T'));
    return isNaN(d) ? iso : d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  try {
    const res = await fetch('/api/admin/stats');
    if (!res.ok) { window.location.href = '/'; return; }
    const s = await res.json();

    const set = (id, v) => { document.getElementById(id).textContent = v; };
    set('m-users',       s.users);
    set('m-new30',       s.newUsers30);
    set('m-active7',     s.active7);
    set('m-active30',    s.active30);
    set('m-inventories', s.inventories);
    set('m-products',    s.products);
    set('m-purchases',   s.purchases);

    document.getElementById('users-tbody').innerHTML = (s.recentUsers || []).map(u => `
      <tr>
        <td>${esc(u.name)}</td>
        <td class="hide-sm muted">${esc(u.email)}</td>
        <td class="muted">${fmtDate(u.last_login_at)}</td>
      </tr>`).join('') || '<tr><td colspan="3" class="muted">—</td></tr>';
  } catch {
    document.getElementById('load-error').hidden = false;
  }

  document.addEventListener('langchange', () => I18N.apply());
})();
