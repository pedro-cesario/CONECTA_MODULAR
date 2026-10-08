import re

with open('frontend/src/modules/dashboard/dashboard.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace step name back to busca
content = content.replace("triagem-modal-step-paciente", "triagem-modal-step-busca")

# Extract the new renderPAPaciente
pattern = re.compile(r'export function renderPAPaciente\(paciente, etiquetaKey\)\s*\{.*?\n  \}', re.DOTALL)

original_render = """export function renderPAPaciente(paciente, etiquetaKey) {

    const nrAtendimento = paciente.nr_atendimento || '-';
    const cdUnidadeRaw = paciente.cd_unidade ?? paciente.CD_UNIDADE ?? paciente.unidade;
    const cdUnidade = String(cdUnidadeRaw ?? '').trim() || '-';

    let statusClass = '';
    let statusBadge = '';

    const etiqueta = DASHBOARD_PA_ETIQUETAS.find(e => e.key === etiquetaKey);

    if (etiquetaKey === 'decididos') {
      const decisao = paciente.decisao;
      if (decisao === 'aceito' || decisao === 'recusado') {
        statusClass = decisao;
        const badgeClass = decisao === 'aceito' ? 'dashboard-badge-green' : 'dashboard-badge-red';
        const badgeLabel = decisao === 'aceito' ? 'Aceito' : 'Recusado';
        statusBadge = `<span class="dashboard-badge ${badgeClass}"><i class="bi ${decisao === 'aceito' ? 'bi-check-circle' : 'bi-x-circle'}"></i> ${utils.escapeHtml(badgeLabel)}</span>`;
      }
    } else if (etiqueta) {
      statusBadge = `<span class="dashboard-badge dashboard-badge-${etiqueta.color}"><i class="bi ${etiqueta.icon}"></i> ${utils.escapeHtml(etiqueta.label)}</span>`;
    }

    return `
      <article class="dashboard-patient-card ${statusClass}" data-atendimento="${utils.escapeHtml(String(nrAtendimento))}" data-nr-templ="${utils.escapeHtml(String(paciente.nr_seq_templ || ''))}" data-etiqueta="${utils.escapeHtml(etiquetaKey || '')}">
        ${statusBadge ? `<div class="dashboard-patient-tags">${statusBadge}</div>` : ''}
        <h3>${utils.escapeHtml(paciente.nome || '-')}</h3>
        ${utils.renderNomeCivilPaciente(paciente)}
        <div class="dashboard-patient-meta">
          <span><i class="bi bi-hash"></i> ${utils.escapeHtml(nrAtendimento)}</span>
          <span><i class="bi bi-building"></i> ${utils.escapeHtml(paciente.setor || '-')}</span>
          <span><i class="bi bi-diagram-3"></i> ${utils.escapeHtml(cdUnidade)}</span>
          <span><i class="bi bi-credit-card"></i> ${utils.escapeHtml(paciente.convenio || '-')}</span>
        </div>
      </article>\`;

  }"""

new_content = pattern.sub(original_render, content)

with open('frontend/src/modules/dashboard/dashboard.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Restored dashboard.js")
