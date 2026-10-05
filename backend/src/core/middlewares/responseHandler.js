/**
 * Middleware para enriquecer a resposta HTTP com métodos padronizados
 */
function responseHandler(req, res, next) {
  res.success = function (data = null, meta = null, statusCode = 200) {
    const payload = {
      success: true,
      data
    };
    if (meta) {
      payload.meta = meta;
    }
    return res.status(statusCode).json(payload);
  };

  res.fail = function (message = 'Erro na operação', statusCode = 400, code = 'BAD_REQUEST', details = null) {
    return res.status(statusCode).json({
      success: false,
      message,
      error: {
        code,
        message,
        details
      }
    });
  };

  next();
}

module.exports = responseHandler;
