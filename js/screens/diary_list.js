(function () {
  async function render(container) {
    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">${Icons.svg('arrowLeft')}</button>
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
      <div class="diary-list-item">
        <button class="diary-list-content" data-date="${e.entry_date}">
          <div class="diary-list-date">${Util.formatDateLabel(e.entry_date)}</div>
          <div class="diary-list-preview">${Util.escapeHtml(e.content) || '(내용 없음)'}</div>
        </button>
        <button class="diary-list-delete" data-date="${e.entry_date}" title="삭제">${Icons.svg('trash')}</button>
      </div>
    `).join('');

    bodyEl.querySelectorAll('.diary-list-content').forEach((el) => {
      el.addEventListener('click', () => {
        location.hash = `#/diary?date=${el.dataset.date}`;
      });
    });

    bodyEl.querySelectorAll('.diary-list-delete').forEach((el) => {
      el.addEventListener('click', async () => {
        if (!confirm('이 날짜의 일기를 정말 삭제할까요?')) return;
        try {
          await Api.deleteDiary(el.dataset.date);
          render(container);
        } catch (err) {
          Util.toast(err.message || '삭제 중 오류가 발생했습니다.', { error: true });
        }
      });
    });
  }

  Router.register('diary-list', render);
})();
