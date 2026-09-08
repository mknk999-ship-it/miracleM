(function () {
  const PREP_SECONDS = 10;
  const EXERCISE_SECONDS = 120;

  const TYPE_META = {
    pushup: {
      title: '푸쉬업',
      unit: '개',
      guide: '시작하면 10초 준비 후 2분간 진행 · 종료되면 개수를 입력하세요',
    },
    situp: {
      title: '윗몸일으키기',
      unit: '개',
      guide: '시작하면 10초 준비 후 2분간 진행 · 종료되면 개수를 입력하세요',
    },
  };

  function fmt(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${Util.pad(m)}:${Util.pad(sec)}`;
  }

  function makeScreen(type) {
    const meta = TYPE_META[type];
    let state = 'idle'; // idle | prepare | exercise | done
    let phaseStart = 0;
    let tickHandle = null;

    function phaseElapsed() {
      return (Date.now() - phaseStart) / 1000;
    }

    function renderTodayLogs(container, logs) {
      const el = container.querySelector('#timed-today-logs');
      if (!el) return;
      if (!logs || logs.length === 0) {
        el.innerHTML = '';
        return;
      }
      el.innerHTML = `
        <div class="section-title">오늘 기록</div>
        ${logs.map((log) => {
          const g = Util.countGradeLabel(type, log.total_sets);
          return `
            <div class="rank-row" data-id="${log.id}">
              <div class="rank-info">
                <div class="rank-time">${log.total_sets}${meta.unit} · <span class="run-grade${g.pass ? '' : ' fail'}">${g.label}</span></div>
                <div class="rank-date">${Util.formatTimeOfDay(log.created_at)}</div>
              </div>
              <button class="rank-delete" data-id="${log.id}" title="삭제">${Icons.svg('trash')}</button>
            </div>
          `;
        }).join('')}
      `;
      el.querySelectorAll('.rank-delete').forEach((btn) => {
        btn.addEventListener('click', async () => {
          if (!confirm('이 운동 기록을 삭제할까요?')) return;
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
        const logs = await Api.listExerciseLogsByDate(Util.todayStr(), type);
        renderTodayLogs(container, logs);
      } catch (e) {
        // 목록 조회 실패는 조용히 무시 (측정 자체를 막지 않음)
      }
    }

    function renderControls(container) {
      const el = container.querySelector('#timed-controls');
      if (state === 'idle') {
        el.innerHTML = `<button class="btn btn-primary btn-lg btn-block" id="start-btn">시작</button>`;
        el.querySelector('#start-btn').addEventListener('click', () => startPrep(container));
      } else if (state === 'done') {
        el.innerHTML = `
          <div class="run-section">
            <div class="section-title">개수 입력</div>
            <input type="number" id="count-input" class="count-input" inputmode="numeric" min="0" placeholder="예: 45">
            <div class="run-grade-preview" id="count-grade-preview"></div>
          </div>
          <button class="btn btn-primary btn-lg btn-block" id="save-count-btn">저장</button>
        `;
        const countInput = el.querySelector('#count-input');
        const gradePreviewEl = el.querySelector('#count-grade-preview');
        countInput.addEventListener('input', () => {
          const count = parseInt(countInput.value, 10);
          if (Number.isNaN(count)) {
            gradePreviewEl.innerHTML = '';
            return;
          }
          const g = Util.countGradeLabel(type, count);
          gradePreviewEl.innerHTML = `<span class="run-grade${g.pass ? '' : ' fail'}">${g.label}</span>`;
        });
        countInput.focus();
        el.querySelector('#save-count-btn').addEventListener('click', async () => {
          const count = parseInt(countInput.value, 10);
          if (Number.isNaN(count) || count < 0) {
            Util.toast('개수를 입력해주세요.', { error: true });
            return;
          }
          const g = Util.countGradeLabel(type, count);
          try {
            await Api.saveExercise(Util.todayStr(), count, EXERCISE_SECONDS, [], type);
            state = 'idle';
            renderControls(container);
            updateDisplay(container);
            Util.toast(`${meta.title} 기록이 저장되었어요! (${g.label})`);
            await refreshTodayLogs(container);
          } catch (e) {
            Util.toast(e.message || '저장 중 오류가 발생했습니다.', { error: true });
          }
        });
      } else {
        el.innerHTML = `<button class="btn btn-lg btn-block" id="cancel-btn">취소</button>`;
        el.querySelector('#cancel-btn').addEventListener('click', () => cancelExercise(container));
      }
    }

    function updateDisplay(container) {
      const timeEl = container.querySelector('#timed-time');
      const badgeEl = container.querySelector('#timed-badge');
      if (!timeEl) return;

      if (state === 'prepare') {
        const remaining = PREP_SECONDS - phaseElapsed();
        if (remaining <= 0) {
          Util.beepTimes(5);
          startExercisePhase(container);
          return;
        }
        timeEl.textContent = fmt(remaining);
        timeEl.classList.remove('is-rest');
        badgeEl.textContent = '준비 시간';
        badgeEl.className = 'plank-phase-badge is-prep';
      } else if (state === 'exercise') {
        const remaining = EXERCISE_SECONDS - phaseElapsed();
        if (remaining <= 0) {
          Util.beepTimes(5);
          finishExercise(container);
          return;
        }
        timeEl.textContent = fmt(remaining);
        timeEl.classList.remove('is-rest');
        badgeEl.textContent = '측정 진행중';
        badgeEl.className = 'plank-phase-badge is-work';
      } else if (state === 'done') {
        timeEl.textContent = '00:00';
        badgeEl.textContent = '측정 완료';
        badgeEl.className = 'plank-phase-badge';
      } else {
        timeEl.textContent = fmt(EXERCISE_SECONDS);
        badgeEl.textContent = '';
        badgeEl.className = 'plank-phase-badge';
      }
    }

    function startPrep(container) {
      Util.unlockAudio();
      state = 'prepare';
      phaseStart = Date.now();
      renderControls(container);
      updateDisplay(container);
      if (tickHandle) clearInterval(tickHandle);
      tickHandle = setInterval(() => updateDisplay(container), 200);
    }

    function startExercisePhase(container) {
      state = 'exercise';
      phaseStart = Date.now();
      renderControls(container);
      updateDisplay(container);
    }

    function finishExercise(container) {
      state = 'done';
      clearInterval(tickHandle);
      renderControls(container);
      updateDisplay(container);
    }

    function cancelExercise(container) {
      clearInterval(tickHandle);
      state = 'idle';
      renderControls(container);
      updateDisplay(container);
    }

    async function render(container) {
      state = 'idle';
      if (tickHandle) clearInterval(tickHandle);

      container.innerHTML = `
        <div class="screen">
          <div class="topbar">
            <button class="icon-btn" id="back-btn">${Icons.svg('arrowLeft')}</button>
            <h1>${meta.title}</h1>
            <span style="width:36px"></span>
          </div>
          <div class="exercise-guide">${meta.guide}</div>
          <div class="plank-display">
            <div class="plank-phase-badge" id="timed-badge"></div>
            <div class="plank-time" id="timed-time">${fmt(EXERCISE_SECONDS)}</div>
          </div>
          <div class="exercise-controls" id="timed-controls"></div>
          <div id="timed-today-logs"></div>
          <div class="exercise-bottom-actions">
            <button class="btn btn-block" id="go-history">${Icons.svg('calendar')} 달력으로 기록보기</button>
          </div>
        </div>
      `;
      container.querySelector('#back-btn').addEventListener('click', () => {
        if (tickHandle) clearInterval(tickHandle);
        Router.go('exercise');
      });
      container.querySelector('#go-history').addEventListener('click', () => {
        Router.go(`exercise-history?type=${type}`);
      });
      renderControls(container);
      updateDisplay(container);
      await refreshTodayLogs(container);
    }

    Router.register(`exercise-${type}`, render);
  }

  makeScreen('pushup');
  makeScreen('situp');
})();
