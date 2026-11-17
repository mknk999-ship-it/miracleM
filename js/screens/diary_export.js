(function () {
  function renderEntry(entry) {
    const parsed = Util.splitPrayerContent(entry.content);
    const mainText = parsed.main ? Util.escapeHtml(parsed.main).replace(/\n/g, '<br>') : '<span class="diary-export-empty">(본문 없음)</span>';
    const prayerBlock = parsed.prayer !== null ? `
      <div class="diary-export-prayer">
        <div class="diary-export-prayer-label">기도문</div>
        <div class="diary-export-prayer-text">${parsed.prayer ? Util.escapeHtml(parsed.prayer).replace(/\n/g, '<br>') : '<span class="diary-export-empty">(내용 없음)</span>'}</div>
      </div>
    ` : '';
    return `
      <article class="diary-export-entry">
        <h2 class="diary-export-date">${Util.formatDateLabel(entry.entry_date)}</h2>
        <div class="diary-export-main">${mainText}</div>
        ${prayerBlock}
      </article>
    `;
  }

  async function render(container) {
    container.innerHTML = `
      <div class="screen diary-export-screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">${Icons.svg('arrowLeft')}</button>
          <h1>일기 · 기도 모아보기</h1>
          <button class="text-link" id="print-btn">인쇄</button>
        </div>
        <div id="diary-export-body"><div class="spinner"></div></div>
      </div>
    `;
    container.querySelector('#back-btn').addEventListener('click', () => Router.go('diary-list'));
    container.querySelector('#print-btn').addEventListener('click', () => window.print());

    const bodyEl = container.querySelector('#diary-export-body');
    let entries;
    try {
      entries = await Api.listDiary(100000, 0);
    } catch (e) {
      bodyEl.innerHTML = `<div class="empty-state">불러오지 못했어요: ${Util.escapeHtml(e.message || '')}</div>`;
      return;
    }
    if (entries.length === 0) {
      bodyEl.innerHTML = '<div class="empty-state">아직 작성한 일기가 없어요.</div>';
      return;
    }

    const sorted = entries.slice().sort((a, b) => a.entry_date.localeCompare(b.entry_date));
    const prayerCount = sorted.filter((e) => Util.hasPrayer(e.content)).length;

    bodyEl.innerHTML = `
      <div class="diary-export-summary">일기 ${sorted.length}개 · 기도문 ${prayerCount}개</div>
      ${sorted.map(renderEntry).join('')}
    `;
  }

  Router.register('diary-export', render);
})();
