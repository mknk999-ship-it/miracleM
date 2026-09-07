(function () {
  function toSeconds(minutesStr, secondsStr) {
    const m = parseInt(minutesStr, 10) || 0;
    const s = parseInt(secondsStr, 10) || 0;
    return m * 60 + s;
  }

  function renderTodayLogs(container, logs) {
    const el = container.querySelector('#running-today-logs');
    if (!el) return;
    if (!logs || logs.length === 0) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = `
      <div class="section-title">오늘 기록</div>
      ${logs.map((log) => `
        <div class="rank-row" data-id="${log.id}">
          <div class="rank-info">
            <div class="rank-time">${Number(log.distance_km).toFixed(2)}km · ${Util.formatDuration(log.total_seconds)}</div>
            <div class="rank-date">${Util.formatTimeOfDay(log.created_at)}</div>
          </div>
          <button class="rank-delete" data-id="${log.id}" title="삭제">${Icons.svg('trash')}</button>
        </div>
      `).join('')}
    `;
    el.querySelectorAll('.rank-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('이 달리기 기록을 삭제할까요?')) return;
        try {
          await Api.deleteExerciseLog(parseInt(btn.dataset.id, 10));
          await refreshTodayLogs(container);
        } catch (e) {
          Util.toast(e.message || '삭제 중 오류가 발생했습니다.', { error: true });
        }
      });
    });
  }

  async function refreshTodayLogs(container) {
    try {
      const logs = await Api.listExerciseLogsByDate(Util.todayStr(), 'running');
      renderTodayLogs(container, logs);
    } catch (e) {
      // 목록 조회 실패는 조용히 무시 (기록 입력 자체를 막지 않음)
    }
  }

  async function render(container) {
    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">${Icons.svg('arrowLeft')}</button>
          <h1>달리기</h1>
          <span style="width:36px"></span>
        </div>
        <div class="exercise-guide">달린 거리와 기록(시간)을 입력하고 저장하세요</div>
        <div class="running-form">
          <label class="running-field">
            <span>거리 (km)</span>
            <input type="number" id="run-distance" inputmode="decimal" step="0.01" min="0" placeholder="예: 5.2">
          </label>
          <div class="running-time-fields">
            <label class="running-field">
              <span>기록 · 분</span>
              <input type="number" id="run-minutes" inputmode="numeric" min="0" placeholder="0">
            </label>
            <label class="running-field">
              <span>초</span>
              <input type="number" id="run-seconds" inputmode="numeric" min="0" max="59" placeholder="0">
            </label>
          </div>
        </div>
        <div class="exercise-controls">
          <button class="btn btn-primary btn-lg btn-block" id="save-run-btn">저장</button>
        </div>
        <div id="running-today-logs"></div>
        <div class="exercise-bottom-actions">
          <button class="btn btn-block" id="go-history">${Icons.svg('calendar')} 달력으로 기록보기</button>
        </div>
      </div>
    `;

    container.querySelector('#back-btn').addEventListener('click', () => Router.go('exercise'));
    container.querySelector('#go-history').addEventListener('click', () => {
      Router.go('exercise-history?type=running');
    });

    container.querySelector('#save-run-btn').addEventListener('click', async () => {
      const distanceInput = container.querySelector('#run-distance');
      const minutesInput = container.querySelector('#run-minutes');
      const secondsInput = container.querySelector('#run-seconds');
      const distance = parseFloat(distanceInput.value);
      const totalSeconds = toSeconds(minutesInput.value, secondsInput.value);

      if (!distance || distance <= 0) {
        Util.toast('거리를 입력해주세요.', { error: true });
        return;
      }
      if (totalSeconds <= 0) {
        Util.toast('기록(시간)을 입력해주세요.', { error: true });
        return;
      }

      try {
        await Api.saveExercise(Util.todayStr(), 1, totalSeconds, [], 'running', Math.round(distance * 100) / 100);
        distanceInput.value = '';
        minutesInput.value = '';
        secondsInput.value = '';
        Util.toast('달리기 기록이 저장되었어요!');
        await refreshTodayLogs(container);
      } catch (e) {
        Util.toast(e.message || '저장 중 오류가 발생했습니다.', { error: true });
      }
    });

    await refreshTodayLogs(container);
  }

  Router.register('exercise-running', render);
})();
