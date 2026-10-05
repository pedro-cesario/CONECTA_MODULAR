/**
 * Conecta Assistencial — Structured Logger
 * Provides JSON/Pretty logs with Timestamp, Level, Request ID and Metadata.
 */

const isProduction = process.env.NODE_ENV === 'production';

function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    message,
    ...meta
  };

  if (isProduction) {
    return JSON.stringify(entry);
  }

  // Pretty print for development/local
  const reqPart = entry.requestId ? ` [Req: ${entry.requestId.slice(0, 8)}]` : '';
  const userPart = entry.user ? ` [User: ${entry.user}]` : '';
  const metaStr = Object.keys(meta).filter(k => !['requestId', 'user'].includes(k)).length > 0
    ? ' ' + JSON.stringify(meta)
    : '';

  return `[${timestamp}] [${level.toUpperCase()}]${reqPart}${userPart} ${message}${metaStr}`;
}

const logger = {
  info(message, meta) {
    console.log(formatLog('info', message, meta));
  },
  warn(message, meta) {
    console.warn(formatLog('warn', message, meta));
  },
  error(message, meta) {
    console.error(formatLog('error', message, meta));
  },
  debug(message, meta) {
    if (process.env.DEBUG || !isProduction) {
      console.log(formatLog('debug', message, meta));
    }
  },
  http(req, res, durationMs) {
    const statusCode = res.statusCode;
    const level = statusCode >= 500 ? 'error' : (statusCode >= 400 ? 'warn' : 'info');
    const user = req.session?.usuario?.nm_usuario || req.session?.usuario?.nome || null;
    
    this[level](`${req.method} ${req.originalUrl || req.url} ${statusCode} (${durationMs.toFixed(1)}ms)`, {
      requestId: req.requestId,
      user,
      ip: req.ip,
      statusCode,
      durationMs
    });
  }
};

module.exports = logger;
