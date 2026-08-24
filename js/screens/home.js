(function () {
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  let viewYear, viewMonth; // viewMonth: 1-12

  function monthLabel(y, m) {
    return `${y}년 ${m}월`;
  }

  function rankBadge(count, size) {
    if (count <= 0) return '';
    const stars = '<span class="mark-star"></span>'.repeat(count);
    return `<span class="mark-tab${size ? ' ' + size : ''}">${stars}</span>`;
  }

  function buildDayCells(y, m, data, todayStr) {
    const firstDay = new Date(y, m - 1, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(y, m, 0).getDate();
    const diarySet = new Set(data.diary_dates);
    const exerciseSet = new Set(data.exercise_dates);
    const scriptureSet = new Set(data.scripture_dates);

    let html = '';
    for (let i = 0; i < startOffset; i++) {
      html += `<div class="cal-day empty"></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${Util.pad(m)}-${Util.pad(d)}`;
      const isToday = dateStr === todayStr;
      const count = [diarySet.has(dateStr), scriptureSet.has(dateStr), exerciseSet.has(dateStr)]
        .filter(Boolean).length;
      html += `
        <button class="cal-day${isToday ? ' today' : ''}" data-date="${dateStr}">
          <span class="day-num">${d}</span>
          <span class="marks">${rankBadge(count)}</span>
        </button>`;
    }
    return html;
  }

  async function loadAndRender(container) {
    const data = await Api.getCalendarMonth(viewYear, viewMonth);
    const todayStr = Util.todayStr();

    container.innerHTML = `
      <div class="screen">
        <div class="topbar"><h1>홈</h1></div>
        <div class="month-header">
          <button class="month-nav-btn" id="prev-month">${Icons.svg('chevronLeft')}</button>
          <h2 id="month-label">${monthLabel(viewYear, viewMonth)}</h2>
          <button class="month-nav-btn" id="next-month">${Icons.svg('chevronRight')}</button>
        </div>
        <div class="track-legend">
          <span class="legend-rank">${rankBadge(1, 'lg')}준장 · 1개 완료</span>
          <span class="legend-rank">${rankBadge(2, 'lg')}소장 · 2개 완료</span>
          <span class="legend-rank">${rankBadge(3, 'lg')}중장 · 3개 완료</span>
        </div>
        <div class="calendar-grid">
          ${WEEKDAYS.map((w) => `<div class="cal-weekday">${w}</div>`).join('')}
          ${buildDayCells(viewYear, viewMonth, data, todayStr)}
        </div>
        <div class="hint-text">일기 · 말씀 · 운동 중 완료한 개수만큼 계급장이 올라가요 · 날짜를 터치하면 말씀 읽기 표시를 켜고 끌 수 있어요</div>
        <div class="month-stats">
          <div class="stat-card"><div class="stat-num">${data.diary_count}</div><div class="stat-label">일기</div></div>
          <div class="stat-card"><div class="stat-num">${data.scripture_count}</div><div class="stat-label">말씀</div></div>
          <div class="stat-card"><div class="stat-num">${data.exercise_count}</div><div class="stat-label">운동</div></div>
        </div>
      </div>
    `;

    container.querySelector('#prev-month').addEventListener('click', () => {
      viewMonth -= 1;
      if (viewMonth < 1) { viewMonth = 12; viewYear -= 1; }
      loadAndRender(container);
    });
    container.querySelector('#next-month').addEventListener('click', () => {
      viewMonth += 1;
      if (viewMonth > 12) { viewMonth = 1; viewYear += 1; }
      loadAndRender(container);
    });

    container.querySelectorAll('.cal-day[data-date]').forEach((el) => {
      el.addEventListener('click', async () => {
        const dateStr = el.dataset.date;
        el.style.opacity = '0.5';
        try {
          await Api.toggleScripture(dateStr);
          await loadAndRender(container);
        } catch (e) {
          Util.toast(e.message || '처리 중 오류가 발생했습니다.', { error: true });
          el.style.opacity = '1';
        }
      });
    });
  }

  async function render(container) {
    const now = new Date();
    if (viewYear === undefined) {
      viewYear = now.getFullYear();
      viewMonth = now.getMonth() + 1;
    }
    await loadAndRender(container);
  }

  Router.register('home', render);
})();
