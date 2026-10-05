const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const configCache = require('../src/core/config/configCache');
const { validarPerfil, validarModuloPermissao, getPerfilAtivo } = require('../src/core/utils/acesso');

describe('Security & Access Matrix — Unit Tests', () => {
  before(async () => {
    await configCache.load();
  });

  describe('getPerfilAtivo', () => {
    it('should return perfilAtivo when defined in session', () => {
      const usuario = { nm_usuario: 'dr.joao', perfilAtivo: 'medico' };
      assert.strictEqual(getPerfilAtivo(usuario), 'medico');
    });

    it('should fallback to perfisDisponiveis when perfilAtivo is undefined', () => {
      const usuario = { nm_usuario: 'dr.joao', perfisDisponiveis: [{ id: 'psicologia' }] };
      assert.strictEqual(getPerfilAtivo(usuario), 'psicologia');
    });

    it('should return null when usuario is null or empty', () => {
      assert.strictEqual(getPerfilAtivo(null), null);
      assert.strictEqual(getPerfilAtivo({}), null);
    });
  });

  describe('validarPerfil', () => {
    it('should allow access when perfil matches and session flag is present', () => {
      const usuario = {
        nm_usuario: 'enfermeiro.pedro',
        perfilAtivo: 'enfermagem',
        acesso_enfermagem: true
      };
      assert.strictEqual(validarPerfil(usuario, 'enfermagem'), true);
    });

    it('should reject access when session flag is missing', () => {
      const usuario = {
        nm_usuario: 'enfermeiro.pedro',
        perfilAtivo: 'enfermagem',
        acesso_enfermagem: false
      };
      assert.strictEqual(validarPerfil(usuario, 'enfermagem'), false);
    });

    it('should reject access when perfil does not match', () => {
      const usuario = {
        nm_usuario: 'psico.ana',
        perfilAtivo: 'psicologia',
        acesso_psicologia: true
      };
      assert.strictEqual(validarPerfil(usuario, 'enfermagem'), false);
    });
  });

  describe('validarModuloPermissao', () => {
    it('should reject when usuario has no permissions for module', () => {
      const usuario = { nm_usuario: 'user.teste', perfilAtivo: 'visitante' };
      assert.strictEqual(validarModuloPermissao(usuario, 'passagem'), false);
    });

    it('should return false for null user', () => {
      assert.strictEqual(validarModuloPermissao(null, 'passagem'), false);
    });
  });
});
