/**
 * Conecta HEAL 2.0 - Conecta TV Painel de Chamada de Senhas
 * Client de TV com SSE em Tempo Real, Áudio Web Audio API e Síntese de Voz PT-BR.
 */

const painelState = {
  painelId: 'recepcao_principal',
  painelConfig: {
    nome: 'Recepção Principal',
    som_ativo: true,
    voz_ativa: true,
    voz_velocidade: 1.0
  },
  ultimaChamada: null,
  historico: [],
  audioEnabled: false,
  eventSource: null,
  audioCtx: null
};

// ============================================================================
// 1. INICIALIZAÇÃO
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // 1. Lê painel da URL ?painel=slug
  const params = new URLSearchParams(window.location.search);
  painelState.painelId = params.get('painel') || 'recepcao_principal';

  // 2. Inicia Relógio
  iniciarRelogio();

  // 3. Carrega Estado Inicial
  carregarEstadoInicial();

  // 4. Conecta SSE em Tempo Real
  conectarSSE();

  // 5. Configura Botões (Áudio & Fullscreen)
  configurarEventosUI();
});

// ============================================================================
// 2. RELÓGIO & STATUS
// ============================================================================

function iniciarRelogio() {
  const timeEl = document.getElementById('painel-clock-time');
  const dateEl = document.getElementById('painel-clock-date');

  function update() {
    const now = new Date();
    if (timeEl) {
      timeEl.textContent = now.toLocaleTimeString('pt-BR');
    }
    if (dateEl) {
      const options = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' };
      dateEl.textContent = now.toLocaleDateString('pt-BR', options);
    }
  }

  update();
  setInterval(update, 1000);
}

function setStatusConexao(online) {
  const badge = document.getElementById('painel-status-badge');
  const text = document.getElementById('painel-status-text');
  if (!badge || !text) return;

  if (online) {
    badge.className = 'painel-status-badge';
    text.textContent = 'Ao Vivo';
  } else {
    badge.className = 'painel-status-badge bg-danger-subtle text-danger border-danger-subtle';
    text.textContent = 'Reconectando...';
  }
}

// ============================================================================
// 3. BUSCA DE DADOS INICIAIS & POLLING DE FALLBACK
// ============================================================================

async function carregarEstadoInicial() {
  try {
    const res = await fetch(`/api/painel/${painelState.painelId}/estado`);
    const json = await res.json();
    if (json.success) {
      if (json.painel) {
        painelState.painelConfig = json.painel;
        const nomeEl = document.getElementById('painel-tv-nome');
        if (nomeEl && json.painel.nome) nomeEl.textContent = json.painel.nome;
      }
      if (json.ultimaChamada) {
        exibirChamada(json.ultimaChamada, false);
      }
      if (Array.isArray(json.historico)) {
        painelState.historico = json.historico;
        renderizarHistorico();
      }
      setStatusConexao(true);
    }
  } catch (err) {
    console.error('[Painel TV] Erro ao carregar estado inicial:', err);
    setStatusConexao(false);
  }
}

// ============================================================================
// 4. CONEXÃO SERVER-SENT EVENTS (SSE)
// ============================================================================

function conectarSSE() {
  if (painelState.eventSource) {
    painelState.eventSource.close();
  }

  const sseUrl = `/api/painel/${painelState.painelId}/stream`;
  const es = new EventSource(sseUrl);
  painelState.eventSource = es;

  es.addEventListener('open', () => {
    console.log('[Painel TV] Conectado ao stream SSE em tempo real.');
    setStatusConexao(true);
  });

  es.addEventListener('conectado', (e) => {
    setStatusConexao(true);
  });

  es.addEventListener('chamada', (e) => {
    try {
      const payload = JSON.parse(e.data);
      if (payload.dados) {
        processarNovaChamada(payload.dados);
      }
    } catch (err) {
      console.error('[Painel TV] Erro ao processar evento de chamada:', err);
    }
  });

  es.addEventListener('error', (e) => {
    console.warn('[Painel TV] Desconectado do SSE. Tentando reconectar...');
    setStatusConexao(false);
  });
}

// ============================================================================
// 5. EXIBIÇÃO & FEEDBACK VISUAL
// ============================================================================

function processarNovaChamada(dados) {
  // Move a chamada anterior para o histórico (mantém exatamente as últimas 07)
  if (painelState.ultimaChamada && painelState.ultimaChamada.nr_sequencia !== dados.nr_sequencia) {
    painelState.historico.unshift(painelState.ultimaChamada);
    if (painelState.historico.length > 7) {
      painelState.historico = painelState.historico.slice(0, 7);
    }
    renderizarHistorico();
  }

  exibirChamada(dados, true);

  // Executa Som e Voz
  tocarAvisoSonoro();
  falarSenha(dados);
}

