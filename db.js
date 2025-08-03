const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const config = require('./config.json');

async function initDb() {
  const db = await open({ filename: config.dbFile, driver: sqlite3.Database });
  await db.run(`CREATE TABLE IF NOT EXISTS paid_users (
    id TEXT PRIMARY KEY,
    until TEXT
  )`);
  return db;
}

module.exports = { initDb };
