const { insertAuditLog } = require('../database/auditDatabase');
const logger = require('./logger');

/**
 * Conecta Assistencial — LGPD Compliance & Audit Trail Logger
 * Registra acessos e manipulações de prontuários, passagens e dados sensíveis.
 */
const auditLogger = {
  log({ req, action, resourceType, resourceId, details, status = 'SUCCESS' }) {
    const user = req?.session?.usuario || {};
    const cdUsuario = user.cd_usuario || user.id || null;
    const nmUsuario = user.nm_usuario || user.nome || 'ANONIMO';
    const perfil = user.perfilAtivo || user.perfil || null;
    const ip = req?.ip || req?.connection?.remoteAddress || null;
    const userAgent = req?.headers ? req.headers['user-agent'] : null;
    const requestId = req?.requestId || null;

    const entry = {
      timestamp: new Date().toISOString(),
      requestId,
      cdUsuario,
      nmUsuario,
      perfil,
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : null,
      details,
      ip,
      userAgent,
      status
    };

    // Log assíncrono para o SQLite (não bloqueia a requisição HTTP)
    insertAuditLog(entry).catch(err => {
      logger.error('[AuditLogger] Falha ao persistir audit trail:', { error: err?.message, entry });
    });

    // Registra também no logger estruturado
    logger.info(`[LGPD-AUDIT] ${action} em ${resourceType}:${resourceId || 'ALL'} por ${nmUsuario}`, {
      requestId,
      action,
      resourceType,
      resourceId,
      nmUsuario
    });
  }
};

module.exports = auditLogger;
