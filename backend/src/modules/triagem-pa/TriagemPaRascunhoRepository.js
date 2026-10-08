const rascunhosDb = require('../../core/database/rascunhosDatabase');

class TriagemPaRascunhoRepository {
  async getRascunho(nrAtendimento) {
    return await rascunhosDb.getRascunho(nrAtendimento);
  }

  async saveRascunho(nrAtendimento, rascunhoData, nmUsuario) {
    const version = rascunhoData._version || null;
    return await rascunhosDb.saveRascunho(nrAtendimento, JSON.stringify(rascunhoData), nmUsuario, version);
  }

  async removeRascunho(nrAtendimento) {
    return await rascunhosDb.removeRascunho(nrAtendimento);
  }
}

module.exports = new TriagemPaRascunhoRepository();
