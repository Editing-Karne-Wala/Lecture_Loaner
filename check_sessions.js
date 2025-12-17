const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

// Hardcoded path based on find_by_name result
const fs = require('fs');
let dbPath = path.join(process.env.APPDATA, 'app', 'lecture_loaner.db');

console.log("Checking DB at:", dbPath);

if (fs.existsSync(dbPath)) {
    const db = new Database(dbPath);
    const sessions = db.prepare("SELECT * FROM sessions WHERE status = 'active'").all();
    console.log(`Found ${sessions.length} active sessions.`);
    sessions.forEach(s => {
        console.log(`- ID: ${s.id}, Start: ${s.start_time}, Deadline: ${s.deadline}`);
    });
} else {
    console.log("DB file not found!");
}
