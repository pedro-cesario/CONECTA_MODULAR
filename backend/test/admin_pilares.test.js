const { describe, it, after } = require('node:test');
const assert = require('node:assert');
const configCache = require('../src/core/config/configCache');
const adminController = require('../src/modules/admin/adminController');

describe('Conecta Admin — 4 Pilares & Catálogo Dinâmico', () => {

  after(async () => {
    try {
      const redisClient = require('../src/core/config/redisClient');
      if (redisClient && redisClient.isOpen) {
        await redisClient.quit();
      }
    } catch(e) {}
  });

  describe('Pilar 2: Catálogo Dinâmico de Relatórios TASY', () => {
    it('deve retornar os 7 relatórios padrão semeados no SQLite', async () => {
      await configCache.load();
      const relatorios = configCache.getRelatoriosTasy(false);
      assert.ok(Array.isArray(relatorios), 'Deve ser um array');
      assert.ok(relatorios.length >= 7, 'Deve conter ao menos os 7 relatórios TASY padrão');
      
      const codigos = relatorios.map(r => r.cd_relatorio);
      assert.ok(codigos.includes(718), 'Deve conter relatório 718 (Checklist)');
      assert.ok(codigos.includes(651), 'Deve conter relatório 651 (Ficha de Atendimento)');
      assert.ok(codigos.includes(205), 'Deve conter relatório 205 (Etiqueta Paciente)');
      assert.ok(codigos.includes(643), 'Deve conter relatório 643 (Termo de Consentimento)');
    });

    it('deve permitir salvar, alternar status e excluir um relatório customizado', async () => {
      await configCache.load();
      // 1. Salvar novo
      const novo = await configCache.saveRelatorioTasy({
        cd_relatorio: 9999,
        nr_sequencia: 1234567,
        ds_titulo: 'RELATÓRIO TESTE AUTOMATIZADO',
        icone: 'bi-file-earmark-check',
        badge: 'Teste QA',
        ativo: 1,
        ordem: 99
      });
      assert.ok(novo.id, 'Deve gerar um ID para o relatório');

      // 2. Verificar presença
      let lista = configCache.getRelatoriosTasy(false);
      let encontrado = lista.find(r => r.id === novo.id);
      assert.strictEqual(encontrado.cd_relatorio, 9999);
      assert.strictEqual(encontrado.ativo, 1);

      // 3. Toggle Ativo -> Inativo
      await configCache.toggleRelatorioTasy(novo.id, 0);
      lista = configCache.getRelatoriosTasy(false);
      encontrado = lista.find(r => r.id === novo.id);
      assert.strictEqual(encontrado.ativo, 0);

      // 4. Excluir
      await configCache.deleteRelatorioTasy(novo.id);
      lista = configCache.getRelatoriosTasy(false);
      encontrado = lista.find(r => r.id === novo.id);
      assert.strictEqual(encontrado, undefined, 'Deve ter sido excluído do SQLite');
    });
  });

  describe('Pilar 4: Parâmetros Institucionais e Cache Dinâmico', () => {
    it('deve expor configurações institucionais sem hardcodes', async () => {
      await configCache.load();
      const config = configCache.getSystemConfig();
      assert.ok(config, 'Config deve existir');
      assert.strictEqual(typeof config.nome_instituicao, 'string');
      assert.strictEqual(config.nome_instituicao, 'Hospital Espírita André Luiz');
      assert.ok(["5", "7"].includes(config.tv_historico_limite));
      assert.ok(config.cache_setores_preaquecidos.includes('68'));
    });
  });

  describe('Pilar 3: Telemetria & Recursos do Servidor', () => {
    it('deve retornar métricas em tempo real de Node.js, heap e runtime', async () => {
      await configCache.load();
      let responseData = null;
      const req = {};
      const res = {
        json: (payload) => {
          responseData = payload;
          return payload;
        },
        status: () => res
      };

      await adminController.obterTelemetriaServidor(req, res);
      assert.ok(responseData, 'Deve retornar payload');
      assert.strictEqual(responseData.success, true);
      assert.ok(responseData.data.node, 'Deve conter informações do Node.js');
      assert.ok(responseData.data.node.memory.heapUsedMb > 0, 'Heap usado deve ser maior que 0');
      assert.ok(responseData.data.node.uptimeFormatted, 'Uptime formatado deve existir');
      assert.ok(responseData.data.oracle, 'Deve conter informações do Oracle');
      assert.ok(responseData.data.redis, 'Deve conter informações do Redis');
    });
  });

});
