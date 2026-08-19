const escalaAtivaRepository = require('../repositories/escalaAtivaRepository');

function fromDbRows(rows) {
  if (!rows || rows.length === 0) return null;

  const map = new Map();
  const enfermeiro = rows.find(r => r.IE_TIPO === 'ENFERMEIRO');

  const tecnicosMap = new Map();

  rows.forEach(row => {
    const cdPessoa = row.CD_PESSOA_FISICA ? Number(row.CD_PESSOA_FISICA) : null;
    const nrAtend = row.NR_ATENDIMENTO ? Number(row.NR_ATENDIMENTO) : null;

    if (!map.has(row.IE_TIPO)) {
      map.set(row.IE_TIPO, []);
    }

    const entry = {
      cd_pessoa_fisica: cdPessoa,
      nr_atendimento: nrAtend,
      ds_observacao: row.DS_OBSERVACAO || ''
    };

    map.get(row.IE_TIPO).push(entry);

    if (row.IE_TIPO === 'TECNICO' && cdPessoa && nrAtend) {
      if (!tecnicosMap.has(cdPessoa)) {
        tecnicosMap.set(cdPessoa, { cd_pessoa_fisica: cdPessoa, pacientes: [], patio_circulante: [] });
      }
      tecnicosMap.get(cdPessoa).pacientes.push(nrAtend);
    }

    if (row.IE_TIPO === 'PATIO' && cdPessoa) {
      if (!tecnicosMap.has(cdPessoa)) {
        tecnicosMap.set(cdPessoa, { cd_pessoa_fisica: cdPessoa, pacientes: [], patio_circulante: [] });
      }
      tecnicosMap.get(cdPessoa).patio_circulante.push('Patio');
    }

    if (row.IE_TIPO === 'CIRCULANTE' && cdPessoa) {
      if (!tecnicosMap.has(cdPessoa)) {
        tecnicosMap.set(cdPessoa, { cd_pessoa_fisica: cdPessoa, pacientes: [], patio_circulante: [] });
      }
      tecnicosMap.get(cdPessoa).patio_circulante.push('Circulante');
    }
  });

  const faltasFolgas = (map.get('FALTA') || []).map(e => ({ cd_pessoa_fisica: e.cd_pessoa_fisica, tipo: 'Falta' }))
    .concat((map.get('FOLGA') || []).map(e => ({ cd_pessoa_fisica: e.cd_pessoa_fisica, tipo: 'Folga' })));

  const avaliacaoMap = new Map();
  (map.get('AVALIACAO') || []).forEach(e => {
    if (!e.cd_pessoa_fisica) return;
    const key = `${e.cd_pessoa_fisica}||${e.ds_observacao || ''}`;
    if (!avaliacaoMap.has(key)) {
      avaliacaoMap.set(key, { cd_pessoa_fisica: e.cd_pessoa_fisica, pacientes: new Set(), descricao: e.ds_observacao || '' });
    }
    if (e.nr_atendimento) {
      avaliacaoMap.get(key).pacientes.add(e.nr_atendimento);
    }
  });
  const avaliacaoExterna = [...avaliacaoMap.values()].map(item => ({
    cd_pessoa_fisica: item.cd_pessoa_fisica,
    pacientes: [...item.pacientes],
    descricao: item.descricao
  }));

  const observacoesRow = (map.get('OBSERVACAO') || [])[0];
  const observacoes = observacoesRow ? observacoesRow.ds_observacao : '';

  const profissionais = (map.get('PSICOLOGO') || []).map(e => ({ cd_pessoa_fisica: e.cd_pessoa_fisica }));

  const ectPre = (map.get('PRE_PROCEDIMENTO') || [])[0];
  const ectSala = (map.get('SALA_PROCEDIMENTO') || [])[0];
  const ectRec = (map.get('SALA_RECUPERACAO') || [])[0];
  const ect = (ectPre || ectSala || ectRec) ? {
    pre_procedimento: ectPre ? Number(ectPre.cd_pessoa_fisica) : null,
    sala_procedimento: ectSala ? Number(ectSala.cd_pessoa_fisica) : null,
    sala_recuperacao: ectRec ? Number(ectRec.cd_pessoa_fisica) : null
  } : null;

  const result = {
    tipo_escala: profissionais.length > 0 || Number(rows[0].CD_SETOR_ATENDIMENTO) === 4 ? 'PSICOLOGIA' : 'ASSISTENCIAL',
    cd_setor_atendimento: rows[0].CD_SETOR_ATENDIMENTO,
    data_plantao: rows[0].DT_PLANTAO,
    turno: rows[0].IE_TURNO,
    nr_versao: rows[0].NR_VERSAO,
    nm_usuario: rows[0].NM_USUARIO,
    enfermeiro_cd_pessoa_fisica: enfermeiro ? Number(enfermeiro.CD_PESSOA_FISICA) : null,
    profissionais,
    tecnicos: [...tecnicosMap.values()],
    faltas_folgas: faltasFolgas,
    avaliacao_externa: avaliacaoExterna,
    observacoes: observacoes,
    ect: ect
  };

  console.log('[EscalaAtiva] fromDbRows:', JSON.stringify({ tecnicos: result.tecnicos.length, patio: result.tecnicos.filter(t => t.patio_circulante && t.patio_circulante.includes('Patio')).length, circulante: result.tecnicos.filter(t => t.patio_circulante && t.patio_circulante.includes('Circulante')).length, faltasFolgas: result.faltas_folgas.length, avaliacao: result.avaliacao_externa.length, obs: result.observacoes ? 'S' : 'N' }));

  return result;
}

