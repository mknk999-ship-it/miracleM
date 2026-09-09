(function () {
  function boot() {
    if (!location.hash) {
      location.hash = '#/home';
    } else {
      Router.renderCurrent();
    }
  }

  document.addEventListener('DOMContentLoaded', boot);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        /* PWA 등록 실패는 앱 사용에 영향 없음 */
      });
    });
  }
})();
