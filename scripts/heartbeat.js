const https = require('https');
const http = require('http');
const os = require('os');
const { execSync } = require('child_process');

const GCF_ENDPOINT = process.env.HEARTBEAT_ENDPOINT;
const nodeName = process.env.NODE_NAME || 'Node Alpha';
const role = process.env.NODE_ROLE || 'Primary';

const HEARTBEAT_INTERVAL_MS = 60000; // 1 minute
const BACKUP_INTERVAL_MS = 15 * 60000; // 15 minutes

console.log(`Starting Daemon for ${nodeName} (${role})...`);

function triggerLocalBackup() {
    console.log(`[DAEMON] Triggering frequent local safety backup...`);
    
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/cluster/backup',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    };

    const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
            console.log(`[DAEMON] Automated safety backup completed successfully.`);
        } else {
            console.error(`[DAEMON] Automated backup failed with status code: ${res.statusCode}`);
        }
    });

    req.on('error', (e) => {
        console.error(`[DAEMON] Error triggering local backup: ${e.message}`);
    });

    req.end();
}

function sendHeartbeat() {
    console.log(`[DAEMON] Recording heartbeat locally...`);
    
    // We update local status without freezing if cloud fails
    try {
        const sqlite3 = require('node:sqlite');
        const db = new sqlite3.DatabaseSync('./latuns.db');
        db.exec(`INSERT INTO settings (key, value) VALUES ('lastHeartbeat', '${new Date().toISOString()}') ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
    } catch(err) {
        console.error("[DAEMON] Failed to update local DB heartbeat:", err.message);
    }

    if (!GCF_ENDPOINT) {
        console.log(`[DAEMON] No GCF_ENDPOINT provided. Skipping cloud ping.`);
        return;
    }

    const payload = JSON.stringify({
        machineIdentity: os.hostname(),
        nodeName,
        role,
        uptime: os.uptime(),
        timestamp: new Date().toISOString()
    });

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    const req = https.request(GCF_ENDPOINT, options, (res) => {
        console.log(`[DAEMON] Cloud Heartbeat response [${res.statusCode}]`);
    });

    req.on('error', (e) => {
        console.error(`[DAEMON] Cloud Heartbeat error (Ignored, keeping system alive): ${e.message}`);
    });

    req.write(payload);
    req.end();
}

// Initial triggers
sendHeartbeat();

// Setup intervals
setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
setInterval(triggerLocalBackup, BACKUP_INTERVAL_MS);
