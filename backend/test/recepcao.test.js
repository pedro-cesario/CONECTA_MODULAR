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

});
