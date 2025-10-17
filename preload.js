const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露 Node.js API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
    connectPort: (port, options) => ipcRenderer.invoke('connect-port', port, options),
    disconnectPort: () => ipcRenderer.invoke('disconnect-port'),
    listPorts: () => ipcRenderer.invoke('list-ports'),
    sendData: (data) => ipcRenderer.invoke('send-data', data),
    onSerialData: (callback) => ipcRenderer.on('serial-data', (_event, data) => callback(data)),
    onSerialError: (callback) => ipcRenderer.on('serial-error', (_event, error) => callback(error))
});