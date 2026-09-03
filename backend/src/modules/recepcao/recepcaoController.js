const recepcaoService = require('./recepcaoService');

/**
 * Módulo de Recepção & Acolhimento — Controller HTTP
 */

async function listarFilasSenhas(req, res, next) {
  try {
    const data = await recepcaoService.listarFilasSenhas();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listarSenhasEspera(req, res, next) {
  try {
    const { fila } = req.query;
    const data = await recepcaoService.listarSenhasEspera(fila);
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
    res.status(err.status || 500).setHeader('Content-Type', 'text/html; charset=utf-8').send(`
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
          <p>${err.message || 'Ocorreu um erro ao comunicar com o servidor TasyReports.'}</p>
          <div class="alert-sub">
            <div><strong>Relatório TASY:</strong> Código ${req.params.id}</div>
            <div><strong>Atendimento:</strong> #${req.query.nr_atendimento || 'Não informado'}</div>
            <div style="margin-top: 6px; color: #38bdf8;"><strong>Status:</strong> O atendimento está salvo com sucesso no banco TASY. Apenas a emissão do PDF pelo TasyAppServer requer credencial válida configurada no Conecta Admin.</div>
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

module.exports = {
  listarFilasSenhas,
  listarSenhasEspera,
  chamarProximaSenha,
  rechamarSenha,
  buscarPessoas,
  obterPessoaCompleta,
  salvarPessoa,
  listarConvenios,
  listarCategoriasConvenio,
  obterUltimoConvenioPaciente,
  listarSetoresAtendimento,
  listarClassificacoesAtendimento,
  abrirAtendimento,
  listarAtendimentosHoje,
  listarRelatoriosAtendimento,
  gerarRelatorioAtendimento,
  listarDocumentosGED,
  anexarDocumentoGED
};
