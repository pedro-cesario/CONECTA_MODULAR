const { AppError } = require('../errors/AppError');
const logger = require('../utils/logger');

/**
 * Middleware Centralizado de Tratamento de Erros
 * Padrão Enterprise com Envelope RESTful e rastreamento de Correlation ID
 */
function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV === 'development';
  const requestId = req.requestId || null;

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`[AppError ${err.statusCode}] ${err.code}: ${err.message}`, {
        requestId,
        code: err.code,
        details: err.details
      });
    }
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      requestId,
      error: {
        code: err.code,
        message: err.message,
        details: err.details || null
      }
    });
  }

  // Tratamento para erros de sintaxe em JSON de requisições
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'JSON mal formatado no corpo da requisição',
      requestId,
      error: {
        code: 'BAD_REQUEST',
        message: 'JSON mal formatado no corpo da requisição'
      }
    });
  }

  // Erro não tratado / interno
  logger.error(`[UnhandledError] ${req.method} ${req.originalUrl}: ${err?.message || err}`, {
    requestId,
    stack: err?.stack,
    method: req.method,
    url: req.originalUrl
  });

  return res.status(500).json({
    success: false,
    message: isDev ? err.message : 'Erro interno do servidor',
    requestId,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isDev ? err.message : 'Erro interno do servidor',
      stack: isDev ? err.stack : undefined
    }
  });
}

module.exports = errorHandler;

