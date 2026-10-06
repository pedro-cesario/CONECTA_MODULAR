const http = require('http');
const https = require('https');
const { URL } = require('url');
const configCache = require('../../core/config/configCache');
const recepcaoRepository = require('./recepcaoRepository');

function getTasyUrl() {
  const sysConfig = configCache.getSystemConfig() || {};
  const url = sysConfig.tasy_reports_url || process.env.TASY_REPORTS_URL;
  if (!url) throw new Error('Configuração tasy_reports_url ou TASY_REPORTS_URL ausente');
  return url;
}
function getTasyUser() {
  const sysConfig = configCache.getSystemConfig() || {};
  const user = sysConfig.tasy_reports_user || process.env.TASY_REPORTS_USER;
  if (!user) throw new Error('Configuração tasy_reports_user ou TASY_REPORTS_USER ausente');
  return user;
}
function getTasyPassword() {
  const sysConfig = configCache.getSystemConfig() || {};
  const pass = sysConfig.tasy_reports_password || process.env.TASY_REPORTS_PASSWORD;
  if (!pass) throw new Error('Configuração tasy_reports_password ou TASY_REPORTS_PASSWORD ausente');
  return pass;
}
function getTasyClientId() {
  const sysConfig = configCache.getSystemConfig() || {};
  return sysConfig.tasy_reports_client_id || process.env.TASY_REPORTS_CLIENT_ID || 'WTASY';
}
function getTasyScope() {
  const sysConfig = configCache.getSystemConfig() || {};
  return sysConfig.tasy_reports_scope || process.env.TASY_REPORTS_SCOPE || 'WTASY';
}
function getTasyTimezone() {
  const sysConfig = configCache.getSystemConfig() || {};
  return sysConfig.tasy_reports_timezone || process.env.TASY_REPORTS_TIMEZONE || 'America/Sao_Paulo';
}

let cachedAuth = null;
let loginPromise = null;

function requestHttp(options, postData = null, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const isHttps = options.protocol === 'https:';
    const client = isHttps ? https : http;

    const reqOptions = {
      ...options,
      timeout: timeoutMs
    };

    const req = client.request(reqOptions, (res) => {
      const chunks = [];
      let totalBytes = 0;
      const MAX_BYTES = 30 * 1024 * 1024; // 30MB max

      res.on('data', (chunk) => {
        totalBytes += chunk.length;
        if (totalBytes > MAX_BYTES) {
          req.destroy(new Error('Resposta do TASY excedeu o limite máximo de 30MB'));
          return;
        }
        chunks.push(chunk);
      });

      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          buffer,
          text: () => buffer.toString('utf8'),
          json: () => {
            try {
              return JSON.parse(buffer.toString('utf8'));
            } catch (e) {
              return null;
            }
          }
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error(`Timeout de ${timeoutMs / 1000}s excedido na comunicação com TASY Reports/Storage`));
    });

    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function loginTasy(forceRefresh = false) {
  if (!forceRefresh && cachedAuth && cachedAuth.expiresAt > Date.now()) {
    return cachedAuth;
  }

  if (loginPromise) {
    return loginPromise;
  }

  loginPromise = (async () => {
    try {
      const urlObj = new URL(`${getTasyUrl()}/resources/public/security/oauth`);
      const body = JSON.stringify({
        username: getTasyUser(),
        password: getTasyPassword(),
        grant_type: 'password',
        client_id: getTasyClientId(),
        scope: getTasyScope(),
        timezone: getTasyTimezone()
      });

      const options = {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      };

      const res = await requestHttp(options, body);
      if (res.statusCode !== 200) {
        let msg = res.text();
        try {
          const parsed = JSON.parse(msg);
          if (parsed.code === 1100 || parsed.message) {
            msg = `Credenciais TASY inválidas (${parsed.message || 'Usuário ou senha incorretos'}). Acesse o Conecta Admin > Sistema & Parâmetros > Parâmetros da Recepção & TASY para atualizar o usuário e senha do TasyAppServer.`;
          }
        } catch (e) {}
        throw new Error(`Falha na autenticação TasyAppServer (HTTP ${res.statusCode}): ${msg}`);
      }

      const json = res.json();
      if (!json || !json.access_token) {
        throw new Error('Resposta inválida da autenticação Tasy: token não encontrado');
      }

      const rawCookies = res.headers['set-cookie'] || [];
      const cookies = rawCookies.map((c) => c.split(';')[0]).join('; ');
      const xsrf = res.headers['xsrf-token'] || '';

      // Expiração segura (8 minutos)
      const expiresInSec = json.expires_in ? json.expires_in * 60 : 480;
      cachedAuth = {
        token: json.access_token,
        cookies,
        xsrf,
        expiresAt: Date.now() + expiresInSec * 1000 - 30000
      };

      return cachedAuth;
    } finally {
      loginPromise = null;
    }
  })();

  return loginPromise;
}

