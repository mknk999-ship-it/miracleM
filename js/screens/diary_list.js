(function () {
  async function render(container) {
    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">←</button>
          <h1>지난 일기</h1>
          <span style="width:36px"></span>
        </div>
        <div id="diary-list-body"><div class="spinner"></div></div>
      </div>
    `;
    container.querySelector('#back-btn').addEventListener('click', () => Router.go('diary'));

    const bodyEl = container.querySelector('#diary-list-body');
    const entries = await Api.listDiary(60, 0);
    if (entries.length === 0) {
      bodyEl.innerHTML = '<div class="empty-state">아직 작성한 일기가 없어요.</div>';
      return;
    }
    bodyEl.innerHTML = entries.map((e) => `
      <button class="diary-list-item" data-date="${e.entry_date}" style="display:block;width:100%;text-align:left;">
        <div class="diary-list-date">${Util.formatDateLabel(e.entry_date)}</div>
        <div class="diary-list-preview">${Util.escapeHtml(e.content) || '(내용 없음)'}</div>
      </button>
    `).join('');

    bodyEl.querySelectorAll('.diary-list-item').forEach((el) => {
      el.addEventListener('click', () => {
        location.hash = `#/diary?date=${el.dataset.date}`;
      });
    });
  }

  Router.register('diary-list', render);
})();
