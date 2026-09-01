// Supabase REST(PostgREST) RPC 호출 래퍼.
// 모든 daily_ 데이터는 SECURITY DEFINER RPC를 통해서만 오갑니다.
(function () {
  const { SUPABASE_URL, SUPABASE_KEY } = window.APP_CONFIG;
  const PIN_KEY = 'daily_app_pin';

  function getPin() {
    return sessionStorage.getItem(PIN_KEY) || '';
  }

  function setPin(pin) {
    sessionStorage.setItem(PIN_KEY, pin);
  }

  function clearPin() {
    sessionStorage.removeItem(PIN_KEY);
  }

  function hasPin() {
    return !!getPin();
  }

  class ApiError extends Error {
    constructor(message, isAuthError) {
      super(message);
      this.isAuthError = isAuthError;
    }
  }

  // includePin=false 인 경우에만 p_pin을 명시적으로 params에서 가져옵니다 (로그인 시도용)
  async function rpc(fnName, params = {}, { includePin = true } = {}) {
    const body = includePin ? { p_pin: getPin(), ...params } : { ...params };

    let res;
    try {
      res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
        },
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      throw new ApiError('네트워크 연결을 확인해주세요.', false);
    }

    if (!res.ok) {
      let message = '요청 중 오류가 발생했습니다.';
      let isAuthError = false;
      try {
        const err = await res.json();
        if (err && err.message) {
          message = err.message;
          if (message.includes('비밀번호') || message.includes('PIN')) {
            isAuthError = true;
          }
        }
      } catch (_) {
        /* ignore parse error */
      }
      if (res.status === 401 || res.status === 403) isAuthError = true;
      throw new ApiError(message, isAuthError);
    }

    if (res.status === 204) return null;
    return res.json();
  }

  window.Api = {
    getPin,
    setPin,
    clearPin,
    hasPin,
    ApiError,
    rpc,

    login(pin) {
      return rpc('daily_login', { p_pin: pin }, { includePin: false });
    },
    getCalendarMonth(year, month) {
      return rpc('daily_get_calendar_month', { p_year: year, p_month: month });
    },
    toggleScripture(dateStr) {
      return rpc('daily_toggle_scripture', { p_date: dateStr });
    },
    syncScriptureFromMizpah(dateStr) {
      return rpc('daily_sync_scripture_from_mizpah', { p_date: dateStr });
    },
    upsertDiary(dateStr, content) {
      return rpc('daily_upsert_diary', { p_date: dateStr, p_content: content });
    },
    getDiary(dateStr) {
      return rpc('daily_get_diary', { p_date: dateStr });
    },
    deleteDiary(dateStr) {
      return rpc('daily_delete_diary', { p_date: dateStr });
    },
    listDiary(limit = 30, offset = 0) {
      return rpc('daily_list_diary', { p_limit: limit, p_offset: offset });
    },
    listDiaryMonth(year, month) {
      return rpc('daily_list_diary_month', { p_year: year, p_month: month });
    },
    logWake(dateStr) {
      return rpc('daily_log_wake', { p_date: dateStr });
    },
    getWake(dateStr) {
      return rpc('daily_get_wake', { p_date: dateStr });
    },
    listWakeMonth(year, month) {
      return rpc('daily_list_wake_month', { p_year: year, p_month: month });
    },
    setWakeTime(dateStr, isoTimeOrNull) {
      return rpc('daily_set_wake_time', { p_date: dateStr, p_wake_time: isoTimeOrNull });
    },
    getAffirmations() {
      return rpc('daily_get_affirmations', {});
    },
    adminListAffirmations() {
      return rpc('daily_admin_list_affirmations', {});
    },
    upsertAffirmation(id, content, sortOrder, isActive) {
      return rpc('daily_upsert_affirmation', {
        p_id: id,
        p_content: content,
        p_sort_order: sortOrder,
        p_is_active: isActive,
      });
    },
    deleteAffirmation(id) {
      return rpc('daily_delete_affirmation', { p_id: id });
    },
    saveExercise(dateStr, totalSets, totalSeconds, laps, exerciseType = 'crossfit') {
      return rpc('daily_save_exercise', {
        p_date: dateStr,
        p_total_sets: totalSets,
        p_total_seconds: totalSeconds,
        p_laps: laps,
        p_exercise_type: exerciseType,
      });
    },
    listExerciseRecords(setCount = null, exerciseType = 'crossfit') {
      return rpc('daily_list_exercise_records', { p_set_count: setCount, p_exercise_type: exerciseType });
    },
    listExerciseSetCounts(exerciseType = 'crossfit') {
      return rpc('daily_list_exercise_set_counts', { p_exercise_type: exerciseType });
    },
    listExerciseLogsByDate(dateStr, exerciseType = 'crossfit') {
      return rpc('daily_list_exercise_logs_by_date', { p_date: dateStr, p_exercise_type: exerciseType });
    },
    listExerciseLogsMonth(year, month, exerciseType = 'crossfit') {
      return rpc('daily_list_exercise_logs_month', { p_year: year, p_month: month, p_exercise_type: exerciseType });
    },
    deleteExerciseLog(id) {
      return rpc('daily_delete_exercise_log', { p_id: id });
    },
    listNotes() {
      return rpc('daily_list_notes', {});
    },
    upsertNote(id, content, isPinned, isCompleted = null) {
      return rpc('daily_upsert_note', { p_id: id, p_content: content, p_is_pinned: isPinned, p_is_completed: isCompleted });
    },
    deleteNote(id) {
      return rpc('daily_delete_note', { p_id: id });
    },
  };
})();