function toDbItems(payload) {
  const items = [];

  if (payload.tipo_escala === 'PSICOLOGIA') {
    const profissionais = [...new Set((payload.profissionais || []).map(item => Number(item?.cd_pessoa_fisica)).filter(Number.isInteger))];
    profissionais.forEach(cdPessoa => {
      items.push({ ie_tipo: 'PSICOLOGO', cd_pessoa_fisica: cdPessoa, nr_atendimento: null, ds_observacao: null });
    });
    if (payload.observacoes) {
      items.push({ ie_tipo: 'OBSERVACAO', cd_pessoa_fisica: null, nr_atendimento: null, ds_observacao: payload.observacoes });
    }
    return items;
  }

  if (payload.enfermeiro_cd_pessoa_fisica) {
    items.push({ ie_tipo: 'ENFERMEIRO', cd_pessoa_fisica: payload.enfermeiro_cd_pessoa_fisica, nr_atendimento: null, ds_observacao: null });
  }

  if (payload.ect) {
    if (payload.ect.pre_procedimento) {
      items.push({ ie_tipo: 'PRE_PROCEDIMENTO', cd_pessoa_fisica: Number(payload.ect.pre_procedimento), nr_atendimento: null, ds_observacao: null });
    }
    if (payload.ect.sala_procedimento) {
      items.push({ ie_tipo: 'SALA_PROCEDIMENTO', cd_pessoa_fisica: Number(payload.ect.sala_procedimento), nr_atendimento: null, ds_observacao: null });
    }
    if (payload.ect.sala_recuperacao) {
      items.push({ ie_tipo: 'SALA_RECUPERACAO', cd_pessoa_fisica: Number(payload.ect.sala_recuperacao), nr_atendimento: null, ds_observacao: null });
    }
  }

  (payload.tecnicos || []).forEach(t => {
    const cdPessoa = Number(t.cd_pessoa_fisica);
    (t.pacientes || []).forEach(p => {
      items.push({ ie_tipo: 'TECNICO', cd_pessoa_fisica: cdPessoa, nr_atendimento: Number(p), ds_observacao: null });
    });
    (t.patio_circulante || []).forEach(extra => {
      const tipo = extra === 'Patio' ? 'PATIO' : 'CIRCULANTE';
      items.push({ ie_tipo: tipo, cd_pessoa_fisica: cdPessoa, nr_atendimento: null, ds_observacao: null });
    });
  });

  (payload.faltas_folgas || []).forEach(ff => {
    const tipo = ff.tipo === 'Folga' ? 'FOLGA' : 'FALTA';
    items.push({ ie_tipo: tipo, cd_pessoa_fisica: Number(ff.cd_pessoa_fisica), nr_atendimento: null, ds_observacao: null });
  });

  (payload.avaliacao_externa || []).forEach(av => {
    (av.pacientes || []).forEach(p => {
      items.push({ ie_tipo: 'AVALIACAO', cd_pessoa_fisica: Number(av.cd_pessoa_fisica), nr_atendimento: Number(p), ds_observacao: av.descricao || null });
    });
  });

  if (payload.observacoes) {
    items.push({ ie_tipo: 'OBSERVACAO', cd_pessoa_fisica: null, nr_atendimento: null, ds_observacao: payload.observacoes });
  }

  return items;
}

