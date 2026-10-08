const assert = require('assert');
const TriagemValidationService = require('./TriagemValidationService');
const db = require('../../core/database/index.js');

async function runTests() {
  let queryLog = [];
  
  const originalGetConnection = db.getConnection;
  db.getConnection = async () => {
    return {
      execute: async (sql, params) => {
        queryLog.push({ sql, params });
        if (params.id == 9999) return { rows: [] };
        
        // Simular retorno de DS_CLASSIFICACAO correta
        if (sql.includes('triagem_classif_risco')) {
          if (params.id == 1) return { rows: [{ DS_CLASSIFICACAO: 'Vermelho' }] };
          if (params.id == 2) return { rows: [{ DS_CLASSIFICACAO: 'Amarelo' }] };
          if (params.id == 3) return { rows: [{ DS_CLASSIFICACAO: 'Azul' }] }; // Inválido se esperado Verde
        }
        
        return { rows: [{ 1: 1 }] };
      },
      close: async () => {}
    };
  };

  try {
    // Test 1: All valid
    queryLog = [];
    await TriagemValidationService.validatePAConfigs({
      triagem_estab: 1,
      triagem_setor: 39,
      triagem_fila_origem: 10,
      triagem_classif_nao_identificado: 1,
      triagem_cor_vermelho: 1,
      triagem_cor_amarelo: 2,
      triagem_procedencia: 1,
      triagem_clinica: 1,
      triagem_tipo_atend: 1,
      triagem_motivo: 1,
      triagem_motivo_inutilizacao: 3
    });
    assert.strictEqual(queryLog.length, 11, 'Deveria ter executado 11 consultas');

    // Test 2: Invalid Fila
    queryLog = [];
    try {
      await TriagemValidationService.validatePAConfigs({ triagem_fila_origem: 9999 });
      assert.fail('Should have thrown');
    } catch(e) {
      assert(e.message.includes('Fila de espera (nr_sequencia: 9999) não existe.'));
    }

    // Test 3: Multiple invalid
    queryLog = [];
    try {
      await TriagemValidationService.validatePAConfigs({ triagem_setor: 9999, triagem_cor_vermelho: 9999 });
      assert.fail('Should have thrown');
    } catch(e) {
      assert(e.message.includes('Setor Padrão (cd: 9999) não existe no TASY.'));
      assert(e.message.includes('Classificação de Risco (nr_sequencia: 9999) não existe no TASY.'));
    }

    // Test 4: Wrong color
    queryLog = [];
    try {
      await TriagemValidationService.validatePAConfigs({ triagem_cor_verde: 3 });
      assert.fail('Should have thrown');
    } catch(e) {
      assert(e.message.includes("Classificação de Risco (nr_sequencia: 3) aponta para 'Azul' ao invés de 'Verde'."));
    }

    console.log("All validation tests passed!");
  } finally {
    db.getConnection = originalGetConnection;
  }
}

runTests().catch(console.error);
