/**
 * Conecta HEAL 2.0 - SSE Realtime Hub para Painéis de TV
 * Transmissão instantânea de chamadas e rechamadas de senhas para as TVs.
 */

const clients = new Map(); // Map<painelId, Set<res>>
const recentCallsByPanel = new Map(); // Map<painelId, Array<dadosChamada>>

function getRecentCalls(painelId) {
  const pId = painelId || 'recepcao_principal';
  return recentCallsByPanel.get(pId) || [];
}

function storeRecentCall(painelId, dadosChamada) {
  const pId = painelId || 'recepcao_principal';
  if (!recentCallsByPanel.has(pId)) {
    recentCallsByPanel.set(pId, []);
  }
  const list = recentCallsByPanel.get(pId);
  const filtered = list.filter(item => item.nr_sequencia !== dadosChamada.nr_sequencia);
  filtered.unshift(dadosChamada);
  if (filtered.length > 20) {
    filtered.length = 20;
  }
  recentCallsByPanel.set(pId, filtered);
}

function addClient(painelId, res) {
  const pId = painelId || 'recepcao_principal';
  if (!clients.has(pId)) {
    clients.set(pId, new Set());
  }
  clients.get(pId).add(res);
  
  console.log(`[SSE] Novo cliente conectado no painel: ${pId}. Total neste painel: ${clients.get(pId).size}`);

  // Heartbeat inicial
  res.write(`event: conectado\ndata: ${JSON.stringify({ painelId: pId, timestamp: new Date().toISOString() })}\n\n`);

  res.on('close', () => {
    console.log(`[SSE] Cliente desconectado do painel: ${pId}`);
    removeClient(pId, res);
  });
}

function removeClient(painelId, res) {
  const pId = painelId || 'recepcao_principal';
  if (clients.has(pId)) {
    clients.get(pId).delete(res);
    if (clients.get(pId).size === 0) {
      clients.delete(pId);
    }
  }
}

function broadcastChamada(painelId, dadosChamada) {
  const pId = painelId || 'recepcao_principal';

  // Guarda no buffer de chamadas recentes em memória
  storeRecentCall(pId, dadosChamada);

  const payload = JSON.stringify({
    tipo: 'CHAMADA_SENHA',
    painelId: pId,
    dados: dadosChamada,
    timestamp: new Date().toISOString()
  });

  const message = `event: chamada\ndata: ${payload}\n\n`;

  // Envia para o painel específico
  console.log(`[SSE] Tentando enviar chamada para o painel ${pId}. Clientes conectados neste painel: ${clients.has(pId) ? clients.get(pId).size : 0}`);
  if (clients.has(pId)) {
    clients.get(pId).forEach(client => {
      try {
        client.write(message);
        console.log(`[SSE] Enviado payload de chamada para cliente no painel ${pId}`);
      } catch (err) {
        console.error(`[SSE] Erro ao escrever no cliente do painel ${pId}:`, err);
        removeClient(pId, client);
      }
    });
  }

  // Envia também para painéis que monitoram 'all'
  if (pId !== 'all' && clients.has('all')) {
    clients.get('all').forEach(client => {
      try {
        client.write(message);
      } catch (err) {
        removeClient('all', client);
      }
    });
  }
}

// Keep-alive a cada 20 segundos para manter conexões SSE vivas em proxies/firewalls
setInterval(() => {
  clients.forEach((clientSet, pId) => {
    clientSet.forEach(client => {
      try {
        client.write(`: ping\n\n`);
      } catch (err) {
        removeClient(pId, client);
      }
    });
  });
}, 20000).unref();

module.exports = {
  addClient,
  removeClient,
  broadcastChamada,
  getRecentCalls
};
