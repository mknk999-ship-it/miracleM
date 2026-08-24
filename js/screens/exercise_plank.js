(function () {
  const WORK_SECONDS = 60;
  const REST_SECONDS = 60;

  let state = 'idle'; // idle | work | rest
  let phaseStart = 0;
  let sessionStart = 0;
  let setsCompleted = 0;
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

  function renderControls(container) {
    const el = container.querySelector('#plank-controls');
    if (state === 'idle') {
      el.innerHTML = `<button class="btn btn-primary btn-lg btn-block" id="start-btn">시작</button>`;
      el.querySelector('#start-btn').addEventListener('click', () => startExercise(container));
    } else {
      el.innerHTML = `
        <button class="btn btn-lg" id="set-btn"${state === 'rest' ? ' disabled style="opacity:.4"' : ''}>세트완료</button>
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
    if (!timeEl) return;

    if (state === 'work') {
      timeEl.textContent = fmt(WORK_SECONDS - phaseElapsed());
      timeEl.classList.remove('is-rest');
      badgeEl.textContent = '플랭크 진행중';
      badgeEl.className = 'plank-phase-badge is-work';
    } else if (state === 'rest') {
      const remaining = REST_SECONDS - phaseElapsed();
      if (remaining <= 0) {
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
    setsEl.textContent = `${setsCompleted}세트 완료`;
  }

  function startWorkPhase(container) {
    state = 'work';
    phaseStart = Date.now();
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
    setsCompleted = 0;
    sessionStart = Date.now();
    if (tickHandle) clearInterval(tickHandle);
    startWorkPhase(container);
    tickHandle = setInterval(() => updateDisplay(container), 200);
  }

  function completeSet(container) {
    if (state !== 'work') return;
    setsCompleted += 1;
    startRestPhase(container);
  }

  function finishExercise(container) {
    if (state === 'idle') return;
    clearInterval(tickHandle);
    const totalSeconds = (Date.now() - sessionStart) / 1000;
    const finishedSets = setsCompleted;
    state = 'idle';
    renderControls(container);
    updateDisplay(container);
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

  async function render(container) {
    state = 'idle';
    setsCompleted = 0;
    if (tickHandle) clearInterval(tickHandle);

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">${Icons.svg('arrowLeft')}</button>
          <h1>플랭크</h1>
          <span style="width:36px"></span>
        </div>
        <div class="exercise-guide">1세트 = 플랭크 1분 · 휴식 1분, 전체완료 전까지 반복</div>
        <div class="plank-display">
          <div class="plank-phase-badge" id="plank-badge"></div>
          <div class="plank-time" id="plank-time">00:00</div>
          <div class="plank-sets" id="plank-sets">0세트 완료</div>
        </div>
        <div class="exercise-controls" id="plank-controls"></div>
      </div>
    `;
    container.querySelector('#back-btn').addEventListener('click', () => {
      if (tickHandle) clearInterval(tickHandle);
      Router.go('exercise');
    });
    renderControls(container);
    updateDisplay(container);
  }

  Router.register('exercise-plank', render);
})();
