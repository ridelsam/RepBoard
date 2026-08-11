const { app, BrowserWindow, ipcMain, powerSaveBlocker, shell } = require('electron');
const path = require('path');

const APP_ID = 'com.repboard.desktop';
let mainWindow;
let blockerId = null;

app.setAppUserModelId(APP_ID);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 880,
    minHeight: 600,
    backgroundColor: '#07101f',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

ipcMain.handle('window:always-on-top', (_event, enabled) => {
  if (!mainWindow) return false;
  mainWindow.setAlwaysOnTop(Boolean(enabled), 'floating');
  return mainWindow.isAlwaysOnTop();
});

ipcMain.handle('window:fullscreen', () => {
  if (!mainWindow) return false;
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
});

ipcMain.handle('power:keep-awake', (_event, enabled) => {
  if (enabled && blockerId === null) {
    blockerId = powerSaveBlocker.start('prevent-display-sleep');
  } else if (!enabled && blockerId !== null) {
    if (powerSaveBlocker.isStarted(blockerId)) powerSaveBlocker.stop(blockerId);
    blockerId = null;
  }
  return blockerId !== null;
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (blockerId !== null && powerSaveBlocker.isStarted(blockerId)) {
    powerSaveBlocker.stop(blockerId);
  }
});
