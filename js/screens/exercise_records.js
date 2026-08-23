(function () {
  async function renderList(container, setCount) {
    const listEl = container.querySelector('#records-list');
    listEl.innerHTML = '<div class="spinner"></div>';
    const records = await Api.listExerciseRecords(setCount);
    if (records.length === 0) {
      listEl.innerHTML = '<div class="empty-state">아직 기록이 없어요.</div>';
      return;
    }
    listEl.innerHTML = records.map((r) => `
      <div class="rank-row${r.rank <= 3 ? ' rank-' + r.rank : ''}">
        <div class="rank-num">${r.rank}</div>
        <div class="rank-info">
          <div class="rank-time">${Util.formatStopwatch(r.total_seconds)}</div>
          <div class="rank-date">${Util.formatShortDate(r.log_date)} · ${r.total_sets}세트</div>
        </div>
      </div>
    `).join('');
  }

  async function render(container, params) {
    const initialSet = params.get('set') ? parseInt(params.get('set'), 10) : null;

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">←</button>
          <h1>운동 랭킹</h1>
          <span style="width:36px"></span>
        </div>
        <div class="rank-filter" id="rank-filter"></div>
        <div id="records-list"><div class="spinner"></div></div>
      </div>
    `;
    container.querySelector('#back-btn').addEventListener('click', () => Router.go('exercise'));

    const setCounts = await Api.listExerciseSetCounts();
    const filterEl = container.querySelector('#rank-filter');
    let activeSet = initialSet;
    if (activeSet !== null && !setCounts.some((s) => s.total_sets === activeSet)) {
      activeSet = null;
    }

    function renderFilterButtons() {
      const chips = [{ total_sets: null, record_count: null, label: '전체' }, ...setCounts];
      filterEl.innerHTML = chips.map((c) => `
        <button class="rank-filter-btn${activeSet === c.total_sets ? ' active' : ''}" data-set="${c.total_sets ?? ''}">
          ${c.label || c.total_sets + '세트'}
        </button>
      `).join('');
      filterEl.querySelectorAll('.rank-filter-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          const v = btn.dataset.set;
          activeSet = v === '' ? null : parseInt(v, 10);
          renderFilterButtons();
          renderList(container, activeSet);
        });
      });
    }

    renderFilterButtons();
    await renderList(container, activeSet);
  }

  Router.register('exercise-records', render);
})();
