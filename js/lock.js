(function () {
  const MAX_LEN = 8; // 최대 PIN 길이 (숫자 제한 없음, 4자리 이상 권장)
  const MIN_AUTO_LEN = 4; // 이 길이 이상부터 입력할 때마다 자동으로 로그인 시도
  let entered = '';
  let busy = false;

  function render() {
    const dotsWrap = document.getElementById('lock-dots');
    dotsWrap.innerHTML = '';
    const len = Math.max(entered.length, 4);
    for (let i = 0; i < len; i++) {
      const dot = document.createElement('div');
      dot.className = 'lock-dot' + (i < entered.length ? ' filled' : '');
      dotsWrap.appendChild(dot);
    }
  }

  function showError(message) {
    const errEl = document.getElementById('lock-error');
    errEl.textContent = message;
    errEl.classList.add('show');
    const dotsWrap = document.getElementById('lock-dots');
    dotsWrap.classList.add('lock-shake');
    setTimeout(() => dotsWrap.classList.remove('lock-shake'), 400);
  }

  function clearError() {
    const errEl = document.getElementById('lock-error');
    errEl.classList.remove('show');
  }

  // 확인 버튼으로 명시적으로 제출한 경우: 틀리면 즉시 에러를 보여준다.
  async function tryLogin() {
    if (busy || entered.length === 0) return;
    busy = true;
    try {
      await Api.login(entered);
      Api.setPin(entered);
      unlock();
    } catch (e) {
      showError(e.message || '비밀번호가 올바르지 않습니다.');
      entered = '';
      render();
    } finally {
      busy = false;
    }
  }

  // 숫자를 입력할 때마다 자동으로 로그인을 시도한다. 맞으면 바로 진입하고,
  // 아직 다 입력하지 않아서 틀린 것일 수 있으므로 최대 길이에 도달하기
  // 전까지는 에러를 표시하지 않고 조용히 실패한다.
  async function attemptAutoLogin() {
    if (busy) return;
    const pinAttempt = entered;
    if (pinAttempt.length < MIN_AUTO_LEN) return;

    busy = true;
    let succeeded = false;
    try {
      await Api.login(pinAttempt);
      succeeded = true;
      Api.setPin(pinAttempt);
      unlock();
    } catch (e) {
      if (pinAttempt.length >= MAX_LEN) {
        showError(e.message || '비밀번호가 올바르지 않습니다.');
        entered = '';
        render();
      }
    } finally {
      busy = false;
    }

    // 요청이 진행되는 동안 사용자가 이어서 입력했다면, 최신 입력값으로 다시 시도한다.
    if (!succeeded && entered !== pinAttempt && entered.length >= MIN_AUTO_LEN) {
      attemptAutoLogin();
    }
  }

  function onKey(key) {
    clearError();
    if (key === 'del') {
      entered = entered.slice(0, -1);
      render();
      return;
    }
    if (key === 'ok') {
      tryLogin();
      return;
    }
    if (entered.length >= MAX_LEN) return;
    entered += key;
    render();
    attemptAutoLogin();
  }

  function unlock() {
    document.getElementById('lock-screen').classList.add('hidden');
    document.getElementById('app-shell').classList.remove('hidden');
    entered = '';
    window.dispatchEvent(new CustomEvent('app:unlocked'));
  }

  function buildKeypad() {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'empty', '0', 'del'];
    const wrap = document.getElementById('lock-keypad');
    wrap.innerHTML = '';
    keys.forEach((k) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      if (k === 'empty') {
        btn.className = 'keypad-btn keypad-empty';
      } else if (k === 'del') {
        btn.className = 'keypad-btn keypad-del';
        btn.textContent = '지움';
        btn.addEventListener('click', () => onKey('del'));
      } else {
        btn.className = 'keypad-btn';
        btn.textContent = k;
        btn.addEventListener('click', () => onKey(k));
      }
      wrap.appendChild(btn);
    });
  }

  function init() {
    buildKeypad();
    render();
    document.getElementById('lock-ok-btn').addEventListener('click', () => onKey('ok'));

    if (Api.hasPin()) {
      // 세션 유지: 이미 로그인된 상태라면 바로 통과 (RPC 실패 시 다시 잠금)
      Api.login(Api.getPin())
        .then(unlock)
        .catch(() => {
          Api.clearPin();
        });
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