async function obterEscalaAtiva(cdSetor, dtPlantao, turno) {
  const rows = await escalaAtivaRepository.loadAtiva(cdSetor, dtPlantao, turno);
  return fromDbRows(rows);
}

async function obterEscalasAtivasPorPeriodo(cdSetor, dataInicio, dataFim) {
  const rows = await escalaAtivaRepository.loadAtivasPorPeriodo(cdSetor, dataInicio, dataFim);
  const grupos = new Map();
  rows.forEach(row => {
    const key = `${row.DT_PLANTAO}-${row.IE_TURNO}`;
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key).push(row);
  });
  return Object.fromEntries([...grupos.entries()].map(([key, groupRows]) => [key, fromDbRows(groupRows)]));
}

async function salvarEscalaAtiva(payload, nmUsuario) {
  if (payload.tipo_escala === 'PSICOLOGIA') {
    if (Number(payload.cd_setor_atendimento) !== 4) {
      throw Object.assign(new Error('A Gestão de Escalas deve usar o setor 4'), { status: 400 });
    }
    const profissionais = [...new Set((payload.profissionais || []).map(item => Number(item?.cd_pessoa_fisica)).filter(Number.isInteger))];
    if (profissionais.length === 0 && !String(payload.observacoes || '').trim()) {
      throw Object.assign(new Error('Informe ao menos um profissional ou uma observação'), { status: 400 });
    }
  }

  const items = toDbItems(payload);
  const savePayload = {
    cd_setor_atendimento: payload.cd_setor_atendimento,
    dt_plantao: payload.data_plantao,
    turno: payload.turno,
    items
  };
  const result = await escalaAtivaRepository.saveAtiva(savePayload, nmUsuario);
  return { ...result, items };
}

async function listarVersoes(cdSetor, dtPlantao, turno) {
  return escalaAtivaRepository.loadVersoes(cdSetor, dtPlantao, turno);
}

async function obterVersao(cdSetor, dtPlantao, turno, versao) {
  const rows = await escalaAtivaRepository.loadVersaoEspecifica(cdSetor, dtPlantao, turno, versao);
  return fromDbRows(rows);
}

function diffListas(anteriores, atuais, keyFn) {
  const prevKeys = new Set(anteriores.map(keyFn));
  const currKeys = new Set(atuais.map(keyFn));
  return {
    adicionados: atuais.filter(a => !prevKeys.has(keyFn(a))),
    removidos: anteriores.filter(a => !currKeys.has(keyFn(a)))
  };
}

