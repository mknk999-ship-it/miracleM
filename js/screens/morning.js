(function () {
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  let cardIndex = 0;
  let affirmations = [];
  let wakeViewYear, wakeViewMonth; // wakeViewMonth: 1-12

  function renderDeck(container) {
    const deckEl = container.querySelector('#affirmation-deck');
    if (!deckEl) return;
    if (affirmations.length === 0) {
      deckEl.innerHTML = `<div class="empty-state">등록된 확언이 없어요.<br>관리 화면에서 추가해보세요.</div>`;
      return;
    }
    const card = affirmations[cardIndex];
    deckEl.innerHTML = `
      <div class="affirmation-card">${Util.escapeHtml(card.content)}</div>
      <div class="affirmation-progress">${cardIndex + 1} / ${affirmations.length}</div>
      <div class="affirmation-nav">
        <button class="btn" id="aff-prev" ${cardIndex === 0 ? 'disabled style="opacity:.4"' : ''}>이전</button>
        <button class="btn btn-primary" id="aff-next" ${cardIndex === affirmations.length - 1 ? 'disabled style="opacity:.4"' : ''}>다음</button>
      </div>
    `;
    deckEl.querySelector('#aff-prev')?.addEventListener('click', () => {
      if (cardIndex > 0) { cardIndex -= 1; renderDeck(container); }
    });
    deckEl.querySelector('#aff-next')?.addEventListener('click', () => {
      if (cardIndex < affirmations.length - 1) { cardIndex += 1; renderDeck(container); }
    });
  }

  function renderWakeState(container, wakeTimeIso) {
    const btn = container.querySelector('#wake-btn');
    if (wakeTimeIso) {
      btn.classList.add('done');
      btn.innerHTML = `기상 완료<span class="wake-sub">${Util.formatTimeOfDay(wakeTimeIso)}</span>`;
    } else {
      btn.classList.remove('done');
      btn.innerHTML = `기상 완료<span class="wake-sub">눌러서 기록하기</span>`;
    }
  }

  async function refreshTodayWakeState(container) {
    const wakeRow = await Api.getWake(Util.todayStr());
    renderWakeState(container, wakeRow ? wakeRow.wake_time : null);
  }

  async function handleWake(container) {
    const btn = container.querySelector('#wake-btn');
    if (btn.classList.contains('done')) {
      Util.toast('오늘은 이미 기상을 기록했어요.');
      return;
    }
    btn.disabled = true;
    try {
      await Api.logWake(Util.todayStr());
      await Promise.all([refreshTodayWakeState(container), loadWakeCalendar(container)]);
      Util.toast('기상을 기록했어요. 좋은 아침이에요!');
    } catch (e) {
      Util.toast(e.message || '저장 중 오류가 발생했습니다.', { error: true });
    } finally {
      btn.disabled = false;
    }
  }

  function toLocalHHMM(iso) {
    const d = new Date(iso);
    return `${Util.pad(d.getHours())}:${Util.pad(d.getMinutes())}`;
  }

  function wakeMonthLabel(y, m) {
    return `${y}년 ${m}월`;
  }

  function buildWakeDayCells(y, m, wakeMap, todayStr) {
    const firstDay = new Date(y, m - 1, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(y, m, 0).getDate();

    let html = '';
    for (let i = 0; i < startOffset; i++) {
      html += `<div class="cal-day empty"></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${Util.pad(m)}-${Util.pad(d)}`;
      const isToday = dateStr === todayStr;
      const iso = wakeMap.get(dateStr);
      html += `
        <button class="cal-day${isToday ? ' today' : ''}" data-date="${dateStr}">
          <span class="day-num">${d}</span>
          <span class="wake-time-label">${iso ? toLocalHHMM(iso) : ''}</span>
        </button>`;
    }
    return html;
  }

  function openWakeTimeSheet(container, dateStr, currentIso, onSaved) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    backdrop.innerHTML = `
      <div class="sheet">
        <h3>${Util.formatDateLabel(dateStr)} 기상 시각</h3>
        <input type="time" id="wake-time-input" value="${currentIso ? toLocalHHMM(currentIso) : ''}"
          style="width:100%;padding:14px;font-size:16px;margin-bottom:14px;">
        <div class="sheet-actions">
          ${currentIso ? '<button class="btn btn-danger" id="wake-time-clear">삭제</button>' : ''}
          <button class="btn" id="wake-time-cancel">취소</button>
          <button class="btn btn-primary" id="wake-time-save">저장</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    backdrop.querySelector('#wake-time-cancel').addEventListener('click', () => backdrop.remove());

    backdrop.querySelector('#wake-time-clear')?.addEventListener('click', async () => {
      try {
        await Api.setWakeTime(dateStr, null);
        backdrop.remove();
        onSaved();
      } catch (e) {
        Util.toast(e.message || '처리 중 오류가 발생했습니다.', { error: true });
      }
    });

    backdrop.querySelector('#wake-time-save').addEventListener('click', async () => {
      const val = backdrop.querySelector('#wake-time-input').value;
      if (!val) { Util.toast('시각을 입력해주세요.', { error: true }); return; }
      const [hh, mm] = val.split(':').map(Number);
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
      try {
        await Api.setWakeTime(dateStr, dt.toISOString());
        backdrop.remove();
        onSaved();
      } catch (e) {
        Util.toast(e.message || '저장 중 오류가 발생했습니다.', { error: true });
      }
    });
  }

  async function loadWakeCalendar(container) {
    const wrap = container.querySelector('#wake-calendar-wrap');
    if (!wrap) return;
    const logs = await Api.listWakeMonth(wakeViewYear, wakeViewMonth);
    const wakeMap = new Map(logs.map((l) => [l.wake_date, l.wake_time]));
    const todayStr = Util.todayStr();

    wrap.innerHTML = `
      <div class="month-header">
        <button class="month-nav-btn" id="wake-prev-month">${Icons.svg('chevronLeft')}</button>
        <h2>${wakeMonthLabel(wakeViewYear, wakeViewMonth)}</h2>
        <button class="month-nav-btn" id="wake-next-month">${Icons.svg('chevronRight')}</button>
      </div>
      <div class="calendar-grid">
        ${WEEKDAYS.map((w) => `<div class="cal-weekday">${w}</div>`).join('')}
        ${buildWakeDayCells(wakeViewYear, wakeViewMonth, wakeMap, todayStr)}
      </div>
      <div class="hint-text">날짜를 터치하면 기상 시각을 입력하거나 고칠 수 있어요</div>
    `;

    wrap.querySelector('#wake-prev-month').addEventListener('click', () => {
      wakeViewMonth -= 1;
      if (wakeViewMonth < 1) { wakeViewMonth = 12; wakeViewYear -= 1; }
      loadWakeCalendar(container);
    });
    wrap.querySelector('#wake-next-month').addEventListener('click', () => {
      wakeViewMonth += 1;
      if (wakeViewMonth > 12) { wakeViewMonth = 1; wakeViewYear += 1; }
      loadWakeCalendar(container);
    });

    wrap.querySelectorAll('.cal-day[data-date]').forEach((el) => {
      el.addEventListener('click', () => {
        const dateStr = el.dataset.date;
        openWakeTimeSheet(container, dateStr, wakeMap.get(dateStr) || null, async () => {
          await Promise.all([loadWakeCalendar(container), refreshTodayWakeState(container)]);
        });
      });
    });
  }

  async function render(container) {
    const now = new Date();
    if (wakeViewYear === undefined) {
      wakeViewYear = now.getFullYear();
      wakeViewMonth = now.getMonth() + 1;
    }

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <h1>아침 루틴</h1>
        </div>
        <div class="wake-hero">
          <button class="wake-btn" id="wake-btn">기상 완료</button>
        </div>
        <div class="section-title-row">
          <div class="section-title">오늘의 확언</div>
          <button class="text-link" id="go-admin">확언편집</button>
        </div>
        <div class="affirmation-deck" id="affirmation-deck"><div class="spinner"></div></div>

        <div class="section-title">기상 기록</div>
        <div id="wake-calendar-wrap"><div class="spinner"></div></div>
      </div>
    `;

    container.querySelector('#go-admin').addEventListener('click', () => Router.go('affirmations-admin'));
    container.querySelector('#wake-btn').addEventListener('click', () => handleWake(container));

    const [wakeRow, affList] = await Promise.all([
      Api.getWake(Util.todayStr()),
      Api.getAffirmations(),
    ]);
    renderWakeState(container, wakeRow ? wakeRow.wake_time : null);
    affirmations = affList;
    cardIndex = 0;
    renderDeck(container);

    await loadWakeCalendar(container);
  }

  Router.register('morning', render);
})();
