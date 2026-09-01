const { app, BrowserWindow, dialog } = require('electron');
const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const waitOn = require('wait-on');

let mainWindow;

// Paths
const rootDir = __dirname;
const dataDir = path.join(rootDir, 'data');
const signalFile = path.join(dataDir, 'demote.signal');
const rejoinScript = path.join(rootDir, 'rejoin-as-standby.bat');

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: 'Latuns ERP Startup',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    // Optionally load a basic loading HTML file, or just let it be blank until localhost responds
    mainWindow.loadFile('loading.html').catch(() => {
        // If no loading.html exists, just keep it blank
    });

    try {
        console.log('Starting Docker cluster...');
        
        // Start Docker
        const dockerProcess = spawn('docker-compose', ['up', '-d', '--build'], { cwd: rootDir, shell: true });
        
        dockerProcess.stdout.on('data', (data) => {
            process.stdout.write(data);
        });

        dockerProcess.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        dockerProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`Error starting Docker: process exited with code ${code}`);
                dialog.showErrorBox('Docker Error', 'Failed to start Docker containers. Make sure Docker Desktop is running.');
            }
        });

        console.log('Waiting for ERP to become available at http://localhost:3000...');
        
        // Wait for localhost:3000
        await waitOn({
            resources: ['http-get://localhost:3000'],
            delay: 1000, // initial delay
            interval: 1000,
            timeout: 120000, // 2 mins timeout
            window: 1000,
        });

        console.log('ERP is online! Loading UI...');
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.setTitle('Latuns ERP');
        
        // Start demotion watcher
        startDemotionWatcher();

    } catch (err) {
        console.error('Startup Error:', err);
        dialog.showErrorBox('Startup Failed', 'Could not reach the local ERP server in time.');
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

function startDemotionWatcher() {
    console.log('Starting internal demotion watcher...');
    
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    setInterval(() => {
        if (fs.existsSync(signalFile)) {
            console.log(`[${new Date().toISOString()}] DEMOTE SIGNAL DETECTED!`);
            
            try {
                fs.unlinkSync(signalFile);
                
                // Show a native notification/dialog
                dialog.showMessageBox({
                    type: 'warning',
                    title: 'Cluster Handover Alert',
                    message: 'A peer node has taken over as Primary Master.\nThis node will now automatically rejoin as a Standby Replica.'
                });

                exec(`start cmd.exe /K "${rejoinScript}"`, (error) => {
                    if (error) {
                        console.error(`Error executing rejoin script: ${error}`);
                    }
                });
            } catch (err) {
                console.error('Error processing demote signal:', err);
            }
        }
    }, 5000);
}
