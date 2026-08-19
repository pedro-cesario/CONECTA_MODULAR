const db = require('better-sqlite3')('backend/auth.sqlite'); console.log(db.prepare('SELECT name FROM sqlite_master WHERE type=''table''').all());
