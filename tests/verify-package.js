const assert = require('node:assert/strict');
const path = require('path');
const asar = require('@electron/asar');

const archive = path.join(__dirname, '..', 'dist', 'win-unpacked', 'resources', 'app.asar');
const packageJson = JSON.parse(asar.extractFile(archive, 'package.json'));
const html = asar.extractFile(archive, 'src/index.html').toString();
const appCode = asar.extractFile(archive, 'src/app.js').toString();

assert.equal(packageJson.version, '1.4.0');
for (const id of ['startWorkoutBtn', 'pauseWorkoutBtn', 'finishWorkoutBtn', 'restartWorkoutBtn']) {
  assert.ok(html.includes(id), `Packaged UI is missing ${id}`);
}
assert.ok(appCode.includes("workoutStatus = 'paused'"));
assert.ok(appCode.includes('core.finishWorkout'));
assert.ok(appCode.includes('state.elapsedMs = 0'));
assert.ok(appCode.includes('state.exerciseTargets'));
assert.ok(!html.includes('ONE SET'));
assert.ok(!html.includes('keyboard-hint'));
console.log('Packaged RepBoard 1.4.0 verification passed.');
