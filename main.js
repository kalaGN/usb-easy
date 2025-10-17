const { app, BrowserWindow, ipcMain } = require('electron');
const { SerialPort } = require('serialport');
require('dotenv').config(); // Load .env file

// Set environment variable to ensure correct encoding
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

let currentPort = null;

function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false, // Disable nodeIntegration for security
            contextIsolation: true, // Enable context isolation
            preload: __dirname + '/preload.js' // Specify preload script
        },
        fullscreen: false // Not fullscreen
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

// IPC handlers
ipcMain.handle('connect-port', async (event, port, options) => {
    // Disconnect previous connection (if exists)
    if (currentPort && currentPort.isOpen) {
        try {
            currentPort.close();
        } catch (err) {
            console.error('Error closing previous connection:', err);
        }
    }
    
    try {
        // Create serial port connection
        currentPort = new SerialPort({
            path: port,
            baudRate: options.baudRate,
            dataBits: options.dataBits,
            stopBits: options.stopBits,
            autoOpen: false
        });
        
        // Return Promise to handle async open operation
        return new Promise((resolve) => {
            currentPort.open((err) => {
                if (err) {
                    console.error('Failed to open serial port:', err.message);
                    resolve({ success: false, message: `Failed to open serial port: ${err.message}` });
                } else {
                    console.log(`Successfully connected to port ${port}`, options);
                    
                    // Listen for data reception
                    currentPort.on('data', (data) => {
                        // Send received data to renderer process
                        console.log('Received serial data:', data.toString('hex'));
                        event.sender.send('serial-data', data.toString());
                    });
                    
                    // Listen for errors
                    currentPort.on('error', (err) => {
                        console.error('Serial port error:', err);
                        event.sender.send('serial-error', err.message);
                    });
                    
                    // Listen for close event
                    currentPort.on('close', () => {
                        console.log('Serial port connection closed');
                    });
                    
                    resolve({ success: true, message: `Successfully connected to port ${port}` });
                }
            });
        });
    } catch (error) {
        console.error('Exception occurred while connecting to port:', error);
        return { success: false, message: `Connection exception: ${error.message}` };
    }
});

ipcMain.handle('disconnect-port', async () => {
    if (currentPort) {
        try {
            if (currentPort.isOpen) {
                currentPort.close();
            }
            currentPort = null;
            console.log('Port disconnected');
            return { success: true, message: 'Port disconnected' };
        } catch (error) {
            console.error('Error disconnecting port:', error);
            return { success: false, message: `Failed to disconnect port: ${error.message}` };
        }
    } else {
        return { success: true, message: 'No active connection' };
    }
});

ipcMain.handle('list-ports', async () => {
    try {
        // Get list of available serial ports
        const ports = await SerialPort.list();
        return { 
            success: true, 
            ports: ports.map(port => ({
                label: port.path,
                value: port.path
            }))
        };
    } catch (error) {
        console.error('Failed to list serial ports:', error);
        return { success: false, error: error.message };
    }
});

// Send data to serial port
ipcMain.handle('send-data', async (event, data) => {
    if (!currentPort) {
        return { success: false, message: 'Not connected to any port' };
    }
    
    if (!currentPort.isOpen) {
        return { success: false, message: 'Serial port is not open' };
    }
    
    try {
        // Return Promise to ensure data sending completion
        return new Promise((resolve) => {
            console.log('Received send request:', { 
                originalData: data, 
                dataType: typeof data,
                dataLength: Array.isArray(data) ? data.length : (typeof data === 'string' ? data.length : 'N/A')
            });
            
            // Handle different data types
            if (typeof data === 'string') {
                // String data (including HEX converted data from renderer process)
                // Check if newline character needs to be added
                let dataToSend = data;
                if (!data.endsWith('\n') && !data.endsWith('\r')) {
                    dataToSend = data + '\n';
                    console.log('Adding newline character to string data');
                }
                
                console.log('Sending string data:', { original: data, withNewline: dataToSend });
                currentPort.write(dataToSend, (err) => {
                    if (err) {
                        console.error('Failed to send data:', err);
                        resolve({ success: false, message: `Failed to send data: ${err.message}` });
                    } else {
                        console.log('String data sent successfully');
                        resolve({ success: true, message: 'Data sent successfully' });
                    }
                });
            } else if (Array.isArray(data)) {
                // Array data (bytes) - this is for HEX data sent as byte arrays
                const buffer = Buffer.from(data);
                console.log('Sending array data as buffer:', { 
                    buffer: buffer,
                    hex: buffer.toString('hex')
                });
                
                currentPort.write(buffer, (err) => {
                    if (err) {
                        console.error('Failed to send data:', err);
                        resolve({ success: false, message: `Failed to send data: ${err.message}` });
                    } else {
                        console.log('Array data sent successfully');
                        resolve({ success: true, message: 'Data sent successfully' });
                    }
                });
            } else {
                // Other data types (possibly objects, etc.)
                console.warn('Unknown data type:', typeof data);
                const buffer = Buffer.from(data);
                console.log('Sending other data type as buffer:', { 
                    buffer: buffer,
                    hex: buffer.toString('hex')
                });
                
                currentPort.write(buffer, (err) => {
                    if (err) {
                        console.error('Failed to send data:', err);
                        resolve({ success: false, message: `Failed to send data: ${err.message}` });
                    } else {
                        console.log('Other data type sent successfully');
                        resolve({ success: true, message: 'Data sent successfully' });
                    }
                });
            }
        });
    } catch (error) {
        console.error('Exception occurred while sending data:', error);
        return { success: false, message: `Send exception: ${error.message}` };
    }
});
