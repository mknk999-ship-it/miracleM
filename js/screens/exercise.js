(function () {
  let state = 'idle'; // idle | running | saving
  let startTime = 0;
  let sets = 0;
  let laps = [];
  let tickHandle = null;

  function elapsedSeconds() {
    return (Date.now() - startTime) / 1000;
  }

  function renderLapList(container) {
    const el = container.querySelector('#lap-list');
    if (!el) return;
    if (laps.length === 0) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = laps
      .slice()
      .reverse()
      .map((l) => `
        <div class="lap-row">
          <span class="lap-set">${l.set_no}세트</span>
          <span class="lap-time">${Util.formatStopwatch(l.elapsed_seconds)}</span>
        </div>
      `).join('');
  }

  function updateDisplay(container) {
    const timeEl = container.querySelector('#stopwatch-time');
    const setsEl = container.querySelector('#stopwatch-sets');
    if (!timeEl) return;
    timeEl.textContent = Util.formatStopwatch(state === 'running' ? elapsedSeconds() : (laps.length ? laps[laps.length - 1].elapsed_seconds : 0));
    setsEl.textContent = `${sets}세트 완료`;
  }

  function renderControls(container) {
    const el = container.querySelector('#exercise-controls');
    if (state === 'idle') {
      el.innerHTML = `<button class="btn btn-primary btn-lg btn-block" id="start-btn">시작</button>`;
      el.querySelector('#start-btn').addEventListener('click', () => startExercise(container));
    } else {
      el.innerHTML = `
        <button class="btn btn-lg" id="set-btn">세트완료</button>
        <button class="btn btn-primary btn-lg" id="finish-btn">전체완료</button>
      `;
      el.querySelector('#set-btn').addEventListener('click', () => completeSet(container));
      el.querySelector('#finish-btn').addEventListener('click', () => finishExercise(container));
    }
  }

  function startExercise(container) {
    state = 'running';
    startTime = Date.now();
    sets = 0;
    laps = [];
    renderControls(container);
    renderLapList(container);
    tickHandle = setInterval(() => updateDisplay(container), 30);
  }

  function completeSet(container) {
    if (state !== 'running') return;
    sets += 1;
    laps.push({ set_no: sets, elapsed_seconds: elapsedSeconds() });
    updateDisplay(container);
    renderLapList(container);
  }

  async function finishExercise(container) {
    if (state !== 'running') return;
    const totalSeconds = elapsedSeconds();
    clearInterval(tickHandle);
    state = 'idle';

    const lapsPayload = laps.map((l, idx) => ({
      set_no: l.set_no,
      elapsed_seconds: Math.round(l.elapsed_seconds * 100) / 100,
      lap_seconds: Math.round((l.elapsed_seconds - (idx > 0 ? laps[idx - 1].elapsed_seconds : 0)) * 100) / 100,
    }));

    try {
      const result = await Api.saveExercise(Util.todayStr(), sets, Math.round(totalSeconds * 100) / 100, lapsPayload);
      showResultModal(container, sets, totalSeconds, result);
    } catch (e) {
      Util.toast(e.message || '저장 중 오류가 발생했습니다.', { error: true });
    }

    sets = 0;
    laps = [];
    renderControls(container);
    renderLapList(container);
    updateDisplay(container);
  }

  function showResultModal(container, totalSets, totalSeconds, result) {
    const backdrop = document.createElement('div');
    backdrop.className = 'result-modal-backdrop';
    backdrop.innerHTML = `
      <div class="result-modal${result.is_best ? ' is-best' : ''}">
        <div class="result-rank">${result.is_best ? `${Icons.svg('trophy')} 역대 1위` : `역대 ${result.rank}위`}</div>
        <div class="result-sub">${result.is_best ? '최고 기록을 달성했어요!' : `${totalSets}세트 부문 · 총 ${result.total_in_group}건 중`}</div>
        <div class="result-stats">
          <div>${totalSets}<span>세트</span></div>
          <div>${Util.formatStopwatch(totalSeconds)}<span>총 시간</span></div>
        </div>
        <div class="sheet-actions">
          <button class="btn" id="result-close">닫기</button>
          <button class="btn btn-primary" id="result-rank-view">랭킹 보기</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#result-close').addEventListener('click', () => backdrop.remove());
    backdrop.querySelector('#result-rank-view').addEventListener('click', () => {
      backdrop.remove();
      Router.go(`exercise-records?set=${totalSets}`);
    });

    if (result.is_best) {
      Confetti.fire();
    }
  }

  async function render(container) {
    state = 'idle';
    sets = 0;
    laps = [];
    if (tickHandle) clearInterval(tickHandle);

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <h1>운동</h1>
          <button class="icon-btn" id="go-records" title="기록/랭킹">${Icons.svg('trophy')}</button>
        </div>
        <div class="exercise-guide">1세트 = 푸쉬업 10 · 풀업 5 · 스쿼트 15</div>
        <div class="stopwatch-display">
          <div class="stopwatch-time" id="stopwatch-time">00:00.00</div>
          <div class="stopwatch-sets" id="stopwatch-sets">0세트 완료</div>
        </div>
        <div class="exercise-controls" id="exercise-controls"></div>
        <div class="lap-list" id="lap-list"></div>
      </div>
    `;
    container.querySelector('#go-records').addEventListener('click', () => Router.go('exercise-records'));
    renderControls(container);
    updateDisplay(container);
  }

  Router.register('exercise', render);
})();
