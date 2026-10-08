const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const dbPath = path.resolve(__dirname, 'backend/src/core/database/auth.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error(err);
  else {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
      console.log(rows);
    });
  }
});
