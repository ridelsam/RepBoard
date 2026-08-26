(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RepCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_EXERCISES = ['Push-ups', 'Squats', 'Sit-ups', 'Lunges', 'Curls', 'Shoulder press', 'Other'];
  const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const JS_WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function weekdayForTimestamp(timestamp = Date.now()) {
    const date = new Date(timestamp);
    return JS_WEEKDAYS[date.getDay()] || 'monday';
  }

  function cleanExercises(value, fallback = DEFAULT_EXERCISES) {
    if (!Array.isArray(value)) return [...fallback];
    const exercises = value
      .filter((name) => typeof name === 'string' && name.trim())
      .map((name) => name.trim())
      .slice(0, 30);
    return exercises.length ? exercises : [...fallback];
  }

  function createExercisePlan(exercises, savedTargets, currentExercise, fallbackTarget = 3) {
    const safeExercises = cleanExercises(exercises);
    const targets = savedTargets && typeof savedTargets === 'object' ? savedTargets : {};
    const exerciseTargets = Object.fromEntries(safeExercises.map((name) => [
      name,
      Object.prototype.hasOwnProperty.call(targets, name)
        ? clamp(targets[name], 1, 99)
        : clamp(fallbackTarget, 1, 99)
    ]));
    return {
      exercises: safeExercises,
      exerciseTargets,
      currentExercise: safeExercises.includes(currentExercise) ? currentExercise : safeExercises[0]
    };
  }

  function defaultState(now = Date.now()) {
    const dayPlans = Object.fromEntries(WEEKDAYS.map((day) => [
      day,
      createExercisePlan(DEFAULT_EXERCISES, {}, DEFAULT_EXERCISES[0], 3)
    ]));
    return {
      version: 5,
      activeDay: weekdayForTimestamp(now),
      dayPlans,
      sessionStartedAt: now,
      timerStartedAt: null,
      elapsedMs: 0,
      workoutStatus: 'idle',
      workoutActive: false,
      sets: [],
      history: [],
      settings: {
        sound: true,
        keepAwake: true,
        alwaysOnTop: false,
        restSeconds: 60,
        defaultTarget: 3
      }
    };
  }

  function normalizeSet(set, fallbackDay) {
    if (!set || typeof set !== 'object') return set;
    const day = WEEKDAYS.includes(set.day) ? set.day : fallbackDay;
    return { ...set, day };
  }

  function hydrate(raw, now = Date.now()) {
    const base = defaultState(now);
    if (!raw || typeof raw !== 'object') return base;
    const settings = { ...base.settings, ...(raw.settings || {}) };
    if (Number(raw.version) < 2) settings.defaultTarget = 3;
    settings.defaultTarget = clamp(settings.defaultTarget, 1, 99);
    settings.restSeconds = clamp(settings.restSeconds, 0, 600);

    let dayPlans;
    if (Number(raw.version) >= 5 && raw.dayPlans && typeof raw.dayPlans === 'object') {
      dayPlans = Object.fromEntries(WEEKDAYS.map((day) => {
        const saved = raw.dayPlans[day] && typeof raw.dayPlans[day] === 'object' ? raw.dayPlans[day] : {};
        return [day, createExercisePlan(
          saved.exercises,
          saved.exerciseTargets,
          saved.currentExercise,
          settings.defaultTarget
        )];
      }));
    } else {
      const exercises = cleanExercises(raw.exercises);
      const currentExercise = exercises.includes(raw.currentExercise) ? raw.currentExercise : exercises[0];
      const legacyTarget = Number(raw.version) < 2
        ? 3
        : clamp(raw.target || settings.defaultTarget, 1, 99);
      const savedTargets = raw.exerciseTargets && typeof raw.exerciseTargets === 'object' ? raw.exerciseTargets : {};
      dayPlans = Object.fromEntries(WEEKDAYS.map((day) => [
        day,
        createExercisePlan(exercises, savedTargets, currentExercise, legacyTarget)
      ]));
    }

    const activeDay = weekdayForTimestamp(now);
    const sets = Array.isArray(raw.sets)
      ? raw.sets.slice(-200).map((set) => normalizeSet(set, activeDay))
      : [];
    const history = Array.isArray(raw.history)
      ? raw.history.slice(-100).map((session) => {
          if (!session || typeof session !== 'object') return session;
          const sessionDay = weekdayForTimestamp(session.startedAt);
          return {
            ...session,
            sets: Array.isArray(session.sets)
              ? session.sets.map((set) => normalizeSet(set, sessionDay))
              : []
          };
        })
      : [];

    return {
      version: 5,
      activeDay,
      dayPlans,
      sessionStartedAt: now,
      timerStartedAt: null,
      elapsedMs: 0,
      workoutStatus: 'idle',
      workoutActive: false,
      sets,
      history,
      settings
    };
  }

  function exercisePlanForDay(state, day = state.activeDay) {
    return state.dayPlans?.[day] || createExercisePlan(DEFAULT_EXERCISES, {}, DEFAULT_EXERCISES[0], state.settings?.defaultTarget || 3);
  }

  function completeSet(state, now = Date.now()) {
    const plan = exercisePlanForDay(state);
    const entry = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      day: state.activeDay,
      exercise: plan.currentExercise,
      goal: targetForExercise(state, plan.currentExercise),
      completedAt: now
    };
    return { ...state, sets: [...state.sets, entry].slice(-200) };
  }

  function removeLastSet(state, exercise, day = state.activeDay) {
    const index = state.sets.map((set) => set.exercise === exercise && set.day === day).lastIndexOf(true);
    if (index < 0) return state;
    return { ...state, sets: state.sets.filter((_set, setIndex) => setIndex !== index) };
  }

  function setsForExercise(sets, exercise, day) {
    return (sets || []).filter((set) => (
      set.exercise === exercise && (day === undefined || set.day === day)
    )).length;
  }

  function targetForExercise(state, exercise, day = state.activeDay) {
    const plan = exercisePlanForDay(state, day);
    const saved = plan.exerciseTargets && plan.exerciseTargets[exercise];
    return clamp(saved || state.settings?.defaultTarget || 3, 1, 99);
  }

  function newWorkout(state, now = Date.now()) {
    const history = state.sets.length
      ? [...state.history, {
          id: `session-${now}`,
          startedAt: state.sessionStartedAt,
          endedAt: now,
          sets: state.sets
        }].slice(-100)
      : state.history;
    return {
      ...state,
      sets: [],
      history,
      sessionStartedAt: now,
      timerStartedAt: null,
      elapsedMs: 0,
      workoutStatus: 'idle',
      workoutActive: false
    };
  }

  function finishWorkout(state, now = Date.now(), durationMs = 0) {
    const elapsedMs = Math.max(0, Math.round(Number(durationMs) || 0));
    const history = state.sets.length
      ? [...state.history, {
          id: `session-${now}`,
          startedAt: state.sessionStartedAt,
          endedAt: now,
          durationMs: elapsedMs,
          sets: state.sets
        }].slice(-100)
      : state.history;
    return {
      ...state,
      sets: [],
      history,
      elapsedMs,
      timerStartedAt: null,
      workoutStatus: 'finished',
      workoutActive: false
    };
  }

  function restartWorkout(state, now = Date.now()) {
    return {
      ...state,
      sets: [],
      sessionStartedAt: now,
      timerStartedAt: now,
      elapsedMs: 0,
      workoutStatus: 'running',
      workoutActive: true
    };
  }

  return {
    DEFAULT_EXERCISES,
    WEEKDAYS,
    clamp,
    weekdayForTimestamp,
    defaultState,
    hydrate,
    exercisePlanForDay,
    completeSet,
    removeLastSet,
    setsForExercise,
    targetForExercise,
    newWorkout,
    finishWorkout,
    restartWorkout
  };
});
