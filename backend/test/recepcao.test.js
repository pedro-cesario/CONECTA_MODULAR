const { describe, it } = require('node:test');
const assert = require('node:assert');
const recepcaoService = require('../src/modules/recepcao/recepcaoService');

describe('Recepção & Acolhimento — Unit Tests', () => {

  describe('Validação de Busca de Pessoas Físicas', () => {
    it('deve retornar array vazio para termos nulos ou com menos de 2 caracteres', async () => {
      assert.deepStrictEqual(await recepcaoService.buscarPessoas(null), []);
      assert.deepStrictEqual(await recepcaoService.buscarPessoas(''), []);
      assert.deepStrictEqual(await recepcaoService.buscarPessoas('a'), []);
    });
  });

  describe('Validação de Cadastro de Paciente', () => {
    it('deve rejeitar cadastro sem nome da pessoa física', async () => {
      await assert.rejects(
        async () => {
          await recepcaoService.salvarPessoa({ nm_pessoa_fisica: '', dt_nascimento: '1990-01-01' }, 'teste');
        },
        { message: 'Nome completo da pessoa é obrigatório' }
      );
    });

    it('deve rejeitar cadastro sem data de nascimento', async () => {
      await assert.rejects(
        async () => {
          await recepcaoService.salvarPessoa({ nm_pessoa_fisica: 'Paciente Teste', dt_nascimento: null }, 'teste');
        },
        { message: 'Data de nascimento é obrigatória' }
      );
    });
  });

  describe('Validação de Abertura de Atendimento', () => {
    it('deve rejeitar abertura de atendimento sem pessoa física', async () => {
      await assert.rejects(
        async () => {
          await recepcaoService.abrirAtendimento({ cd_pessoa_fisica: null }, 'teste');
        },
        { message: 'Pessoa física é obrigatória para abrir atendimento' }
      );
    });
  });

  describe('Validação de Categorias e Convênios', () => {
    it('deve retornar array vazio se convênio não for informado', async () => {
      const cats = await recepcaoService.listarCategoriasConvenio(null);
      assert.deepStrictEqual(cats, []);
    });

    it('deve retornar null se pessoa não for informada para último convênio', async () => {
      const ultimo = await recepcaoService.obterUltimoConvenioPaciente(null);
      assert.strictEqual(ultimo, null);
    });
  });

  describe('Isolamento de Filas por Módulo (Recepção vs Pronto Atendimento vs Painel)', () => {
    const configCache = require('../src/core/config/configCache');
    const recepcaoRepository = require('../src/modules/recepcao/recepcaoRepository');

    let origGetPerfil;
    let origListarFilas;
    let origListarSenhas;

    it('deve filtrar filas e senhas estritamente pelo campo correspondente ao módulo solicitado', async () => {
      origGetPerfil = configCache.getPerfilById;
      origListarFilas = recepcaoRepository.listarFilasSenhas;
      origListarSenhas = recepcaoRepository.listarSenhasEspera;

      try {
        configCache.getPerfilById = () => ({
          config_recepcao: {
            filasPermitidas: [1, 2],
            filasDpa: [3, 4],
            filasPainel: [5]
          }
        });

        recepcaoRepository.listarFilasSenhas = async () => [
          { NR_SEQUENCIA: 1, DS_FILA: 'Recepção Normal' },
          { NR_SEQUENCIA: 2, DS_FILA: 'Recepção Pref' },
          { NR_SEQUENCIA: 3, DS_FILA: 'Triagem P.A.' },
          { NR_SEQUENCIA: 4, DS_FILA: 'Emergência P.A.' },
          { NR_SEQUENCIA: 5, DS_FILA: 'Painel TV' }
        ];

        recepcaoRepository.listarSenhasEspera = async () => [
          { NR_SEQUENCIA: 101, nr_seq_fila_senha: 1, CD_SENHA_GERADA: 'R01' },
          { NR_SEQUENCIA: 102, nr_seq_fila_senha: 3, CD_SENHA_GERADA: 'T01' },
          { NR_SEQUENCIA: 103, nr_seq_fila_senha: 5, CD_SENHA_GERADA: 'P01' }
        ];

        // Recepção: só deve ver filas 1 e 2, e senha 101
        const resRec = await recepcaoService.listarFilasSenhas('perfil_teste', 'recepcao');
        assert.deepStrictEqual(resRec.data.map(f => f.NR_SEQUENCIA), [1, 2]);

        const senhasRec = await recepcaoService.listarSenhasEspera(null, 'perfil_teste', 'recepcao');
        assert.deepStrictEqual(senhasRec.map(s => s.NR_SEQUENCIA), [101]);

        // Pronto Atendimento (DPA): só deve ver filas 3 e 4, e senha 102
        const resDpa = await recepcaoService.listarFilasSenhas('perfil_teste', 'dashboard_pa');
        assert.deepStrictEqual(resDpa.data.map(f => f.NR_SEQUENCIA), [3, 4]);

        const senhasDpa = await recepcaoService.listarSenhasEspera(null, 'perfil_teste', 'dashboard_pa');
        assert.deepStrictEqual(senhasDpa.map(s => s.NR_SEQUENCIA), [102]);

        // Painel de Senhas: só deve ver fila 5, e senha 103
        const resPainel = await recepcaoService.listarFilasSenhas('perfil_teste', 'painel_senhas');
        assert.deepStrictEqual(resPainel.data.map(f => f.NR_SEQUENCIA), [5]);

        const senhasPainel = await recepcaoService.listarSenhasEspera(null, 'perfil_teste', 'painel_senhas');
        assert.deepStrictEqual(senhasPainel.map(s => s.NR_SEQUENCIA), [103]);
      } finally {
        configCache.getPerfilById = origGetPerfil;
        recepcaoRepository.listarFilasSenhas = origListarFilas;
        recepcaoRepository.listarSenhasEspera = origListarSenhas;
      }
    });
  });

});
