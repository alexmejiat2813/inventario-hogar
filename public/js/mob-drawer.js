(function () {
  var ham     = document.getElementById('mob-ham');
  var overlay = document.getElementById('mob-overlay');
  var drawer  = document.getElementById('mob-drawer');
  var dclose  = document.getElementById('mob-dclose');
  if (!ham || !overlay || !drawer) return;
  var ACT = {};
  try { ACT = JSON.parse(drawer.dataset.mobActs || '{}'); } catch (e) {}
  function openDrawer()  { overlay.classList.add('mob-show'); drawer.classList.add('mob-open'); drawer.setAttribute('aria-hidden', 'false'); }
  function closeDrawer() { overlay.classList.remove('mob-show'); drawer.classList.remove('mob-open'); drawer.setAttribute('aria-hidden', 'true'); }
  ham.addEventListener('click', openDrawer);
  overlay.addEventListener('click', closeDrawer);
  if (dclose) dclose.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
  drawer.querySelectorAll('[data-mob-act]').forEach(function (item) {
    item.addEventListener('click', function () {
      if (item.disabled) return;
      var real = document.getElementById(ACT[item.dataset.mobAct]);
      closeDrawer();
      if (real) real.click();
    });
  });
})();
