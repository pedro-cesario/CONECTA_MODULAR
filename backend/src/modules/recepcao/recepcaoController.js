const recepcaoService = require('./recepcaoService');
const { getPerfilAtivo } = require('../../core/utils/acesso');

/**
 * Módulo de Recepção & Acolhimento — Controller HTTP
 */

async function listarFilasSenhas(req, res, next) {
  try {
    const perfilAtivo = getPerfilAtivo(req.session?.usuario) || req.session?.usuario?.perfilAtivo;
    const modulo = req.query.modulo || 'recepcao';
    const { data, modo_visualizacao } = await recepcaoService.listarFilasSenhas(perfilAtivo, modulo);
    res.json({ success: true, data, modo_visualizacao });
  } catch (err) {
    next(err);
  }
}

async function listarSenhasEspera(req, res, next) {
  try {
    const { fila, modulo } = req.query;
    const perfilAtivo = getPerfilAtivo(req.session?.usuario) || req.session?.usuario?.perfilAtivo;
    const moduloFinal = modulo || 'recepcao';
    const data = await recepcaoService.listarSenhasEspera(fila, perfilAtivo, moduloFinal);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function chamarProximaSenha(req, res, next) {
  try {
    const { nr_seq_fila_senha, ds_maquina } = req.body;
    const usuario = req.session?.usuario?.nm_usuario || 'CONECTA_USER';
    const result = await recepcaoService.chamarProximaSenha(nr_seq_fila_senha, ds_maquina, usuario);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function rechamarSenha(req, res, next) {
  try {
    const { nr_sequencia, ds_maquina } = req.body;
    const usuario = req.session?.usuario?.nm_usuario || 'CONECTA_USER';
    const result = await recepcaoService.rechamarSenha(nr_sequencia, ds_maquina, usuario);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function buscarPessoas(req, res, next) {
  try {
    const { q } = req.query;
    const data = await recepcaoService.buscarPessoas(q);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function obterPessoaCompleta(req, res, next) {
  try {
    const { id } = req.params;
    const data = await recepcaoService.obterPessoaCompleta(id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function salvarPessoa(req, res, next) {
  try {
    const usuario = req.session?.usuario?.nm_usuario || 'CONECTA_USER';
    const result = await recepcaoService.salvarPessoa(req.body, usuario);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function verificarDuplicidadePaciente(req, res, next) {
  try {
    const { cpf, dt_nascimento, cd_pessoa_fisica } = req.query;
    const data = await recepcaoService.verificarDuplicidadePaciente({
      cpf,
      dtNascimento: dt_nascimento,
      cdPessoaFisica: cd_pessoa_fisica
    });
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listarConvenios(req, res, next) {
  try {
    const data = await recepcaoService.listarConvenios();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listarCategoriasConvenio(req, res, next) {
  try {
    const { cdConvenio } = req.params;
    const data = await recepcaoService.listarCategoriasConvenio(cdConvenio);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function obterUltimoConvenioPaciente(req, res, next) {
  try {
    const { id } = req.params;
    const data = await recepcaoService.obterUltimoConvenioPaciente(id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listarSetoresAtendimento(req, res, next) {
  try {
    const data = await recepcaoService.listarSetoresAtendimento();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listarClassificacoesAtendimento(req, res, next) {
  try {
    const data = await recepcaoService.listarClassificacoesAtendimento();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function abrirAtendimento(req, res, next) {
  try {
    const usuario = req.session?.usuario?.nm_usuario || 'CONECTA_USER';
    const result = await recepcaoService.abrirAtendimento(req.body, usuario);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function listarRelatoriosAtendimento(req, res, next) {
  try {
    const data = await recepcaoService.listarRelatoriosAtendimento();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function gerarRelatorioAtendimento(req, res, next) {
  try {
    const { id } = req.params;
    const { nr_atendimento } = req.query;

    const idStr = String(id || '').trim();
    if (!/^\d+$/.test(idStr)) {
      return res.status(400).json({ success: false, message: 'Identificador de relatório inválido' });
    }
    const idNum = Number(idStr);
    if (!Number.isSafeInteger(idNum) || idNum <= 0) {
      return res.status(400).json({ success: false, message: 'Identificador de relatório inválido ou fora dos limites seguros' });
    }

    const recepcaoRepository = require('./recepcaoRepository');
    const catalogo = recepcaoRepository.obterCatalogoBase();
    const relatorioAutorizado = catalogo.find(r => Number(r.cd_relatorio) === idNum);
    
    if (!relatorioAutorizado) {
      return res.status(403).json({ success: false, message: 'Relatório não autorizado ou não disponível no catálogo vigente' });
    }

    const usuarioLogado = req.session?.usuario || {};
    const nmUsuario = usuarioLogado.nm_usuario || 'CONECTA_USER';
    const nmPessoaFisica = usuarioLogado.nm_pessoa_fisica || nmUsuario;
    const cdPessoaFisica = usuarioLogado.cd_pessoa_fisica || null;

    const customParams = {
      NM_USUARIO: nmUsuario,
      NM_USUARIO_IMPR: nmPessoaFisica,
      NM_USUARIO_LOGADO: nmUsuario,
      NM_PESSOA_FISICA_USUARIO: nmPessoaFisica,
      NM_OPERADOR: nmPessoaFisica,
      DS_USUARIO: nmUsuario
    };
    if (cdPessoaFisica) {
      customParams.CD_PESSOA_FISICA_USUARIO = String(cdPessoaFisica);
    }

    const userAuth = req.session?.tasyAuth || null;

    console.log(`[TasyReports] Gerando relatório ${id} para atendimento #${nr_atendimento} pelo usuário ${nmUsuario} (${nmPessoaFisica}) | Sessão Própria: ${Boolean(userAuth)}`);
    const { buffer, fileName, contentType } = await recepcaoService.gerarRelatorioAtendimento(id, nr_atendimento, customParams, userAuth);
    res.setHeader('Content-Type', contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fileName || `relatorio_${id}_${nr_atendimento}.pdf`}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
  } catch (err) {
    console.error(`[TasyReports] Erro ao emitir relatório ${req.params?.id} para atend ${req.query?.nr_atendimento}:`, err);
    const errMsg = err.message || 'Ocorreu um erro ao comunicar com o servidor TasyReports.';
    const isAuthError = err.status === 401 || err.statusCode === 401 || /credencia|autentica|token/i.test(errMsg);
    const statusMsg = isAuthError
      ? 'Falha de autenticação com o TasyAppServer. Verifique o usuário e senha configurados no Conecta Admin > Parâmetros da Recepção & TASY.'
      : 'O atendimento está salvo com sucesso no banco TASY. A falha ocorreu durante a geração do relatório no TasyAppServer. Verifique os parâmetros e vínculos cadastrais do atendimento.';

    res.status(err.statusCode || err.status || 500).setHeader('Content-Type', 'text/html; charset=utf-8').send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Aviso - Relatório TASY</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .box { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 2.5rem; max-width: 580px; text-align: center; box-shadow: 0 15px 35px rgba(0,0,0,0.5); }
          h2 { color: #f87171; margin-top: 0; font-size: 1.4rem; }
          p { color: #cbd5e1; line-height: 1.6; font-size: 0.95rem; }
          .alert-sub { background: #0f172a; border-radius: 8px; padding: 0.9rem; margin: 1.2rem 0; color: #94a3b8; font-size: 0.85rem; text-align: left; }
          .btn { display: inline-block; margin-top: 1.2rem; padding: 0.65rem 1.4rem; background: #0284c7; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; }
        </style>
      </head>
      <body>
        <div class="box">
          <h2>⚠️ Aviso ao Emitir Relatório TASY</h2>
          <p>${errMsg}</p>
          <div class="alert-sub">
            <div><strong>Relatório TASY:</strong> Código ${req.params.id}</div>
            <div><strong>Atendimento:</strong> #${req.query.nr_atendimento || 'Não informado'}</div>
            <div style="margin-top: 6px; color: #38bdf8;"><strong>Status:</strong> ${statusMsg}</div>
          </div>
          <button class="btn" onclick="window.close()">Fechar Janela</button>
        </div>
      </body>
      </html>
    `);
  }
}

async function listarAtendimentosHoje(req, res, next) {
  try {
    const data = await recepcaoService.listarAtendimentosHoje();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listarDocumentosGED(req, res, next) {
  try {
    const { nr_atendimento, cd_pessoa_fisica } = req.query;
    const data = await recepcaoService.listarDocumentosGED(nr_atendimento, cd_pessoa_fisica);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function anexarDocumentoGED(req, res, next) {
  try {
    const usuario = req.session?.usuario?.nm_usuario || 'CONECTA_USER';
    const cdPessoaFisicaUsuario = req.session?.usuario?.cd_pessoa_fisica || null;
    const userAuth = req.session?.tasyAuth || null;
    const body = {
      ...req.body,
      cd_pessoa_fisica_usuario: cdPessoaFisicaUsuario
    };
    const result = await recepcaoService.anexarDocumentoGED(body, usuario, userAuth);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function atualizarAtendimento(req, res, next) {
  try {
    const { nr_atendimento } = req.params;
    const nmUsuario = req.session?.usuario?.nm_usuario || 'CONECTA';
    const result = await recepcaoService.atualizarAtendimento(nr_atendimento, req.body, nmUsuario);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
async function inutilizarSenha(req, res, next) {
  try {
    const { id } = req.params;
    const { motivo_id, ds_maquina } = req.body;
    const nmUsuario = req.session?.usuario?.nm_usuario || 'CONECTA';
    await recepcaoService.inutilizarSenha(id, motivo_id, nmUsuario, ds_maquina || 'CONECTA_WEB');
    res.json({ success: true, message: 'Senha inutilizada com sucesso' });
  } catch (err) {
    next(err);
  }
}

async function listarMotivosInutilizacao(req, res, next) {
  try {
    const data = await recepcaoService.listarMotivosInutilizacao();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
async function downloadDocumentoGED(req, res, next) {
  try {
    const { id } = req.params;
    const doc = await recepcaoService.obterDocumentoGED(id);
    if (!doc || !doc.IM_ARQUIVO_BANCO) {
      return res.status(404).json({ success: false, message: 'Documento não encontrado ou sem arquivo' });
    }
    
    // Configura o content-type com base na extensão
    const ext = (doc.DS_EXTENSAO_ARQUIVO || '').toLowerCase();
    if (ext.includes('pdf')) res.setHeader('Content-Type', 'application/pdf');
    else if (ext.includes('png')) res.setHeader('Content-Type', 'image/png');
    else if (ext.includes('jpg') || ext.includes('jpeg')) res.setHeader('Content-Type', 'image/jpeg');
    else res.setHeader('Content-Type', 'application/octet-stream');
    
    // Retorna o buffer binário
    res.send(doc.IM_ARQUIVO_BANCO);
  } catch (err) {
    next(err);
  }
}

async function excluirDocumentoGED(req, res, next) {
  try {
    const { id } = req.params;
    const { justificativa } = req.body;
    const nmUsuario = req.session?.usuario?.nm_usuario || 'CONECTA';
    await recepcaoService.inativarDocumentoGED(id, justificativa, nmUsuario);
    res.json({ success: true, message: 'Documento inativado com sucesso' });
  } catch (err) {
    next(err);
  }
}
module.exports = {
  listarFilasSenhas,
  listarSenhasEspera,
  chamarProximaSenha,
  inutilizarSenha,
  listarMotivosInutilizacao,
  rechamarSenha,
  buscarPessoas,
  obterPessoaCompleta,
  salvarPessoa,
  verificarDuplicidadePaciente,
  listarConvenios,
  listarCategoriasConvenio,
  obterUltimoConvenioPaciente,
  listarSetoresAtendimento,
  listarClassificacoesAtendimento,
  abrirAtendimento,
  atualizarAtendimento,
  listarAtendimentosHoje,
  listarRelatoriosAtendimento,
  gerarRelatorioAtendimento,
  listarDocumentosGED,
  anexarDocumentoGED,
  downloadDocumentoGED,
  excluirDocumentoGED,
  cancelarAtendimento
};

async function cancelarAtendimento(req, res, next) {
  try {
    const { nr_atendimento } = req.params;
    const { motivo } = req.body;
    const usuario = req.user?.username || 'WEB_API';

    await recepcaoService.cancelarAtendimento(nr_atendimento, usuario, motivo);
    
    return res.json({ success: true, message: 'Atendimento cancelado com sucesso' });
  } catch (err) {
    next(err);
  }
}
