(function () {
  function pad(n) { return String(n).padStart(2, '0'); }

  function toDateStr(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function todayStr() {
    return toDateStr(new Date());
  }

  function formatDateLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    return `${y}년 ${m}월 ${d}일 (${weekdays[date.getDay()]})`;
  }

  function formatShortDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return `${m}월 ${d}일`;
  }

  function formatTimeOfDay(isoStr) {
    const d = new Date(isoStr);
    let h = d.getHours();
    const ampm = h < 12 ? '오전' : '오후';
    h = h % 12;
    if (h === 0) h = 12;
    return `${ampm} ${h}:${pad(d.getMinutes())}`;
  }

  function formatStopwatch(totalSeconds) {
    const s = Math.max(0, totalSeconds);
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    const cs = Math.floor((s - Math.floor(s)) * 100);
    return `${pad(m)}:${pad(sec)}.${pad(cs)}`;
  }

  function formatDuration(totalSeconds) {
    const s = Math.round(totalSeconds);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${pad(sec)}`;
  }

  let toastTimer = null;
  function toast(message, { error = false } = {}) {
    let el = document.getElementById('global-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'global-toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = 'toast show' + (error ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 2200);
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  window.Util = {
    pad,
    toDateStr,
    todayStr,
    formatDateLabel,
    formatShortDate,
    formatTimeOfDay,
    formatStopwatch,
    formatDuration,
    toast,
    escapeHtml,
  };
})();
