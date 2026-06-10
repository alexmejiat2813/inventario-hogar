(function () {
  var b = document.getElementById('back-to-top');
  if (!b) return;
  var check = function () { b.classList.toggle('show', window.scrollY > 400); };
  window.addEventListener('scroll', check, { passive: true });
  b.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
  check();
})();
