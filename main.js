const { app, BrowserWindow, ipcMain } = require('electron');
const mysql = require('mysql2'); // 使用 mysql2 库
const { Client } = require('ssh2'); // 使用 ssh2 库
require('dotenv').config(); // 加载 .env 文件

// MySQL 配置
const mysqlConfig = {
    host: process.env.MYSQL_HOST, // 通过 SSH 隧道连接时，MySQL 主机地址为本地地址
    port: parseInt(process.env.MYSQL_PORT), // MySQL 端口
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE
};

function createWindow () {
    const mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false, // 禁用上下文隔离以便使用 require
        },
        // 设置窗口默认全屏
        fullscreen: true
    });

    mainWindow.loadFile('index.html');

    // SSH 配置
    const sshConfig = {
        host: process.env.SSH_HOST, // SSH 主机地址
        port: parseInt(process.env.SSH_PORT), // SSH 端口
        username: process.env.SSH_USERNAME, // SSH 用户名
        password: process.env.SSH_PASSWORD // SSH 密码
    };

    // 创建 SSH 客户端
    const conn = new Client();

    let stream; // 声明 stream 变量以便在 ipcMain.on('get-table-contents', ...) 中使用

    conn.on('ready', () => {
        console.log('SSH connection established');

        // 创建本地端口转发
        conn.forwardOut(
            '127.0.0.1',
            12345,
            mysqlConfig.host,
            mysqlConfig.port,
            (err, _stream) => {
                if (err) {
                    console.error('Error setting up port forwarding:', err);
                    return;
                }
                stream = _stream; // 将 stream 赋值给全局变量

                // 创建 MySQL 数据库连接
                const db = mysql.createConnection({
                    host: '127.0.0.1',
                    port: 12345, // 使用本地端口转发的端口
                    user: mysqlConfig.user,
                    password: mysqlConfig.password,
                    database: mysqlConfig.database,
                    stream: stream // 使用 SSH 隧道的流
                });

                db.connect((err) => {
                    if (err) {
                        console.error('Error connecting to MySQL:', err.stack);
                        return;
                    }
                    console.log('Connected to MySQL as id ' + db.threadId);

                    // 查询表名并发送给渲染进程
                    db.query("SHOW TABLES", (err, rows) => {
                        if (err) {
                            console.error(err.message);
                        }
                        const tableNames = rows.map(row => Object.values(row)[0]);
                        mainWindow.webContents.send('table-names', tableNames);
                    });
                });

                // 关闭数据库连接
                mainWindow.on('close', () => {
                    db.end((err) => {
                        if (err) {
                            console.error('Error closing MySQL connection:', err.stack);
                            return;
                        }
                        console.log('MySQL connection closed.');
                    });
                });
            }
        );
    }).connect(sshConfig);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// 处理渲染进程发送的查询表内容请求
ipcMain.on('get-table-contents', (event, tableName) => {
    const db = mysql.createConnection({
        host: '127.0.0.1',
        port: 12345, // 使用本地端口转发的端口
        user: mysqlConfig.user,
        password: mysqlConfig.password,
        database: mysqlConfig.database,
        stream: stream // 使用 SSH 隧道的流
    });

    db.connect((err) => {
        if (err) {
            console.error('Error connecting to MySQL:', err.stack);
            return;
        }
        console.log('Connected to MySQL as id ' + db.threadId);

        // 查询表内容并发送给渲染进程
        db.query(`SELECT * FROM \`${tableName}\` LIMIT 100`, (err, rows) => {
            if (err) {
                console.error(err.message);
            }
            event.reply('table-contents', rows);
        });

        // 关闭数据库连接
        db.end((err) => {
            if (err) {
                console.error('Error closing MySQL connection:', err.stack);
                return;
            }
            console.log('MySQL connection closed.');
        });
    });
});