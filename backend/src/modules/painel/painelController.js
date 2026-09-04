/**
 * Conecta HEAL 2.0 - Painel TV Controller
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const configCache = require('../../core/config/configCache');
const { getConnection } = require('../../core/database');
const painelEventsService = require('./painelEventsService');

const ttsCacheDir = path.resolve(__dirname, '../../../../data/tts_cache');
if (!fs.existsSync(ttsCacheDir)) {
  fs.mkdirSync(ttsCacheDir, { recursive: true });
}

async function obterEstadoPainel(req, res, next) {
  try {
    const { id } = req.params;
    const painel = configCache.getPainelTvById(id) || {
      id: id || 'recepcao_principal',
      nome: 'Painel Recepção',
      descricao: 'Painel Geral de Atendimento',
      filas_json: '[]',
      som_ativo: 1,
      voz_ativa: 1,
      voz_velocidade: 1.0,
      ativo: 1
    };

    let filas = [];
    try {
      filas = typeof painel.filas_json === 'string' ? JSON.parse(painel.filas_json) : (painel.filas_json || []);
    } catch (e) {
      filas = [];
    }

    let whereFilas = '';
    const binds = {};
    if (Array.isArray(filas) && filas.length > 0) {
      const validFilas = filas.map(Number).filter(Number.isInteger);
      if (validFilas.length > 0) {
        whereFilas = `AND psf.nr_seq_fila_senha IN (${validFilas.join(',')})`;
      }
    }

    const conn = await getConnection();
    try {
      // 1. Busca as últimas senhas chamadas (hoje e recentes) para este painel
      const result = await conn.execute(
        `SELECT
           psf.nr_sequencia,
           psf.cd_senha_gerada,
           psf.nr_seq_fila_senha,
           fs.ds_fila,
           psf.dt_geracao_senha,
           TO_CHAR(psf.dt_geracao_senha, 'HH24:MI:SS') AS hr_geracao,
           psf.nr_prioridade,
           CASE 
             WHEN psf.nr_prioridade = 1 THEN 'Emergência'
             WHEN psf.nr_prioridade = 2 THEN 'Prioritária'
             ELSE 'Normal'
           END AS ds_prioridade,
           psf.dt_chamada,
           TO_CHAR(psf.dt_chamada, 'HH24:MI:SS') AS hr_chamada,
           psf.ds_maquina_chamada,
           psf.qt_chamadas,
           psf.nm_usuario_chamada,
           ROUND((SYSDATE - psf.dt_geracao_senha) * 1440) AS minutos_espera
         FROM paciente_senha_fila psf
         LEFT JOIN fila_espera_senha fs ON fs.nr_sequencia = psf.nr_seq_fila_senha
         WHERE psf.dt_inutilizacao IS NULL
           AND psf.dt_chamada IS NOT NULL
           AND psf.dt_chamada >= TRUNC(SYSDATE - 1)
           ${whereFilas}
         ORDER BY psf.dt_chamada DESC
         FETCH FIRST 15 ROWS ONLY`,
        binds
      );

      const sysConfig = configCache.getSystemConfig() || {};
      const nomeHospital = sysConfig.nome_instituicao || 'Hospital Espírita André Luiz';
      const limiteHistorico = Math.max(parseInt(sysConfig.tv_historico_limite, 10) || 7, 7);

      const chamadasBanco = (result.rows || []).map(formatarItemPainel);
      const memoria = painelEventsService.getRecentCalls(painel.id);

      // Unifica memória (eventos transmitidos em tempo real) com os dados persistidos no banco
      const unificadas = [];
      const seqVistos = new Set();

      for (const item of memoria) {
        if (item && item.nr_sequencia && !seqVistos.has(Number(item.nr_sequencia))) {
          seqVistos.add(Number(item.nr_sequencia));
          unificadas.push(item);
        }
      }

      for (const item of chamadasBanco) {
        if (item && item.nr_sequencia && !seqVistos.has(Number(item.nr_sequencia))) {
          seqVistos.add(Number(item.nr_sequencia));
          unificadas.push(item);
        }
      }

      const ultimaChamada = unificadas.length > 0 ? unificadas[0] : null;
      const historico = unificadas.slice(1, limiteHistorico + 1);

      res.json({
        success: true,
        instituicao: nomeHospital,
        limiteHistorico,
        painel: {
          id: painel.id,
          nome: painel.nome,
          descricao: painel.descricao,
          som_ativo: Boolean(painel.som_ativo),
          voz_ativa: Boolean(painel.voz_ativa),
          voz_velocidade: painel.voz_velocidade || 1.0,
          filas
        },
        ultimaChamada,
        historico
      });
    } finally {
      await conn.close();
    }
  } catch (err) {
    next(err);
  }
}

function streamPainel(req, res, next) {
  try {
    const { id } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    painelEventsService.addClient(id, res);
  } catch (err) {
    next(err);
  }
}

async function detectarMinhaMaquina(req, res, next) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    const nmComputador = req.query.maquina || req.session?.usuario?.nm_computador || 'NOTE-CESARIO';
    
    // Procura mapeamento cadastrado
    let mapping = configCache.getMaquinaGuiche(nmComputador);
    if (!mapping && ip) {
      mapping = configCache.getMaquinaGuiche(ip);
    }

    if (!mapping) {
      mapping = {
        id: nmComputador,
        nm_maquina: nmComputador,
        ds_guiche: 'Guichê 01',
        painel_id: 'recepcao_principal'
      };
    }

    const paineisDisponiveis = configCache.getPaineisTv();

    res.json({
      success: true,
      data: {
        nm_maquina: mapping.nm_maquina,
        ds_guiche: mapping.ds_guiche,
        ds_guiche_sugerido: mapping.ds_guiche,
        painel_id: mapping.painel_id || 'recepcao_principal',
        painel_sugerido: mapping.painel_id || 'recepcao_principal',
        permite_chamar_senha: mapping.permite_chamar_senha !== 0,
        paineisDisponiveis
      }
    });
  } catch (err) {
    next(err);
  }
}

async function obterMinhaTv(req, res, next) {
  try {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    const nmComputador = req.query.maquina || req.session?.usuario?.nm_computador || '';

    const painelEncontrado = configCache.getPainelParaMaquina(nmComputador, ip);
    const paineisDisponiveis = configCache.getPaineisTv();

    res.json({
      success: true,
      data: {
        nm_maquina: nmComputador || ip,
        painel: painelEncontrado,
        url: painelEncontrado ? `/painel.html?painel=${encodeURIComponent(painelEncontrado.id)}` : null,
        paineisDisponiveis
      }
    });
  } catch (err) {
    next(err);
  }
}

function formatarItemPainel(row) {
  const cdSenha = row.CD_SENHA_GERADA ?? row.cd_senha_gerada;
  const nrSeq = row.NR_SEQUENCIA ?? row.nr_sequencia;
  const dsGuiche = row.DS_MAQUINA_CHAMADA ?? row.ds_maquina_chamada ?? 'Guichê 01';
  const hrChamada = row.HR_CHAMADA ?? row.hr_chamada ?? '--:--';
  const dsFila = row.DS_FILA ?? row.ds_fila ?? 'Recepção';

  // No Hospital Espírita André Luiz, todas as senhas seguem o padrão P + número
  return {
    nr_sequencia: nrSeq,
    cd_senha_gerada: cdSenha,
    cd_senha_completa: `P ${cdSenha}`,
    cd_senha_pura: `P${cdSenha}`,
    ds_guiche: dsGuiche,
    ds_fila: dsFila,
    hr_chamada: hrChamada
  };
}

async function gerarAudioVoz(req, res, next) {
  try {
    const rawTexto = req.query.texto || '';
    const texto = String(rawTexto).trim().substring(0, 200);
    if (!texto) {
      return res.status(400).json({ success: false, message: 'Texto para fala é obrigatório' });
    }

    const hash = crypto.createHash('md5').update('pt-BR:' + texto).digest('hex');
    const filePath = path.join(ttsCacheDir, `${hash}.mp3`);

    // Se já estiver em cache, serve imediatamente do disco (<1ms)
    if (fs.existsSync(filePath)) {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      return fs.createReadStream(filePath).pipe(res);
    }

    // Busca áudio natural em português do Brasil
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=pt-BR&client=tw-ob&q=${encodeURIComponent(texto)}`;

    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (googleRes) => {
      if (googleRes.statusCode !== 200) {
        return res.status(502).json({ success: false, message: 'Falha ao sintetizar voz no provedor de áudio' });
      }

      const chunks = [];
      googleRes.on('data', chunk => chunks.push(chunk));
      googleRes.on('end', () => {
        const audioBuffer = Buffer.concat(chunks);
        try {
          fs.writeFileSync(filePath, audioBuffer);
        } catch (writeErr) {
          console.warn('[Painel TV] Aviso ao gravar cache de áudio:', writeErr.message);
        }

        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        res.end(audioBuffer);
      });
    }).on('error', (err) => {
      console.warn('[Painel TV] Erro de rede ao buscar áudio natural:', err.message);
      res.status(503).json({ success: false, message: 'Serviço de voz temporariamente indisponível' });
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  obterEstadoPainel,
  streamPainel,
  detectarMinhaMaquina,
  obterMinhaTv,
  formatarItemPainel,
  gerarAudioVoz
};
