(function () {
  function openEditSheet(container, item, onSaved) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    backdrop.innerHTML = `
      <div class="sheet">
        <h3>${item ? '확언 수정' : '확언 추가'}</h3>
        <textarea id="aff-content" placeholder="확언 문구를 입력하세요">${item ? Util.escapeHtml(item.content) : ''}</textarea>
        <div class="field-row">
          <span>노출 순서</span>
          <input type="text" id="aff-sort" inputmode="numeric" style="width:80px;text-align:center;padding:8px;" value="${item ? item.sort_order : 0}">
        </div>
        <div class="field-row">
          <span>활성화 (아침 화면에 노출)</span>
          <button type="button" class="switch ${item && !item.is_active ? '' : 'on'}" id="aff-active-switch"><span class="knob"></span></button>
        </div>
        <div class="sheet-actions">
          <button class="btn" id="aff-cancel">취소</button>
          <button class="btn btn-primary" id="aff-save">저장</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    let isActive = item ? item.is_active : true;
    const switchEl = backdrop.querySelector('#aff-active-switch');
    switchEl.addEventListener('click', () => {
      isActive = !isActive;
      switchEl.classList.toggle('on', isActive);
    });

    backdrop.querySelector('#aff-cancel').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

    backdrop.querySelector('#aff-save').addEventListener('click', async () => {
      const content = backdrop.querySelector('#aff-content').value.trim();
      const sortOrder = parseInt(backdrop.querySelector('#aff-sort').value, 10) || 0;
      if (!content) { Util.toast('내용을 입력해주세요.', { error: true }); return; }
      try {
        await Api.upsertAffirmation(item ? item.id : null, content, sortOrder, isActive);
        backdrop.remove();
        onSaved();
      } catch (e) {
        Util.toast(e.message || '저장 중 오류가 발생했습니다.', { error: true });
      }
    });
  }

  async function refreshList(container) {
    const listEl = container.querySelector('#admin-list');
    listEl.innerHTML = '<div class="spinner"></div>';
    const items = await Api.adminListAffirmations();
    if (items.length === 0) {
      listEl.innerHTML = '<div class="empty-state">등록된 확언이 없어요.</div>';
      return;
    }
    listEl.innerHTML = items.map((it) => `
      <div class="admin-item${it.is_active ? '' : ' inactive'}" data-id="${it.id}">
        <div class="admin-content">${Util.escapeHtml(it.content)}</div>
        <div class="admin-actions">
          <button class="admin-edit" title="수정">✏️</button>
          <button class="admin-delete" title="삭제">🗑️</button>
        </div>
      </div>
    `).join('');

    listEl.querySelectorAll('.admin-item').forEach((row) => {
      const id = parseInt(row.dataset.id, 10);
      const item = items.find((i) => i.id === id);
      row.querySelector('.admin-edit').addEventListener('click', () => {
        openEditSheet(container, item, () => refreshList(container));
      });
      row.querySelector('.admin-delete').addEventListener('click', async () => {
        if (!confirm('이 확언을 삭제할까요?')) return;
        try {
          await Api.deleteAffirmation(id);
          refreshList(container);
        } catch (e) {
          Util.toast(e.message || '삭제 중 오류가 발생했습니다.', { error: true });
        }
      });
    });
  }

  async function render(container) {
    container.innerHTML = `
      <div class="screen">
        <div class="topbar">
          <button class="icon-btn" id="back-btn">←</button>
          <h1>확언 관리</h1>
          <span style="width:36px"></span>
        </div>
        <div id="admin-list"><div class="spinner"></div></div>
      </div>
      <button class="fab" id="add-fab">+</button>
    `;
    container.querySelector('#back-btn').addEventListener('click', () => Router.go('morning'));
    container.querySelector('#add-fab').addEventListener('click', () => {
      openEditSheet(container, null, () => refreshList(container));
    });
    await refreshList(container);
  }

  Router.register('affirmations-admin', render);
})();
