const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const { formatarItemPainel } = require('../src/modules/painel/painelController');
const configCache = require('../src/core/config/configCache');

describe('Fluxo de Senha da Internação & Exibição de Nome — Unit Tests', () => {

  before(async () => {
    await configCache.load();
  });

  describe('Formatação de Item do Painel TV com Paciente', () => {
    it('deve incluir nm_paciente quando fornecido', () => {
      const row = {
        NR_SEQUENCIA: 101,
        CD_SENHA_GERADA: 15,
        DS_MAQUINA_CHAMADA: 'Guichê 02',
        HR_CHAMADA: '14:30',
        DS_FILA: 'PA - INTERNAÇÃO',
        NM_PACIENTE: 'MARIA DAS GRACAS SILVA'
      };

      const formatado = formatarItemPainel(row);

      assert.strictEqual(formatado.nr_sequencia, 101);
      assert.strictEqual(formatado.cd_senha_gerada, 15);
      assert.strictEqual(formatado.cd_senha_completa, 'P 15');
      assert.strictEqual(formatado.nm_paciente, 'MARIA DAS GRACAS SILVA');
      assert.strictEqual(formatado.ds_guiche, 'Guichê 02');
      assert.strictEqual(formatado.ds_fila, 'PA - INTERNAÇÃO');
    });

    it('deve manter nm_paciente nulo quando não identificado (totem)', () => {
      const row = {
        NR_SEQUENCIA: 102,
        CD_SENHA_GERADA: 16,
        DS_MAQUINA_CHAMADA: 'Guichê 01',
        HR_CHAMADA: '14:35',
        DS_FILA: 'PA - NORMAL'
      };

      const formatado = formatarItemPainel(row);

      assert.strictEqual(formatado.nr_sequencia, 102);
      assert.strictEqual(formatado.cd_senha_gerada, 16);
      assert.strictEqual(formatado.cd_senha_completa, 'P 16');
      assert.strictEqual(formatado.nm_paciente, null);
    });
  });

  describe('Configuração da Fila de Internação', () => {
    it('deve carregar configuração de fila do Dashboard PA ou permitir fallback para 18', () => {
      const configPA = configCache.getDashboardPAConfig();
      const nrFila = (configPA && configPA.nr_sequencia_fila) ? Number(configPA.nr_sequencia_fila) : 18;
      assert.ok(typeof nrFila === 'number' && nrFila > 0);
      assert.strictEqual(nrFila, 18);
    });
  });

});
