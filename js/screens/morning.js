(function () {
  let cardIndex = 0;
  let affirmations = [];

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

  async function handleWake(container) {
    const btn = container.querySelector('#wake-btn');
    btn.disabled = true;
    try {
      const row = await Api.logWake(Util.todayStr());
      renderWakeState(container, row.wake_time);
      Util.toast('기상을 기록했어요. 좋은 아침이에요!');
    } catch (e) {
      Util.toast(e.message || '저장 중 오류가 발생했습니다.', { error: true });
    } finally {
      btn.disabled = false;
    }
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

  async function render(container) {
    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <h1>아침 루틴</h1>
          <button class="icon-btn" id="go-admin" title="확언 관리">⚙️</button>
        </div>
        <div class="wake-hero">
          <button class="wake-btn" id="wake-btn">기상 완료</button>
        </div>
        <div class="section-title">오늘의 확언</div>
        <div class="affirmation-deck" id="affirmation-deck"><div class="spinner"></div></div>
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
  }

  Router.register('morning', render);
})();
