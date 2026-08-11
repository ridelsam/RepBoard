(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RepCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const DEFAULT_EXERCISES = ['Push-ups', 'Squats', 'Sit-ups', 'Lunges', 'Curls', 'Shoulder press', 'Other'];

  function clamp(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return min;
    return Math.min(max, Math.max(min, Math.round(number)));
  }

  function defaultState(now = Date.now()) {
    const exerciseTargets = Object.fromEntries(DEFAULT_EXERCISES.map((name) => [name, 3]));
    return {
      version: 4,
      target: 3,
      currentExercise: 'Push-ups',
      exercises: [...DEFAULT_EXERCISES],
      exerciseTargets,
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

  function hydrate(raw, now = Date.now()) {
    const base = defaultState(now);
    if (!raw || typeof raw !== 'object') return base;
    const exercises = Array.isArray(raw.exercises)
      ? raw.exercises.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()).slice(0, 30)
      : base.exercises;
    const settings = { ...base.settings, ...(raw.settings || {}) };
    if (Number(raw.version) < 2) settings.defaultTarget = 3;
    settings.defaultTarget = clamp(settings.defaultTarget, 1, 99);
    settings.restSeconds = clamp(settings.restSeconds, 0, 600);
    const safeExercises = exercises.length ? exercises : base.exercises;
    const currentExercise = safeExercises.includes(raw.currentExercise) ? raw.currentExercise : safeExercises[0];
    const legacyTarget = Number(raw.version) < 2 ? 3 : clamp(raw.target || settings.defaultTarget, 1, 99);
    const savedTargets = raw.exerciseTargets && typeof raw.exerciseTargets === 'object' ? raw.exerciseTargets : {};
    const exerciseTargets = Object.fromEntries(
      safeExercises.map((name) => [name, Object.prototype.hasOwnProperty.call(savedTargets, name)
        ? clamp(savedTargets[name], 1, 99)
        : legacyTarget])
    );
    return {
      ...base,
      ...raw,
      version: 4,
      count: 0,
      workoutActive: false,
      workoutStatus: 'idle',
      timerStartedAt: null,
      elapsedMs: 0,
      sessionStartedAt: now,
      currentExercise,
      target: exerciseTargets[currentExercise],
      exercises: safeExercises,
      exerciseTargets,
      sets: Array.isArray(raw.sets) ? raw.sets.slice(-200) : [],
      history: Array.isArray(raw.history) ? raw.history.slice(-100) : [],
      settings
    };
  }

  function completeSet(state, now = Date.now()) {
    const entry = {
      id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
      exercise: state.currentExercise,
      goal: targetForExercise(state, state.currentExercise),
      completedAt: now
    };
    return { ...state, sets: [...state.sets, entry].slice(-200) };
  }

  function removeLastSet(state, exercise) {
    const index = state.sets.map((set) => set.exercise).lastIndexOf(exercise);
    if (index < 0) return state;
    return { ...state, sets: state.sets.filter((_set, setIndex) => setIndex !== index) };
  }

  function setsForExercise(sets, exercise) {
    return (sets || []).filter((set) => set.exercise === exercise).length;
  }

  function targetForExercise(state, exercise) {
    const saved = state.exerciseTargets && state.exerciseTargets[exercise];
    return clamp(saved || state.target || state.settings?.defaultTarget || 3, 1, 99);
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
      count: 0,
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
      count: 0,
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
      count: 0,
      sets: [],
      sessionStartedAt: now,
      timerStartedAt: now,
      elapsedMs: 0,
      workoutStatus: 'running',
      workoutActive: true
    };
  }

  return { DEFAULT_EXERCISES, clamp, defaultState, hydrate, completeSet, removeLastSet, setsForExercise, targetForExercise, newWorkout, finishWorkout, restartWorkout };
});
