(function () {
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  const TYPE_META = {
    crossfit: {
      title: '크로스핏 기록',
      backRoute: 'exercise-crossfit',
      formatTime: (s) => Util.formatStopwatch(s),
    },
    plank: {
      title: '플랭크 기록',
      backRoute: 'exercise-plank',
      formatTime: (s) => Util.formatDuration(s),
    },
  };

  let viewYear, viewMonth, currentType;

  function monthLabel(y, m) {
    return `${y}년 ${m}월`;
  }

  function aggregateByDate(logs) {
    const map = new Map();
    logs.forEach((log) => {
      const cur = map.get(log.log_date) || { sets: 0, seconds: 0 };
      cur.sets += log.total_sets;
      cur.seconds += Number(log.total_seconds);
      map.set(log.log_date, cur);
    });
    return map;
  }

  function buildDayCells(y, m, byDate, todayStr) {
    const firstDay = new Date(y, m - 1, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(y, m, 0).getDate();

    let html = '';
    for (let i = 0; i < startOffset; i++) {
      html += `<div class="diary-cal-day empty"></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${Util.pad(m)}-${Util.pad(d)}`;
      const isToday = dateStr === todayStr;
      const agg = byDate.get(dateStr);
      html += `
        <button class="diary-cal-day${isToday ? ' today' : ''}${agg ? ' has-entry' : ''}" data-date="${dateStr}">
          <span class="diary-cal-day-num">${d}</span>
          ${agg ? `<span class="diary-cal-preview">${agg.sets}세트<br>${Util.formatDuration(agg.seconds)}</span>` : ''}
        </button>`;
    }
    return html;
  }

  async function openDayDetail(container, dateStr) {
    const meta = TYPE_META[currentType];
    let logs;
    try {
      logs = await Api.listExerciseLogsByDate(dateStr, currentType);
    } catch (e) {
      Util.toast(e.message || '불러오지 못했습니다.', { error: true });
      return;
    }

    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    backdrop.innerHTML = `
      <div class="sheet">
        <h3>${Util.formatDateLabel(dateStr)}</h3>
        <div id="day-detail-list">
          ${logs.length === 0 ? '<div class="empty-state">이 날짜에는 기록이 없어요.</div>' : logs.map((log) => `
            <div class="rank-row" data-id="${log.id}">
              <div class="rank-info">
                <div class="rank-time">${log.total_sets}세트 · ${meta.formatTime(log.total_seconds)}</div>
                <div class="rank-date">${Util.formatTimeOfDay(log.created_at)}</div>
              </div>
              <button class="rank-delete" data-id="${log.id}" title="삭제">${Icons.svg('trash')}</button>
            </div>
          `).join('')}
        </div>
        <div class="sheet-actions">
          <button class="btn btn-block" id="day-detail-close">닫기</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    backdrop.querySelector('#day-detail-close').addEventListener('click', () => backdrop.remove());
    backdrop.querySelectorAll('.rank-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('이 운동 기록을 정말 삭제할까요?')) return;
        try {
          await Api.deleteExerciseLog(parseInt(btn.dataset.id, 10));
          backdrop.remove();
          await loadAndRender(container);
        } catch (e) {
          Util.toast(e.message || '삭제 중 오류가 발생했습니다.', { error: true });
        }
      });
    });
  }

  async function loadAndRender(container) {
    const meta = TYPE_META[currentType];
    const todayStr = Util.todayStr();
    let logs = [];
    try {
      logs = await Api.listExerciseLogsMonth(viewYear, viewMonth, currentType);
    } catch (e) {
      // 조회 실패해도 빈 달력은 보여준다
    }
    const byDate = aggregateByDate(logs);

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">${Icons.svg('arrowLeft')}</button>
          <h1>${meta.title}</h1>
          <span style="width:36px"></span>
        </div>
        <div class="month-header">
          <button class="month-nav-btn" id="prev-month">${Icons.svg('chevronLeft')}</button>
          <h2>${monthLabel(viewYear, viewMonth)}</h2>
          <button class="month-nav-btn" id="next-month">${Icons.svg('chevronRight')}</button>
        </div>
        <div class="diary-cal-grid">
          ${WEEKDAYS.map((w) => `<div class="cal-weekday">${w}</div>`).join('')}
          ${buildDayCells(viewYear, viewMonth, byDate, todayStr)}
        </div>
        <div class="hint-text">날짜를 누르면 그날의 기록을 자세히 보고 삭제할 수 있어요</div>
      </div>
    `;

    container.querySelector('#back-btn').addEventListener('click', () => Router.go(meta.backRoute));
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
    container.querySelectorAll('.diary-cal-day[data-date]').forEach((el) => {
      el.addEventListener('click', () => openDayDetail(container, el.dataset.date));
    });
  }

  async function render(container, params) {
    currentType = params.get('type') === 'plank' ? 'plank' : 'crossfit';
    const now = new Date();
    viewYear = now.getFullYear();
    viewMonth = now.getMonth() + 1;
    await loadAndRender(container);
  }

  Router.register('exercise-history', render);
})();
