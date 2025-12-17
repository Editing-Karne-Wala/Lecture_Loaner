const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

// Mock app.getPath for standalone script
const userDataPath = "C:\\Users\\shiny\\AppData\\Roaming\\Lecture Loaner";
const dbPath = path.join(userDataPath, 'lecture_loaner.db');

console.log("Opening DB at:", dbPath);
const db = new Database(dbPath);

const info = db.prepare("UPDATE sessions SET status = 'cancelled' WHERE status = 'active' OR status = 'reckoning'").run();
console.log(`Cleared ${info.changes} active/reckoning sessions.`);
