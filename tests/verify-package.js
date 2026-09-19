const assert = require('node:assert/strict');
const path = require('path');
const asar = require('@electron/asar');

const archive = path.join(__dirname, '..', 'dist', 'win-unpacked', 'resources', 'app.asar');
const packageJson = JSON.parse(asar.extractFile(archive, 'package.json'));
const html = asar.extractFile(archive, 'src/index.html').toString();
const appCode = asar.extractFile(archive, 'src/app.js').toString();
const stateCode = asar.extractFile(archive, 'src/state.js').toString();

assert.equal(packageJson.version, '1.7.0');
for (const id of ['daySelect', 'startWorkoutBtn', 'pauseWorkoutBtn', 'finishWorkoutBtn', 'restartWorkoutBtn']) {
  assert.ok(html.includes(id), `Packaged UI is missing ${id}`);
}
assert.ok(appCode.includes("workoutStatus = 'paused'"));
assert.ok(appCode.includes('core.finishWorkout'));
assert.ok(appCode.includes('core.isWorkoutComplete'));
assert.ok(appCode.includes('state.elapsedMs = 0'));
assert.ok(appCode.includes('plan.exerciseTargets'));
assert.ok(appCode.includes("document.createElement('details')"));
assert.ok(stateCode.includes('dayPlans'));
assert.ok(stateCode.includes('isWorkoutComplete'));
assert.ok(!html.includes('ONE SET'));
assert.ok(!html.includes('keyboard-hint'));
assert.ok(html.includes('data-theme-choice="light"'));
assert.ok(html.includes('data-theme-choice="dark"'));
assert.ok(asar.extractFile(archive, 'src/theme-init.js').length > 0);
const icon = asar.extractFile(archive, 'build/icon.ico');
assert.equal(icon.readUInt16LE(2), 1);
assert.equal(icon.readUInt16LE(4), 7);
console.log('Packaged RepBoard 1.7.0 verification passed.');
