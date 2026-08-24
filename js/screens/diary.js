(function () {
  let saveTimer = null;

  function shiftDate(dateStr, delta) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d + delta);
    return Util.toDateStr(date);
  }

  async function render(container, params) {
    const dateStr = params.get('date') || Util.todayStr();
    const isToday = dateStr === Util.todayStr();

    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <h1>일기</h1>
          <button class="icon-btn" id="go-calendar" title="달력으로 보기">${Icons.svg('calendar')}</button>
        </div>
        <div class="diary-date-picker">
          <button class="month-nav-btn" id="prev-day">${Icons.svg('chevronLeft')}</button>
          <span class="diary-date-label">${Util.formatDateLabel(dateStr)}${isToday ? ' · 오늘' : ''}</span>
          <button class="month-nav-btn" id="next-day">${Icons.svg('chevronRight')}</button>
        </div>
        <textarea class="diary-editor" id="diary-editor" placeholder="오늘 하루는 어땠나요?"></textarea>
        <div class="diary-footer-row">
          <div class="hint-text" id="save-status">&nbsp;</div>
          <button class="text-btn-danger hidden" id="delete-diary-btn">${Icons.svg('trash')} 삭제</button>
        </div>
        <button class="btn btn-block diary-list-btn" id="go-list">${Icons.svg('book')} 리스트로 보기</button>
      </div>
    `;

    const editor = container.querySelector('#diary-editor');
    const statusEl = container.querySelector('#save-status');
    editor.disabled = true;

    async function flushSave() {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
        try {
          await Api.upsertDiary(dateStr, editor.value);
        } catch (e) {
          Util.toast(e.message || '저장 중 오류가 발생했습니다.', { error: true });
        }
      }
    }

    container.querySelector('#go-calendar').addEventListener('click', async () => {
      await flushSave();
      Router.go('diary-calendar');
    });
    container.querySelector('#go-list').addEventListener('click', async () => {
      await flushSave();
      Router.go('diary-list');
    });
    container.querySelector('#prev-day').addEventListener('click', async () => {
      await flushSave();
      location.hash = `#/diary?date=${shiftDate(dateStr, -1)}`;
    });
    container.querySelector('#next-day').addEventListener('click', async () => {
      await flushSave();
      location.hash = `#/diary?date=${shiftDate(dateStr, 1)}`;
    });

    const onLeave = () => { flushSave(); };
    window.addEventListener('hashchange', onLeave, { once: true });

    const deleteBtn = container.querySelector('#delete-diary-btn');
    deleteBtn.addEventListener('click', async () => {
      if (!confirm('이 날짜의 일기를 정말 삭제할까요?')) return;
      clearTimeout(saveTimer);
      saveTimer = null;
      try {
        await Api.deleteDiary(dateStr);
        editor.value = '';
        deleteBtn.classList.add('hidden');
        statusEl.textContent = '삭제됨';
      } catch (e) {
        Util.toast(e.message || '삭제 중 오류가 발생했습니다.', { error: true });
      }
    });

    const existing = await Api.getDiary(dateStr);
    editor.value = existing ? existing.content : '';
    editor.disabled = false;
    deleteBtn.classList.toggle('hidden', !existing);

    editor.addEventListener('input', () => {
      deleteBtn.classList.remove('hidden');
      statusEl.textContent = '저장 중...';
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        saveTimer = null;
        try {
          await Api.upsertDiary(dateStr, editor.value);
          statusEl.textContent = '저장됨';
        } catch (e) {
          statusEl.textContent = '';
          Util.toast(e.message || '저장 중 오류가 발생했습니다.', { error: true });
        }
      }, 700);
    });
  }

  Router.register('diary', render);
})();
