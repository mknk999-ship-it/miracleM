(function () {
  const FIRST_SET_SECONDS = 70; // 첫 세트는 1분10초
  const WORK_SECONDS = 60; // 이후 세트는 1분
  const REST_SECONDS = 60;

  let state = 'idle'; // idle | work | rest
  let phaseStart = 0;
  let currentWorkDuration = WORK_SECONDS;
  let sessionStart = 0;
  let setsCompleted = 0;
  let laps = [];
  let tickHandle = null;

  function fmt(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${Util.pad(m)}:${Util.pad(sec)}`;
  }

  function phaseElapsed() {
    return (Date.now() - phaseStart) / 1000;
  }

  function workDurationForSet(setNo) {
    return setNo === 1 ? FIRST_SET_SECONDS : WORK_SECONDS;
  }

  function currentSetNumber() {
    if (state === 'work') return setsCompleted + 1;
    if (state === 'rest') return setsCompleted;
    return 0;
  }

  function renderControls(container) {
    const el = container.querySelector('#plank-controls');
    if (state === 'idle') {
      el.innerHTML = `<button class="btn btn-primary btn-lg btn-block" id="start-btn">시작</button>`;
      el.querySelector('#start-btn').addEventListener('click', () => startExercise(container));
    } else {
      el.innerHTML = `
        <button class="btn btn-lg" id="set-btn"${state === 'rest' ? ' disabled style="opacity:.4"' : ''}>세트종료</button>
        <button class="btn btn-primary btn-lg" id="finish-btn">전체완료</button>
      `;
      if (state === 'work') {
        el.querySelector('#set-btn').addEventListener('click', () => completeSet(container));
      }
      el.querySelector('#finish-btn').addEventListener('click', () => finishExercise(container));
    }
  }

  function updateDisplay(container) {
    const timeEl = container.querySelector('#plank-time');
    const setsEl = container.querySelector('#plank-sets');
    const badgeEl = container.querySelector('#plank-badge');
    const setNoEl = container.querySelector('#plank-set-no');
    if (!timeEl) return;

    if (state === 'work') {
      const remaining = currentWorkDuration - phaseElapsed();
      if (remaining <= 0) {
        completeSet(container);
        return;
      }
      timeEl.textContent = fmt(remaining);
      timeEl.classList.remove('is-rest');
      badgeEl.textContent = '플랭크 진행중';
      badgeEl.className = 'plank-phase-badge is-work';
    } else if (state === 'rest') {
      const remaining = REST_SECONDS - phaseElapsed();
      if (remaining <= 0) {
        Util.beep();
        startWorkPhase(container);
        return;
      }
      timeEl.textContent = fmt(remaining);
      timeEl.classList.add('is-rest');
      badgeEl.textContent = '휴식중';
      badgeEl.className = 'plank-phase-badge is-rest';
    } else {
      timeEl.textContent = '00:00';
      timeEl.classList.remove('is-rest');
      badgeEl.textContent = '';
      badgeEl.className = 'plank-phase-badge';
    }
    setNoEl.textContent = state === 'idle' ? '' : `${currentSetNumber()}세트`;
    setsEl.textContent = `${setsCompleted}세트 완료`;
  }

  function startWorkPhase(container) {
    state = 'work';
    phaseStart = Date.now();
    currentWorkDuration = workDurationForSet(setsCompleted + 1);
    renderControls(container);
    updateDisplay(container);
  }

  function startRestPhase(container) {
    state = 'rest';
    phaseStart = Date.now();
    renderControls(container);
    updateDisplay(container);
  }

  function startExercise(container) {
    Util.unlockAudio();
    setsCompleted = 0;
    laps = [];
    sessionStart = Date.now();
    if (tickHandle) clearInterval(tickHandle);
    startWorkPhase(container);
    tickHandle = setInterval(() => updateDisplay(container), 200);
  }

  function completeSet(container) {
    if (state !== 'work') return;
    Util.beep();
    setsCompleted += 1;
    laps.push({
      set_no: setsCompleted,
      hold_seconds: Math.round(phaseElapsed() * 100) / 100,
      elapsed_seconds: Math.round(((Date.now() - sessionStart) / 1000) * 100) / 100,
    });
    startRestPhase(container);
  }

  async function finishExercise(container) {
    if (state === 'idle') return;
    clearInterval(tickHandle);
    const totalSeconds = (Date.now() - sessionStart) / 1000;
    const finishedSets = setsCompleted;
    const finishedLaps = laps;
    state = 'idle';
    setsCompleted = 0;
    laps = [];
    renderControls(container);
    updateDisplay(container);

    if (finishedSets > 0) {
      try {
        await Api.saveExercise(Util.todayStr(), finishedSets, Math.round(totalSeconds * 100) / 100, finishedLaps, 'plank');
        await refreshTodayLogs(container);
      } catch (e) {
        Util.toast(e.message || '저장 중 오류가 발생했습니다.', { error: true });
      }
    }
    showResultModal(finishedSets, totalSeconds);
  }

  function showResultModal(totalSets, totalSeconds) {
    const backdrop = document.createElement('div');
    backdrop.className = 'result-modal-backdrop';
    backdrop.innerHTML = `
      <div class="result-modal">
        <div class="result-rank">${Icons.svg('hourglass')} 플랭크 완료</div>
        <div class="result-sub">수고하셨어요!</div>
        <div class="result-stats">
          <div>${totalSets}<span>세트</span></div>
          <div>${Util.formatDuration(totalSeconds)}<span>총 시간</span></div>
        </div>
        <div class="sheet-actions">
          <button class="btn btn-primary btn-block" id="result-close">닫기</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#result-close').addEventListener('click', () => backdrop.remove());
  }

  function renderTodayLogs(container, logs) {
    const el = container.querySelector('#plank-today-logs');
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
            <div class="rank-time">${log.total_sets}세트 · ${Util.formatDuration(log.total_seconds)}</div>
            <div class="rank-date">${Util.formatTimeOfDay(log.created_at)}</div>
          </div>
          <button class="rank-delete" data-id="${log.id}" title="삭제">${Icons.svg('trash')}</button>
        </div>
      `).join('')}
    `;
    el.querySelectorAll('.rank-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('오늘의 플랭크 기록을 삭제할까요?')) return;
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
      const logs = await Api.listExerciseLogsByDate(Util.todayStr(), 'plank');
      renderTodayLogs(container, logs);
    } catch (e) {
      // 목록 조회 실패는 조용히 무시 (운동 자체 흐름을 막지 않음)
    }
  }

  async function render(container) {
    state = 'idle';
    setsCompleted = 0;
    laps = [];
    if (tickHandle) clearInterval(tickHandle);

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">${Icons.svg('arrowLeft')}</button>
          <h1>플랭크</h1>
          <button class="icon-btn" id="go-history" title="날짜별 기록">${Icons.svg('calendar')}</button>
        </div>
        <div class="exercise-guide">1세트 = 플랭크(첫 세트 1분10초, 이후 1분) · 휴식 1분, 전체완료 전까지 반복</div>
        <div class="plank-display">
          <div class="plank-phase-badge" id="plank-badge"></div>
          <div class="plank-set-no" id="plank-set-no"></div>
          <div class="plank-time" id="plank-time">00:00</div>
          <div class="plank-sets" id="plank-sets">0세트 완료</div>
        </div>
        <div class="exercise-controls" id="plank-controls"></div>
        <div id="plank-today-logs"></div>
      </div>
    `;
    container.querySelector('#back-btn').addEventListener('click', () => {
      if (tickHandle) clearInterval(tickHandle);
      Router.go('exercise');
    });
    container.querySelector('#go-history').addEventListener('click', () => {
      Router.go('exercise-history?type=plank');
    });
    renderControls(container);
    updateDisplay(container);
    await refreshTodayLogs(container);
  }

  Router.register('exercise-plank', render);
})();