async function obterNumeroContaPaciente(nrAtendimento) {
  try {
    return await recepcaoRepository.obterContaPaciente(nrAtendimento);
  } catch (err) {
    console.error('[TasyReports] Erro ao buscar conta do paciente:', err);
    return null;
  }
}

async function loginTasyUser(username, password) {
  try {
    const urlObj = new URL(`${getTasyUrl()}/resources/public/security/oauth`);
    const body = JSON.stringify({
      username: username,
      password: password,
      grant_type: 'password',
      client_id: getTasyClientId(),
      scope: getTasyScope(),
      timezone: getTasyTimezone()
    });

    const options = {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const res = await requestHttp(options, body);
    if (res.statusCode === 200) {
      const json = res.json();
      if (json && json.access_token) {
        const rawCookies = res.headers['set-cookie'] || [];
        const cookies = rawCookies.map((c) => c.split(';')[0]).join('; ');
        const xsrf = res.headers['xsrf-token'] || '';
        return {
          success: true,
          token: json.access_token,
          cookies,
          xsrf
        };
      }
    }
    return { success: false, status: res.statusCode };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function gerarRelatorioPdf(cdRelatorio, nrAtendimento, customParams = {}, userAuth = null) {
  const cdRel = Number(cdRelatorio);
  const atend = String(nrAtendimento);

  // Mapeamento de tipo e parâmetros obrigatórios do TASY
  let type = 'CATE';
  let reportParams = { NR_ATENDIMENTO: atend, ...customParams };

  if (cdRel === 70126) {
    type = 'WATE';
    const nrConta = await obterNumeroContaPaciente(atend);
    reportParams = {
      NR_INTERNO_CONTA: nrConta || '-1',
      IE_RODAPE: 'S',
      IE_ORDEM: 'D',
      IE_EMITE_SEG_PAGINA: 'S',
      NR_SEQ_PROTOCOLO: '-1',
      ...customParams
    };
  } else if (cdRel === 70125) {
    type = 'WATE';
    const nrConta = await obterNumeroContaPaciente(atend);
    reportParams = {
      NR_INTERNO_CONTA: nrConta || '-1',
      NR_ATEND_CONTA_TISS: atend,
      NR_SEQ_PROTOCOLO: '-1',
      IE_RODAPE: 'S',
      IE_ORDEM: 'P',
      IE_EMITE_SEG_PAGINA: 'S',
      ...customParams
    };
  } else if (cdRel >= 70120 && cdRel <= 70135) {
    type = 'WATE';
    const nrConta = await obterNumeroContaPaciente(atend);
    reportParams = {
      NR_INTERNO_CONTA: nrConta || '-1',
      NR_ATEND_CONTA_TISS: atend,
      NR_SEQ_PROTOCOLO: '-1',
      IE_RODAPE: 'S',
      IE_ORDEM: 'P',
      IE_EMITE_SEG_PAGINA: 'S',
      ...customParams
    };
  }

  // Executa com retry automático caso a sessão expire
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    // Se o usuário logado possui sessão Tasy própria, utiliza sua autenticação
    let auth = null;
    if (userAuth && userAuth.token && tentativa === 1) {
      auth = userAuth;
    } else {
      auth = await loginTasy(tentativa === 2);
    }

    const payload = [
      {
        '@class': 'br.com.philips.tasy.dto.shared.report.ReportsParam',
        tipo: 'ReportsParam',
        reports: [
          {
            '@class': 'br.com.philips.tasy.dto.shared.report.ReportParam',
            code: cdRel,
            type: type,
            parameters: reportParams,
            printedCopies: 1,
            actionClass: '',
            customPreview: false,
            configure: false,
            customGenerate: false,
            printerName: '',
            duplexPrinting: null,
            usingSectorPrinters: false,
            title: `Relatorio_${cdRel}`,
            showMessage: true
          }
        ],
        printersAvailable: [],
        defaultPrinter: null,
        fileList: [],
        localStoragePrinterName: null
      },
      { tipo: 'Boolean', valor: false },
      { tipo: 'Integer', valor: null },
      { tipo: 'String', valor: 'PDF' },
      { tipo: 'String', valor: '' },
      { tipo: 'boolean', valor: true },
      { tipo: 'HashMap', valor: {} },
      { tipo: 'String', valor: 'CONECTA_ASSISTENCIAL' }
    ];

    const urlObj = new URL(`${getTasyUrl()}/resources/service/Report/generateReports`);
    const postData = JSON.stringify(payload);

    const options = {
      protocol: urlObj.protocol,
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${auth.token}`,
        'Cookie': auth.cookies,
        'X-XSRF-TOKEN': auth.xsrf,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const res = await requestHttp(options, postData);

    if (res.statusCode === 401 && tentativa === 1) {
      cachedAuth = null;
      continue;
    }

    if (res.statusCode !== 200) {
      throw new Error(`Erro ao gerar relatório no TASY (HTTP ${res.statusCode}): ${res.text()}`);
    }

    const json = res.json();
    if (!json || !json.reports || json.reports.length === 0 || !json.reports[0].pdfFileName) {
      throw new Error(`TASY não retornou o PDF gerado para o relatório ${cdRel}. Retorno: ${res.text()}`);
    }

    const pdfFileName = json.reports[0].pdfFileName;

    // Baixa o arquivo PDF gerado pelo TASY
    const downloadUrlObj = new URL(`${getTasyUrl()}/resources/files/pdf/${pdfFileName}`);
    const downloadOptions = {
      protocol: downloadUrlObj.protocol,
      hostname: downloadUrlObj.hostname,
      port: downloadUrlObj.port || (downloadUrlObj.protocol === 'https:' ? 443 : 80),
      path: downloadUrlObj.pathname,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${auth.token}`,
        'Cookie': auth.cookies,
        'X-XSRF-TOKEN': auth.xsrf
      }
    };

    const downloadRes = await requestHttp(downloadOptions);
    if (downloadRes.statusCode !== 200) {
      throw new Error(`Erro ao baixar o PDF do TASY (HTTP ${downloadRes.statusCode})`);
    }

    return {
      buffer: downloadRes.buffer,
      fileName: pdfFileName,
      contentType: 'application/pdf'
    };
  }

  throw new Error('Falha ao gerar relatório após tentativas de autenticação.');
}

async function uploadArquivoTasyStorage(fileBuffer, fileName, mimeType = 'application/pdf', userAuth = null) {
  let auth = null;
  if (userAuth && userAuth.token) {
    auth = userAuth;
  } else {
    auth = await loginTasy();
  }

  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const cleanFileName = fileName ? fileName.replace(/[^a-zA-Z0-9._-]/g, '_') : 'documento.pdf';

  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${cleanFileName}"\r\nContent-Type: ${mimeType || 'application/pdf'}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const fullBody = Buffer.concat([head, fileBuffer, tail]);

  const urlObj = new URL(`${getTasyUrl()}/resources/files`);
  const options = {
    protocol: urlObj.protocol,
    hostname: urlObj.hostname,
    port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
    path: urlObj.pathname,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${auth.token}`,
      'Cookie': auth.cookies,
      'X-XSRF-TOKEN': auth.xsrf,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': fullBody.length
    }
  };

  const res = await requestHttp(options, fullBody);
  if (res.statusCode !== 200) {
    throw new Error(`Falha ao enviar arquivo para o Storage do TASY (HTTP ${res.statusCode}): ${res.text()}`);
  }

  const json = res.json();
  if (Array.isArray(json) && json.length > 0 && typeof json[0] === 'string') {
    return json[0]; // URI oficial "tasy-storage://..."
  }

  throw new Error(`Retorno inesperado do Storage TASY: ${res.text()}`);
}

module.exports = {
  loginTasy,
  loginTasyUser,
  gerarRelatorioPdf,
  uploadArquivoTasyStorage
};
