const http = require('http');
const https = require('https');
const { URL } = require('url');
const { getConnection } = require('../../core/database');

const TASY_URL = process.env.TASY_REPORTS_URL || 'http://192.168.1.25/TasyAppServer';
const TASY_USER = process.env.TASY_REPORTS_USER || 'pedro.cesario';
const TASY_PASSWORD = process.env.TASY_REPORTS_PASSWORD || 'Dc153351##';
const TASY_CLIENT_ID = process.env.TASY_REPORTS_CLIENT_ID || 'WTASY';
const TASY_SCOPE = process.env.TASY_REPORTS_SCOPE || 'WTASY';
const TASY_TIMEZONE = process.env.TASY_REPORTS_TIMEZONE || 'America/Sao_Paulo';

let cachedAuth = null;
let loginPromise = null;

function requestHttp(options, postData = null) {
  return new Promise((resolve, reject) => {
    const isHttps = options.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
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
      const urlObj = new URL(`${TASY_URL}/resources/public/security/oauth`);
      const body = JSON.stringify({
        username: TASY_USER,
        password: TASY_PASSWORD,
        grant_type: 'password',
        client_id: TASY_CLIENT_ID,
        scope: TASY_SCOPE,
        timezone: TASY_TIMEZONE
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
        throw new Error(`Falha na autenticação TasyAppServer (HTTP ${res.statusCode}): ${res.text()}`);
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
  let conn;
  try {
    conn = await getConnection();
    const res = await conn.execute(
      `SELECT nr_interno_conta FROM conta_paciente WHERE nr_atendimento = :atend ORDER BY dt_atualizacao DESC`,
      { atend: Number(nrAtendimento) }
    );
    if (res.rows && res.rows.length > 0) {
      return String(res.rows[0].NR_INTERNO_CONTA);
    }
    return null;
  } catch (err) {
    console.error('[TasyReports] Erro ao buscar conta do paciente:', err);
    return null;
  } finally {
    if (conn) await conn.close();
  }
}

async function gerarRelatorioPdf(cdRelatorio, nrAtendimento, customParams = {}) {
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
  }

  // Executa com retry automático caso a sessão expire
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    const auth = await loginTasy(tentativa === 2);

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

    const urlObj = new URL(`${TASY_URL}/resources/service/Report/generateReports`);
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
    const downloadUrlObj = new URL(`${TASY_URL}/resources/files/pdf/${pdfFileName}`);
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

module.exports = {
  loginTasy,
  gerarRelatorioPdf
};
