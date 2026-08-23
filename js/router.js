(function () {
  const routes = {};
  const NAV_ROUTES = ['home', 'morning', 'exercise', 'diary', 'notes'];
  const NAV_META = {
    home: { icon: '🏠', label: '홈' },
    morning: { icon: '🌅', label: '아침' },
    exercise: { icon: '⏱️', label: '운동' },
    diary: { icon: '📔', label: '일기' },
    notes: { icon: '📌', label: '메모' },
  };

  function register(path, renderFn) {
    routes[path] = renderFn;
  }

  function parseHash() {
    const raw = (location.hash || '#/home').replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const params = new URLSearchParams(query || '');
    return { path: path || 'home', params };
  }

  function currentTopLevel(path) {
    return path.split('/')[0];
  }

  function renderNav(activePath) {
    const nav = document.getElementById('bottom-nav');
    nav.innerHTML = '';
    const top = currentTopLevel(activePath);
    NAV_ROUTES.forEach((route) => {
      const meta = NAV_META[route];
      const item = document.createElement('button');
      item.className = 'nav-item' + (top === route ? ' active' : '');
      item.innerHTML = `<span class="nav-icon">${meta.icon}</span><span>${meta.label}</span>`;
      item.addEventListener('click', () => go(route));
      nav.appendChild(item);
    });
  }

  async function renderCurrent() {
    const { path, params } = parseHash();
    const container = document.getElementById('screen-container');
    const handler = routes[path] || routes['home'];
    renderNav(path);
    container.scrollTop = 0;
    container.innerHTML = '<div class="spinner"></div>';
    try {
      await handler(container, params);
    } catch (e) {
      if (e instanceof Api.ApiError && e.isAuthError) {
        Api.clearPin();
        location.reload();
        return;
      }
      container.innerHTML = `<div class="screen"><div class="empty-state">화면을 불러오지 못했습니다.<br>${Util.escapeHtml(e.message || '')}</div></div>`;
    }
  }

  function go(path) {
    if (location.hash === `#/${path}`) {
      renderCurrent();
    } else {
      location.hash = `#/${path}`;
    }
  }

  window.addEventListener('hashchange', renderCurrent);

  window.Router = { register, go, renderCurrent };
})();
