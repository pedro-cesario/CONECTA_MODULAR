(() => {
  'use strict';

  const API_URL = '';

  const state = {
    usuario: null,
    testRunning: false,
    lastResult: null,
    pollInterval: null
  };

  const api = {
    async get(url) {
      const res = await fetch(url, { credentials: 'include' });
      return res.json();
    },
    async post(url, data) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      return res.json();
    }
  };

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`screen-${name}`).classList.add('active');
  }

  function showLoginError(msg) {
    const err = document.getElementById('login-error');
    err.textContent = msg;
    err.classList.remove('d-none');
  }

  function hideLoginError() {
    document.getElementById('login-error').classList.add('d-none');
  }

  async function handleLogin(e) {
    e.preventDefault();
    hideLoginError();

    const btn = document.getElementById('btn-login');
    const btnText = btn.querySelector('.btn-text');
    const btnLoader = btn.querySelector('.btn-loader');

    btn.disabled = true;
    btnText.classList.add('d-none');
    btnLoader.classList.remove('d-none');

    const username = document.getElementById('inp-usuario').value;
    const password = document.getElementById('inp-senha').value;

    try {
      const result = await api.post('/api/login', { username, password });

      if (result.success) {
        state.usuario = result.user;
        document.getElementById('user-name').textContent = result.user.nm_usuario;
        showScreen('app');
        loadStatus();
        loadHistory();
      } else {
        showLoginError(result.message || 'Erro ao fazer login');
      }
    } catch (err) {
      showLoginError('Erro de conexão');
    } finally {
      btn.disabled = false;
      btnText.classList.remove('d-none');
      btnLoader.classList.add('d-none');
    }
  }

  async function handleLogout() {
    await api.post('/api/logout', {});
    state.usuario = null;
    showScreen('login');
  }

  async function checkSession() {
    try {
      const result = await api.get('/api/me');
      if (result.success && result.user) {
        state.usuario = result.user;
        document.getElementById('user-name').textContent = result.user.nm_usuario;
        showScreen('app');
        loadStatus();
        loadHistory();
      } else {
        showScreen('login');
      }
    } catch (err) {
      showScreen('login');
    }
  }

  async function loadStatus() {
    try {
      const result = await api.get('/api/test/status');
      updateStatusDisplay(result.lastRun, result.currentOutput);
    } catch (err) {}
  }

  function updateStatusDisplay(lastRun, currentOutput) {
    const statusEl = document.getElementById('test-status');
    const btn = document.getElementById('btn-run-tests');

    btn.disabled = state.testRunning;

    if (state.testRunning && currentOutput) {
      statusEl.className = 'test-status running';
      statusEl.innerHTML = '<i class="bi bi-arrow-repeat spin"></i><span>Executando...</span>';
      
      renderLiveOutput(currentOutput);
      return;
    }

    if (lastRun) {
      if (lastRun.status === 'success') {
        statusEl.className = 'test-status success';
        statusEl.innerHTML = `<i class="bi bi-check-circle-fill"></i><span>${lastRun.testsPassed} testes OK</span>`;
      } else {
        statusEl.className = 'test-status error';
        statusEl.innerHTML = `<i class="bi bi-x-circle-fill"></i><span>${lastRun.testsFailed} falhas</span>`;
      }
      renderResults(lastRun);
    } else {
      statusEl.className = 'test-status';
      statusEl.innerHTML = '<i class="bi bi-check-circle"></i><span>Pronto para testar</span>';
    }
  }

  function renderLiveOutput(output) {
    const resultsEl = document.getElementById('test-results');
    const lines = output.split('\n').filter(line => 
      line.trim().includes('✓') || 
      line.trim().includes('PASS') || 
      line.trim().includes('Test Suites') ||
      line.trim().includes('Test:') ||
      line.trim().includes('console.log') && !line.includes('=== INICIANDO')
    );
    
    resultsEl.innerHTML = lines.slice(-30).map(line => {
      const isPass = line.includes('✓') || line.includes('PASS') || line.includes('passed');
      const isFail = line.includes('✗') || line.includes('FAIL') || line.includes('failed');
      
      if (line.includes('console.log')) return '';
      if (line.includes('=== INICIANDO') || line.includes('=== TESTES FINALIZADOS')) return '';
      
      return `<div class="result-item ${isPass ? 'pass' : isFail ? 'fail' : ''}">
        <i class="bi bi-${isPass ? 'check-circle-fill' : isFail ? 'x-circle-fill' : 'arrow-right-circle'}"></i>
        <span class="title">${line.trim()}</span>
      </div>`;
    }).join('');
    
    resultsEl.scrollTop = resultsEl.scrollHeight;
  }

  function renderResults(lastRun) {
    const resultsEl = document.getElementById('test-results');
    const output = lastRun.output || '';
    
    const passedLines = output.match(/✓.*/g) || [];
    const failedLines = output.match(/✗.*/g) || [];
    
    let html = '';
    
    passedLines.forEach(line => {
      html += `<div class="result-item pass">
        <i class="bi bi-check-circle-fill"></i>
        <span class="title">${line.replace('✓', '').trim()}</span>
      </div>`;
    });
    
    if (failedLines.length > 0) {
      html += '<div class="section-divider">Falhas:</div>';
      failedLines.forEach(line => {
        html += `<div class="result-item fail">
          <i class="bi bi-x-circle-fill"></i>
          <span class="title">${line.replace('✗', '').trim()}</span>
        </div>`;
      });
    }
    
    if (!html) {
      html = `<div class="result-item pass">
        <i class="bi bi-check-circle-fill"></i>
        <span class="title">${lastRun.testsPassed} testes passaram</span>
      </div>`;
    }
    
    resultsEl.innerHTML = html;
  }

  async function runTests() {
    if (state.testRunning) return;

    const btn = document.getElementById('btn-run-tests');
    const progressEl = document.getElementById('test-progress');
    const progressBar = progressEl.querySelector('.progress-bar');
    const progressText = document.getElementById('progress-text');

    state.testRunning = true;
    btn.disabled = true;

    progressEl.classList.remove('d-none');
    progressBar.style.width = '10%';
    progressText.textContent = 'Iniciando testes...';

    loadStatus();

    try {
      const result = await api.post('/api/test/run', {});

      if (!result.success) {
        alert(result.message || 'Erro ao iniciar testes');
        state.testRunning = false;
        progressEl.classList.add('d-none');
        loadStatus();
        return;
      }

      state.pollInterval = setInterval(async () => {
        try {
          const statusResult = await api.get('/api/test/status');
          updateStatusDisplay(statusResult.lastRun, statusResult.currentOutput);
          
          if (statusResult.lastRun && statusResult.lastRun.runEndTime) {
            clearInterval(state.pollInterval);
            state.testRunning = false;
            progressEl.classList.add('d-none');
            progressBar.style.width = '0%';
            await loadHistory();
          }
        } catch (err) {}
      }, 2000);

    } catch (err) {
      alert('Erro ao executar testes');
      state.testRunning = false;
      progressEl.classList.add('d-none');
      progressBar.style.width = '0%';
    }
  }

  async function loadHistory() {
    try {
      const result = await api.get('/api/test/history');
      renderHistory(result.history || []);
    } catch (err) {}
  }

  function renderHistory(history) {
    const listEl = document.getElementById('history-list');

    if (!history || history.length === 0) {
      listEl.innerHTML = '<div class="history-empty">Nenhuma execução anterior</div>';
      return;
    }

    listEl.innerHTML = history.map(h => {
      const date = new Date(h.runStartTime);
      const dateStr = date.toLocaleDateString('pt-BR');
      const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="history-item" onclick="loadHistoryItem(${h.runId})">
          <div class="status-icon ${h.status === 'success' ? 'success' : 'error'}">
            <i class="bi bi-${h.status === 'success' ? 'check' : 'x'}"></i>
          </div>
          <div class="info">
            <div class="user">${h.user}</div>
            <div class="time">${dateStr} ${timeStr}</div>
          </div>
          <div class="stats">
            <span class="passed">${h.testsPassed} OK</span>
            ${h.testsFailed > 0 ? `<span class="failed">${h.testsFailed} falha(s)</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  async function loadHistoryItem(runId) {
    try {
      const result = await api.get('/api/test/history');
      const item = result.history.find(h => h.runId == runId);
      if (item) {
        renderResults(item);
      }
    } catch (err) {}
  }

  window.loadHistoryItem = loadHistoryItem;

  document.getElementById('form-login').addEventListener('submit', handleLogin);
  document.getElementById('btn-logout').addEventListener('click', handleLogout);
  document.getElementById('btn-run-tests').addEventListener('click', runTests);

  checkSession();
})();