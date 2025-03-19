const { app, BrowserWindow, ipcMain } = require('electron');
require('dotenv').config(); // 加载 .env 文件

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // 禁用上下文隔离以便使用 require
        },
        fullscreen: false // 修改为不全屏
    });

    mainWindow.loadFile('index.html');
    
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});