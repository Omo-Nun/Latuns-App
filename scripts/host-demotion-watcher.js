const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('========================================================');
console.log('  LATUNS ERP - HOST DEMOTION WATCHER');
console.log('========================================================');

const dataDir = path.join(__dirname, '..', 'data');
const signalFile = path.join(dataDir, 'demote.signal');
const pidFile = path.join(dataDir, 'demote-watcher.pid');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// PID-file guard: prevent dual execution with Electron's built-in watcher
if (fs.existsSync(pidFile)) {
    try {
        const existingPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
        // Check if the process is still running
        try {
            process.kill(existingPid, 0); // Signal 0 = check if process exists
            console.log(`Another demotion watcher is already running (PID ${existingPid}).`);
            console.log('If this is stale, delete data/demote-watcher.pid and retry.');
            process.exit(0);
        } catch (e) {
            // Process not running — stale PID file, overwrite it
            console.log(`Stale PID file found (PID ${existingPid} not running). Taking over.`);
        }
    } catch (e) {
        // Malformed PID file, overwrite it
    }
}

// Write our PID
fs.writeFileSync(pidFile, process.pid.toString());

// Cleanup PID file on exit
function cleanup() {
    try {
        if (fs.existsSync(pidFile)) {
            const storedPid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
            if (storedPid === process.pid) {
                fs.unlinkSync(pidFile);
            }
        }
    } catch (e) {
        // Best-effort cleanup
    }
}

process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });

console.log(`Monitoring data/demote.signal for automated demotion (PID ${process.pid})...`);
console.log('This script must remain open on the host machine.');
console.log();

// Check every 5 seconds
setInterval(() => {
    if (fs.existsSync(signalFile)) {
        console.log(`[${new Date().toISOString()}] DEMOTE SIGNAL DETECTED!`);
        console.log('Initiating automated standby re-initialization...');
        
        try {
            // Delete the signal file so it doesn't loop
            fs.unlinkSync(signalFile);
            
            // Execute the batch script
            const batPath = path.join(__dirname, '..', 'rejoin-as-standby.bat');
            
            // Execute the batch script silently in the background
            // We removed the manual prompt in the bat file, so it's fully automated now
            exec(`"${batPath}"`, (error, stdout, stderr) => {
                if (error) {
                    console.error(`Error executing demotion script: ${error}`);
                    if (stderr) console.error(`Stderr: ${stderr}`);
                } else {
                    console.log('Demotion and rejoin completed successfully in the background.');
                    console.log(stdout);
                }
            });
            
        } catch (err) {
            console.error('Error processing demote signal:', err);
        }
    }
}, 5000);