async function compararVersoes(cdSetor, dtPlantao, turno, versao) {
  const atual = await obterVersao(cdSetor, dtPlantao, turno, versao);
  if (!atual) return null;

  const anterior = await obterVersao(cdSetor, dtPlantao, turno, versao - 1);

  const diff = {
    versao,
    nm_usuario: atual.nm_usuario,
    data_plantao: atual.data_plantao,
    semAnterior: !anterior,
    alteracoes: []
  };

  if (!anterior) {
    diff.alteracoes.push({ secao: 'info', texto: 'Versão inicial da escala — nenhuma versão anterior para comparar.' });
    return diff;
  }

  if (String(atual.enfermeiro_cd_pessoa_fisica || '') !== String(anterior.enfermeiro_cd_pessoa_fisica || '')) {
    diff.alteracoes.push({ secao: 'enfermeiro', antes: anterior.enfermeiro_cd_pessoa_fisica, depois: atual.enfermeiro_cd_pessoa_fisica });
  }

  const techKeys = t => Number(t.cd_pessoa_fisica);
  const tecDiff = diffListas(anterior.tecnicos || [], atual.tecnicos || [], techKeys);

  tecDiff.adicionados.forEach(t => {
    diff.alteracoes.push({ secao: 'tecnicos', tipo: '+', cd_pessoa_fisica: t.cd_pessoa_fisica, pacientes: t.pacientes, patio_circulante: t.patio_circulante });
  });
  tecDiff.removidos.forEach(t => {
    diff.alteracoes.push({ secao: 'tecnicos', tipo: '-', cd_pessoa_fisica: t.cd_pessoa_fisica });
  });

  const comuns = (atual.tecnicos || []).filter(a => (anterior.tecnicos || []).some(b => techKeys(a) === techKeys(b)));
  comuns.forEach(att => {
    const ant = (anterior.tecnicos || []).find(b => techKeys(b) === techKeys(att));
    const extrasDiff = diffListas(ant.patio_circulante || [], att.patio_circulante || [], x => x);
    const pacAdc = (att.pacientes || []).filter(p => !(ant.pacientes || []).includes(p));
    const pacRem = (ant.pacientes || []).filter(p => !(att.pacientes || []).includes(p));
    if (pacAdc.length || pacRem.length || extrasDiff.adicionados.length || extrasDiff.removidos.length) {
      diff.alteracoes.push({
        secao: 'tecnicos', tipo: '~', cd_pessoa_fisica: att.cd_pessoa_fisica,
        pacientes_adicionados: pacAdc, pacientes_removidos: pacRem,
        extras_adicionados: extrasDiff.adicionados, extras_removidos: extrasDiff.removidos
      });
    }
  });

  const ffKey = f => `${f.cd_pessoa_fisica}||${f.tipo}`;
  const ffDiff = diffListas(anterior.faltas_folgas || [], atual.faltas_folgas || [], ffKey);
  ffDiff.adicionados.forEach(f => diff.alteracoes.push({ secao: 'faltas_folgas', tipo: '+', cd_pessoa_fisica: f.cd_pessoa_fisica, ff_tipo: f.tipo }));
  ffDiff.removidos.forEach(f => diff.alteracoes.push({ secao: 'faltas_folgas', tipo: '-', cd_pessoa_fisica: f.cd_pessoa_fisica, ff_tipo: f.tipo }));

  const avKey = a => `${a.cd_pessoa_fisica}||${a.descricao || ''}`;
  const avDiff = diffListas(anterior.avaliacao_externa || [], atual.avaliacao_externa || [], avKey);
  avDiff.adicionados.forEach(a => diff.alteracoes.push({ secao: 'avaliacao', tipo: '+', cd_pessoa_fisica: a.cd_pessoa_fisica, pacientes: a.pacientes, descricao: a.descricao }));
  avDiff.removidos.forEach(a => diff.alteracoes.push({ secao: 'avaliacao', tipo: '-', cd_pessoa_fisica: a.cd_pessoa_fisica }));

  if (String(atual.observacoes || '') !== String(anterior.observacoes || '')) {
    diff.alteracoes.push({ secao: 'observacoes', antes: anterior.observacoes || '', depois: atual.observacoes || '' });
  }

  if (diff.alteracoes.length === 0) {
    diff.alteracoes.push({ secao: 'info', texto: 'Nenhuma alteração detectada em relação à versão anterior.' });
  }

  return diff;
}

async function buscarPatioCirculanteGlobal(dtPlantao, turno) {
  return escalaAtivaRepository.findPatioCirculanteGlobal(dtPlantao, turno);
}

module.exports = { obterEscalaAtiva, obterEscalasAtivasPorPeriodo, salvarEscalaAtiva, listarVersoes, obterVersao, compararVersoes, buscarPatioCirculanteGlobal };
