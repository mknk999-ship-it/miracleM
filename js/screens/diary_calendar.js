(function () {
  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
  let viewYear, viewMonth; // viewMonth: 1-12

  function monthLabel(y, m) {
    return `${y}년 ${m}월`;
  }

  function buildDayCells(y, m, entriesByDate, todayStr) {
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
      const content = entriesByDate.get(dateStr);
      const hasPrayer = content && Util.hasPrayer(content);
      html += `
        <button class="diary-cal-day${isToday ? ' today' : ''}${content ? ' has-entry' : ''}${hasPrayer ? ' has-prayer' : ''}" data-date="${dateStr}">
          <span class="diary-cal-day-num">${d}</span>
          ${content ? `<span class="diary-cal-preview">${Util.escapeHtml(content)}</span>` : ''}
        </button>`;
    }
    return html;
  }

  async function loadAndRender(container) {
    const entries = await Api.listDiaryMonth(viewYear, viewMonth);
    const entriesByDate = new Map(entries.map((e) => [e.entry_date, e.content]));
    const todayStr = Util.todayStr();

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">${Icons.svg('arrowLeft')}</button>
          <h1>일기 달력</h1>
          <span style="width:36px"></span>
        </div>
        <div class="month-header">
          <button class="month-nav-btn" id="prev-month">${Icons.svg('chevronLeft')}</button>
          <h2 id="month-label">${monthLabel(viewYear, viewMonth)}</h2>
          <button class="month-nav-btn" id="next-month">${Icons.svg('chevronRight')}</button>
        </div>
        <div class="diary-cal-grid">
          ${WEEKDAYS.map((w) => `<div class="cal-weekday">${w}</div>`).join('')}
          ${buildDayCells(viewYear, viewMonth, entriesByDate, todayStr)}
        </div>
      </div>
    `;

    container.querySelector('#back-btn').addEventListener('click', () => Router.go('diary'));
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
      el.addEventListener('click', () => {
        location.hash = `#/diary?date=${el.dataset.date}`;
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

  Router.register('diary-calendar', render);
})();
