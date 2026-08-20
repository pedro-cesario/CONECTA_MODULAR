/**
 * ============================================================================
 * CONECTA STUDIO — BUILDER JS
 * Editor Visual Drag-and-Drop estilo WIX para Conecta HEAL
 * ============================================================================
 */

(function () {
  'use strict';

  // --- STATE ---
  const state = {
    pageId: null,
    pageData: {
      id: 'nova_tela_' + Date.now(),
      nome: 'Nova Tela Conecta',
      descricao: 'Página criada no Conecta Studio',
      categoria: 'custom',
      is_native: 0
    },
    selectedNode: null,
    history: [],
    historyIndex: -1,
    isPreview: false,
    draggedType: null
  };

  // --- COMPONENT TEMPLATES (CONECTA DESIGN SYSTEM) ---
  const COMPONENT_DEFINITIONS = {
    'topbar': {
      name: 'Topbar Conecta',
      icon: 'bi-window-dock',
      category: 'layout',
      render: () => `
        <header class="topbar studio-canvas-node" data-studio-type="topbar" style="border-radius: 0.75rem; margin-bottom: 1.25rem;">
          <div class="topbar-left">
            <span class="topbar-logo"><i class="bi bi-hospital"></i></span>
            <div class="topbar-title">
              <h1 contenteditable="false">Conecta HEAL</h1>
              <small>Passagem de Plantão & Gestão</small>
            </div>
          </div>
          <div class="topbar-center">
            <span class="topbar-badge" style="background: rgba(19, 79, 159, 0.1); color: var(--primary); padding: 0.35rem 0.75rem; border-radius: 999px; font-size: 0.8rem; font-weight: 700;">
              <i class="bi bi-geo-alt-fill"></i> <span class="studio-text">Setor de Atendimento</span>
            </span>
          </div>
          <div class="topbar-right">
            <span class="user-badge" style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.04); padding: 0.35rem 0.75rem; border-radius: 999px;">
              <i class="bi bi-person-circle" style="font-size: 1.2rem; color: var(--primary);"></i>
              <span style="font-size: 0.82rem; font-weight: 700;">Alexandre Braga</span>
            </span>
          </div>
        </header>
      `
    },

    'panel_white': {
      name: 'Painel Branco Conecta',
      icon: 'bi-square',
      category: 'layout',
      render: () => `
        <div class="studio-canvas-node card-conecta studio-container-drop" data-studio-type="panel_white" style="background: #ffffff; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05); margin-bottom: 1.25rem; width: 100%;">
          <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.75rem; margin-bottom: 1rem;">
            <h3 class="studio-text" style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--primary);">Título da Seção / Painel</h3>
            <span class="badge bg-primary-subtle text-primary" style="font-weight: 700;">Ativo</span>
          </div>
          <div class="studio-child-zone" style="min-height: 50px;">
            <p class="studio-text" style="color: #64748b; font-size: 0.9rem; margin: 0;">Arraste outros elementos ou componentes para dentro deste painel.</p>
          </div>
        </div>
      `
    },

    'grid_2': {
      name: 'Grid 2 Colunas',
      icon: 'bi-layout-split',
      category: 'layout',
      render: () => `
        <div class="studio-canvas-node row g-3" data-studio-type="grid_2" style="margin-bottom: 1.25rem; width: 100%;">
          <div class="col-md-6">
            <div class="studio-child-zone" style="background: rgba(241, 245, 249, 0.7); border: 1.5px dashed #cbd5e1; border-radius: 0.75rem; padding: 1rem; min-height: 90px;">
              <p class="text-muted small m-0 text-center">Coluna 1 (Solte elementos aqui)</p>
            </div>
          </div>
          <div class="col-md-6">
            <div class="studio-child-zone" style="background: rgba(241, 245, 249, 0.7); border: 1.5px dashed #cbd5e1; border-radius: 0.75rem; padding: 1rem; min-height: 90px;">
              <p class="text-muted small m-0 text-center">Coluna 2 (Solte elementos aqui)</p>
            </div>
          </div>
        </div>
      `
    },

    'grid_3': {
      name: 'Grid 3 Colunas',
      icon: 'bi-grid-3x3-gap',
      category: 'layout',
      render: () => `
        <div class="studio-canvas-node row g-3" data-studio-type="grid_3" style="margin-bottom: 1.25rem; width: 100%;">
          <div class="col-md-4">
            <div class="studio-child-zone" style="background: rgba(241, 245, 249, 0.7); border: 1.5px dashed #cbd5e1; border-radius: 0.75rem; padding: 1rem; min-height: 90px;">
              <p class="text-muted small m-0 text-center">Coluna 1</p>
            </div>
          </div>
          <div class="col-md-4">
            <div class="studio-child-zone" style="background: rgba(241, 245, 249, 0.7); border: 1.5px dashed #cbd5e1; border-radius: 0.75rem; padding: 1rem; min-height: 90px;">
              <p class="text-muted small m-0 text-center">Coluna 2</p>
            </div>
          </div>
          <div class="col-md-4">
            <div class="studio-child-zone" style="background: rgba(241, 245, 249, 0.7); border: 1.5px dashed #cbd5e1; border-radius: 0.75rem; padding: 1rem; min-height: 90px;">
              <p class="text-muted small m-0 text-center">Coluna 3</p>
            </div>
          </div>
        </div>
      `
    },

    'card_paciente': {
      name: 'Card de Paciente / Leito',
      icon: 'bi-person-badge',
      category: 'components',
      render: () => `
        <div class="studio-canvas-node paciente-card" data-studio-type="card_paciente" style="background: #ffffff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); border: 1px solid #e2e8f0; margin-bottom: 1rem; width: 100%;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.65rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span class="leito-badge" style="background: var(--primary); color: #ffffff; font-weight: 800; font-size: 0.85rem; padding: 0.35rem 0.75rem; border-radius: 0.5rem;">
                Leito 104-A
              </span>
              <strong class="studio-text" style="font-size: 1.05rem; color: #1e293b;">Maria Santos da Silva</strong>
            </div>
            <span class="badge bg-danger-subtle text-danger" style="font-weight: 700; font-size: 0.78rem;">
              <i class="bi bi-exclamation-octagon-fill"></i> Alto Risco
            </span>
          </div>
          <p class="studio-text" style="color: #64748b; font-size: 0.88rem; margin: 0 0 0.75rem;">
            <strong>Diagnóstico:</strong> Pós-operatório imediato · Sem alergias conhecidas
          </p>
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
            <span class="badge bg-secondary-subtle text-secondary">Acompanhante Presente</span>
            <span class="badge bg-warning-subtle text-warning-emphasis">Jejum</span>
            <span class="badge bg-danger-subtle text-danger">Queda</span>
          </div>
        </div>
      `
    },

    'turno_bar': {
      name: 'Barra de Turno / Período',
      icon: 'bi-sun-fill',
      category: 'components',
      render: () => `
        <div class="studio-canvas-node turno-bar" data-studio-type="turno_bar" style="display: inline-flex; align-items: center; background: rgba(19, 79, 159, 0.08); padding: 4px; border-radius: 999px; margin-bottom: 1rem;">
          <button type="button" class="btn btn-sm btn-white shadow-sm" style="border-radius: 999px; font-weight: 700; color: var(--primary); background: #ffffff; padding: 0.4rem 1.15rem; border: 0;">
            <i class="bi bi-sun-fill text-warning"></i> Diurno (Dia)
          </button>
          <button type="button" class="btn btn-sm" style="border-radius: 999px; font-weight: 600; color: #64748b; padding: 0.4rem 1.15rem; border: 0; background: transparent;">
            <i class="bi bi-moon-stars-fill text-primary"></i> Noturno (Noite)
          </button>
        </div>
      `
    },

    'btn_primary': {
      name: 'Botão Salvar / Primário',
      icon: 'bi-check2-circle',
      category: 'components',
      render: () => `
        <div class="studio-canvas-node" data-studio-type="btn_primary" style="display: inline-block; margin-bottom: 0.5rem;">
          <button class="btn btn-save btn-save--highlight" style="background: linear-gradient(145deg, var(--primary), var(--primary-light)); color: #ffffff; font-weight: 700; padding: 0.65rem 1.5rem; border-radius: 0.65rem; border: 0; display: inline-flex; align-items: center; gap: 0.5rem; box-shadow: 0 4px 14px rgba(19, 79, 159, 0.3);">
            <i class="bi bi-check2-all"></i> <span class="studio-text">Salvar / Finalizar Passagem</span>
          </button>
        </div>
      `
    },

    'btn_secondary': {
      name: 'Botão Secundário / Ação',
      icon: 'bi-hand-index-thumb',
      category: 'components',
      render: () => `
        <div class="studio-canvas-node" data-studio-type="btn_secondary" style="display: inline-block; margin-bottom: 0.5rem;">
          <button class="btn btn-outline-secondary" style="font-weight: 600; padding: 0.6rem 1.25rem; border-radius: 0.65rem; display: inline-flex; align-items: center; gap: 0.45rem;">
            <i class="bi bi-arrow-repeat"></i> <span class="studio-text">Atualizar Dados</span>
          </button>
        </div>
      `
    },

    'kpi_card': {
      name: 'Card de Métrica / KPI',
      icon: 'bi-speedometer2',
      category: 'components',
      render: () => `
        <div class="studio-canvas-node kpi-card" data-studio-type="kpi_card" style="background: #ffffff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; width: 100%;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(19, 79, 159, 0.1); color: var(--primary); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">
            <i class="bi bi-hospital"></i>
          </div>
          <div>
            <small class="studio-text" style="color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.04em;">Total de Leitos</small>
            <h2 class="studio-text" style="margin: 0; font-size: 1.75rem; font-weight: 800; color: #1e293b;">28 <span style="font-size: 0.85rem; font-weight: 600; color: #16a34a;">+2 hoje</span></h2>
          </div>
        </div>
      `
    },

    'intercorrencia_box': {
      name: 'Bloco de Intercorrências',
      icon: 'bi-card-checklist',
      category: 'components',
      render: () => `
        <div class="studio-canvas-node" data-studio-type="intercorrencia_box" style="background: #ffffff; border-radius: 1rem; padding: 1.25rem; border: 1px solid #e2e8f0; margin-bottom: 1rem; width: 100%;">
          <h4 class="studio-text" style="font-size: 0.95rem; font-weight: 800; color: var(--primary); margin-bottom: 0.85rem;">
            <i class="bi bi-pencil-square"></i> Registro de Ocorrências do Plantão
          </h4>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 0.85rem;">
            <label style="font-size: 0.82rem; font-weight: 600; color: #334155; display: flex; align-items: center; gap: 0.35rem;">
              <input type="checkbox" class="form-check-input" checked> Queda
            </label>
            <label style="font-size: 0.82rem; font-weight: 600; color: #334155; display: flex; align-items: center; gap: 0.35rem;">
              <input type="checkbox" class="form-check-input"> Jejum
            </label>
            <label style="font-size: 0.82rem; font-weight: 600; color: #334155; display: flex; align-items: center; gap: 0.35rem;">
              <input type="checkbox" class="form-check-input"> Broncoaspiração
            </label>
          </div>
          <textarea class="form-control" rows="3" placeholder="Digite as observações e ocorrências detalhadas..." style="border-radius: 0.65rem; font-size: 0.88rem;"></textarea>
        </div>
      `
    },

    'auditoria_nisa_card': {
      name: 'Auditoria Higiene das Mãos',
      icon: 'bi-clipboard2-pulse',
      category: 'components',
      render: () => `
        <div class="studio-canvas-node card-auditoria" data-studio-type="auditoria_nisa_card" style="background: #ffffff; border-radius: 1rem; padding: 1.25rem; border: 1px solid #e2e8f0; margin-bottom: 1rem; width: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <strong class="studio-text" style="color: var(--primary); font-size: 0.95rem;">Oportunidade 1: Antes de tocar o paciente</strong>
            <span class="badge bg-success-subtle text-success">Conforme</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem;">
            <button class="btn btn-sm btn-outline-primary active" style="font-weight: 700;">Álcool</button>
            <button class="btn btn-sm btn-outline-primary" style="font-weight: 700;">Sabonete</button>
            <button class="btn btn-sm btn-outline-danger" style="font-weight: 700;">Perdida</button>
          </div>
        </div>
      `
    },

    'tabela_conecta': {
      name: 'Tabela Formatada Conecta',
      icon: 'bi-table',
      category: 'components',
      render: () => `
        <div class="studio-canvas-node table-responsive" data-studio-type="tabela_conecta" style="background: #ffffff; border-radius: 1rem; padding: 1rem; border: 1px solid #e2e8f0; margin-bottom: 1.25rem; width: 100%;">
          <table class="table table-hover align-middle m-0" style="font-size: 0.88rem;">
            <thead style="background: rgba(19, 79, 159, 0.05); color: var(--primary);">
              <tr>
                <th style="font-weight: 800; border-radius: 0.5rem 0 0 0.5rem;">Paciente / Leito</th>
                <th style="font-weight: 800;">Admissão</th>
                <th style="font-weight: 800;">Especialidade</th>
                <th style="font-weight: 800;">Status</th>
                <th style="font-weight: 800; border-radius: 0 0.5rem 0.5rem 0;">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Ana Maria Ramos</strong><br><small class="text-muted">Leito 201</small></td>
                <td>20/08 08:30</td>
                <td>Clínica Médica</td>
                <td><span class="badge bg-success-subtle text-success">Estável</span></td>
                <td><button class="btn btn-sm btn-outline-primary"><i class="bi bi-eye"></i></button></td>
              </tr>
              <tr>
                <td><strong>Carlos Silva Ribeiro</strong><br><small class="text-muted">Leito 202</small></td>
                <td>20/08 11:15</td>
                <td>Cirurgia Geral</td>
                <td><span class="badge bg-warning-subtle text-warning-emphasis">Pendente Exame</span></td>
                <td><button class="btn btn-sm btn-outline-primary"><i class="bi bi-eye"></i></button></td>
              </tr>
            </tbody>
          </table>
        </div>
      `
    },

    'form_input': {
      name: 'Campo de Texto / Input',
      icon: 'bi-input-cursor-text',
      category: 'forms',
      render: () => `
        <div class="studio-canvas-node mb-3" data-studio-type="form_input" style="width: 100%;">
          <label class="form-label studio-text" style="font-size: 0.82rem; font-weight: 700; color: #475569;">Rótulo do Campo</label>
          <input type="text" class="form-control" placeholder="Digite o valor aqui..." style="border-radius: 0.65rem; font-size: 0.88rem;">
        </div>
      `
    },

    'form_select': {
      name: 'Menu Seleção / Dropdown',
      icon: 'bi-menu-button-wide',
      category: 'forms',
      render: () => `
        <div class="studio-canvas-node mb-3" data-studio-type="form_select" style="width: 100%;">
          <label class="form-label studio-text" style="font-size: 0.82rem; font-weight: 700; color: #475569;">Selecione a Opção</label>
          <select class="form-select" style="border-radius: 0.65rem; font-size: 0.88rem;">
            <option selected>Opção 1 (Padrão)</option>
            <option>Opção 2</option>
            <option>Opção 3</option>
          </select>
        </div>
      `
    },

    'modal_trigger_btn': {
      name: 'Botão Disparador de Modal',
      icon: 'bi-window-stack',
      category: 'modals',
      render: () => `
        <div class="studio-canvas-node" data-studio-type="modal_trigger_btn" data-modal-title="Atenção: Confirmação" data-modal-body="Deseja realmente executar esta ação no Conecta?" style="display: inline-block; margin-bottom: 0.5rem;">
          <button class="btn btn-warning" style="font-weight: 700; padding: 0.6rem 1.25rem; border-radius: 0.65rem; color: #1e293b; display: inline-flex; align-items: center; gap: 0.45rem;">
            <i class="bi bi-exclamation-triangle-fill"></i> <span class="studio-text">Abrir Modal de Aviso</span>
          </button>
        </div>
      `
    },

    'footer_conecta': {
      name: 'Footer Barra Inferior',
      icon: 'bi-layout-three-columns',
      category: 'layout',
      render: () => `
        <footer class="studio-canvas-node" data-studio-type="footer_conecta" style="background: #ffffff; border-radius: 1rem; padding: 1rem 1.5rem; border: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; margin-top: 1.5rem; width: 100%; box-shadow: 0 -4px 16px rgba(15, 23, 42, 0.04);">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <span style="font-size: 0.85rem; color: #64748b;"><strong>Conecta HEAL</strong> v2.1</span>
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <button class="btn btn-secondary btn-sm" style="border-radius: 0.5rem; font-weight: 600;">Cancelar</button>
            <button class="btn btn-primary btn-sm btn-save--highlight" style="border-radius: 0.5rem; font-weight: 700; background: var(--primary);"><i class="bi bi-check2"></i> Salvar</button>
          </div>
        </footer>
      `
    }
  };

  // --- INITIALIZATION ---
  document.addEventListener('DOMContentLoaded', async () => {
    initUrlParams();
    initPalette();
    initCanvasEvents();
    initInspector();
    initTopActions();
    await loadPageData();
  });

  function initUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const pageId = params.get('page');
    if (pageId) {
      state.pageId = pageId;
    }
  }

  // --- PALETTE RENDER & DRAG ---
  function initPalette() {
    const container = document.getElementById('palette-content');
    if (!container) return;

    const categories = {
      'layout': { title: 'Layout & Estrutura', icon: 'bi-grid-1x2' },
      'components': { title: 'Componentes Conecta', icon: 'bi-box-seam' },
      'forms': { title: 'Formulários & Entradas', icon: 'bi-ui-radios' },
      'modals': { title: 'Modais & Ações', icon: 'bi-window-fullscreen' }
    };

    let html = '';
    for (const [catKey, catInfo] of Object.entries(categories)) {
      const items = Object.entries(COMPONENT_DEFINITIONS).filter(([_, def]) => def.category === catKey);
      if (items.length === 0) continue;

      html += `
        <div class="studio-palette-section">
          <div class="studio-section-title"><i class="bi ${catInfo.icon}"></i> ${catInfo.title}</div>
          <div class="studio-components-grid">
            ${items.map(([typeKey, def]) => `
              <div class="studio-draggable-item" draggable="true" data-type="${typeKey}">
                <i class="bi ${def.icon}"></i>
                <span>${def.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    container.innerHTML = html;

    // Drag events from palette
    container.querySelectorAll('.studio-draggable-item').forEach(el => {
      el.addEventListener('dragstart', (e) => {
        state.draggedType = el.getAttribute('data-type');
        e.dataTransfer.setData('text/plain', state.draggedType);
        e.dataTransfer.effectAllowed = 'copy';
      });

      // Also 1-click to append
      el.addEventListener('click', () => {
        const type = el.getAttribute('data-type');
        appendComponentToCanvas(type);
      });
    });

    // Search filter
    const searchInput = document.getElementById('palette-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        container.querySelectorAll('.studio-draggable-item').forEach(item => {
          const text = item.innerText.toLowerCase();
          item.style.display = text.includes(term) ? 'flex' : 'none';
        });
      });
    }
  }

  // --- CANVAS & DROP EVENTS ---
  function initCanvasEvents() {
    const canvas = document.getElementById('studio-canvas-root');
    if (!canvas) return;

    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      highlightDropzone(e.target);
    });

    canvas.addEventListener('dragleave', (e) => {
      removeDropzoneHighlight();
    });

    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      removeDropzoneHighlight();
      const type = e.dataTransfer.getData('text/plain') || state.draggedType;
      if (type && COMPONENT_DEFINITIONS[type]) {
        insertComponentAtDrop(type, e.target);
        saveHistoryState();
      }
    });

    // Node selection
    canvas.addEventListener('click', (e) => {
      if (state.isPreview) {
        handlePreviewClick(e);
        return;
      }
      const node = e.target.closest('.studio-canvas-node');
      if (node) {
        e.stopPropagation();
        selectNode(node);
      } else {
        deselectNode();
      }
    });

    // Inline text editing
    canvas.addEventListener('dblclick', (e) => {
      if (state.isPreview) return;
      const textEl = e.target.closest('.studio-text, h1, h2, h3, h4, h5, p, span, small, strong, label, button');
      if (textEl) {
        textEl.setAttribute('contenteditable', 'true');
        textEl.focus();
        textEl.addEventListener('blur', () => {
          textEl.removeAttribute('contenteditable');
          saveHistoryState();
          syncInspectorWithSelectedNode();
        }, { once: true });
      }
    });
  }

  function highlightDropzone(target) {
    const zone = target.closest('.studio-child-zone, #studio-canvas-root');
    if (zone) {
      zone.classList.add('drag-over');
    }
  }

  function removeDropzoneHighlight() {
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  }

  function appendComponentToCanvas(type) {
    const canvas = document.getElementById('studio-canvas-root');
    if (!canvas || !COMPONENT_DEFINITIONS[type]) return;

    // Remove empty guide if present
    const emptyGuide = canvas.querySelector('.studio-empty-canvas-guide');
    if (emptyGuide) emptyGuide.remove();

    const targetContainer = state.selectedNode && state.selectedNode.querySelector('.studio-child-zone') 
      ? state.selectedNode.querySelector('.studio-child-zone') 
      : canvas;

    const temp = document.createElement('div');
    temp.innerHTML = COMPONENT_DEFINITIONS[type].render().trim();
    const newNode = temp.firstElementChild;

    targetContainer.appendChild(newNode);
    selectNode(newNode);
    saveHistoryState();
  }

  function insertComponentAtDrop(type, target) {
    const canvas = document.getElementById('studio-canvas-root');
    const emptyGuide = canvas.querySelector('.studio-empty-canvas-guide');
    if (emptyGuide) emptyGuide.remove();

    const temp = document.createElement('div');
    temp.innerHTML = COMPONENT_DEFINITIONS[type].render().trim();
    const newNode = temp.firstElementChild;

    const childZone = target.closest('.studio-child-zone');
    if (childZone) {
      childZone.appendChild(newNode);
    } else {
      const neighborNode = target.closest('.studio-canvas-node');
      if (neighborNode && neighborNode.parentNode) {
        neighborNode.parentNode.insertBefore(newNode, neighborNode.nextSibling);
      } else {
        canvas.appendChild(newNode);
      }
    }

    selectNode(newNode);
  }

  // --- SELECTION & FLOATING ACTIONS ---
  function selectNode(node) {
    deselectNode();
    state.selectedNode = node;
    node.classList.add('studio-selected');

    createFloatingActionBar(node);
    syncInspectorWithSelectedNode();
  }

  function deselectNode() {
    if (state.selectedNode) {
      state.selectedNode.classList.remove('studio-selected');
    }
    state.selectedNode = null;
    removeFloatingActionBar();
    resetInspector();
  }

  function createFloatingActionBar(node) {
    removeFloatingActionBar();
    const bar = document.createElement('div');
    bar.className = 'studio-floating-actions';
    bar.id = 'studio-floating-bar';

    const type = node.getAttribute('data-studio-type') || 'Elemento';
    const def = COMPONENT_DEFINITIONS[type];
    const label = def ? def.name : type;

    bar.innerHTML = `
      <span class="studio-node-tag">${label}</span>
      <button class="studio-action-btn" title="Mover para Cima" id="btn-node-up"><i class="bi bi-arrow-up"></i></button>
      <button class="studio-action-btn" title="Mover para Baixo" id="btn-node-down"><i class="bi bi-arrow-down"></i></button>
      <button class="studio-action-btn" title="Duplicar Bloco" id="btn-node-dup"><i class="bi bi-copy"></i></button>
      <button class="studio-action-btn delete-btn" title="Excluir" id="btn-node-del"><i class="bi bi-trash"></i></button>
    `;

    node.appendChild(bar);

    document.getElementById('btn-node-up').addEventListener('click', (e) => {
      e.stopPropagation();
      if (node.previousElementSibling) {
        node.parentNode.insertBefore(node, node.previousElementSibling);
        saveHistoryState();
      }
    });

    document.getElementById('btn-node-down').addEventListener('click', (e) => {
      e.stopPropagation();
      if (node.nextElementSibling) {
        node.parentNode.insertBefore(node.nextElementSibling, node);
        saveHistoryState();
      }
    });

    document.getElementById('btn-node-dup').addEventListener('click', (e) => {
      e.stopPropagation();
      const clone = node.cloneNode(true);
      clone.classList.remove('studio-selected');
      const oldBar = clone.querySelector('#studio-floating-bar');
      if (oldBar) oldBar.remove();
      node.parentNode.insertBefore(clone, node.nextSibling);
      selectNode(clone);
      saveHistoryState();
    });

    document.getElementById('btn-node-del').addEventListener('click', (e) => {
      e.stopPropagation();
      node.remove();
      deselectNode();
      saveHistoryState();
    });
  }

  function removeFloatingActionBar() {
    const existing = document.getElementById('studio-floating-bar');
    if (existing) existing.remove();
  }

  // --- INSPECTOR PANEL ---
  function initInspector() {
    // Tabs switcher
    document.querySelectorAll('.studio-inspector-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.studio-inspector-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.getAttribute('data-tab');
        document.querySelectorAll('.studio-inspector-tab-content').forEach(c => c.style.display = 'none');
        const target = document.getElementById(`inspector-tab-${tab}`);
        if (target) target.style.display = 'block';
      });
    });

    // Content inputs
    const textInput = document.getElementById('prop-text');
    if (textInput) {
      textInput.addEventListener('input', (e) => {
        if (!state.selectedNode) return;
        const textTarget = state.selectedNode.querySelector('.studio-text') || state.selectedNode;
        textTarget.innerText = e.target.value;
        saveHistoryState();
      });
    }

    // Style inputs
    const bgInput = document.getElementById('prop-bg');
    if (bgInput) {
      bgInput.addEventListener('input', (e) => {
        if (!state.selectedNode) return;
        state.selectedNode.style.backgroundColor = e.target.value;
        saveHistoryState();
      });
    }

    const radiusSelect = document.getElementById('prop-radius');
    if (radiusSelect) {
      radiusSelect.addEventListener('change', (e) => {
        if (!state.selectedNode) return;
        state.selectedNode.style.borderRadius = e.target.value;
        saveHistoryState();
      });
    }

    const shadowSelect = document.getElementById('prop-shadow');
    if (shadowSelect) {
      shadowSelect.addEventListener('change', (e) => {
        if (!state.selectedNode) return;
        state.selectedNode.style.boxShadow = e.target.value;
        saveHistoryState();
      });
    }

    const pulseToggle = document.getElementById('prop-pulse-toggle');
    if (pulseToggle) {
      pulseToggle.addEventListener('change', (e) => {
        if (!state.selectedNode) return;
        if (e.target.checked) {
          state.selectedNode.classList.add('btn-save--highlight');
        } else {
          state.selectedNode.classList.remove('btn-save--highlight');
        }
        saveHistoryState();
      });
    }

    // Modal props
    const modalTitle = document.getElementById('prop-modal-title');
    const modalBody = document.getElementById('prop-modal-body');
    if (modalTitle && modalBody) {
      const updateModalProps = () => {
        if (!state.selectedNode) return;
        state.selectedNode.setAttribute('data-modal-title', modalTitle.value);
        state.selectedNode.setAttribute('data-modal-body', modalBody.value);
        saveHistoryState();
      };
      modalTitle.addEventListener('input', updateModalProps);
      modalBody.addEventListener('input', updateModalProps);
    }
  }

  function syncInspectorWithSelectedNode() {
    if (!state.selectedNode) return;

    const textTarget = state.selectedNode.querySelector('.studio-text') || state.selectedNode;
    const textInput = document.getElementById('prop-text');
    if (textInput && textTarget) {
      textInput.value = textTarget.innerText.trim();
    }

    const pulseToggle = document.getElementById('prop-pulse-toggle');
    if (pulseToggle) {
      pulseToggle.checked = state.selectedNode.classList.contains('btn-save--highlight') || 
                            state.selectedNode.classList.contains('turno-bar--highlight');
    }

    const modalTitle = document.getElementById('prop-modal-title');
    const modalBody = document.getElementById('prop-modal-body');
    if (modalTitle) modalTitle.value = state.selectedNode.getAttribute('data-modal-title') || '';
    if (modalBody) modalBody.value = state.selectedNode.getAttribute('data-modal-body') || '';
  }

  function resetInspector() {
    const textInput = document.getElementById('prop-text');
    if (textInput) textInput.value = '';
    const pulseToggle = document.getElementById('prop-pulse-toggle');
    if (pulseToggle) pulseToggle.checked = false;
  }

  // --- PREVIEW INTERACTIVE MODE & MODALS ---
  function handlePreviewClick(e) {
    const modalTrigger = e.target.closest('[data-studio-type="modal_trigger_btn"], [data-modal-title]');
    if (modalTrigger) {
      const title = modalTrigger.getAttribute('data-modal-title') || 'Mensagem do Sistema';
      const body = modalTrigger.getAttribute('data-modal-body') || 'Operação realizada com sucesso!';
      showPreviewModal(title, body);
      return;
    }

    // Toggle checkboxes
    const cb = e.target.closest('input[type="checkbox"]');
    if (cb) {
      cb.checked = !cb.checked;
    }

    // Turno button active toggle
    const turnoBtn = e.target.closest('.turno-bar button');
    if (turnoBtn) {
      const parent = turnoBtn.closest('.turno-bar');
      parent.querySelectorAll('button').forEach(b => {
        b.classList.remove('btn-white', 'shadow-sm');
        b.style.background = 'transparent';
        b.style.color = '#64748b';
      });
      turnoBtn.classList.add('btn-white', 'shadow-sm');
      turnoBtn.style.background = '#ffffff';
      turnoBtn.style.color = 'var(--primary)';
    }
  }

  function showPreviewModal(title, body) {
    const modal = document.getElementById('studio-preview-dialog');
    if (!modal) return;
    document.getElementById('studio-dialog-title').innerText = title;
    document.getElementById('studio-dialog-body').innerText = body;
    modal.classList.add('open');
  }

  // --- HISTORY & UNDO/REDO ---
  function saveHistoryState() {
    const canvas = document.getElementById('studio-canvas-root');
    if (!canvas) return;

    // Clean floating bar from snapshot
    removeFloatingActionBar();

    const snapshot = canvas.innerHTML;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push(snapshot);
    state.historyIndex++;
    if (state.history.length > 40) {
      state.history.shift();
      state.historyIndex--;
    }
  }

  function undo() {
    if (state.historyIndex > 0) {
      state.historyIndex--;
      const canvas = document.getElementById('studio-canvas-root');
      canvas.innerHTML = state.history[state.historyIndex];
      deselectNode();
    }
  }

  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      const canvas = document.getElementById('studio-canvas-root');
      canvas.innerHTML = state.history[state.historyIndex];
      deselectNode();
    }
  }

  // --- TOPBAR ACTIONS ---
  function initTopActions() {
    // Device switch
    document.querySelectorAll('.studio-device-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.studio-device-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.getAttribute('data-view');
        const viewport = document.getElementById('studio-viewport');
        viewport.className = `studio-viewport view-${view}`;
      });
    });

    // Undo / Redo
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.addEventListener('click', undo);
    if (btnRedo) btnRedo.addEventListener('click', redo);

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    });

    // Preview Toggle
    const btnPreview = document.getElementById('btn-preview-toggle');
    if (btnPreview) {
      btnPreview.addEventListener('click', () => {
        state.isPreview = !state.isPreview;
        document.body.classList.toggle('preview-active', state.isPreview);
        btnPreview.classList.toggle('active', state.isPreview);
        btnPreview.innerHTML = state.isPreview 
          ? '<i class="bi bi-pencil-square"></i> Modo Edição' 
          : '<i class="bi bi-eye"></i> Modo Teste / Preview';
        if (state.isPreview) deselectNode();
      });
    }

    // Export HTML Modal
    const btnExport = document.getElementById('btn-export-html');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        removeFloatingActionBar();
        const canvas = document.getElementById('studio-canvas-root');
        const clone = canvas.cloneNode(true);
        // Clean studio helper classes
        clone.querySelectorAll('.studio-selected, .drag-over').forEach(el => el.classList.remove('studio-selected', 'drag-over'));
        const htmlCode = clone.innerHTML.trim();
        
        document.getElementById('code-output-html').innerText = htmlCode;
        document.getElementById('studio-code-modal').classList.add('open');
      });
    }

    // Copy Code button
    const btnCopy = document.getElementById('btn-copy-code');
    if (btnCopy) {
      btnCopy.addEventListener('click', () => {
        const text = document.getElementById('code-output-html').innerText;
        navigator.clipboard.writeText(text).then(() => {
          btnCopy.innerHTML = '<i class="bi bi-check2"></i> Copiado com Sucesso!';
          setTimeout(() => { btnCopy.innerHTML = '<i class="bi bi-clipboard"></i> Copiar Código HTML'; }, 2000);
        });
      });
    }

    // Save Button
    const btnSave = document.getElementById('btn-save-page');
    if (btnSave) {
      btnSave.addEventListener('click', savePageData);
    }

    // Modal Close buttons
    document.querySelectorAll('.studio-modal-close, [data-modal-dismiss]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.studio-modal-overlay').forEach(m => m.classList.remove('open'));
      });
    });

    // Page Name Input sync
    const pageNameInput = document.getElementById('studio-page-name');
    if (pageNameInput) {
      pageNameInput.addEventListener('input', (e) => {
        state.pageData.nome = e.target.value;
      });
    }
  }

  // --- DEFAULT TEMPLATES ---
  const DEFAULT_TEMPLATES = {
    'passagem': () => `
      ${COMPONENT_DEFINITIONS['topbar'].render()}
      <div class="row g-3" style="width: 100%; margin-bottom: 1.25rem;">
        <div class="col-md-3">
          <div class="card p-3 shadow-sm border-0 studio-canvas-node" style="border-radius: 1rem; background: #ffffff;">
            <h5 class="studio-text" style="font-weight: 800; color: var(--primary); font-size: 0.95rem; margin-bottom: 0.85rem;">
              <i class="bi bi-hospital"></i> Setores
            </h5>
            <div class="list-group list-group-flush small">
              <a href="#" class="list-group-item list-group-item-action active" style="border-radius: 0.5rem; font-weight: 700; background: var(--primary);"><i class="bi bi-geo-alt"></i> Setor de Internação 1</a>
              <a href="#" class="list-group-item list-group-item-action" style="border-radius: 0.5rem; font-weight: 600;"><i class="bi bi-geo-alt"></i> U.T.I. Geral</a>
              <a href="#" class="list-group-item list-group-item-action" style="border-radius: 0.5rem; font-weight: 600;"><i class="bi bi-geo-alt"></i> Centro Cirúrgico</a>
            </div>
          </div>
        </div>
        <div class="col-md-9">
          <div class="row g-3 mb-3">
            <div class="col-md-4">${COMPONENT_DEFINITIONS['kpi_card'].render()}</div>
            <div class="col-md-4">${COMPONENT_DEFINITIONS['kpi_card'].render()}</div>
            <div class="col-md-4">${COMPONENT_DEFINITIONS['kpi_card'].render()}</div>
          </div>
          ${COMPONENT_DEFINITIONS['card_paciente'].render()}
          ${COMPONENT_DEFINITIONS['card_paciente'].render()}
          ${COMPONENT_DEFINITIONS['intercorrencia_box'].render()}
        </div>
      </div>
      ${COMPONENT_DEFINITIONS['footer_conecta'].render()}
    `,

    'dashboard_pa': () => `
      ${COMPONENT_DEFINITIONS['topbar'].render()}
      <div class="row g-3 mb-3" style="width: 100%;">
        <div class="col-md-4">${COMPONENT_DEFINITIONS['kpi_card'].render()}</div>
        <div class="col-md-4">${COMPONENT_DEFINITIONS['kpi_card'].render()}</div>
        <div class="col-md-4">${COMPONENT_DEFINITIONS['kpi_card'].render()}</div>
      </div>
      ${COMPONENT_DEFINITIONS['tabela_conecta'].render()}
      ${COMPONENT_DEFINITIONS['footer_conecta'].render()}
    `,

    'pacientes': () => `
      ${COMPONENT_DEFINITIONS['topbar'].render()}
      <div class="row g-3" style="width: 100%; margin-bottom: 1.25rem;">
        <div class="col-md-4">${COMPONENT_DEFINITIONS['card_paciente'].render()}</div>
        <div class="col-md-4">${COMPONENT_DEFINITIONS['card_paciente'].render()}</div>
        <div class="col-md-4">${COMPONENT_DEFINITIONS['card_paciente'].render()}</div>
      </div>
      ${COMPONENT_DEFINITIONS['footer_conecta'].render()}
    `,

    'auditorias': () => `
      ${COMPONENT_DEFINITIONS['topbar'].render()}
      ${COMPONENT_DEFINITIONS['panel_white'].render()}
      ${COMPONENT_DEFINITIONS['auditoria_nisa_card'].render()}
      ${COMPONENT_DEFINITIONS['footer_conecta'].render()}
    `,

    'livro': () => `
      ${COMPONENT_DEFINITIONS['topbar'].render()}
      ${COMPONENT_DEFINITIONS['panel_white'].render()}
      ${COMPONENT_DEFINITIONS['intercorrencia_box'].render()}
      ${COMPONENT_DEFINITIONS['footer_conecta'].render()}
    `,

    'escala': () => `
      ${COMPONENT_DEFINITIONS['topbar'].render()}
      ${COMPONENT_DEFINITIONS['tabela_conecta'].render()}
      ${COMPONENT_DEFINITIONS['footer_conecta'].render()}
    `
  };

  // --- SAVE & LOAD FROM BACKEND ---
  async function loadPageData() {
    const canvas = document.getElementById('studio-canvas-root');
    const pageNameInput = document.getElementById('studio-page-name');
    const pageBadge = document.getElementById('studio-page-badge');

    if (!state.pageId) {
      // Blank new page
      state.pageData = {
        id: 'tela_custom_' + Date.now(),
        nome: 'Nova Tela Conecta',
        descricao: 'Página criada no Conecta Studio',
        categoria: 'custom',
        is_native: 0
      };
      if (pageNameInput) pageNameInput.value = state.pageData.nome;
      if (pageBadge) pageBadge.innerText = 'Personalizada';
      saveHistoryState();
      return;
    }

    try {
      const res = await fetch(`/api/admin/studio/pages/${state.pageId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          state.pageData = json.data;
          if (pageNameInput) pageNameInput.value = state.pageData.nome;
          if (pageBadge) pageBadge.innerText = state.pageData.is_native ? 'Nativa do Sistema' : 'Personalizada';

          if (state.pageData.html_output && state.pageData.html_output.trim()) {
            canvas.innerHTML = state.pageData.html_output;
          } else if (DEFAULT_TEMPLATES[state.pageId]) {
            canvas.innerHTML = DEFAULT_TEMPLATES[state.pageId]().trim();
          } else if (state.pageData.layout_json) {
            renderLayoutFromJson(state.pageData.layout_json);
          }
          saveHistoryState();
          return;
        }
      }
    } catch (err) {
      console.warn('[Studio] Erro ao carregar tela do backend, verificando fallback local:', err);
    }

    // Fallback: Default template or localStorage
    if (DEFAULT_TEMPLATES[state.pageId]) {
      canvas.innerHTML = DEFAULT_TEMPLATES[state.pageId]().trim();
    } else {
      const local = localStorage.getItem(`conecta_studio_${state.pageId}`);
      if (local) {
        try {
          const parsed = JSON.parse(local);
          state.pageData = parsed;
          if (pageNameInput) pageNameInput.value = parsed.nome;
          canvas.innerHTML = parsed.html_output || '';
        } catch (e) {}
      }
    }
    saveHistoryState();
  }

  function renderLayoutFromJson(layoutStr) {
    const canvas = document.getElementById('studio-canvas-root');
    try {
      const layout = typeof layoutStr === 'string' ? JSON.parse(layoutStr) : layoutStr;
      if (layout && layout.components && Array.isArray(layout.components)) {
        canvas.innerHTML = '';
        layout.components.forEach(comp => {
          const typeKey = comp.type;
          if (COMPONENT_DEFINITIONS[typeKey]) {
            const temp = document.createElement('div');
            temp.innerHTML = COMPONENT_DEFINITIONS[typeKey].render().trim();
            canvas.appendChild(temp.firstElementChild);
          }
        });
      }
    } catch (e) {
      console.error('[Studio] Erro ao interpretar layout_json:', e);
    }
  }

  async function savePageData() {
    const btnSave = document.getElementById('btn-save-page');
    const canvas = document.getElementById('studio-canvas-root');
    removeFloatingActionBar();

    const clone = canvas.cloneNode(true);
    clone.querySelectorAll('.studio-selected, .drag-over').forEach(el => el.classList.remove('studio-selected', 'drag-over'));
    const htmlOutput = clone.innerHTML.trim();

    state.pageData.html_output = htmlOutput;
    state.pageData.layout_json = JSON.stringify({
      version: '1.0',
      id: state.pageData.id,
      nome: state.pageData.nome,
      updated_at: new Date().toISOString()
    });

    btnSave.innerHTML = '<i class="bi bi-arrow-repeat spin"></i> Salvando...';

    try {
      const res = await fetch(`/api/admin/studio/pages/${state.pageData.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state.pageData)
      });

      if (res.ok) {
        btnSave.innerHTML = '<i class="bi bi-check-circle-fill"></i> Salvo com Sucesso!';
      } else {
        btnSave.innerHTML = '<i class="bi bi-check-circle-fill"></i> Salvo Localmente!';
      }
    } catch (e) {
      btnSave.innerHTML = '<i class="bi bi-check-circle-fill"></i> Salvo Localmente!';
    }

    // Local storage backup
    localStorage.setItem(`conecta_studio_${state.pageData.id}`, JSON.stringify(state.pageData));

    setTimeout(() => {
      btnSave.innerHTML = '<i class="bi bi-floppy2-fill"></i> Salvar Tela';
    }, 2200);
  }

})();
