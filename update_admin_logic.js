const fs = require('fs');
let html = fs.readFileSync('frontend/admin.html', 'utf8');

const jsLogic = `
    let escalaState = { auto: [], manuais: [], precedencia: [] };

    const allowedFields = ['pas', 'pad', 'fc', 'fr', 'sato2', 'glasgow', 'spo2'];
    const allowedOperators = ['>', '>=', '<', '<=', '==', '!='];
    const allowedColors = ['VERMELHO', 'AMARELO', 'VERDE', 'AZUL'];

    function renderEscalaUI() {
      // 1. Auto
      const cAuto = document.getElementById('container-regras-auto');
      cAuto.innerHTML = '';
      escalaState.auto.forEach((regra, i) => {
        const div = document.createElement('div');
        div.className = 'col-12';
        let condsHtml = regra.condicoes.map((c, j) => \`
          <div class="d-flex gap-2 mb-2 align-items-center">
            <select class="form-select form-select-sm w-auto in-campo" data-r="\${i}" data-c="\${j}">
              \${allowedFields.map(f => \`<option value="\${f}" \${c.campo === f ? 'selected' : ''}>\${f}</option>\`).join('')}
            </select>
            <select class="form-select form-select-sm w-auto in-op" data-r="\${i}" data-c="\${j}">
              \${allowedOperators.map(o => \`<option value="\${o}" \${c.operador === o ? 'selected' : ''}>\${o}</option>\`).join('')}
            </select>
            <input type="number" class="form-control form-control-sm w-auto in-val" value="\${c.valor}" data-r="\${i}" data-c="\${j}">
            <button class="btn btn-sm btn-outline-danger btn-rm-cond" data-r="\${i}" data-c="\${j}"><i class="bi bi-trash"></i></button>
          </div>
        \`).join('');

        div.innerHTML = \`
          <div class="card shadow-sm border-0 mb-2">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                <div class="d-flex gap-3 align-items-center">
                  <input type="text" class="form-control form-control-sm fw-bold in-id" value="\${regra.id}" data-r="\${i}" style="width:150px">
                  <select class="form-select form-select-sm in-cor" data-r="\${i}" style="width:120px">
                    \${allowedColors.map(col => \`<option value="\${col}" \${regra.cor === col ? 'selected' : ''}>\${col}</option>\`).join('')}
                  </select>
                  <div class="form-check form-switch mt-1">
                    <input class="form-check-input in-ativo" type="checkbox" data-r="\${i}" \${regra.ativo ? 'checked' : ''}>
                    <label class="form-check-label small text-muted">Ativo</label>
                  </div>
                </div>
                <button class="btn btn-sm btn-danger btn-rm-regra" data-r="\${i}"><i class="bi bi-trash"></i> Excluir Regra</button>
              </div>
              <div class="bg-light p-3 rounded">
                <div class="d-flex gap-2 mb-3 align-items-center">
                  <span class="fw-bold text-secondary small">Se</span>
                  <select class="form-select form-select-sm in-logico w-auto fw-bold" data-r="\${i}">
                    <option value="AND" \${regra.operadorLogico === 'AND' ? 'selected' : ''}>TODAS (AND)</option>
                    <option value="OR" \${regra.operadorLogico === 'OR' ? 'selected' : ''}>QUALQUER (OR)</option>
                  </select>
                  <span class="fw-bold text-secondary small">das condições abaixo for atingida:</span>
                </div>
                \${condsHtml}
                <button class="btn btn-sm btn-outline-primary mt-2 btn-add-cond" data-r="\${i}"><i class="bi bi-plus"></i> Adicionar Condição</button>
              </div>
            </div>
          </div>
        \`;
        cAuto.appendChild(div);
      });

      // 2. Manuais
      const tbody = document.getElementById('tbody-regras-manuais');
      tbody.innerHTML = '';
      escalaState.manuais.forEach((r, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = \`
          <td><input type="text" class="form-control form-control-sm in-m-cod" value="\${r.codigo}" data-r="\${i}"></td>
          <td><input type="text" class="form-control form-control-sm in-m-desc" value="\${r.descricao}" data-r="\${i}"></td>
          <td>
            <select class="form-select form-select-sm in-m-cor" data-r="\${i}">
              \${allowedColors.map(col => \`<option value="\${col}" \${r.cor === col ? 'selected' : ''}>\${col}</option>\`).join('')}
            </select>
          </td>
          <td><input type="number" class="form-control form-control-sm in-m-ord" value="\${r.ordem}" data-r="\${i}"></td>
          <td class="text-center"><input class="form-check-input in-m-ativo mt-2" type="checkbox" \${r.ativo ? 'checked' : ''} data-r="\${i}"></td>
          <td class="text-center"><button class="btn btn-sm btn-danger btn-rm-manual" data-r="\${i}"><i class="bi bi-trash"></i></button></td>
        \`;
        tbody.appendChild(tr);
      });

      // 3. Precedencia
      const listP = document.getElementById('list-precedencia');
      listP.innerHTML = '';
      escalaState.precedencia.forEach((cor, i) => {
        const li = document.createElement('li');
        li.className = 'list-group-item d-flex justify-content-between align-items-center';
        li.innerHTML = \`
          <span><span class="badge bg-secondary me-2">\${i+1}</span> \${cor}</span>
          <div>
            <button class="btn btn-sm btn-light btn-prec-up" data-i="\${i}" \${i===0?'disabled':''}><i class="bi bi-arrow-up"></i></button>
            <button class="btn btn-sm btn-light btn-prec-down" data-i="\${i}" \${i===escalaState.precedencia.length-1?'disabled':''}><i class="bi bi-arrow-down"></i></button>
          </div>
        \`;
        listP.appendChild(li);
      });

      attachEscalaEvents();
    }

    function attachEscalaEvents() {
      document.querySelectorAll('.in-id').forEach(el => el.addEventListener('change', e => { escalaState.auto[e.target.dataset.r].id = e.target.value; }));
      document.querySelectorAll('.in-cor').forEach(el => el.addEventListener('change', e => { escalaState.auto[e.target.dataset.r].cor = e.target.value; }));
      document.querySelectorAll('.in-ativo').forEach(el => el.addEventListener('change', e => { escalaState.auto[e.target.dataset.r].ativo = e.target.checked; }));
      document.querySelectorAll('.in-logico').forEach(el => el.addEventListener('change', e => { escalaState.auto[e.target.dataset.r].operadorLogico = e.target.value; }));

      document.querySelectorAll('.in-campo').forEach(el => el.addEventListener('change', e => { escalaState.auto[e.target.dataset.r].condicoes[e.target.dataset.c].campo = e.target.value; }));
      document.querySelectorAll('.in-op').forEach(el => el.addEventListener('change', e => { escalaState.auto[e.target.dataset.r].condicoes[e.target.dataset.c].operador = e.target.value; }));
      document.querySelectorAll('.in-val').forEach(el => el.addEventListener('change', e => { escalaState.auto[e.target.dataset.r].condicoes[e.target.dataset.c].valor = Number(e.target.value); }));

      document.querySelectorAll('.btn-add-cond').forEach(el => el.addEventListener('click', e => {
        escalaState.auto[e.target.dataset.r].condicoes.push({ campo: 'fc', operador: '>=', valor: 0 });
        renderEscalaUI();
      }));

      document.querySelectorAll('.btn-rm-cond').forEach(el => el.addEventListener('click', e => {
        let r = e.target.closest('button').dataset.r;
        let c = e.target.closest('button').dataset.c;
        escalaState.auto[r].condicoes.splice(c, 1);
        renderEscalaUI();
      }));

      document.querySelectorAll('.btn-rm-regra').forEach(el => el.addEventListener('click', e => {
        let r = e.target.closest('button').dataset.r;
        escalaState.auto.splice(r, 1);
        renderEscalaUI();
      }));

      // Manuais
      document.querySelectorAll('.in-m-cod').forEach(el => el.addEventListener('change', e => { escalaState.manuais[e.target.dataset.r].codigo = e.target.value; }));
      document.querySelectorAll('.in-m-desc').forEach(el => el.addEventListener('change', e => { escalaState.manuais[e.target.dataset.r].descricao = e.target.value; }));
      document.querySelectorAll('.in-m-cor').forEach(el => el.addEventListener('change', e => { escalaState.manuais[e.target.dataset.r].cor = e.target.value; }));
      document.querySelectorAll('.in-m-ord').forEach(el => el.addEventListener('change', e => { escalaState.manuais[e.target.dataset.r].ordem = Number(e.target.value); }));
      document.querySelectorAll('.in-m-ativo').forEach(el => el.addEventListener('change', e => { escalaState.manuais[e.target.dataset.r].ativo = e.target.checked; }));
      
      document.querySelectorAll('.btn-rm-manual').forEach(el => el.addEventListener('click', e => {
        let r = e.target.closest('button').dataset.r;
        escalaState.manuais.splice(r, 1);
        renderEscalaUI();
      }));

      // Precedencia
      document.querySelectorAll('.btn-prec-up').forEach(el => el.addEventListener('click', e => {
        let i = Number(e.target.closest('button').dataset.i);
        if(i > 0) {
          let temp = escalaState.precedencia[i];
          escalaState.precedencia[i] = escalaState.precedencia[i-1];
          escalaState.precedencia[i-1] = temp;
          renderEscalaUI();
        }
      }));
      document.querySelectorAll('.btn-prec-down').forEach(el => el.addEventListener('click', e => {
        let i = Number(e.target.closest('button').dataset.i);
        if(i < escalaState.precedencia.length - 1) {
          let temp = escalaState.precedencia[i];
          escalaState.precedencia[i] = escalaState.precedencia[i+1];
          escalaState.precedencia[i+1] = temp;
          renderEscalaUI();
        }
      }));
    }

    document.getElementById('btn-add-regra-auto')?.addEventListener('click', () => {
      escalaState.auto.push({
        id: 'NOVA_REGRA', criterio: '', cor: 'VERMELHO', ativo: true, operadorLogico: 'AND',
        condicoes: [{ campo: 'fc', operador: '>=', valor: 0 }]
      });
      renderEscalaUI();
    });

    document.getElementById('btn-add-regra-manual')?.addEventListener('click', () => {
      escalaState.manuais.push({
        codigo: 'NOVO', descricao: '', cor: 'VERMELHO', ativo: true, ordem: 99
      });
      renderEscalaUI();
    });

    document.getElementById('btn-save-escala-triagem-ui')?.addEventListener('click', async () => {
      const payload = {
        triagem_precedencia: JSON.stringify(escalaState.precedencia),
        triagem_regras_automaticas: JSON.stringify(escalaState.auto),
        triagem_regras_manuais: JSON.stringify(escalaState.manuais)
      };
      
      try {
        const res = await api.post(\`\${apiConfig.baseUrl}/admin/system/config\`, payload);
        if (res.success) {
          showToast('Escala de Triagem salva com sucesso!', 'success');
        } else {
          showToast('Erro ao salvar escala de triagem', 'error');
        }
      } catch(err) {
        showToast('Erro: ' + err.message, 'error');
      }
    });
`;

