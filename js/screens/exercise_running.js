(function () {
  const WHEEL_ITEM_HEIGHT = 44;

  function createWheel(viewportEl, { min, max, initial, onChange, circular = false }) {
    const rangeSize = max - min + 1;
    const REPEATS = circular ? 5 : 1;
    const middleRepeat = Math.floor(REPEATS / 2);

    const values = [];
    for (let r = 0; r < REPEATS; r++) {
      for (let v = min; v <= max; v++) values.push(v);
    }

    viewportEl.innerHTML = `
      <div class="wheel-list">
        ${values.map((v) => `<div class="wheel-item" data-value="${v}">${Util.pad(v)}</div>`).join('')}
      </div>
    `;
    const items = Array.from(viewportEl.querySelectorAll('.wheel-item'));

    function idxForValue(v) { return middleRepeat * rangeSize + (v - min); }

    let currentIdx = idxForValue(Math.min(Math.max(initial, min), max));
    let current = values[currentIdx];

    function setSelectedIdx(idx) {
      currentIdx = idx;
      current = values[idx];
      items.forEach((it, i) => it.classList.toggle('selected', i === idx));
    }

    function scrollToIdx(idx, smooth) {
      viewportEl.scrollTo({ top: idx * WHEEL_ITEM_HEIGHT, behavior: smooth ? 'smooth' : 'auto' });
    }

    scrollToIdx(currentIdx, false);
    setSelectedIdx(currentIdx);

    let scrollTimer = null;
    viewportEl.addEventListener('scroll', () => {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        let idx = Math.min(Math.max(Math.round(viewportEl.scrollTop / WHEEL_ITEM_HEIGHT), 0), values.length - 1);

        if (circular) {
          const repeatIndex = Math.floor(idx / rangeSize);
          if (repeatIndex !== middleRepeat) {
            // 바깥쪽 사본으로 넘어갔으면, 같은 값의 가운데 사본으로 티 안 나게 되돌린다 (무한 스크롤처럼 보이게)
            idx = idxForValue(values[idx]);
            viewportEl.scrollTop = idx * WHEEL_ITEM_HEIGHT;
          } else if (viewportEl.scrollTop !== idx * WHEEL_ITEM_HEIGHT) {
            scrollToIdx(idx, true);
          }
        } else if (viewportEl.scrollTop !== idx * WHEEL_ITEM_HEIGHT) {
          scrollToIdx(idx, true);
        }

        if (idx !== currentIdx) {
          const changed = values[idx] !== current;
          setSelectedIdx(idx);
          if (changed) onChange(current);
        }
      }, 120);
    });

    return {
      get value() { return current; },
      set(v) {
        const idx = idxForValue(v);
        scrollToIdx(idx, true);
        setSelectedIdx(idx);
      },
    };
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
      ${logs.map((log) => {
        const g = Util.runningGradeLabel(log.distance_km, log.total_seconds);
        return `
          <div class="rank-row" data-id="${log.id}">
            <div class="rank-info">
              <div class="rank-time">${Number(log.distance_km).toFixed(2)}km · ${Util.formatDuration(log.total_seconds)} · <span class="run-grade${g.pass ? '' : ' fail'}">${g.label}</span></div>
              <div class="rank-date">${Util.formatTimeOfDay(log.created_at)}</div>
            </div>
            <button class="rank-delete" data-id="${log.id}" title="삭제">${Icons.svg('trash')}</button>
          </div>
        `;
      }).join('')}
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
    let distanceKm = 0;

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">${Icons.svg('arrowLeft')}</button>
          <h1>달리기</h1>
          <span style="width:36px"></span>
        </div>
        <div class="exercise-guide">달린 거리와 기록(시간)을 입력하고 저장하세요</div>

        <div class="run-section">
          <div class="section-title-row">
            <div class="section-title">거리</div>
            <button class="text-link" id="run-distance-reset">초기화</button>
          </div>
          <div class="run-distance-display">
            <span id="run-distance-value">0.0</span><span class="run-distance-unit">km</span>
          </div>
          <div class="run-distance-buttons">
            <button type="button" class="run-chip" data-add="0.5">+500m</button>
            <button type="button" class="run-chip" data-add="1">+1km</button>
            <button type="button" class="run-chip" data-add="3">+3km</button>
          </div>
        </div>

        <div class="run-section">
          <div class="section-title">기록</div>
          <div class="run-wheel-row">
            <div class="wheel-highlight"></div>
            <div class="run-wheel-group">
              <div class="wheel-viewport" id="wheel-minutes"></div>
              <div class="run-wheel-caption">분</div>
            </div>
            <div class="run-wheel-group">
              <div class="wheel-viewport" id="wheel-seconds"></div>
              <div class="run-wheel-caption">초</div>
            </div>
          </div>
          <div class="run-grade-preview" id="run-grade-preview"></div>
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

    const distanceValueEl = container.querySelector('#run-distance-value');
    const gradePreviewEl = container.querySelector('#run-grade-preview');

    function updateDistanceDisplay() {
      distanceValueEl.textContent = distanceKm.toFixed(1);
    }

    function updateGradePreview() {
      const totalSeconds = minutesWheel.value * 60 + secondsWheel.value;
      if (!distanceKm || distanceKm <= 0 || totalSeconds <= 0) {
        gradePreviewEl.innerHTML = '';
        return;
      }
      const g = Util.runningGradeLabel(distanceKm, totalSeconds);
      const note = distanceKm < 3 ? '3km 이상부터 등급 판정' : '3km 기준';
      gradePreviewEl.innerHTML = `${note} · <span class="run-grade${g.pass ? '' : ' fail'}">${g.label}</span>`;
    }

    container.querySelectorAll('.run-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        distanceKm = Math.round((distanceKm + Number(btn.dataset.add)) * 10) / 10;
        updateDistanceDisplay();
        updateGradePreview();
      });
    });
    container.querySelector('#run-distance-reset').addEventListener('click', () => {
      distanceKm = 0;
      updateDistanceDisplay();
      updateGradePreview();
    });

    const minutesWheel = createWheel(container.querySelector('#wheel-minutes'), { min: 0, max: 300, initial: 0, onChange: updateGradePreview });
    const secondsWheel = createWheel(container.querySelector('#wheel-seconds'), { min: 0, max: 59, initial: 0, onChange: updateGradePreview, circular: true });

    container.querySelector('#save-run-btn').addEventListener('click', async () => {
      const totalSeconds = minutesWheel.value * 60 + secondsWheel.value;

      if (!distanceKm || distanceKm <= 0) {
        Util.toast('거리를 입력해주세요.', { error: true });
        return;
      }
      if (totalSeconds <= 0) {
        Util.toast('기록(시간)을 입력해주세요.', { error: true });
        return;
      }

      const g = Util.runningGradeLabel(distanceKm, totalSeconds);
      try {
        await Api.saveExercise(Util.todayStr(), 1, totalSeconds, [], 'running', distanceKm);
        distanceKm = 0;
        updateDistanceDisplay();
        minutesWheel.set(0);
        secondsWheel.set(0);
        updateGradePreview();
        Util.toast(`달리기 기록이 저장되었어요! (${g.label})`);
        await refreshTodayLogs(container);
      } catch (e) {
        Util.toast(e.message || '저장 중 오류가 발생했습니다.', { error: true });
      }
    });

    await refreshTodayLogs(container);
  }

  Router.register('exercise-running', render);
})();
