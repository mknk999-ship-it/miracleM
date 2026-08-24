(function () {
  function openEditSheet(container, item, onSaved) {
    const backdrop = document.createElement('div');
    backdrop.className = 'sheet-backdrop';
    backdrop.innerHTML = `
      <div class="sheet">
        <h3>${item ? '메모 수정' : '메모 추가'}</h3>
        <textarea id="note-content" placeholder="메모 내용을 입력하세요">${item ? Util.escapeHtml(item.content) : ''}</textarea>
        <div class="field-row">
          <span>고정핀 (목록 상단 고정)</span>
          <button type="button" class="switch ${item && item.is_pinned ? 'on' : ''}" id="note-pin-switch"><span class="knob"></span></button>
        </div>
        <div class="sheet-actions">
          <button class="btn" id="note-cancel">취소</button>
          <button class="btn btn-primary" id="note-save">저장</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    let isPinned = item ? item.is_pinned : false;
    const switchEl = backdrop.querySelector('#note-pin-switch');
    switchEl.addEventListener('click', () => {
      isPinned = !isPinned;
      switchEl.classList.toggle('on', isPinned);
    });

    backdrop.querySelector('#note-cancel').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

    backdrop.querySelector('#note-save').addEventListener('click', async () => {
      const content = backdrop.querySelector('#note-content').value.trim();
      if (!content) { Util.toast('내용을 입력해주세요.', { error: true }); return; }
      try {
        await Api.upsertNote(item ? item.id : null, content, isPinned);
        backdrop.remove();
        onSaved();
      } catch (e) {
        Util.toast(e.message || '저장 중 오류가 발생했습니다.', { error: true });
      }
    });
  }

  function noteCardHtml(n) {
    return `
      <div class="note-card${n.is_pinned ? ' pinned' : ''}${n.is_completed ? ' completed' : ''}" data-id="${n.id}">
        ${n.is_pinned ? `<span class="note-pin-badge">${Icons.svg('pin')}</span>` : ''}
        <div class="note-content">${Util.escapeHtml(n.content)}</div>
        <div class="note-meta">
          <span>${Util.formatDateLabel(n.updated_at.slice(0, 10))}</span>
          <div class="note-actions">
            <button class="note-pin-toggle">${n.is_pinned ? '고정 해제' : '고정'}</button>
            <button class="note-complete-toggle">${n.is_completed ? '완료 취소' : '완료'}</button>
            <button class="note-edit">수정</button>
            <button class="note-delete danger">삭제</button>
          </div>
        </div>
      </div>
    `;
  }

  function wireNoteCard(container, row, notes, onSaved) {
    const id = parseInt(row.dataset.id, 10);
    const note = notes.find((n) => n.id === id);
    row.querySelector('.note-edit').addEventListener('click', () => {
      openEditSheet(container, note, onSaved);
    });
    row.querySelector('.note-pin-toggle').addEventListener('click', async () => {
      try {
        await Api.upsertNote(note.id, note.content, !note.is_pinned);
        onSaved();
      } catch (e) {
        Util.toast(e.message || '처리 중 오류가 발생했습니다.', { error: true });
      }
    });
    row.querySelector('.note-complete-toggle').addEventListener('click', async () => {
      try {
        await Api.upsertNote(note.id, note.content, note.is_pinned, !note.is_completed);
        onSaved();
      } catch (e) {
        Util.toast(e.message || '처리 중 오류가 발생했습니다.', { error: true });
      }
    });
    row.querySelector('.note-delete').addEventListener('click', async () => {
      if (!confirm('이 메모를 삭제할까요?')) return;
      try {
        await Api.deleteNote(id);
        onSaved();
      } catch (e) {
        Util.toast(e.message || '삭제 중 오류가 발생했습니다.', { error: true });
      }
    });
  }

  async function refreshList(container) {
    const listEl = container.querySelector('#notes-list');
    listEl.innerHTML = '<div class="spinner"></div>';
    const notes = await Api.listNotes();
    if (notes.length === 0) {
      listEl.innerHTML = '<div class="empty-state">등록된 메모가 없어요.</div>';
      return;
    }

    const activeNotes = notes.filter((n) => !n.is_completed);
    const completedNotes = notes.filter((n) => n.is_completed);

    listEl.innerHTML = `
      <div id="notes-active">
        ${activeNotes.length ? activeNotes.map(noteCardHtml).join('') : '<div class="empty-state">등록된 메모가 없어요.</div>'}
      </div>
      ${completedNotes.length ? `
        <div class="section-title">완료된 메모</div>
        <div id="notes-completed">${completedNotes.map(noteCardHtml).join('')}</div>
      ` : ''}
    `;

    const onSaved = () => refreshList(container);
    listEl.querySelectorAll('.note-card').forEach((row) => {
      wireNoteCard(container, row, notes, onSaved);
    });
  }

  async function render(container) {
    container.innerHTML = `
      <div class="screen">
        <div class="topbar"><h1>중요 메모</h1></div>
        <div id="notes-list"><div class="spinner"></div></div>
      </div>
      <button class="fab" id="add-fab">${Icons.svg('plus')}</button>
    `;
    container.querySelector('#add-fab').addEventListener('click', () => {
      openEditSheet(container, null, () => refreshList(container));
    });
    await refreshList(container);
  }

  Router.register('notes', render);
})();
