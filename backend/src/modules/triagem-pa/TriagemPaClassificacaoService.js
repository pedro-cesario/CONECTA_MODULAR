const { AppError } = require('../../core/errors/AppError');
const crypto = require('crypto');

class TriagemPaClassificacaoService {
  static allowedFields = ['pas', 'pad', 'fc', 'fr', 'sato2', 'glasgow', 'spo2'];
  static allowedOperators = ['>', '>=', '<', '<=', '==', '!='];
  
  static defaultPrecedencia = ['VERMELHO', 'AMARELO', 'VERDE', 'AZUL'];
  
  static defaultRegrasAutomaticas = [
    { id: 'V2_PA_ALTA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'OR', condicoes: [ { campo: 'pas', operador: '>', valor: 170 }, { campo: 'pad', operador: '>', valor: 120 } ] },
    { id: 'V2_PA_BAIXA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'OR', condicoes: [ { campo: 'pas', operador: '<', valor: 80 }, { campo: 'pad', operador: '<', valor: 60 } ] },
    { id: 'V2_FC_ALTA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'AND', condicoes: [ { campo: 'fc', operador: '>=', valor: 160 } ] },
    { id: 'V2_FC_BAIXA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'AND', condicoes: [ { campo: 'fc', operador: '<', valor: 50 } ] },
    { id: 'V2_FR_ALTA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'AND', condicoes: [ { campo: 'fr', operador: '>', valor: 30 } ] },
    { id: 'V2_FR_BAIXA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'AND', condicoes: [ { campo: 'fr', operador: '<', valor: 10 } ] },
    { id: 'V2_SPO2_BAIXA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'AND', condicoes: [ { campo: 'spo2', operador: '<', valor: 85 } ] },
    { id: 'V3_GLASGOW', criterio: 'V3', cor: 'VERMELHO', ativo: true, operadorLogico: 'AND', condicoes: [ { campo: 'glasgow', operador: '<=', valor: 8 } ] }
  ];

  static defaultRegrasManuais = [
    { codigo: 'V1', descricao: 'TAE nas últimas 2h', cor: 'VERMELHO', ativo: true, ordem: 1 },
    { codigo: 'V4', descricao: 'Dor torácica de características anginosas / suspeita de SCA', cor: 'VERMELHO', ativo: true, ordem: 2 },
    { codigo: 'V5', descricao: 'Agitação psicomotora grave / necessidade de contenção física', cor: 'VERMELHO', ativo: true, ordem: 3 },
    { codigo: 'A1', descricao: 'Inquietação / gesticulando muito / risco de agitação', cor: 'AMARELO', ativo: true, ordem: 4 },
    { codigo: 'A2', descricao: 'Presença de encaminhamento a atendimento de urgência / transferência inter-hospitalar', cor: 'AMARELO', ativo: true, ordem: 5 },
    { codigo: 'A3', descricao: 'Choro intenso', cor: 'AMARELO', ativo: true, ordem: 6 },
    { codigo: 'A4', descricao: 'Conflitos com acompanhante no pronto atendimento', cor: 'AMARELO', ativo: true, ordem: 7 },
    { codigo: 'A5', descricao: 'IAE com planejamento', cor: 'AMARELO', ativo: true, ordem: 8 },
    { codigo: 'G1', descricao: 'Insônia', cor: 'VERDE', ativo: true, ordem: 9 },
    { codigo: 'G2', descricao: 'Depressão com comportamento tranquilo', cor: 'VERDE', ativo: true, ordem: 10 },
    { codigo: 'G3', descricao: 'DV estáveis', cor: 'VERDE', ativo: true, ordem: 11 },
    { codigo: 'G4', descricao: 'Estado Mental Estável', cor: 'VERDE', ativo: true, ordem: 12 },
    { codigo: 'B1', descricao: 'Relatório', cor: 'AZUL', ativo: true, ordem: 13 },
    { codigo: 'B2', descricao: 'Renovar receita', cor: 'AZUL', ativo: true, ordem: 14 },
    { codigo: 'B3', descricao: 'Continuar acompanhamento no ambulatório', cor: 'AZUL', ativo: true, ordem: 15 },
    { codigo: 'B4', descricao: 'Atestado', cor: 'AZUL', ativo: true, ordem: 16 }
  ];

  static calcularGlasgow(glasgowData) {
    if (!glasgowData) return null;
    const { ocular, verbal, motora } = glasgowData;
    if (!ocular || !verbal || !motora) return null;
    return Number(ocular) + Number(verbal) + Number(motora);
  }

  static validarRegrasAutomaticas(regras) {
    if (!Array.isArray(regras)) throw new AppError('Regras automáticas inválidas', 400);
    const ids = new Set();
    regras.forEach(r => {
      if (!r.id) throw new AppError('Regra automática sem id', 400);
      if (ids.has(r.id)) throw new AppError(`Código duplicado: ${r.id}`, 400);
      ids.add(r.id);
      if (!r.cor) throw new AppError(`Regra ${r.id} sem cor`, 400);
      if (r.operadorLogico !== 'AND' && r.operadorLogico !== 'OR') throw new AppError(`Regra ${r.id} possui agrupador diferente de AND/OR`, 400);
      if (!Array.isArray(r.condicoes) || r.condicoes.length === 0) throw new AppError(`Regra ${r.id} com grupo vazio de condições`, 400);
      
      r.condicoes.forEach((c, idx) => {
        if (!this.allowedFields.includes(c.campo)) throw new AppError(`Campo desconhecido: ${c.campo} na regra ${r.id}`, 400);
        if (!this.allowedOperators.includes(c.operador)) throw new AppError(`Operador não suportado: ${c.operador} na regra ${r.id}`, 400);
        if (c.valor === undefined || c.valor === null) throw new AppError(`Valor obrigatório na condição ${idx} da regra ${r.id}`, 400);
      });
    });
    return regras;
  }

  static validarRegrasManuais(regras) {
    if (!Array.isArray(regras)) throw new AppError('Critérios manuais inválidos', 400);
    const codigos = new Set();
    regras.forEach(r => {
      if (!r.codigo) throw new AppError('Critério manual sem código', 400);
      if (codigos.has(r.codigo)) throw new AppError(`Código duplicado: ${r.codigo}`, 400);
      codigos.add(r.codigo);
      if (!r.descricao) throw new AppError(`Critério ${r.codigo} sem descrição`, 400);
      if (!r.cor) throw new AppError(`Critério ${r.codigo} sem cor`, 400);
      if (r.ordem === undefined || isNaN(r.ordem)) throw new AppError(`Critério ${r.codigo} sem ordem válida`, 400);
    });
    return regras;
  }

  static validarPrecedencia(precedencia) {
    if (!Array.isArray(precedencia)) throw new AppError('Precedência inválida', 400);
    const required = ['VERMELHO', 'AMARELO', 'VERDE', 'AZUL'];
    for (const req of required) {
      if (!precedencia.includes(req)) throw new AppError(`Cor ausente na precedência: ${req}`, 400);
    }
    const unique = new Set(precedencia);
    if (unique.size !== precedencia.length) throw new AppError('Precedência contém duplicatas', 400);
    return precedencia;
  }

  static evaluateExpression(valorObtido, operador, valorRegra) {
    if (valorObtido === null || valorObtido === undefined || valorObtido === '') return false;
    const v1 = Number(valorObtido);
    const v2 = Number(valorRegra);
    switch (operador) {
      case '>': return v1 > v2;
      case '>=': return v1 >= v2;
      case '<': return v1 < v2;
      case '<=': return v1 <= v2;
      case '==': return v1 === v2;
      case '!=': return v1 !== v2;
      default: return false;
    }
  }

  static evaluateRuleGroup(regra, valoresDisponiveis) {
    const isAnd = regra.operadorLogico === 'AND';
    const numCondicoes = regra.condicoes.length;
    let validCount = 0;
    
    // Evaluate if there are values present for all necessary fields? 
    // Usually if a field is null/missing, it evaluates to false.
    let evaluatedResults = [];

    for (const cond of regra.condicoes) {
      const valorAferido = valoresDisponiveis[cond.campo];
      const res = this.evaluateExpression(valorAferido, cond.operador, cond.valor);
      evaluatedResults.push(res);
    }

    if (isAnd) {
      return evaluatedResults.every(v => v === true);
    } else {
      return evaluatedResults.some(v => v === true);
    }
  }

  static getEvidenciaStr(regra) {
    const desc = regra.condicoes.map(c => `${c.campo} ${c.operador} ${c.valor}`);
    return `[${regra.id}] ${desc.join(' ' + regra.operadorLogico + ' ')}`;
  }

  static async calcularClassificacao(rascunhoData, adminConfigs = {}) {
    let precedencia;
    let regrasAutomaticas;
    let regrasManuais;

    try {
      precedencia = adminConfigs.triagem_precedencia ? this.validarPrecedencia(JSON.parse(adminConfigs.triagem_precedencia)) : this.defaultPrecedencia;
    } catch(e) { precedencia = this.defaultPrecedencia; }

    try {
      regrasAutomaticas = adminConfigs.triagem_regras_automaticas ? this.validarRegrasAutomaticas(JSON.parse(adminConfigs.triagem_regras_automaticas)) : this.defaultRegrasAutomaticas;
    } catch(e) { regrasAutomaticas = this.defaultRegrasAutomaticas; }

    try {
      regrasManuais = adminConfigs.triagem_regras_manuais ? this.validarRegrasManuais(JSON.parse(adminConfigs.triagem_regras_manuais)) : this.defaultRegrasManuais;
    } catch(e) { regrasManuais = this.defaultRegrasManuais; }

    const configHash = crypto.createHash('md5').update(JSON.stringify({ precedencia, regrasAutomaticas, regrasManuais })).digest('hex');

    const coresElegiveis = new Set();
    const criteriosIdentificados = [];

    const glasgowScore = this.calcularGlasgow(rascunhoData.glasgow);
    const sv = rascunhoData.sinaisVitais || {};

    const valoresDisponiveis = {
      glasgow: glasgowScore,
      fc: sv.fc,
      fr: sv.fr,
      spo2: sv.sato2 !== undefined ? sv.sato2 : sv.spo2, // Suporta alias
      pas: sv.pas,
      pad: sv.pad
    };

    // Avaliar Automáticos
    regrasAutomaticas.filter(r => r.ativo).forEach(regra => {
      if (this.evaluateRuleGroup(regra, valoresDisponiveis)) {
        coresElegiveis.add(regra.cor);
        criteriosIdentificados.push({
          origem: 'AUTOMATICO',
          codigo: regra.id,
          criterio: regra.criterio,
          cor: regra.cor,
          evidencia: this.getEvidenciaStr(regra)
        });
      }
    });

    // Avaliar Manuais
    const inputManuais = rascunhoData.criteriosManuais || [];
    const configManuaisMap = {};
    regrasManuais.filter(r => r.ativo).forEach(r => { configManuaisMap[r.codigo] = r; });

    for (const critId of inputManuais) {
      if (configManuaisMap[critId]) {
        const rConf = configManuaisMap[critId];
        coresElegiveis.add(rConf.cor);
        criteriosIdentificados.push({
          origem: 'MANUAL',
          codigo: rConf.codigo,
          descricao: rConf.descricao,
          cor: rConf.cor
        });
      }
    }

    let classificacaoResolvida = null;
    const arrCores = Array.from(coresElegiveis);

    if (arrCores.length > 0) {
      // Aplicar precedencia
      for (const corPrioritaria of precedencia) {
        if (arrCores.includes(corPrioritaria)) {
          classificacaoResolvida = corPrioritaria;
          break;
        }
      }
    }

    return {
      coresElegiveis: arrCores,
      classificacaoResolvida,
      criteriosIdentificados,
      glasgowScore,
      configVersion: configHash,
      configManuaisValidas: regrasManuais // para expor ao frontend
    };
  }
}

module.exports = TriagemPaClassificacaoService;
