document.addEventListener('DOMContentLoaded', function () {
  I18N.init();
  if (new URLSearchParams(location.search).get('error')) {
    document.getElementById('error-banner').classList.add('visible');
  }
});
