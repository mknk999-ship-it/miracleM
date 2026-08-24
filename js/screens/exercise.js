(function () {
  const MENU = [
    {
      route: 'exercise-crossfit',
      icon: 'dumbbell',
      accent: 'gold',
      title: '크로스핏',
      sub: '푸쉬업 · 풀업 · 스쿼트 세트 스탑워치',
    },
    {
      route: 'exercise-plank',
      icon: 'hourglass',
      accent: 'plain',
      title: '플랭크',
      sub: '1분 플랭크 · 1분 휴식 반복 타이머',
    },
  ];

  async function render(container) {
    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <h1>운동</h1>
        </div>
        <div class="exercise-menu">
          ${MENU.map((m) => `
            <button class="exercise-menu-card accent-${m.accent}" data-route="${m.route}">
              <span class="exercise-menu-icon">${Icons.svg(m.icon)}</span>
              <span class="exercise-menu-text">
                <span class="exercise-menu-title">${m.title}</span>
                <span class="exercise-menu-sub">${m.sub}</span>
              </span>
              <span class="exercise-menu-arrow">${Icons.svg('chevronRight')}</span>
            </button>
          `).join('')}
          <div class="exercise-menu-card disabled">
            <span class="exercise-menu-icon">${Icons.svg('plus')}</span>
            <span class="exercise-menu-text">
              <span class="exercise-menu-title">더 준비 중이에요</span>
              <span class="exercise-menu-sub">향후 운동 종목이 추가될 예정입니다</span>
            </span>
          </div>
        </div>
      </div>
    `;
    container.querySelectorAll('.exercise-menu-card[data-route]').forEach((btn) => {
      btn.addEventListener('click', () => Router.go(btn.dataset.route));
    });
  }

  Router.register('exercise', render);
})();