// Inject state population logic to loadConfigSistema
const injectLoad = `
          try {
            escalaState.precedencia = result.data.triagem_precedencia ? JSON.parse(result.data.triagem_precedencia) : ["VERMELHO", "AMARELO", "VERDE", "AZUL"];
            escalaState.auto = result.data.triagem_regras_automaticas ? JSON.parse(result.data.triagem_regras_automaticas) : [];
            escalaState.manuais = result.data.triagem_regras_manuais ? JSON.parse(result.data.triagem_regras_manuais) : [];
            if(escalaState.auto.length === 0) {
              // Defaults provided by backend if empty
              escalaState.auto = [
                { id: 'V2_PA_ALTA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'OR', condicoes: [ { campo: 'pas', operador: '>', valor: 170 }, { campo: 'pad', operador: '>', valor: 120 } ] },
                { id: 'V2_PA_BAIXA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'OR', condicoes: [ { campo: 'pas', operador: '<', valor: 80 }, { campo: 'pad', operador: '<', valor: 60 } ] },
                { id: 'V2_FC_ALTA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'AND', condicoes: [ { campo: 'fc', operador: '>=', valor: 160 } ] },
                { id: 'V2_FC_BAIXA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'AND', condicoes: [ { campo: 'fc', operador: '<', valor: 50 } ] },
                { id: 'V2_FR_ALTA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'AND', condicoes: [ { campo: 'fr', operador: '>', valor: 30 } ] },
                { id: 'V2_FR_BAIXA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'AND', condicoes: [ { campo: 'fr', operador: '<', valor: 10 } ] },
                { id: 'V2_SPO2_BAIXA', criterio: 'V2', cor: 'VERMELHO', ativo: true, operadorLogico: 'AND', condicoes: [ { campo: 'spo2', operador: '<', valor: 85 } ] },
                { id: 'V3_GLASGOW', criterio: 'V3', cor: 'VERMELHO', ativo: true, operadorLogico: 'AND', condicoes: [ { campo: 'glasgow', operador: '<=', valor: 8 } ] }
              ];
            }
            if(escalaState.manuais.length === 0) {
              escalaState.manuais = [
                { codigo: 'V1', descricao: 'TAE nas últimas 2h', cor: 'VERMELHO', ativo: true, ordem: 1 },
                { codigo: 'V4', descricao: 'Dor torácica de características anginosas / suspeita de SCA', cor: 'VERMELHO', ativo: true, ordem: 2 },
                { codigo: 'V5', descricao: 'Agitação psicomotora grave / necessidade de contenção física', cor: 'VERMELHO', ativo: true, ordem: 3 },
                { codigo: 'A1', descricao: 'Inquietação / gesticulando muito / risco de agitação', cor: 'AMARELO', ativo: true, ordem: 4 },
                { codigo: 'A2', descricao: 'Presença de encaminhamento a atendimento de urgência', cor: 'AMARELO', ativo: true, ordem: 5 },
                { codigo: 'A3', descricao: 'Choro intenso', cor: 'AMARELO', ativo: true, ordem: 6 },
                { codigo: 'A4', descricao: 'Conflitos com acompanhante no pronto atendimento', cor: 'AMARELO', ativo: true, ordem: 7 },
                { codigo: 'A5', descricao: 'IAE com planejamento', cor: 'AMARELO', ativo: true, ordem: 8 },
                { codigo: 'G1', descricao: 'Insônia', cor: 'VERDE', ativo: true, ordem: 9 },
                { codigo: 'G2', descricao: 'Depressão com comportamento tranquilo', cor: 'VERDE', ativo: true, ordem: 10 },
                { codigo: 'G3', descricao: 'DV estáveis', cor: 'VERDE', ativo: true, ordem: 11 },
                { codigo: 'G4', descricao: 'Estado Mental Estável', cor: 'VERDE', ativo: true, ordem: 12 },
                { codigo: 'B1', descricao: 'Relatório', cor: 'AZUL', ativo: true, ordem: 13 },
                { codigo: 'B2', descricao: 'Renovar receita', cor: 'AZUL', ativo: true, ordem: 14 },
                { codigo: 'B3', descricao: 'Continuar acompanhamento no ambulatório', cor: 'AZUL', ativo: true, ordem: 15 },
                { codigo: 'B4', descricao: 'Atestado', cor: 'AZUL', ativo: true, ordem: 16 }
              ];
            }
            renderEscalaUI();
          } catch(e) { console.error('Erro ao renderizar escala', e); }
`;

// We remove the old JSON editors logic
html = html.replace(/if \(document\.getElementById\('config-triagem-precedencia'\)\) \{[\s\S]*?\}/, '');
html = html.replace(/if \(document\.getElementById\('config-triagem-regras-auto'\)\) \{[\s\S]*?\}/, '');
html = html.replace(/if \(document\.getElementById\('config-triagem-regras-manuais'\)\) \{[\s\S]*?\}/, '');
html = html.replace(/document\.getElementById\('btn-save-escala-triagem'\)\?\.addEventListener\('click'[\s\S]*?\}\);/, '');

// Inject the load logic
html = html.replace("if (document.getElementById('config-app-version')) {", injectLoad + "\n          if (document.getElementById('config-app-version')) {");

// Inject JS logic
html = html.replace('function renderTelemetria', jsLogic + '\n    function renderTelemetria');

fs.writeFileSync('frontend/admin.html', html);
