# Contributing to RepBoard

Thanks for helping improve the world's most overengineered method of remembering a small number.

## Before opening a change

- Keep the interface usable from a touchscreen across a room.
- Prefer large controls and short labels over tiny precision-click targets.
- Preserve local-only operation; RepBoard should not require an account or cloud service.
- Avoid adding dependencies unless they clearly earn their place.

## Development

```powershell
npm install
npm test
npm start
```

Run the Electron GUI smoke test when changing interactions or layout:

```powershell
npx electron tests\capture-ui.js
```

Build release artifacts with:

```powershell
npm run dist
```

## Pull requests

Describe what changed, why it helps, and how you tested it. Screenshots are appreciated for visible changes. One focused improvement per pull request is easier to review than a heroic rewrite of the entire gym.
