const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');

const dbDir = path.resolve(__dirname, '../../../../auth.sqlite');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'config.db');
const db = new sqlite3.Database(dbPath);

// Initialize Audit Table
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS conecta_audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    request_id TEXT,
    cd_usuario TEXT,
    nm_usuario TEXT,
    perfil TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT,
    ip TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'SUCCESS'
  )`);

  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON conecta_audit_trail (timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_usuario ON conecta_audit_trail (nm_usuario)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_action ON conecta_audit_trail (action)`);
});

function insertAuditLog(entry) {
  return new Promise((resolve) => {
    const sql = `INSERT INTO conecta_audit_trail 
      (timestamp, request_id, cd_usuario, nm_usuario, perfil, action, resource_type, resource_id, details, ip, user_agent, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    const params = [
      entry.timestamp || new Date().toISOString(),
      entry.requestId || null,
      entry.cdUsuario || null,
      entry.nmUsuario || null,
      entry.perfil || null,
      entry.action,
      entry.resourceType,
      entry.resourceId || null,
      typeof entry.details === 'object' ? JSON.stringify(entry.details) : (entry.details || null),
      entry.ip || null,
      entry.userAgent || null,
      entry.status || 'SUCCESS'
    ];

    db.run(sql, params, function (err) {
      if (err) {
        console.error('[AuditTrail] Erro ao inserir log de auditoria:', err.message);
        return resolve(false);
      }
      resolve(this.lastID);
    });
  });
}

function queryAuditLogs({ limit = 100, offset = 0, usuario, action, startDate, endDate } = {}) {
  return new Promise((resolve, reject) => {
    let sql = `SELECT * FROM conecta_audit_trail WHERE 1=1`;
    const params = [];

    if (usuario) {
      sql += ` AND nm_usuario LIKE ?`;
      params.push(`%${usuario}%`);
    }
    if (action) {
      sql += ` AND action = ?`;
      params.push(action);
    }
    if (startDate) {
      sql += ` AND timestamp >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND timestamp <= ?`;
      params.push(endDate);
    }

    sql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(Math.min(limit, 500), offset);

    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });
}

module.exports = {
  db,
  insertAuditLog,
  queryAuditLogs
};
