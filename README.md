# RepBoard

> Vibe-coded out of necessity because Microsoft is sunsetting Whiteboard for personal accounts—an app apparently used by less than 1% of PC users and, unfortunately, 100% of me.

I only used Whiteboard on my touchscreen laptop to count workout sets in my room. Against all odds, this may be the first vibe-coded app that is actually useful.

RepBoard is a touch-friendly Windows set counter with individual exercise goals, a workout timer, history, and a built-in pen/touch whiteboard. Everything stays local.

*The `<1%` figure is a joke, not real telemetry. Please do not cite this repository in a market analysis.*

## Features

- One-tap completed-set tracking
- A separate set goal for every exercise
- Separate editable and reorderable exercise plans for every weekday
- At-a-glance indicators when exercises and the full workout are complete
- Automatic workout-timer stop when every exercise reaches its set goal
- Start, pause, resume, finish, restart, and reset timer controls
- Local workout history with older sessions collapsed into quick summaries
- Touch/stylus whiteboard
- Keep-awake, always-on-top, and fullscreen controls

## Download

Get the [latest release](../../releases/latest):

- `RepBoard-Setup-1.6.0-x64.exe` — recommended installer
- `RepBoard-Portable-1.6.0-x64.exe` — no installation needed

The app is not commercially code-signed, so Windows SmartScreen may show an **Unrecognized app** warning. You can review the source or build it yourself.

## Build it yourself

```powershell
git clone https://github.com/YOUR_USERNAME/RepBoard.git
cd RepBoard
npm install
npm test
npm start
```

Create the installer and portable build with:

```powershell
npm run dist
```

## License

[MIT](LICENSE). RepBoard is an independent project and is not affiliated with Microsoft.
