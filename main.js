const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win;
let canClose = false;

function createWindow() {
  win = new BrowserWindow({
    fullscreen: true,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false
    }
  });

  // Force top-most level (Standard 'floating' level, allows OneNote to share top)
  // win.setAlwaysOnTop(true, 'screen-saver'); // REMOVED: Too aggressive for OneNote

  // SMART MONITOR: Whitelist Enforcement
  // If the user is using an allowed app, we RELAX (AlwaysOnTop = false)
  // If they switch to a forbidden app (e.g. Chrome), we ATTACK (AlwaysOnTop = true + Focus)
  const ALLOWED_APPS = [
    'explorer', 'cmd', 'powershell', 'WindowsTerminal', 'ONENOTE',
    'code', 'codeblocks', 'JupyterLab', 'Acrobat', 'notepad',
    // System Apps
    'StartMenuExperienceHost', 'SearchApp', 'SearchHost', 'ShellExperienceHost', 'SystemSettings'
  ]; // Case-insensitive check is done below

  const { spawn } = require('child_process');

  setInterval(() => {
    if (!win || win.isDestroyed()) return;

    const psScript = path.join(__dirname, 'get_active_process.ps1');
    const allowedString = ALLOWED_APPS.join(',');
    // Pass whitelist to script so it can auto-minimize
    const child = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-File', psScript, '-AllowedAppsString', allowedString]);

    child.stdout.on('data', (data) => {
      const activeApp = data.toString().trim();
      if (!activeApp) return;

      console.log(`DEBUG: SmartMonitor saw '${activeApp}'`); // DEBUG LOG

      // Check if active app is in whitelist (Case Insensitive)
      // Note: The PS script sends the minimize command, but we still handle Z-order here as backup
      const isAllowed = ALLOWED_APPS.some(app => activeApp.toLowerCase() === app.toLowerCase());

      // Also allow OURSELVES (Electron/Video Player) 
      // Note: Electron app process name is usually 'electron' or 'video-player-win32-x64'
      const isMe = activeApp.toLowerCase().includes('electron') || activeApp.toLowerCase().includes('video');

      if (isAllowed || isMe) {
        // USER IS WORKING: Relax
        if (win.isAlwaysOnTop()) {
          console.log(`Smart Monitor: Relaxing for ${activeApp}`);
          win.setAlwaysOnTop(false);
          win.minimize(); // Optional: Auto-minimize if obstructing? Maybe just relax z-order.
          // EDIT: Let's just relax z-order so they can alt-tab freely.
        }
      } else {
        // USER IS DISTRACTED: Attack!
        console.log(`Smart Monitor: Blocking ${activeApp}`);

        // AGGRESSIVE: No check. Force it every 500ms to defeat Alt-Tab persistence.
        win.setAlwaysOnTop(true, 'screen-saver');
        win.focus();
        win.moveTop();
      }
    });
  }, 500); // 500ms for faster reaction

  win.loadFile('index.html');

  win.webContents.on('did-finish-load', () => {
    win.webContents.send('init-args', process.argv);
  });

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log(`Media load failed: ${errorDescription}`);
  });

  win.on('close', (e) => {
    if (!canClose) {
      e.preventDefault();
    }
  });

  // Handle fullscreen toggle attempts via 'f' or Escape keys
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      event.preventDefault();
    }
  });

  // Disable browser's fullscreen exit on Escape
  win.webContents.on('enter-full-screen', () => {
    win.webContents.executeJavaScript(`
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
        }
      });
    `);
  });

  ipcMain.on('allow-close', () => {
    canClose = true;
    win.close();
  });

  ipcMain.on('minimize-window', () => {
    win.minimize();
  });

  ipcMain.on('copy-to-clipboard', (event, text) => {
    const { clipboard } = require('electron');
    clipboard.writeText(text);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});