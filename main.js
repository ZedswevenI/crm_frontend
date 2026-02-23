const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile(path.join(__dirname, 'dist/crm_frontend/browser/index.html'));

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log('Failed to load:', errorDescription);
    // Retry loading
    win.loadFile(path.join(__dirname, 'dist/crm_frontend/browser/index.html'));
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});