function exibirChamada(dados, animar = true) {
  painelState.ultimaChamada = dados;

  const numEl = document.getElementById('calling-ticket-number');
  const targetEl = document.getElementById('calling-destination-target');
  const timeEl = document.getElementById('calling-time');
  const filaEl = document.getElementById('calling-fila-nome');
  const cardEl = document.getElementById('painel-calling-card');

  // No Hospital Espírita André Luiz, a senha é sempre P + número
  const numLimpo = String(dados.cd_senha_gerada || dados.cd_senha_completa || '---').replace(/^[^\d]*/i, '').trim();
  const cdCompleto = numLimpo ? `P ${numLimpo}` : '---';
  const guiche = dados.ds_guiche || 'Guichê 01';
  const hr = dados.hr_chamada || new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const fila = dados.ds_fila || 'Recepção';

  if (numEl) numEl.textContent = cdCompleto;
  if (targetEl) targetEl.textContent = guiche.toUpperCase();
  if (timeEl) timeEl.textContent = hr;
  if (filaEl) filaEl.textContent = fila;

  if (animar && cardEl) {
    cardEl.classList.remove('calling-animating');
    void cardEl.offsetWidth; // Trigger reflow
    cardEl.classList.add('calling-animating');
  }
}

function renderizarHistorico() {
  const container = document.getElementById('painel-history-list');
  const badge = document.getElementById('history-count-badge');
  if (!container) return;

  // Mostra exatamente as últimas 07 senhas chamadas
  const lista = painelState.historico.slice(0, 7);
  if (badge) badge.textContent = lista.length;

  if (lista.length === 0) {
    container.innerHTML = `
      <div class="history-empty-state">
        <i class="bi bi-hourglass-split"></i>
        <span>Aguardando chamadas...</span>
      </div>`;
    return;
  }

  container.innerHTML = lista.map(item => {
    const numLimpo = String(item.cd_senha_gerada || item.cd_senha_completa || '').replace(/^[^\d]*/i, '').trim();
    const cdExibido = numLimpo ? `P ${numLimpo}` : (item.cd_senha_completa || item.cd_senha_gerada);

    return `
      <div class="history-item-card">
        <div>
          <div class="history-item-number">${cdExibido}</div>
          <div class="history-item-target">${escapeHtml(item.ds_guiche || 'Guichê')}</div>
        </div>
        <div class="history-item-time">
          <div><i class="bi bi-clock me-1 text-primary"></i> ${item.hr_chamada || '--:--'}</div>
        </div>
      </div>
    `;
  }).join('');
}

// ============================================================================
// 6. ÁUDIO & SÍNTESE DE VOZ (WEB AUDIO API & SPEECH SYNTHESIS)
// ============================================================================

function tocarAvisoSonoro() {
  if (!painelState.painelConfig.som_ativo) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;

    if (!painelState.audioCtx) {
      painelState.audioCtx = new AudioContext();
    }

    const ctx = painelState.audioCtx;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const now = ctx.currentTime;

    // Primeiro tom (Ding - 784Hz / G5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.4, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Segundo tom (Dong - 587Hz / D5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(587.33, now + 0.35);
    gain2.gain.setValueAtTime(0, now + 0.35);
    gain2.gain.linearRampToValueAtTime(0.45, now + 0.4);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.35);
    osc2.stop(now + 1.2);

  } catch (err) {
    console.warn('[Painel TV] Aviso de áudio:', err.message);
  }
}

function falarSenha(dados) {
  if (!painelState.painelConfig.voz_ativa) return;
  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel(); // Cancela chamadas anteriores pendentes

  // Aguarda 900ms para o Ding-Dong tocar primeiro
  setTimeout(() => {
    try {
      const numLimpo = String(dados.cd_senha_gerada || dados.cd_senha_completa || '').replace(/^[^\d]*/i, '').trim();
      const guiche = dados.ds_guiche || 'Guichê 01';

      // No Hospital Espírita André Luiz a pronúncia é: "Senha P [número], [Guichê]"
      const frase = `Senha P ${numLimpo}, ${guiche}`.trim();

      const utterance = new SpeechSynthesisUtterance(frase);
      utterance.lang = 'pt-BR';
      utterance.rate = painelState.painelConfig.voz_velocidade || 1.0;
      utterance.pitch = 1.0;

      // Tenta selecionar voz em português nativa
      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find(v => v.lang.includes('pt-BR') || v.lang.includes('pt_BR') || v.lang.includes('pt'));
      if (ptVoice) {
        utterance.voice = ptVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.warn('[Painel TV] Erro na síntese de voz:', err);
    }
  }, 950);
}

// ============================================================================
// 7. EVENTOS DE UI & CONTROLES
// ============================================================================

function configurarEventosUI() {
  // Ativação de áudio
  const btnAudio = document.getElementById('btn-enable-audio');
  const bannerAudio = document.getElementById('audio-prompt-banner');

  if (btnAudio) {
    btnAudio.addEventListener('click', () => {
      painelState.audioEnabled = true;
      tocarAvisoSonoro();
      if (bannerAudio) bannerAudio.classList.add('d-none');
    });
  }

  // Qualquer clique na tela desbloqueia o AudioContext
  document.body.addEventListener('click', () => {
    if (!painelState.audioEnabled) {
      painelState.audioEnabled = true;
      if (bannerAudio) bannerAudio.classList.add('d-none');
      if (painelState.audioCtx && painelState.audioCtx.state === 'suspended') {
        painelState.audioCtx.resume();
      }
    }
  }, { once: true });

  // Fullscreen toggle
  const btnFull = document.getElementById('btn-toggle-fullscreen');
  if (btnFull) {
    btnFull.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.warn('Erro ao entrar em tela cheia:', err);
        });
      } else {
        document.exitFullscreen();
      }
    });
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
