const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../src/state.js');

function plan(state, day = state.activeDay) {
  return core.exercisePlanForDay(state, day);
}

function selectExercise(state, exercise, day = state.activeDay) {
  plan(state, day).currentExercise = exercise;
  return state;
}

test('a completed set is recorded immediately', () => {
  const state = selectExercise(core.defaultState(100), 'Squats');
  const next = core.completeSet(state, 200);
  assert.equal(state.sets.length, 0);
  assert.equal(next.sets.length, 1);
  assert.equal(next.sets[0].exercise, 'Squats');
  assert.equal(next.sets[0].day, state.activeDay);
  assert.equal(next.sets[0].completedAt, 200);
});

test('completed sets use the selected exercise goal', () => {
  const state = selectExercise(core.defaultState(100), 'Squats');
  plan(state).exerciseTargets = { ...plan(state).exerciseTargets, Squats: 7 };
  const next = core.completeSet(state, 200);
  assert.equal(next.sets[0].goal, 7);
});

test('exercise goals are independent', () => {
  const state = core.defaultState(100);
  plan(state).exerciseTargets = { ...plan(state).exerciseTargets, 'Push-ups': 5, Squats: 2 };
  assert.equal(core.targetForExercise(state, 'Push-ups'), 5);
  assert.equal(core.targetForExercise(state, 'Squats'), 2);
});

test('set counts are tracked independently by exercise', () => {
  let state = core.completeSet(core.defaultState(100), 200);
  state = core.completeSet(state, 300);
  state = core.completeSet(selectExercise(state, 'Squats'), 400);
  assert.equal(core.setsForExercise(state.sets, 'Push-ups'), 2);
  assert.equal(core.setsForExercise(state.sets, 'Squats'), 1);
});

test('remove last set only affects the selected exercise', () => {
  let state = core.completeSet(core.defaultState(100), 200);
  state = core.completeSet(selectExercise(state, 'Squats'), 300);
  state = core.completeSet(selectExercise(state, 'Push-ups'), 400);
  const next = core.removeLastSet(state, 'Push-ups');
  assert.equal(core.setsForExercise(next.sets, 'Push-ups'), 1);
  assert.equal(core.setsForExercise(next.sets, 'Squats'), 1);
});

test('new workout archives completed sets and resets its timer', () => {
  const state = core.completeSet({ ...core.defaultState(100), workoutActive: true }, 200);
  const next = core.newWorkout(state, 300);
  assert.equal(next.sets.length, 0);
  assert.equal(next.history.length, 1);
  assert.equal(next.history[0].sets.length, 1);
  assert.equal(next.sessionStartedAt, 300);
  assert.equal(next.workoutActive, false);
  assert.equal(next.elapsedMs, 0);
  assert.equal(next.workoutStatus, 'idle');
});

test('new workout resets its timer even when there are no sets', () => {
  const state = core.defaultState(100);
  const next = core.newWorkout(state, 500);
  assert.equal(next.sessionStartedAt, 500);
  assert.equal(next.history.length, 0);
});

test('version 1 data migrates to a three-set goal and preserves completed sets', () => {
  const old = {
    version: 1,
    count: 8,
    target: 10,
    currentExercise: 'Squats',
    exercises: ['Squats'],
    sets: [{ id: 'old', exercise: 'Squats', reps: 10, completedAt: 50 }],
    settings: { defaultTarget: 10, restSeconds: 9999 }
  };
  const next = core.hydrate(old, 100);
  assert.equal(next.version, 5);
  assert.equal(plan(next).exerciseTargets.Squats, 3);
  assert.equal(next.settings.defaultTarget, 3);
  assert.equal(next.settings.restSeconds, 600);
  assert.equal(next.sets.length, 1);
});

test('version 3 global goal migrates to every existing exercise', () => {
  const next = core.hydrate({
    version: 3,
    target: 6,
    currentExercise: 'Squats',
    exercises: ['Push-ups', 'Squats'],
    sets: [],
    history: [],
    settings: { defaultTarget: 3 }
  }, 100);
  assert.equal(next.version, 5);
  core.WEEKDAYS.forEach((day) => {
    assert.deepEqual(plan(next, day).exerciseTargets, { 'Push-ups': 6, Squats: 6 });
  });
  assert.equal(core.targetForExercise(next, 'Squats'), 6);
});

