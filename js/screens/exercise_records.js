(function () {
  async function renderList(container, setCount, onChanged) {
    const listEl = container.querySelector('#records-list');
    listEl.innerHTML = '<div class="spinner"></div>';
    const records = await Api.listExerciseRecords(setCount);
    if (records.length === 0) {
      listEl.innerHTML = '<div class="empty-state">아직 기록이 없어요.</div>';
      return;
    }
    listEl.innerHTML = records.map((r) => `
      <div class="rank-row${r.rank <= 3 ? ' rank-' + r.rank : ''}" data-id="${r.id}">
        <div class="rank-num">${r.rank}</div>
        <div class="rank-info">
          <div class="rank-time">${Util.formatStopwatch(r.total_seconds)}</div>
          <div class="rank-date">${Util.formatShortDate(r.log_date)} · ${r.total_sets}세트</div>
        </div>
        <button class="rank-delete" data-id="${r.id}" title="삭제">${Icons.svg('trash')}</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.rank-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('이 운동 기록을 정말 삭제할까요?')) return;
        try {
          await Api.deleteExerciseLog(parseInt(btn.dataset.id, 10));
          onChanged();
        } catch (e) {
          Util.toast(e.message || '삭제 중 오류가 발생했습니다.', { error: true });
        }
      });
    });
  }

  async function render(container, params) {
    const initialSet = params.get('set') ? parseInt(params.get('set'), 10) : null;

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">${Icons.svg('arrowLeft')}</button>
          <h1>운동 랭킹</h1>
          <span style="width:36px"></span>
        </div>
        <div class="rank-filter" id="rank-filter"></div>
        <div id="records-list"><div class="spinner"></div></div>
      </div>
    `;
    container.querySelector('#back-btn').addEventListener('click', () => Router.go('exercise'));

    const filterEl = container.querySelector('#rank-filter');
    let activeSet = initialSet;

    function renderFilterButtons(setCounts) {
      if (activeSet !== null && !setCounts.some((s) => s.total_sets === activeSet)) {
        activeSet = null;
      }
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
          renderFilterButtons(setCounts);
          renderList(container, activeSet, refreshAll);
        });
      });
    }

    async function refreshAll() {
      const setCounts = await Api.listExerciseSetCounts();
      renderFilterButtons(setCounts);
      await renderList(container, activeSet, refreshAll);
    }

    await refreshAll();
  }

  Router.register('exercise-records', render);
})();
