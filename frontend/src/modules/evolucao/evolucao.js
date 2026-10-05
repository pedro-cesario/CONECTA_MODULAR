import { api } from '../../core/api.js';
import * as ui from '../../core/ui.js';
import * as router from '../../core/router.js';

export function setupEvolucao() {
  const btnAbrir = document.getElementById('btn-abrir-evolucao');
  const screenEvolucao = document.getElementById('screen-evolucao');
  const btnLiberar = document.getElementById('btn-evo-liberar');
  const btnValidar = document.getElementById('btn-evo-validar');

  if (btnAbrir) {
    btnAbrir.addEventListener('click', () => {
      router.showScreen('evolucao');
    });
  }

  if (btnLiberar) {
    btnLiberar.addEventListener('click', async () => {
      const nrAtendimento = document.getElementById('inp-evo-atendimento').value;
      const texto = document.getElementById('inp-evo-texto').value;

      if (!nrAtendimento) {
        ui.showToast('Informe o número do atendimento.', 'warning');
        return;
      }

      try {
        const res = await api.request('/api/evolucao/criar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nrAtendimento, texto })
        });
        const data = await res.json();

        if (data.success) {
          ui.showToast('Evolução criada! Agora libere a assinatura no Tasy.', 'success');
        } else {
          ui.showToast(data.message || 'Erro ao criar evolução', 'danger');
        }
      } catch (err) {
        console.error(err);
        ui.showToast('Falha na comunicação com servidor.', 'danger');
      }
    });
  }

  if (btnValidar) {
    btnValidar.addEventListener('click', async () => {
      const nrAtendimento = document.getElementById('inp-evo-atendimento').value;
      if (!nrAtendimento) {
        ui.showToast('Informe o número do atendimento.', 'warning');
        return;
      }

      try {
        const res = await api.get('/api/evolucao/validar/' + nrAtendimento);
        if (res.success && res.assinado) {
          ui.showModal('success', 'Assinatura Digital - ICP-Brasil', `
            <div class="alert alert-success d-flex align-items-center" role="alert" style="text-align: left;">
              <i class="bi bi-shield-check fs-2 me-3"></i>
              <div>
                <strong>Documento Assinado Digitalmente</strong><br/>
                ${res.detalhes_assinatura || `Assinado digitalmente por ${res.medico}.`}
              </div>
            </div>
            <div class="mt-3 text-start" style="text-align: left;">
              <p><strong>Médico:</strong> ${res.medico}</p>
              <p><strong>Data de Liberação:</strong> ${res.data_liberacao}</p>
              <p><strong>Hash de Validação Tasy:</strong> ${res.nr_seq_assinatura}</p>
              ${res.eventos_auditoria && res.eventos_auditoria.length ? `<p><strong>Eventos de Auditoria:</strong> ${res.eventos_auditoria.join(', ')}</p>` : ''}
            </div>
          `);
        } else {
          ui.showModal('warning', 'Assinatura Digital - Status', `
            <div class="alert alert-warning d-flex align-items-center" role="alert" style="text-align: left;">
              <i class="bi bi-exclamation-triangle fs-2 me-3"></i>
              <div>
                <strong>Evolução pendente de assinatura digital no Tasy</strong><br/>
                ${res.message || 'O documento ainda não foi assinado ou validado.'}
              </div>
            </div>
          `);
        }
      } catch (err) {
        console.error(err);
        ui.showToast('Erro ao validar assinatura', 'danger');
      }
    });
  }
}
