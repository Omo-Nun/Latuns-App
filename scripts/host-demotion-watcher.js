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
            
            // Since rejoin-as-standby.bat asks for user input (PEER_IP), we need to handle it or modify it.
            // For full automation, we can pass it, but standard exec is fine for now if we modify the bat file
            // Let's just launch it in a new window so the user sees it and can enter the IP if needed
            exec(`start cmd.exe /K "${batPath}"`, (error) => {
                if (error) {
                    console.error(`Error executing script: ${error}`);
                } else {
                    console.log('Rejoin script launched successfully in a new window.');
                }
            });
            
        } catch (err) {
            console.error('Error processing demote signal:', err);
        }
    }
}, 5000);
