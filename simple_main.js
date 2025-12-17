const { app, BrowserWindow } = require('electron');

console.log('--- SIMPLE MAIN START ---');
console.log('Type of electron:', typeof require('electron'));
console.log('Electron value:', require('electron'));

if (typeof require('electron') === 'string') {
    console.error('CRITICAL ERROR: Electron is not loaded as a framework. Running as Node.js?');
    process.exit(1);
}

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
    });
    win.loadURL('https://google.com');
}

app.whenReady().then(() => {
    createWindow();
});
