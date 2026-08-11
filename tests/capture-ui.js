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
    backgroundColor: '#07101f',
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  await window.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  await wait(800);

  const initial = await window.webContents.executeJavaScript(
    `({
      count: document.querySelector('#countNumber')?.textContent,
      exercise: document.querySelector('.exercise-item.active span')?.textContent,
      goal: document.querySelector('#targetNumber')?.textContent,
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
    initial.exercise !== 'Push-ups' ||
    initial.goal !== '3' ||
    initial.timer !== '00:00' ||
    initial.startButton !== 'Start workout' ||
    !initial.optionsHidden ||
    !initial.counterDisabled ||
    initial.counterControls.join(',') !== '−,+' ||
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
      document.querySelector('#targetPlus').click();
      const pushupGoal = document.querySelector('#targetNumber').textContent;
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
      return {
        pushupGoal,
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
        exerciseOrder: [...document.querySelectorAll('.exercise-item span')].slice(0, 2).map((item) => item.textContent)
      };
    })()`
  );
  if (
    interaction.pushupGoal !== '4' ||
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
    interaction.exerciseOrder.join(',') !== 'Squats,Press-ups'
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
      historySummary: document.querySelector('.history-day header span')?.textContent
    })`
  );
  if (
    finished.timer === '00:00' ||
    !finished.startVisible ||
    !finished.optionsHidden ||
    !finished.counterDisabled ||
    !finished.historySummary?.includes('•')
  ) {
    throw new Error(`Finish behavior failed: ${JSON.stringify(finished)}`);
  }
  const finishedImage = await window.webContents.capturePage();
  fs.writeFileSync(path.join(outputDirectory, 'repboard-counter-finished.jpg'), finishedImage.resize({ width: 800 }).toJPEG(65));

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
  window.destroy();
  app.quit();
}).catch((error) => {
  console.error(error.stack || error);
  app.exit(1);
});
