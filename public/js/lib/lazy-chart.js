/* Lazy loader para Chart.js (#69). Chart.js (~200KB) bloqueaba el parse en las
 * paginas que lo incluian aunque el grafico no fuera lo primero en verse.
 * ensureChart() inyecta los scripts del vendor on-demand una sola vez y resuelve
 * cuando window.Chart esta disponible. opts.datalabels carga ademas el plugin
 * de etiquetas (solo el dashboard lo usa). */
(function () {
  let promise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('No se pudo cargar ' + src));
      document.head.appendChild(s);
    });
  }

  window.ensureChart = function ensureChart(opts = {}) {
    if (window.Chart) return Promise.resolve(window.Chart);
    if (!promise) {
      promise = loadScript('/js/vendor/chart.umd.min.js')
        .then(() => (opts.datalabels ? loadScript('/js/vendor/chartjs-plugin-datalabels.min.js') : null))
        .then(() => window.Chart)
        .catch(err => { promise = null; throw err; });
    }
    return promise;
  };
})();
