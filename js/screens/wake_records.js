(function () {
  async function render(container) {
    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">${Icons.svg('arrowLeft')}</button>
          <h1>기상 기록</h1>
          <span style="width:36px"></span>
        </div>
        <div id="wake-list-body"><div class="spinner"></div></div>
      </div>
    `;
    container.querySelector('#back-btn').addEventListener('click', () => Router.go('morning'));

    const bodyEl = container.querySelector('#wake-list-body');
    const logs = await Api.listWakeLogs(90, 0);
    if (logs.length === 0) {
      bodyEl.innerHTML = '<div class="empty-state">아직 기록된 기상 시각이 없어요.</div>';
      return;
    }
    bodyEl.innerHTML = logs.map((l) => `
      <div class="diary-list-item">
        <div class="diary-list-content">
          <div class="diary-list-date">${Util.formatDateLabel(l.wake_date)}</div>
          <div class="diary-list-preview">${Util.formatTimeOfDay(l.wake_time)}</div>
        </div>
        <button class="diary-list-delete" data-id="${l.id}" title="삭제">${Icons.svg('trash')}</button>
      </div>
    `).join('');

    bodyEl.querySelectorAll('.diary-list-delete').forEach((el) => {
      el.addEventListener('click', async () => {
        if (!confirm('이 기상 기록을 삭제할까요?')) return;
        try {
          await Api.deleteWakeLog(parseInt(el.dataset.id, 10));
          render(container);
        } catch (err) {
          Util.toast(err.message || '삭제 중 오류가 발생했습니다.', { error: true });
        }
      });
    });
  }

  Router.register('wake-records', render);
})();
