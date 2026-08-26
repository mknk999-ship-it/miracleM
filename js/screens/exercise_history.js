(function () {
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

  function shiftDate(dateStr, delta) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d + delta);
    return Util.toDateStr(date);
  }

  async function renderList(container, type, dateStr) {
    const listEl = container.querySelector('#history-list');
    listEl.innerHTML = '<div class="spinner"></div>';
    const meta = TYPE_META[type];
    let logs;
    try {
      logs = await Api.listExerciseLogsByDate(dateStr, type);
    } catch (e) {
      listEl.innerHTML = `<div class="empty-state">${Util.escapeHtml(e.message || '불러오지 못했습니다.')}</div>`;
      return;
    }
    if (!logs || logs.length === 0) {
      listEl.innerHTML = '<div class="empty-state">이 날짜에는 기록이 없어요.</div>';
      return;
    }
    listEl.innerHTML = logs.map((log) => `
      <div class="rank-row" data-id="${log.id}">
        <div class="rank-info">
          <div class="rank-time">${log.total_sets}세트 · ${meta.formatTime(log.total_seconds)}</div>
          <div class="rank-date">${Util.formatTimeOfDay(log.created_at)}</div>
        </div>
        <button class="rank-delete" data-id="${log.id}" title="삭제">${Icons.svg('trash')}</button>
      </div>
    `).join('');
    listEl.querySelectorAll('.rank-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('이 운동 기록을 정말 삭제할까요?')) return;
        try {
          await Api.deleteExerciseLog(parseInt(btn.dataset.id, 10));
          await renderList(container, type, dateStr);
        } catch (e) {
          Util.toast(e.message || '삭제 중 오류가 발생했습니다.', { error: true });
        }
      });
    });
  }

  async function render(container, params) {
    const type = params.get('type') === 'plank' ? 'plank' : 'crossfit';
    const meta = TYPE_META[type];
    let dateStr = params.get('date') || Util.todayStr();

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">${Icons.svg('arrowLeft')}</button>
          <h1>${meta.title}</h1>
          <span style="width:36px"></span>
        </div>
        <div class="diary-date-picker">
          <button class="month-nav-btn" id="prev-day">${Icons.svg('chevronLeft')}</button>
          <span class="diary-date-label" id="history-date-label">${Util.formatDateLabel(dateStr)}</span>
          <button class="month-nav-btn" id="next-day">${Icons.svg('chevronRight')}</button>
        </div>
        <div id="history-list"><div class="spinner"></div></div>
      </div>
    `;

    container.querySelector('#back-btn').addEventListener('click', () => Router.go(meta.backRoute));
    const dateLabelEl = container.querySelector('#history-date-label');
    container.querySelector('#prev-day').addEventListener('click', () => {
      dateStr = shiftDate(dateStr, -1);
      dateLabelEl.textContent = Util.formatDateLabel(dateStr);
      renderList(container, type, dateStr);
    });
    container.querySelector('#next-day').addEventListener('click', () => {
      dateStr = shiftDate(dateStr, 1);
      dateLabelEl.textContent = Util.formatDateLabel(dateStr);
      renderList(container, type, dateStr);
    });

    await renderList(container, type, dateStr);
  }

  Router.register('exercise-history', render);
})();