test('legacy exercises are copied into every weekday without sharing plan objects', () => {
  const next = core.hydrate({
    version: 4,
    currentExercise: 'Rows',
    exercises: ['Rows', 'Planks'],
    exerciseTargets: { Rows: 5, Planks: 2 },
    settings: { defaultTarget: 3 }
  }, new Date(2026, 7, 25).getTime());
  assert.equal(next.activeDay, 'tuesday');
  core.WEEKDAYS.forEach((day) => {
    assert.deepEqual(plan(next, day).exercises, ['Rows', 'Planks']);
    assert.equal(plan(next, day).exerciseTargets.Rows, 5);
  });
  plan(next, 'monday').exercises.push('Pull-ups');
  assert.deepEqual(plan(next, 'tuesday').exercises, ['Rows', 'Planks']);
});

test('weekday plans keep exercises, goals, and completed counts independent', () => {
  let state = core.defaultState(new Date(2026, 7, 24).getTime());
  plan(state, 'monday').exercises = ['Rows'];
  plan(state, 'monday').currentExercise = 'Rows';
  plan(state, 'monday').exerciseTargets = { Rows: 5 };
  plan(state, 'tuesday').exercises = ['Rows', 'Squats'];
  plan(state, 'tuesday').currentExercise = 'Rows';
  plan(state, 'tuesday').exerciseTargets = { Rows: 2, Squats: 4 };
  state = core.completeSet(state, 200);
  state.activeDay = 'tuesday';
  state = core.completeSet(state, 300);
  assert.equal(core.targetForExercise(state, 'Rows', 'monday'), 5);
  assert.equal(core.targetForExercise(state, 'Rows', 'tuesday'), 2);
  assert.equal(core.setsForExercise(state.sets, 'Rows', 'monday'), 1);
  assert.equal(core.setsForExercise(state.sets, 'Rows', 'tuesday'), 1);
  const restored = core.hydrate(state, new Date(2026, 7, 25).getTime());
  assert.deepEqual(plan(restored, 'monday').exercises, ['Rows']);
  assert.deepEqual(plan(restored, 'tuesday').exercises, ['Rows', 'Squats']);
  assert.equal(core.targetForExercise(restored, 'Rows', 'monday'), 5);
  assert.equal(core.targetForExercise(restored, 'Rows', 'tuesday'), 2);
});

test('a workout is complete only when every exercise for that day reaches its goal', () => {
  let state = core.defaultState(new Date(2026, 7, 24).getTime());
  plan(state).exercises = ['Rows', 'Squats'];
  plan(state).currentExercise = 'Rows';
  plan(state).exerciseTargets = { Rows: 2, Squats: 1 };
  state = core.completeSet(state, 200);
  assert.deepEqual(core.completedExercisesForDay(state), []);
  assert.equal(core.isWorkoutComplete(state), false);
  state = core.completeSet(state, 300);
  assert.deepEqual(core.completedExercisesForDay(state), ['Rows']);
  assert.equal(core.isWorkoutComplete(state), false);
  state = core.completeSet(selectExercise(state, 'Squats'), 400);
  assert.deepEqual(core.completedExercisesForDay(state), ['Rows', 'Squats']);
  assert.equal(core.isWorkoutComplete(state), true);
  assert.equal(core.isWorkoutComplete(state, 'tuesday'), false);
});

test('persisted data never resumes an active workout on launch', () => {
  const next = core.hydrate({ ...core.defaultState(100), workoutActive: true, workoutStatus: 'running', elapsedMs: 9000 }, 200);
  assert.equal(next.workoutActive, false);
  assert.equal(next.workoutStatus, 'idle');
  assert.equal(next.elapsedMs, 0);
  assert.equal(next.sessionStartedAt, 200);
});

test('finishing archives sets and preserves elapsed workout time', () => {
  const state = core.completeSet({
    ...core.defaultState(100),
    workoutActive: true,
    workoutStatus: 'running',
    timerStartedAt: 100
  }, 200);
  const next = core.finishWorkout(state, 300, 125000);
  assert.equal(next.sets.length, 0);
  assert.equal(next.history.length, 1);
  assert.equal(next.history[0].durationMs, 125000);
  assert.equal(next.elapsedMs, 125000);
  assert.equal(next.workoutStatus, 'finished');
  assert.equal(next.workoutActive, false);
});

test('restarting clears current sets and immediately runs from zero', () => {
  const state = core.completeSet({ ...core.defaultState(100), elapsedMs: 5000 }, 200);
  const next = core.restartWorkout(state, 300);
  assert.equal(next.sets.length, 0);
  assert.equal(next.elapsedMs, 0);
  assert.equal(next.sessionStartedAt, 300);
  assert.equal(next.timerStartedAt, 300);
  assert.equal(next.workoutStatus, 'running');
  assert.equal(next.workoutActive, true);
});
