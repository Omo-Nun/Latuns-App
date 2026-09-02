const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

console.log('========================================================');
console.log('  LATUNS ERP - HOST DEMOTION WATCHER');
console.log('========================================================');
console.log('Monitoring data/demote.signal for automated demotion...');
console.log('This script must remain open on the host machine.');
console.log();

const dataDir = path.join(__dirname, '..', 'data');
const signalFile = path.join(dataDir, 'demote.signal');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

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
