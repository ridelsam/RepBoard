(() => {
  'use strict';

  const STORAGE_KEY = 'repboard-state-v1';
  const BOARD_KEY = 'repboard-board-v1';
  const core = window.RepCore;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function loadState() {
    try { return core.hydrate(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
    catch { return core.defaultState(); }
  }

  let state = loadState();
  state.workoutActive = false;
  state.workoutStatus = 'idle';
  state.timerStartedAt = null;
  state.elapsedMs = 0;
  state.sessionStartedAt = Date.now();
  let exerciseDraft = [];
  let toastTimer = null;
  let restTimer = null;
  let restEndsAt = 0;
  let restDuration = 0;
  let targetCelebrated = core.setsForExercise(state.sets, selectedExercise(), state.activeDay) >= core.targetForExercise(state, selectedExercise());

  const elements = {
    count: $('#countNumber'),
    ring: $('#counterTap'),
    target: $('#targetNumber'),
    targetHint: $('#targetHint'),
    daySelect: $('#daySelect'),
    exerciseList: $('#exerciseList'),
    exerciseEditorList: $('#exerciseEditorList'),
    setsList: $('#setsList'),
    emptySets: $('#emptySets'),
    setCount: $('#setCount'),
    elapsed: $('#elapsedTime'),
    toast: $('#toast'),
    restBar: $('#restBar'),
    restTime: $('#restTime'),
    restProgress: $('#restProgress'),
    historyStats: $('#historyStats'),
    historyContent: $('#historyContent'),
    workoutProgress: $('#workoutProgress'),
    settings: $('#settingsDialog'),
    exerciseDialog: $('#exerciseDialog'),
    confirmDialog: $('#confirmDialog')
  };

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function activePlan() {
    return core.exercisePlanForDay(state, state.activeDay);
  }

  function selectedExercise() {
    return activePlan().currentExercise;
  }

  function dayLabel(day = state.activeDay) {
    return `${day.charAt(0).toUpperCase()}${day.slice(1)}`;
  }

  function formatTime(seconds) {
    const value = Math.max(0, Math.round(seconds));
    const minutes = Math.floor(value / 60);
    const remainder = value % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
  }

  function currentElapsedMs(now = Date.now()) {
    const saved = Math.max(0, Number(state.elapsedMs) || 0);
    if (state.workoutStatus !== 'running' || !state.timerStartedAt) return saved;
    return saved + Math.max(0, now - state.timerStartedAt);
  }

  function reconcileWorkoutCompletion(now = Date.now()) {
    const workoutComplete = core.isWorkoutComplete(state, state.activeDay);
    if (workoutComplete && state.workoutStatus === 'running') {
      state.elapsedMs = currentElapsedMs(now);
      state.timerStartedAt = null;
      state.workoutStatus = 'completed';
      state.workoutActive = false;
      stopRestTimer();
      return true;
    }
    if (!workoutComplete && state.workoutStatus === 'completed') {
      state.workoutStatus = 'paused';
      state.workoutActive = false;
    }
    return false;
  }

  function formatClock(timestamp) {
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(timestamp));
  }

  function formatDate(timestamp) {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(date);
  }

  function toast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 1900);
  }

  function renderCounter() {
    const exercise = selectedExercise();
    const completed = core.setsForExercise(state.sets, exercise, state.activeDay);
    const target = core.targetForExercise(state, exercise);
    const progress = Math.min(1, completed / target);
    elements.count.textContent = completed;
    elements.target.textContent = target;
    elements.ring.style.setProperty('--progress', `${progress * 360}deg`);
    elements.ring.classList.toggle('reached', completed >= target);
    elements.ring.disabled = !state.workoutActive;
    $('#plusBtn').disabled = !state.workoutActive;
    $('#minusBtn').disabled = !state.workoutActive;
    const remaining = target - completed;
    elements.targetHint.textContent = remaining > 0 ? `${remaining} to go` : remaining === 0 ? 'Goal reached' : `${Math.abs(remaining)} over`;
  }

  function chooseExercise(name) {
    activePlan().currentExercise = name;
    targetCelebrated = core.setsForExercise(state.sets, name, state.activeDay) >= core.targetForExercise(state, name);
    saveState();
    renderAll();
  }

  function createExerciseButton(name) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'exercise-item';
    const completed = core.setsForExercise(state.sets, name, state.activeDay) >= core.targetForExercise(state, name);
    if (name === selectedExercise()) button.classList.add('active');
    if (completed) button.classList.add('completed');
    button.setAttribute('aria-label', `${name}${completed ? ', done' : ''}`);
    const label = document.createElement('span');
    label.textContent = name;
    button.append(label);
    button.addEventListener('click', () => chooseExercise(name));
    return button;
  }

  function renderExercises() {
    const plan = activePlan();
    const completed = core.completedExercisesForDay(state, state.activeDay).length;
    elements.daySelect.value = state.activeDay;
    elements.exerciseList.replaceChildren();
    plan.exercises.forEach((name) => elements.exerciseList.append(createExerciseButton(name)));
    const workoutComplete = completed === plan.exercises.length;
    elements.workoutProgress.textContent = workoutComplete
      ? `✓ Workout complete · ${completed} of ${plan.exercises.length}`
      : `${completed} of ${plan.exercises.length} exercises done`;
    elements.workoutProgress.classList.toggle('complete', workoutComplete);
  }

  function renderExerciseEditor() {
    elements.exerciseEditorList.replaceChildren();
    exerciseDraft.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'exercise-editor-row';
      const input = document.createElement('input');
      input.maxLength = 30;
      input.value = item.name;
      input.setAttribute('aria-label', `Exercise ${index + 1}`);
      input.addEventListener('input', () => { item.name = input.value; });
      const controls = document.createElement('div');
      controls.className = 'exercise-order-controls';
      const up = document.createElement('button');
      up.type = 'button';
      up.textContent = '↑';
      up.title = 'Move up';
      up.disabled = index === 0;
      up.addEventListener('click', () => {
        [exerciseDraft[index - 1], exerciseDraft[index]] = [exerciseDraft[index], exerciseDraft[index - 1]];
        renderExerciseEditor();
      });
      const down = document.createElement('button');
      down.type = 'button';
      down.textContent = '↓';
      down.title = 'Move down';
      down.disabled = index === exerciseDraft.length - 1;
      down.addEventListener('click', () => {
        [exerciseDraft[index + 1], exerciseDraft[index]] = [exerciseDraft[index], exerciseDraft[index + 1]];
        renderExerciseEditor();
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'remove-exercise';
      remove.textContent = '×';
      remove.title = 'Remove exercise';
      remove.addEventListener('click', () => {
        if (exerciseDraft.length === 1) { toast('Keep at least one exercise'); return; }
        exerciseDraft.splice(index, 1);
        renderExerciseEditor();
      });
      controls.append(up, down, remove);
      row.append(input, controls);
      elements.exerciseEditorList.append(row);
    });
  }

  function openExerciseEditor() {
    exerciseDraft = activePlan().exercises.map((name) => ({ originalName: name, name }));
    $('#exerciseDialogTitle').textContent = `Edit ${dayLabel()} exercises`;
    $('#newExerciseInput').value = '';
    renderExerciseEditor();
    elements.exerciseDialog.showModal();
  }

  function saveExerciseEditor() {
    const names = exerciseDraft.map((item) => item.name.trim());
    if (names.some((name) => !name)) { toast('Exercise names cannot be empty'); return; }
    if (new Set(names.map((name) => name.toLowerCase())).size !== names.length) {
      toast('Each exercise needs a unique name');
      return;
    }
    const renamed = new Map(
      exerciseDraft.filter((item) => item.originalName).map((item) => [item.originalName, item.name.trim()])
    );
    const renameSet = (set) => set.day === state.activeDay
      ? { ...set, exercise: renamed.get(set.exercise) || set.exercise }
      : set;
    state.sets = state.sets.map(renameSet);
    state.history = state.history.map((session) => ({ ...session, sets: (session.sets || []).map(renameSet) }));
    const plan = activePlan();
    const previousTargets = plan.exerciseTargets || {};
    plan.exerciseTargets = Object.fromEntries(exerciseDraft.map((item) => {
      const name = item.name.trim();
      const goal = item.originalName
        ? core.clamp(previousTargets[item.originalName] || state.settings.defaultTarget, 1, 99)
        : state.settings.defaultTarget;
      return [name, goal];
    }));
    plan.currentExercise = renamed.get(plan.currentExercise) || (names.includes(plan.currentExercise) ? plan.currentExercise : names[0]);
    plan.exercises = names;
    reconcileWorkoutCompletion();
    saveState();
    renderAll();
    elements.exerciseDialog.close();
    toast(`${dayLabel()} exercises updated`);
  }

  function renderSets() {
    elements.setsList.replaceChildren();
    elements.emptySets.hidden = state.sets.length > 0;
    state.sets.slice().reverse().forEach((set, reverseIndex) => {
      const index = state.sets.length - 1 - reverseIndex;
      const item = document.createElement('article');
      item.className = 'set-item';
      const top = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = set.exercise;
      const exerciseSetNumber = state.sets.slice(0, index + 1).filter((item) => (
        item.exercise === set.exercise && item.day === set.day
      )).length;
      const setLabel = document.createElement('b');
      setLabel.textContent = `Set ${exerciseSetNumber}`;
      const remove = document.createElement('button');
      remove.className = 'remove-set';
      remove.type = 'button';
      remove.title = 'Remove set';
      remove.setAttribute('aria-label', `Remove ${set.exercise} set`);
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        state.sets.splice(index, 1);
        reconcileWorkoutCompletion();
        saveState();
        renderAll();
        toast('Set removed');
      });
      top.append(name, setLabel, remove);
      const meta = document.createElement('span');
      meta.textContent = formatClock(set.completedAt);
      item.append(top, meta);
      elements.setsList.append(item);
    });
    elements.setCount.textContent = state.sets.length;
  }

  function allSessions() {
    const sessions = [...state.history];
    if (state.sets.length) sessions.push({ id: 'current', startedAt: state.sessionStartedAt, endedAt: Date.now(), durationMs: currentElapsedMs(), sets: state.sets, current: true });
    return sessions;
  }

  function renderHistory() {
    const sessions = allSessions();
    const allSets = sessions.flatMap((session) => session.sets || []);
    const exercises = new Set(allSets.map((set) => set.exercise)).size;
    elements.historyStats.innerHTML = '';
    [
      ['Total workouts', sessions.length],
      ['Total sets', allSets.length],
      ['Exercises', exercises]
    ].forEach(([label, value]) => {
      const card = document.createElement('article');
      card.className = 'stat-card';
      const caption = document.createElement('span');
      caption.textContent = label;
      const number = document.createElement('strong');
      number.textContent = value;
      card.append(caption, number);
      elements.historyStats.append(card);
    });
    elements.historyContent.replaceChildren();
    if (!sessions.length) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.innerHTML = '<div><strong>No workouts yet</strong><p>Completed sets will appear here.</p></div>';
      elements.historyContent.append(empty);
      return;
    }
    sessions.slice().reverse().forEach((session, sessionIndex) => {
      const day = document.createElement('details');
      day.className = 'history-day';
      day.open = sessionIndex === 0;
      const header = document.createElement('summary');
      const title = document.createElement('h3');
      title.textContent = `${formatDate(session.startedAt)}${session.current ? ' • Current workout' : ''}`;
      const summary = document.createElement('span');
      const savedDuration = Number(session.durationMs);
      const timestampsDuration = Number(session.endedAt) - Number(session.startedAt);
      const duration = Number.isFinite(savedDuration)
        ? Math.max(0, savedDuration)
        : Number.isFinite(timestampsDuration) ? Math.max(0, timestampsDuration) : 0;
      summary.textContent = `${session.sets.length} completed sets • ${formatTime(duration / 1000)}`;
      header.append(title, summary);
      day.append(header);
      const setNumbers = new Map();
      const counts = new Map();
      session.sets.forEach((set) => {
        const exerciseKey = `${set.day || ''}:${set.exercise}`;
        const next = (counts.get(exerciseKey) || 0) + 1;
        counts.set(exerciseKey, next);
        setNumbers.set(set.id, next);
      });
      session.sets.slice().reverse().forEach((set) => {
        const row = document.createElement('div');
        row.className = 'history-set';
        const name = document.createElement('b');
        name.textContent = set.exercise;
        const time = document.createElement('span');
        time.textContent = formatClock(set.completedAt);
        const value = document.createElement('strong');
        value.textContent = `Set ${setNumbers.get(set.id) || 1}`;
        row.append(name, time, value);
        day.append(row);
      });
      elements.historyContent.append(day);
    });
  }

  function renderSettings() {
    $('#soundSetting').checked = Boolean(state.settings.sound);
    $('#awakeSetting').checked = Boolean(state.settings.keepAwake);
    $('#defaultTargetSetting').value = state.settings.defaultTarget;
    $('#restSetting').value = state.settings.restSeconds;
    $('#awakeBtn').classList.toggle('active', Boolean(state.settings.keepAwake));
    $('#awakeBtn').setAttribute('aria-pressed', String(Boolean(state.settings.keepAwake)));
    $('#pinBtn').classList.toggle('active', Boolean(state.settings.alwaysOnTop));
    $('#pinBtn').setAttribute('aria-pressed', String(Boolean(state.settings.alwaysOnTop)));
  }

  function renderWorkoutState() {
    const completed = state.workoutStatus === 'completed';
    const inProgress = state.workoutStatus === 'running' || state.workoutStatus === 'paused' || completed;
    $('#startWorkoutBtn').hidden = inProgress;
    $('#activeWorkoutControls').hidden = !inProgress;
    $('#activeWorkoutControls').classList.toggle('completed', completed);
    $('#pauseWorkoutBtn').hidden = completed;
    $('#pauseWorkoutBtn').textContent = state.workoutStatus === 'paused' ? 'Resume' : 'Pause';
    const helper = completed
      ? 'Workout complete'
      : state.workoutStatus === 'running'
      ? 'Tap after your set'
      : state.workoutStatus === 'paused'
        ? 'Workout paused'
        : state.workoutStatus === 'finished'
          ? 'Workout finished'
          : 'Start workout first';
    $('.counter-inner em').textContent = helper;
    elements.elapsed.textContent = formatTime(currentElapsedMs() / 1000);
  }

  function renderAll() {
    renderCounter();
    renderExercises();
    renderSets();
    renderHistory();
    renderSettings();
    renderWorkoutState();
  }

  function playTargetSound() {
    if (!state.settings.sound) return;
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      const context = new Context();
      [0, .11].forEach((delay, index) => {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = index ? 880 : 660;
        gain.gain.setValueAtTime(.001, context.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(.16, context.currentTime + delay + .015);
        gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + delay + .16);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(context.currentTime + delay);
        oscillator.stop(context.currentTime + delay + .17);
      });
      setTimeout(() => context.close(), 500);
    } catch { /* Sound is optional. */ }
  }

  function celebrate() {
    playTargetSound();
    if (navigator.vibrate) navigator.vibrate([35, 30, 55]);
    const colors = ['#b8ff28', '#37d5ff', '#ffffff', '#ffc857'];
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < 34; index += 1) {
      const piece = document.createElement('i');
      piece.style.setProperty('--x', `${35 + Math.random() * 30}%`);
      piece.style.setProperty('--dx', `${-180 + Math.random() * 360}px`);
      piece.style.setProperty('--r', `${Math.random() * 180}deg`);
      piece.style.setProperty('--c', colors[index % colors.length]);
      piece.style.animationDelay = `${Math.random() * .1}s`;
      fragment.append(piece);
    }
    $('#confetti').replaceChildren(fragment);
    setTimeout(() => $('#confetti').replaceChildren(), 1100);
    toast('Target reached — strong work!');
  }

  function recordSet() {
    if (!state.workoutActive) { toast('Press Start workout first'); return; }
    const exercise = selectedExercise();
    const previous = core.setsForExercise(state.sets, exercise, state.activeDay);
    state = core.completeSet(state);
    const completed = previous + 1;
    const target = core.targetForExercise(state, exercise);
    const workoutCompleted = reconcileWorkoutCompletion();
    saveState();
    renderAll();
    elements.ring.classList.remove('bump');
    requestAnimationFrame(() => elements.ring.classList.add('bump'));
    if (previous < target && completed >= target && !targetCelebrated) {
      targetCelebrated = true;
      celebrate();
    }
    if (workoutCompleted) {
      toast('Workout complete — timer stopped');
    } else {
      toast(`Set ${completed} saved for ${exercise}`);
      startRestTimer(state.settings.restSeconds);
    }
  }

  function removeLastSet() {
    if (!state.workoutActive) { toast('Press Start workout first'); return; }
    const exercise = selectedExercise();
    const previous = core.setsForExercise(state.sets, exercise, state.activeDay);
    if (!previous) { toast(`No ${exercise} sets to remove`); return; }
    state = core.removeLastSet(state, exercise, state.activeDay);
    targetCelebrated = core.setsForExercise(state.sets, exercise, state.activeDay) >= core.targetForExercise(state, exercise);
    saveState();
    renderAll();
    toast('Last set removed');
  }

  function setTarget(delta) {
    const exercise = selectedExercise();
    const plan = activePlan();
    const target = core.clamp(core.targetForExercise(state, exercise) + delta, 1, 99);
    plan.exerciseTargets = { ...plan.exerciseTargets, [exercise]: target };
    targetCelebrated = core.setsForExercise(state.sets, exercise, state.activeDay) >= target;
    const workoutCompleted = reconcileWorkoutCompletion();
    saveState();
    renderAll();
    if (workoutCompleted) toast('Workout complete — timer stopped');
  }

  function startRestTimer(seconds) {
    clearInterval(restTimer);
    if (!seconds) return;
    restDuration = seconds * 1000;
    restEndsAt = Date.now() + restDuration;
    elements.restBar.hidden = false;
    updateRestTimer();
    restTimer = setInterval(updateRestTimer, 250);
  }

  function updateRestTimer() {
    const remainingMs = Math.max(0, restEndsAt - Date.now());
    elements.restTime.textContent = formatTime(Math.ceil(remainingMs / 1000));
    elements.restProgress.style.width = `${(remainingMs / restDuration) * 100}%`;
    if (remainingMs <= 0) {
      clearInterval(restTimer);
      restTimer = null;
      elements.restBar.hidden = true;
      playTargetSound();
      toast('Rest over — next set!');
    }
  }

  function stopRestTimer() {
    clearInterval(restTimer);
    restTimer = null;
    elements.restBar.hidden = true;
  }

  let confirmResolver = null;
  function askConfirm(title, message, confirmLabel = 'Confirm') {
    $('#confirmTitle').textContent = title;
    $('#confirmMessage').textContent = message;
    $('#confirmOk').textContent = confirmLabel;
    elements.confirmDialog.showModal();
    return new Promise((resolve) => { confirmResolver = resolve; });
  }

  $('#confirmOk').addEventListener('click', (event) => {
    event.preventDefault();
    elements.confirmDialog.close();
    if (confirmResolver) confirmResolver(true);
    confirmResolver = null;
  });
  $('#confirmCancel').addEventListener('click', (event) => {
    event.preventDefault();
    elements.confirmDialog.close();
    if (confirmResolver) confirmResolver(false);
    confirmResolver = null;
  });
  elements.confirmDialog.addEventListener('cancel', () => {
    if (confirmResolver) confirmResolver(false);
    confirmResolver = null;
  });

  $$('.mode-tab').forEach((button) => button.addEventListener('click', () => {
    $$('.mode-tab').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    $$('.view').forEach((view) => view.classList.toggle('active', view.id === `${button.dataset.view}View`));
    if (button.dataset.view === 'board') requestAnimationFrame(resizeCanvas);
    if (button.dataset.view === 'history') renderHistory();
  }));

  elements.ring.addEventListener('click', recordSet);
  $('#plusBtn').addEventListener('click', recordSet);
  $('#minusBtn').addEventListener('click', removeLastSet);
  $('#targetMinus').addEventListener('click', () => setTarget(-1));
  $('#targetPlus').addEventListener('click', () => setTarget(1));
  $('#restSkipBtn').addEventListener('click', stopRestTimer);

  elements.daySelect.addEventListener('change', (event) => {
    state.activeDay = event.target.value;
    const exercise = selectedExercise();
    targetCelebrated = core.setsForExercise(state.sets, exercise, state.activeDay) >= core.targetForExercise(state, exercise);
    const workoutCompleted = reconcileWorkoutCompletion();
    saveState();
    renderAll();
    if (workoutCompleted) toast('Workout complete — timer stopped');
  });

  $('#editExercisesBtn').addEventListener('click', openExerciseEditor);
  $('#addExerciseBtn').addEventListener('click', () => {
    const input = $('#newExerciseInput');
    const name = input.value.trim();
    if (!name) return;
    if (exerciseDraft.some((item) => item.name.trim().toLowerCase() === name.toLowerCase())) {
      toast('That exercise is already in your list');
      return;
    }
    exerciseDraft.push({ originalName: null, name });
    input.value = '';
    renderExerciseEditor();
  });
  $('#saveExercisesBtn').addEventListener('click', saveExerciseEditor);
  $('#newExerciseInput').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') { event.preventDefault(); $('#addExerciseBtn').click(); }
  });

  $('#startWorkoutBtn').addEventListener('click', () => {
    const now = Date.now();
    if (state.workoutStatus === 'idle' || state.workoutStatus === 'finished') state.sessionStartedAt = now;
    state.workoutActive = true;
    state.workoutStatus = 'running';
    state.timerStartedAt = now;
    const workoutCompleted = reconcileWorkoutCompletion(now);
    saveState();
    renderAll();
    toast(workoutCompleted ? 'Workout complete — timer stopped' : 'Workout started');
  });

  $('#pauseWorkoutBtn').addEventListener('click', () => {
    if (state.workoutStatus === 'running') {
      state.elapsedMs = currentElapsedMs();
      state.timerStartedAt = null;
      state.workoutStatus = 'paused';
      state.workoutActive = false;
      stopRestTimer();
      toast('Workout paused');
    } else {
      state.timerStartedAt = Date.now();
      state.workoutStatus = 'running';
      state.workoutActive = true;
      toast('Workout resumed');
    }
    saveState();
    renderAll();
  });

  $('#finishWorkoutBtn').addEventListener('click', async () => {
    if (state.sets.length) {
      const confirmed = await askConfirm('Finish this workout?', 'Completed sets and workout time will move to History. The timer will stop and stay visible.', 'Finish workout');
      if (!confirmed) return;
    }
    const durationMs = currentElapsedMs();
    state = core.finishWorkout(state, Date.now(), durationMs);
    targetCelebrated = false;
    saveState();
    stopRestTimer();
    renderAll();
    toast('Workout finished');
  });

  $('#restartWorkoutBtn').addEventListener('click', async () => {
    if (state.sets.length) {
      const confirmed = await askConfirm('Restart this workout?', 'The timer and current completed sets will be cleared.', 'Restart workout');
      if (!confirmed) return;
    }
    state = core.restartWorkout(state);
    targetCelebrated = false;
    stopRestTimer();
    saveState();
    renderAll();
    toast('Workout restarted');
  });

  $('#resetTimerBtn').addEventListener('click', () => {
    if (currentElapsedMs() < 500) { toast('Timer is already at zero'); return; }
    state.elapsedMs = 0;
    state.timerStartedAt = state.workoutStatus === 'running' ? Date.now() : null;
    saveState();
    renderWorkoutState();
    toast('Workout timer reset');
  });

  $('#clearHistoryBtn').addEventListener('click', async () => {
    if (!state.history.length) { toast('There is no saved history to clear'); return; }
    if (!await askConfirm('Clear saved history?', 'Past workouts will be permanently removed. Your current workout stays.', 'Clear history')) return;
    state.history = [];
    saveState();
    renderHistory();
    toast('History cleared');
  });

  $('#settingsBtn').addEventListener('click', () => {
    renderSettings();
    elements.settings.showModal();
  });
  $('#saveSettingsBtn').addEventListener('click', async (event) => {
    event.preventDefault();
    state.settings.sound = $('#soundSetting').checked;
    state.settings.keepAwake = $('#awakeSetting').checked;
    state.settings.defaultTarget = core.clamp($('#defaultTargetSetting').value, 1, 99);
    state.settings.restSeconds = core.clamp($('#restSetting').value, 0, 600);
    saveState();
    if (window.repboardDesktop) await window.repboardDesktop.setKeepAwake(state.settings.keepAwake);
    elements.settings.close();
    renderSettings();
    toast('Settings saved');
  });

  $('#awakeBtn').addEventListener('click', async () => {
    state.settings.keepAwake = !state.settings.keepAwake;
    if (window.repboardDesktop) state.settings.keepAwake = await window.repboardDesktop.setKeepAwake(state.settings.keepAwake);
    saveState();
    renderSettings();
    toast(state.settings.keepAwake ? 'Display will stay awake' : 'Normal display sleep restored');
  });
  $('#pinBtn').addEventListener('click', async () => {
    state.settings.alwaysOnTop = !state.settings.alwaysOnTop;
    if (window.repboardDesktop) state.settings.alwaysOnTop = await window.repboardDesktop.setAlwaysOnTop(state.settings.alwaysOnTop);
    saveState();
    renderSettings();
    toast(state.settings.alwaysOnTop ? 'RepBoard pinned above other windows' : 'Always-on-top turned off');
  });
  $('#fullscreenBtn').addEventListener('click', () => window.repboardDesktop?.toggleFullscreen());

  document.addEventListener('keydown', (event) => {
    const tag = document.activeElement?.tagName;
    const dialogOpen = Boolean($('dialog[open]'));
    if (tag === 'INPUT' || tag === 'TEXTAREA' || dialogOpen) return;
    const counterVisible = $('#counterView').classList.contains('active');
    if (event.key === 'F11') { event.preventDefault(); window.repboardDesktop?.toggleFullscreen(); return; }
    if (!counterVisible) return;
    if (event.code === 'Space' || event.key === 'ArrowUp' || event.key === '+' || event.key === 'Enter') { event.preventDefault(); recordSet(); }
    else if (event.key === 'ArrowDown' || event.key === '-' || event.key === 'Backspace') { event.preventDefault(); removeLastSet(); }
  });

  // Touch/stylus whiteboard, persisted as normalized vector strokes.
  const canvas = $('#drawCanvas');
  const context = canvas.getContext('2d', { alpha: true });
  let board = { strokes: [] };
  try {
    const persisted = JSON.parse(localStorage.getItem(BOARD_KEY));
    if (persisted && Array.isArray(persisted.strokes)) board = persisted;
  } catch { /* Start with a fresh board. */ }
  let activeStroke = null;
  let drawTool = 'pen';
  let drawColor = '#b8ff28';
  let brushSize = 7;

  function saveBoard() {
    try { localStorage.setItem(BOARD_KEY, JSON.stringify(board)); }
    catch {
      board.strokes = board.strokes.slice(-250);
      localStorage.setItem(BOARD_KEY, JSON.stringify(board));
    }
    $('#boardTip').hidden = board.strokes.length > 0;
  }

  function drawStroke(stroke) {
    if (!stroke.points.length) return;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    context.save();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = stroke.size;
    context.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over';
    context.strokeStyle = stroke.color;
    context.beginPath();
    const first = stroke.points[0];
    context.moveTo(first.x * width, first.y * height);
    if (stroke.points.length === 1) context.lineTo(first.x * width + .01, first.y * height + .01);
    else stroke.points.slice(1).forEach((point) => context.lineTo(point.x * width, point.y * height));
    context.stroke();
    context.restore();
  }

  function redrawBoard() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    const scale = window.devicePixelRatio || 1;
    context.setTransform(scale, 0, 0, scale, 0, 0);
    board.strokes.forEach(drawStroke);
    if (activeStroke) drawStroke(activeStroke);
    $('#boardTip').hidden = board.strokes.length > 0 || Boolean(activeStroke);
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * scale);
    canvas.height = Math.round(rect.height * scale);
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    redrawBoard();
  }

  function pointerPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    };
  }

  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    activeStroke = { tool: drawTool, color: drawColor, size: drawTool === 'eraser' ? Math.max(brushSize * 3, 22) : brushSize, points: [pointerPoint(event)] };
    redrawBoard();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!activeStroke || !canvas.hasPointerCapture(event.pointerId)) return;
    const point = pointerPoint(event);
    const previous = activeStroke.points.at(-1);
    if (Math.hypot(point.x - previous.x, point.y - previous.y) < .0012) return;
    activeStroke.points.push(point);
    redrawBoard();
  });
  function endStroke(event) {
    if (!activeStroke) return;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    board.strokes.push(activeStroke);
    activeStroke = null;
    saveBoard();
    redrawBoard();
  }
  canvas.addEventListener('pointerup', endStroke);
  canvas.addEventListener('pointercancel', endStroke);

  $$('.tool-button[data-tool]').forEach((button) => button.addEventListener('click', () => {
    drawTool = button.dataset.tool;
    $$('.tool-button[data-tool]').forEach((item) => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
  }));
  $$('.color').forEach((button) => button.addEventListener('click', () => {
    drawColor = button.dataset.color;
    drawTool = 'pen';
    $$('.color').forEach((item) => item.classList.toggle('active', item === button));
    $$('.tool-button[data-tool]').forEach((item) => item.classList.toggle('active', item.dataset.tool === 'pen'));
  }));
  $('#brushSize').addEventListener('input', (event) => { brushSize = Number(event.target.value); });
  $('#undoDrawBtn').addEventListener('click', () => { board.strokes.pop(); saveBoard(); redrawBoard(); });
  $('#clearBoardBtn').addEventListener('click', async () => {
    if (!board.strokes.length) return;
    if (!await askConfirm('Clear the board?', 'This removes every pen stroke from your whiteboard.', 'Clear board')) return;
    board.strokes = [];
    saveBoard();
    redrawBoard();
  });

  const canvasObserver = new ResizeObserver(() => {
    if ($('#boardView').classList.contains('active')) resizeCanvas();
  });
  canvasObserver.observe(canvas.parentElement);

  setInterval(() => {
    elements.elapsed.textContent = formatTime(currentElapsedMs() / 1000);
  }, 1000);

  window.addEventListener('beforeunload', () => {
    state.workoutActive = false;
    state.workoutStatus = 'idle';
    state.timerStartedAt = null;
    state.elapsedMs = 0;
    state.sessionStartedAt = Date.now();
    saveState();
    saveBoard();
  });

  renderAll();
  if (window.repboardDesktop) {
    window.repboardDesktop.setKeepAwake(state.settings.keepAwake);
    window.repboardDesktop.setAlwaysOnTop(state.settings.alwaysOnTop);
  }
})();
