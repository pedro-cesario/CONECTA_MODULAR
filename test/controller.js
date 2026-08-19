const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const API_URL = process.env.API_URL || 'http://node:3006';

const HISTORY_FILE = path.join(__dirname, 'history.json');
let currentOutput = '';

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    }
  } catch (err) {}
  return [];
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

function status(req, res) {
  const history = loadHistory();
  const lastRun = history.length > 0 ? history[0] : null;
  
  res.json({
    success: true,
    lastRun,
    currentOutput: currentOutput,
    totalRuns: history.length
  });
}

function run(req, res) {
  const userSession = req.session.usuario;
  if (!userSession) {
    return res.json({ success: false, message: 'Não autenticado' });
  }

  console.log(`\n[TESTES] Iniciando testes como: ${userSession.username}\n`);

  currentOutput = '';
  const runId = Date.now();
  const runStartTime = new Date().toISOString();

  res.json({ success: true, runId, message: 'Testes iniciados' });

  const child = spawn('npm', ['test', '--', '--verbose'], {
    cwd: __dirname,
    env: { ...process.env, API_URL, TEST_USERNAME: userSession.username, TEST_PASSWORD: '' },
    shell: true
  });

  child.stdout.on('data', (data) => {
    const text = data.toString();
    currentOutput += text;
    if (currentOutput.length > 20000) {
      currentOutput = currentOutput.substring(currentOutput.length - 20000);
    }
  });

  child.stderr.on('data', (data) => {
    currentOutput += data.toString();
  });

  child.on('close', (code) => {
    const runEndTime = new Date().toISOString();
    
    const passedMatch = currentOutput.match(/Tests:\s+(\d+)\s+passed/i);
    const failedMatch = currentOutput.match(/Tests:\s+(\d+)\s+failed/i);
    const suitesMatch = currentOutput.match(/Test Suites:\s+(\d+)\s+passed/i);
    
    let status = 'success';
    if (failedMatch || currentOutput.includes('FAIL') || code !== 0) {
      status = 'failed';
    } else if (currentOutput.includes('passing')) {
      status = 'success';
    }

    const testResult = {
      runId,
      runStartTime,
      runEndTime,
      status,
      user: userSession.username,
      testsPassed: passedMatch ? parseInt(passedMatch[1]) : 0,
      testsFailed: failedMatch ? parseInt(failedMatch[1]) : 0,
      testsSuites: suitesMatch ? parseInt(suitesMatch[1]) : 0,
      output: currentOutput.substring(0, 15000)
    };

    try {
      const history = loadHistory();
      history.unshift(testResult);
      if (history.length > 50) history.pop();
      saveHistory(history);
    } catch (err) {
      console.log('[TESTES] Erro ao salvar histórico:', err.message);
    }

    currentOutput = '';
    console.log(`\n[TESTES] Concluídos - Status: ${status}\n`);
  });
}

function history(req, res) {
  const history = loadHistory();
  res.json({
    success: true,
    history: history.slice(0, 20)
  });
}

function clearData(req, res) {
  saveHistory([]);
  res.json({ success: true, message: 'Histórico limpo' });
}

module.exports = {
  status,
  run,
  history,
  clearData
};