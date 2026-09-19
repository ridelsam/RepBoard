const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.setPath('userData', path.join(__dirname, 'artifacts', 'test-user-data', String(process.pid)));

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

app.whenReady().then(async () => {
  const outputDirectory = path.join(__dirname, 'artifacts');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const window = new BrowserWindow({
    width: 1180,
    height: 780,
    show: false,
    backgroundColor: '#18201c',
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false }
  });
  await window.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await wait(800);

  async function captureAppearance(name) {
    // A hidden window may return its preceding compositor frame on first capture.
    await window.webContents.capturePage();
    await wait(150);
    fs.writeFileSync(path.join(outputDirectory, name), (await window.webContents.capturePage()).toPNG());
  }

  const initial = await window.webContents.executeJavaScript(
    `({
      count: document.querySelector('#countNumber')?.textContent,
      theme: document.documentElement.dataset.theme,
      startInView: document.querySelector('#startWorkoutBtn').getBoundingClientRect().bottom <= innerHeight,
      exercise: document.querySelector('.exercise-item.active span')?.textContent,
      goal: document.querySelector('#targetNumber')?.textContent,
      selectedDay: document.querySelector('#daySelect')?.value,
      dayOptions: document.querySelector('#daySelect')?.options.length,
      timer: document.querySelector('#elapsedTime')?.textContent,
      startButton: document.querySelector('#startWorkoutBtn')?.textContent,
      optionsHidden: document.querySelector('#activeWorkoutControls')?.hidden,
      counterDisabled: document.querySelector('#plusBtn')?.disabled,
      counterControls: [...document.querySelectorAll('.counter-controls button')].map((button) => button.textContent.trim()),
      keyboardHintExists: Boolean(document.querySelector('.keyboard-hint')),
      leftPanelWidth: document.querySelector('.exercise-panel')?.getBoundingClientRect().width,
      rightPanelWidth: document.querySelector('.sets-panel')?.getBoundingClientRect().width,
      view: document.querySelector('#counterView')?.classList.contains('active')
    })`
  );
  if (
    initial.count !== '0' ||
    initial.theme !== 'dark' ||
    !initial.startInView ||
    initial.exercise !== 'Push-ups' ||
    initial.goal !== '3' ||
    initial.selectedDay !== ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date().getDay()] ||
    initial.dayOptions !== 7 ||
    initial.timer !== '00:00' ||
    initial.startButton !== 'Start workout' ||
    !initial.optionsHidden ||
    !initial.counterDisabled ||
    initial.counterControls.join(',') !== '−,+ Record set' ||
    initial.keyboardHintExists ||
    initial.leftPanelWidth < 260 ||
    initial.rightPanelWidth < 280 ||
    !initial.view
  ) {
    throw new Error(`Unexpected initial UI state: ${JSON.stringify(initial)}`);
  }

  const image = await window.webContents.capturePage();
  fs.writeFileSync(path.join(outputDirectory, 'repboard-counter.jpg'), image.resize({ width: 800 }).toJPEG(65));
  await window.webContents.executeJavaScript(`document.querySelector('[data-view=board]').click()`);
  await wait(300);
  const boardImage = await window.webContents.capturePage();
  fs.writeFileSync(path.join(outputDirectory, 'repboard-board.jpg'), boardImage.resize({ width: 800 }).toJPEG(65));
  await window.webContents.executeJavaScript(`document.querySelector('[data-view=counter]').click(); document.querySelector('#editExercisesBtn').click()`);
  await wait(150);
  const editorImage = await window.webContents.capturePage();
  fs.writeFileSync(path.join(outputDirectory, 'repboard-exercise-editor.jpg'), editorImage.resize({ width: 800 }).toJPEG(65));
  await window.webContents.executeJavaScript(`document.querySelector('#exerciseDialog .close-button').click()`);

  const interaction = await window.webContents.executeJavaScript(
    `(() => {
      const daySelect = document.querySelector('#daySelect');
      const originalDay = daySelect.value;
      const otherDay = originalDay === 'monday' ? 'tuesday' : 'monday';
      document.querySelector('#targetPlus').click();
      const pushupGoal = document.querySelector('#targetNumber').textContent;
      daySelect.value = otherDay;
      daySelect.dispatchEvent(new Event('change', { bubbles: true }));
      const otherDayPushupGoal = document.querySelector('#targetNumber').textContent;
      daySelect.value = originalDay;
      daySelect.dispatchEvent(new Event('change', { bubbles: true }));
      [...document.querySelectorAll('.exercise-item')].find((button) => button.textContent.trim() === 'Squats').click();
      const squatStartingGoal = document.querySelector('#targetNumber').textContent;
      document.querySelector('#targetMinus').click();
      const squatGoal = document.querySelector('#targetNumber').textContent;
      [...document.querySelectorAll('.exercise-item')].find((button) => button.textContent.trim() === 'Push-ups').click();
      const pushupGoalRestored = document.querySelector('#targetNumber').textContent;
      document.querySelector('#startWorkoutBtn').click();
      const optionsVisible = !document.querySelector('#activeWorkoutControls').hidden;
      const actionLabels = [...document.querySelectorAll('.workout-action')].map((button) => button.textContent);
      document.querySelector('#plusBtn').click();
      document.querySelector('#plusBtn').click();
      document.querySelector('#plusBtn').click();
      const counted = document.querySelector('#countNumber').textContent;
      const savedSets = document.querySelectorAll('.set-item').length;
      document.querySelector('#minusBtn').click();
      const afterRemove = document.querySelector('#countNumber').textContent;
      const savedAfterRemove = document.querySelectorAll('.set-item').length;
      document.querySelector('#editExercisesBtn').click();
      const firstInput = document.querySelector('.exercise-editor-row input');
      firstInput.value = 'Press-ups';
      firstInput.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('.exercise-editor-row .exercise-order-controls button:nth-child(2)').click();
      document.querySelector('#saveExercisesBtn').click();
      const renamedGoal = document.querySelector('#targetNumber').textContent;
      [...document.querySelectorAll('.exercise-item')].find((button) => button.textContent.trim() === 'Squats').click();
      const squatGoalRestored = document.querySelector('#targetNumber').textContent;
      const exerciseOrder = [...document.querySelectorAll('.exercise-item span')].slice(0, 2).map((item) => item.textContent);
      daySelect.value = otherDay;
      daySelect.dispatchEvent(new Event('change', { bubbles: true }));
      const otherDayExercises = [...document.querySelectorAll('.exercise-item span')].slice(0, 2).map((item) => item.textContent);
      daySelect.value = originalDay;
      daySelect.dispatchEvent(new Event('change', { bubbles: true }));
      return {
        pushupGoal,
        otherDayPushupGoal,
        squatStartingGoal,
        squatGoal,
        pushupGoalRestored,
        renamedGoal,
        squatGoalRestored,
        counted,
        optionsVisible,
        actionLabels,
        savedSets,
        afterRemove,
        savedAfterRemove,
        exerciseOrder,
        otherDayExercises
      };
    })()`
  );
  if (
    interaction.pushupGoal !== '4' ||
    interaction.otherDayPushupGoal !== '3' ||
    interaction.squatStartingGoal !== '3' ||
    interaction.squatGoal !== '2' ||
    interaction.pushupGoalRestored !== '4' ||
    interaction.renamedGoal !== '4' ||
    interaction.squatGoalRestored !== '2' ||
    interaction.counted !== '3' ||
    !interaction.optionsVisible ||
    interaction.actionLabels.join(',') !== 'Pause,Finish,Restart' ||
    interaction.savedSets !== 3 ||
    interaction.afterRemove !== '2' ||
    interaction.savedAfterRemove !== 2 ||
    interaction.exerciseOrder.join(',') !== 'Squats,Press-ups' ||
    interaction.otherDayExercises.join(',') !== 'Push-ups,Squats'
  ) {
    throw new Error(`Counter interaction failed: ${JSON.stringify(interaction)}`);
  }

  await wait(1200);
  const paused = await window.webContents.executeJavaScript(
    `(() => {
      document.querySelector('#pauseWorkoutBtn').click();
      return {
        timer: document.querySelector('#elapsedTime').textContent,
        pauseLabel: document.querySelector('#pauseWorkoutBtn').textContent,
        counterDisabled: document.querySelector('#plusBtn').disabled
      };
    })()`
  );
  await wait(1100);
  const pausedStable = await window.webContents.executeJavaScript(`document.querySelector('#elapsedTime').textContent`);
  if (paused.timer === '00:00' || pausedStable !== paused.timer || paused.pauseLabel !== 'Resume' || !paused.counterDisabled) {
    throw new Error(`Pause behavior failed: ${JSON.stringify({ paused, pausedStable })}`);
  }

  await window.webContents.executeJavaScript(`document.querySelector('#pauseWorkoutBtn').click()`);
  await wait(1100);
  await window.webContents.executeJavaScript(`document.querySelector('#finishWorkoutBtn').click()`);
  await wait(100);
  await window.webContents.executeJavaScript(`document.querySelector('#confirmOk').click()`);
  await wait(150);
  const finished = await window.webContents.executeJavaScript(
    `({
      timer: document.querySelector('#elapsedTime').textContent,
      startVisible: !document.querySelector('#startWorkoutBtn').hidden,
      optionsHidden: document.querySelector('#activeWorkoutControls').hidden,
      counterDisabled: document.querySelector('#plusBtn').disabled,
      savedSets: document.querySelectorAll('#setsList .set-item').length,
      emptyVisible: !document.querySelector('#emptySets').hidden,
      setCount: document.querySelector('#setCount').textContent,
      historySummary: document.querySelector('.history-day summary span')?.textContent
    })`
  );
  if (
    finished.timer === '00:00' ||
    !finished.startVisible ||
    !finished.optionsHidden ||
    !finished.counterDisabled ||
    finished.savedSets !== 0 ||
    !finished.emptyVisible ||
    finished.setCount !== '0' ||
    !finished.historySummary?.includes('•')
  ) {
    throw new Error(`Finish behavior failed: ${JSON.stringify(finished)}`);
  }
  const finishedImage = await window.webContents.capturePage();
  fs.writeFileSync(path.join(outputDirectory, 'repboard-counter-finished.jpg'), finishedImage.resize({ width: 800 }).toJPEG(65));

  await window.webContents.executeJavaScript(`document.querySelector('#startWorkoutBtn').click(); document.querySelector('#plusBtn').click(); document.querySelector('#finishWorkoutBtn').click()`);
  await wait(100);
  await window.webContents.executeJavaScript(`document.querySelector('#confirmOk').click()`);
  await wait(300);
  await window.webContents.executeJavaScript(`document.querySelector('[data-view=history]').click()`);
  await wait(200);
  const historyState = await window.webContents.executeJavaScript(
    `(() => {
      const cards = [...document.querySelectorAll('.history-day')];
      return {
        count: cards.length,
        newestOpen: cards[0]?.open,
        olderOpen: cards[1]?.open,
        newestRows: cards[0]?.querySelectorAll('.history-set').length,
        olderRows: cards[1]?.querySelectorAll('.history-set').length,
        olderSummary: cards[1]?.querySelector('summary span')?.textContent,
        newestTitle: cards[0]?.querySelector('h3')?.textContent,
        confirmOpen: document.querySelector('#confirmDialog').open,
        historyActive: document.querySelector('#historyView').classList.contains('active')
      };
    })()`
  );
  if (
    historyState.count !== 2 ||
    !historyState.newestOpen ||
    historyState.olderOpen ||
    historyState.newestRows !== 1 ||
    historyState.olderRows !== 2 ||
    historyState.confirmOpen ||
    !historyState.historyActive ||
    historyState.newestTitle?.includes('Current workout') ||
    !historyState.olderSummary?.includes('completed sets') ||
    !historyState.olderSummary?.includes('•')
  ) {
    throw new Error(`History collapse failed: ${JSON.stringify(historyState)}`);
  }
  const historyImage = await window.webContents.capturePage();
  fs.writeFileSync(path.join(outputDirectory, 'repboard-history.jpg'), historyImage.resize({ width: 800 }).toJPEG(65));
  await window.webContents.executeJavaScript(`document.querySelector('[data-view=counter]').click()`);

  await window.webContents.executeJavaScript(`document.querySelector('#startWorkoutBtn').click(); document.querySelector('#restartWorkoutBtn').click()`);
  const restarted = await window.webContents.executeJavaScript(
    `({ timer: document.querySelector('#elapsedTime').textContent, optionsVisible: !document.querySelector('#activeWorkoutControls').hidden })`
  );
  if (restarted.timer !== '00:00' || !restarted.optionsVisible) {
    throw new Error(`Restart behavior failed: ${JSON.stringify(restarted)}`);
  }

  await wait(1100);
  await window.webContents.executeJavaScript(`document.querySelector('#resetTimerBtn').click()`);
  const resetTimer = await window.webContents.executeJavaScript(`document.querySelector('#elapsedTime').textContent`);
  if (resetTimer !== '00:00') throw new Error(`Timer reset failed: ${resetTimer}`);

  await window.webContents.executeJavaScript(`location.reload()`);
  await wait(350);
  const reopened = await window.webContents.executeJavaScript(
    `({
      timer: document.querySelector('#elapsedTime').textContent,
      startButton: document.querySelector('#startWorkoutBtn').textContent,
      optionsHidden: document.querySelector('#activeWorkoutControls').hidden,
      counterDisabled: document.querySelector('#plusBtn').disabled
    })`
  );
  if (reopened.timer !== '00:00' || reopened.startButton !== 'Start workout' || !reopened.optionsHidden || !reopened.counterDisabled) {
    throw new Error(`Reopen timer state failed: ${JSON.stringify(reopened)}`);
  }

  await window.webContents.executeJavaScript(
    `(() => {
      document.querySelector('#editExercisesBtn').click();
      while (document.querySelectorAll('.exercise-editor-row').length > 1) {
        [...document.querySelectorAll('.remove-exercise')].at(-1).click();
      }
      document.querySelector('#saveExercisesBtn').click();
      while (Number(document.querySelector('#targetNumber').textContent) > 1) {
        document.querySelector('#targetMinus').click();
      }
    })()`
  );
  await window.webContents.executeJavaScript(`document.querySelector('#startWorkoutBtn').click()`);
  await wait(1100);
  const completed = await window.webContents.executeJavaScript(
    `(() => {
      document.querySelector('#plusBtn').click();
      return {
        timer: document.querySelector('#elapsedTime').textContent,
        progress: document.querySelector('#workoutProgress').textContent,
        indicator: document.querySelector('.exercise-item').classList.contains('completed'),
        counterDisabled: document.querySelector('#plusBtn').disabled,
        optionsHidden: document.querySelector('#activeWorkoutControls').hidden,
        startVisible: !document.querySelector('#startWorkoutBtn').hidden,
        savedSets: document.querySelectorAll('#setsList .set-item').length,
        emptyVisible: !document.querySelector('#emptySets').hidden,
        setCount: document.querySelector('#setCount').textContent,
        savedState: JSON.parse(localStorage.getItem('repboard-state-v1')),
        savedStatus: JSON.parse(localStorage.getItem('repboard-state-v1')).workoutStatus
      };
    })()`
  );
  await wait(1100);
  const completedTimerStable = await window.webContents.executeJavaScript(`document.querySelector('#elapsedTime').textContent`);
  if (
    completed.timer === '00:00' ||
    completedTimerStable !== completed.timer ||
    completed.progress !== '0 of 1 exercises done' ||
    completed.indicator ||
    !completed.counterDisabled ||
    !completed.optionsHidden ||
    !completed.startVisible ||
    completed.savedSets !== 0 ||
    !completed.emptyVisible ||
    completed.setCount !== '0' ||
    completed.savedState.sets.length !== 0 ||
    completed.savedState.history.length !== 3 ||
    completed.savedState.history.at(-1).sets.length !== 1 ||
    completed.savedState.history.at(-1).durationMs < 1000 ||
    completed.savedStatus !== 'finished'
  ) {
    throw new Error(`Automatic workout completion failed: ${JSON.stringify({ completed, completedTimerStable })}`);
  }
  await wait(250);
  const completedImage = await window.webContents.capturePage();
  fs.writeFileSync(path.join(outputDirectory, 'repboard-counter-complete.jpg'), completedImage.resize({ width: 800 }).toJPEG(65));
  const nextWorkout = await window.webContents.executeJavaScript(`(() => {
    document.querySelector('#startWorkoutBtn').click();
    return {
      timer: document.querySelector('#elapsedTime').textContent,
      savedSets: document.querySelectorAll('#setsList .set-item').length,
      counterDisabled: document.querySelector('#plusBtn').disabled,
      historyCount: JSON.parse(localStorage.getItem('repboard-state-v1')).history.length
    };
  })()`);
  if (nextWorkout.timer !== '00:00' || nextWorkout.savedSets !== 0 || nextWorkout.counterDisabled || nextWorkout.historyCount !== 3) {
    throw new Error(`Starting after completion failed: ${JSON.stringify(nextWorkout)}`);
  }
  // Appearance changes apply immediately in Settings without resetting a workout.
  for (const theme of ['dark', 'light']) {
    const themed = await window.webContents.executeJavaScript(`(() => {
      const saved = JSON.parse(localStorage.getItem('repboard-state-v1'));
      document.querySelector('#settingsBtn').click();
      document.querySelector('[data-theme-choice="${theme}"]').click();
      const next = JSON.parse(localStorage.getItem('repboard-state-v1'));
      return {
        theme: document.documentElement.dataset.theme,
        savedTheme: next.settings.theme,
        scheme: getComputedStyle(document.documentElement).colorScheme,
        preserved: JSON.stringify(saved.sets) === JSON.stringify(next.sets) && saved.timerStartedAt === next.timerStartedAt && saved.workoutStatus === next.workoutStatus,
        selected: document.querySelector('[data-theme-choice="${theme}"]').getAttribute('aria-pressed'),
        modalOpen: document.querySelector('#settingsDialog').open
      };
    })()`);
    if (themed.theme !== theme || themed.savedTheme !== theme || themed.scheme !== theme || !themed.preserved || themed.selected !== 'true' || !themed.modalOpen) {
      throw new Error(`Appearance change failed: ${JSON.stringify(themed)}`);
    }
    await captureAppearance(`quiet-form-${theme}-settings.png`);
    await window.webContents.executeJavaScript(`document.querySelector('#settingsDialog .close-button').click()`);
    await wait(200);
    if (await window.webContents.executeJavaScript(`document.querySelector('#settingsDialog').open`)) {
      throw new Error('Settings close button did not dismiss the dialog');
    }
    for (const view of ['counter', 'board', 'history']) {
      await window.webContents.executeJavaScript(`document.querySelector('[data-view="${view}"]').click()`);
      await wait(100);
      await captureAppearance(`quiet-form-${theme}-${view}.png`);
    }
    await window.webContents.executeJavaScript(`document.querySelector('[data-view="counter"]').click()`);
  }
  await window.webContents.executeJavaScript(`location.reload()`);
  await wait(350);
  const restoredTheme = await window.webContents.executeJavaScript(`document.documentElement.dataset.theme`);
  if (restoredTheme !== 'light') throw new Error('Light appearance was not restored on launch');
  // Existing primary/white strokes and new semantic inks stay readable in both modes.
  const boardFixture = { strokes: ['#b8ff28', '#ffffff', 'accent', 'text'].map((color, index) => ({
    color, tool: 'pen', size: 7, points: [{ x: .2, y: .2 + index * .15 }, { x: .8, y: .2 + index * .15 }]
  })) };
  await window.webContents.executeJavaScript(`window.addEventListener('beforeunload', () => localStorage.setItem('repboard-board-v1', ${JSON.stringify(JSON.stringify(boardFixture))}), { once: true }); location.reload()`);
  await wait(350);
  await window.webContents.executeJavaScript(`document.querySelector('[data-view="board"]').click()`);
  await wait(100);
  for (const theme of ['light', 'dark']) {
    const inks = await window.webContents.executeJavaScript(`(() => {
      document.querySelector('#settingsBtn').click();
      document.querySelector('[data-theme-choice="${theme}"]').click();
      document.querySelector('#settingsDialog .close-button').click();
      const canvas = document.querySelector('#drawCanvas'), ctx = canvas.getContext('2d');
      return [0, 1, 2, 3].map(i => [...ctx.getImageData(Math.floor(canvas.width * .5), Math.floor(canvas.height * (.2 + i * .15)), 1, 1).data]);
    })()`);
    const accent = theme === 'light' ? [53,94,75,255] : [163,196,173,255];
    const ink = theme === 'light' ? [36,43,38,255] : [232,238,233,255];
    if (JSON.stringify(inks) !== JSON.stringify([accent, ink, accent, ink])) throw new Error(`Board inks failed in ${theme}: ${JSON.stringify(inks)}`);
    await captureAppearance(`quiet-form-${theme}-board-inks.png`);
  }
  const savedBoard = await window.webContents.executeJavaScript(`JSON.parse(localStorage.getItem('repboard-board-v1'))`);
  if (JSON.stringify(savedBoard) !== JSON.stringify(boardFixture)) throw new Error('Appearance changed saved board strokes');
  await window.webContents.executeJavaScript(`document.querySelector('[data-view="counter"]').click()`);
  window.setContentSize(960, 600);
  await wait(150);
  const layout = await window.webContents.executeJavaScript(`({
    overflow: document.documentElement.scrollWidth > innerWidth,
    startBottom: document.querySelector('#startWorkoutBtn').getBoundingClientRect().bottom,
    viewport: innerHeight
  })`);
  if (layout.overflow || layout.startBottom > layout.viewport) throw new Error(`Compact layout failed: ${JSON.stringify(layout)}`);
  fs.writeFileSync(path.join(outputDirectory, 'quiet-form-compact.png'), (await window.webContents.capturePage()).toPNG());
  console.log('Workout controls, history, automatic completion, both appearances, persistence, and compact layout passed.');
  window.destroy();
  app.quit();
}).catch((error) => {
  console.error(error.stack || error);
  app.exit(1);
});
