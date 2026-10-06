/**
 * ============================================================================
 * CONECTA STUDIO — BUILDER JS
 * Editor Visual Drag-and-Drop estilo WIX para Conecta HEAL
 * 100% Fidelidade Visual, Drag-to-Resize & Editor de Código HTML/CSS Live
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
      is_native: 0,
      custom_css: ''
    },
    selectedNode: null,
    history: [],
    historyIndex: -1,
    isPreview: false,
    draggedType: null,
    viewMode: 'visual', // 'visual', 'split', 'code'
    activeCodeTab: 'html-all', // 'html-all', 'html-selected', 'css-custom'
    customCss: '',
    isResizing: false
  };

  // --- COMPONENT TEMPLATES (CONECTA DESIGN SYSTEM) ---
  const COMPONENT_DEFINITIONS = {
    'topbar': {
      name: 'Topbar Conecta',
      icon: 'bi-window-dock',
      category: 'layout',
      render: () => `
        <header class="topbar studio-canvas-node" data-studio-type="topbar" style="border-radius: 0.75rem; margin-bottom: 1.25rem; width: 100%;">
          <div class="topbar-left" style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <i class="bi bi-heart-pulse" style="font-size: 1.4rem; color: #ffffff;"></i>
            <span class="topbar-title" style="font-weight: 800; font-size: 1.15rem; color: #ffffff;">Conecta HEAL</span>
          </div>
          <div class="topbar-nav" style="display: flex; gap: 4px;">
            <button class="topbar-nav-item active" style="padding: 6px 14px; border-radius: 6px; font-weight: 700; background: rgba(255,255,255,0.15); color: #ffffff; border: 0;">Passagem de Plantão</button>
            <button class="topbar-nav-item" style="padding: 6px 14px; border-radius: 6px; font-weight: 600; background: transparent; color: rgba(255,255,255,0.8); border: 0;">Livro Administrativo</button>
            <button class="topbar-nav-item" style="padding: 6px 14px; border-radius: 6px; font-weight: 600; background: transparent; color: rgba(255,255,255,0.8); border: 0;">Pronto Atendimento</button>
          </div>
          <div class="topbar-right" style="display: flex; align-items: center; gap: 10px;">
            <span class="user-badge" style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.1); padding: 0.35rem 0.85rem; border-radius: 999px; color: #ffffff;">
              <i class="bi bi-person-circle" style="font-size: 1.1rem;"></i>
              <span style="font-size: 0.82rem; font-weight: 700;">Alexandre Miranda</span>
            </span>
            <button class="btn-logout" style="background: transparent; border: 0; color: rgba(255,255,255,0.7); font-size: 1.1rem; cursor: pointer;">
              <i class="bi bi-box-arrow-right"></i>
            </button>
          </div>
        </header>
      `
    },

    'panel_white': {
      name: 'Painel Branco Conecta',
      icon: 'bi-square',
      category: 'layout',
      render: () => `
        <div class="studio-canvas-node card-conecta studio-container-drop" data-studio-type="panel_white" style="background: #ffffff; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05); margin-bottom: 1.25rem; width: 100%; border: 1px solid #e2e8f0;">
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
      name: 'Card de Paciente Real',
      icon: 'bi-person-badge',
      category: 'components',
      render: (nome = 'Maria Aparecida Santos', leito = 'Leito 101-A', reg = '94821', diag = 'Pós-operatório imediato de Artroplastia Total de Quadril') => `
        <div class="studio-canvas-node paciente-card" data-studio-type="card_paciente" style="background: #ffffff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.06); border: 1px solid #e2e8f0; margin-bottom: 1rem; width: 100%;">
          <div class="paciente-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span class="leito-badge" style="background: var(--primary); color: #ffffff; font-weight: 800; font-size: 0.85rem; padding: 0.35rem 0.75rem; border-radius: 0.5rem;">
                ${leito}
              </span>
              <div>
                <strong class="studio-text" style="font-size: 1.05rem; color: #1e293b; display: block;">${nome}</strong>
                <small class="text-muted" style="font-size: 0.75rem;">Reg: ${reg} · Idade: 58 anos · Sexo: Feminino</small>
              </div>
            </div>
            <div style="display: flex; gap: 4px;">
              <span class="badge bg-danger-subtle text-danger" style="font-weight: 700; font-size: 0.76rem;">
                <i class="bi bi-exclamation-triangle-fill"></i> Risco Queda
              </span>
              <span class="badge bg-primary-subtle text-primary" style="font-weight: 700; font-size: 0.76rem;">Estável</span>
            </div>
          </div>
          <div class="paciente-body" style="font-size: 0.88rem; line-height: 1.45; color: #475569; margin-bottom: 0.75rem;">
            <p class="m-0 mb-1"><strong>Diagnóstico:</strong> <span class="studio-text">${diag}</span></p>
            <p class="m-0" style="color: #64748b; font-size: 0.82rem;"><strong>Prescrição:</strong> Cefazolina 1g EV 8/8h · Dipirona 1g EV se dor · Enoxaparina 40mg SC</p>
          </div>
          <div class="paciente-tags" style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem;">
            <span class="badge" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;"><i class="bi bi-droplet"></i> Acesso Venoso</span>
            <span class="badge" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;"><i class="bi bi-activity"></i> Dreno Portovac</span>
            <span class="badge" style="background: #fef2f2; color: #991b1b; border: 1px solid #fecaca;"><i class="bi bi-shield-exclamation"></i> Jejum</span>
          </div>
          <div class="paciente-intercorrencia" style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 0.5rem; padding: 0.65rem;">
            <label style="font-weight: 700; font-size: 0.78rem; color: #475569; display: flex; align-items: center; gap: 4px; margin-bottom: 4px;">
              <i class="bi bi-chat-left-dots text-primary"></i> Intercorrência do Plantão
            </label>
            <textarea class="form-control form-control-sm" rows="2" placeholder="Descreva intercorrências deste paciente no plantão..." style="font-size: 0.82rem; background: #ffffff;"></textarea>
          </div>
        </div>
      `
    },

    'turno_bar': {
      name: 'Barra de Turno Dinâmica',
      icon: 'bi-sun-fill',
      category: 'components',
      render: () => `
        <div class="studio-canvas-node turno-bar" data-studio-type="turno_bar" style="display: inline-flex; align-items: center; background: rgba(19, 79, 159, 0.08); padding: 4px; border-radius: 999px; margin-bottom: 1rem;">
          <button type="button" class="btn btn-sm btn-white shadow-sm" style="border-radius: 999px; font-weight: 700; color: var(--primary); background: #ffffff; padding: 0.4rem 1.15rem; border: 0;">
            <i class="bi bi-sun-fill text-warning"></i> Dia (07h às 19h)
          </button>
          <button type="button" class="btn btn-sm" style="border-radius: 999px; font-weight: 600; color: #64748b; padding: 0.4rem 1.15rem; border: 0; background: transparent;">
            <i class="bi bi-moon-stars-fill text-primary"></i> Noite (19h às 07h)
          </button>
        </div>
      `
    },

    'kpi_card': {
      name: 'Card de Métrica / KPI',
      icon: 'bi-speedometer2',
      category: 'components',
      render: (label = 'Total Pacientes', val = '24', icon = 'bi-people-fill', color = 'var(--primary)') => `
        <div class="studio-canvas-node kpi-card" data-studio-type="kpi_card" style="background: #ffffff; border-radius: 1rem; padding: 1.15rem; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0; display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; width: 100%;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(19, 79, 159, 0.1); color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
            <i class="bi ${icon}"></i>
          </div>
          <div>
            <span class="studio-text text-muted small" style="font-size: 0.78rem; text-transform: uppercase; font-weight: 700;">${label}</span>
            <h3 class="studio-text m-0" style="font-size: 1.55rem; font-weight: 800; color: #1e293b;">${val}</h3>
          </div>
        </div>
      `
    },

    'intercorrencia_box': {
      name: 'Bloco de Intercorrências',
      icon: 'bi-exclamation-diamond',
      category: 'components',
      render: () => `
        <div class="studio-canvas-node intercorrencia-box" data-studio-type="intercorrencia_box" style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 1rem; padding: 1.25rem; margin-bottom: 1rem; width: 100%;">
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; color: #b45309;">
            <i class="bi bi-exclamation-triangle-fill" style="font-size: 1.1rem;"></i>
            <strong class="studio-text" style="font-size: 0.95rem;">Registro de Ocorrências e Pendências do Plantão</strong>
          </div>
          <textarea class="form-control" rows="3" placeholder="Digite intercorrências gerais, intercorrências do setor ou recados para o próximo turno..." style="background: #ffffff; font-size: 0.88rem;"></textarea>
        </div>
      `
    },

    'auditoria_nisa_card': {
      name: 'Card Auditoria NISA (3 Colunas)',
      icon: 'bi-clipboard2-pulse',
      category: 'components',
      render: () => `
        <div class="studio-canvas-node auditoria-card" data-studio-type="auditoria_nisa_card" style="background: #ffffff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0; margin-bottom: 1rem; width: 100%;">
          <h5 class="studio-text" style="font-weight: 800; color: var(--primary); font-size: 0.95rem; margin-bottom: 0.85rem;">
            1. Antes do contato com o paciente
          </h5>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
            <button class="btn btn-outline-primary btn-sm" style="border-radius: 0.5rem; font-weight: 700;">Álcool</button>
            <button class="btn btn-outline-info btn-sm" style="border-radius: 0.5rem; font-weight: 700;">Sabonete</button>
            <button class="btn btn-outline-danger btn-sm" style="border-radius: 0.5rem; font-weight: 700;">Perdida</button>
          </div>
        </div>
      `
    },

    'tabela_conecta': {
      name: 'Tabela Padrão Conecta',
      icon: 'bi-table',
      category: 'components',
      render: () => `
        <div class="studio-canvas-node table-responsive" data-studio-type="tabela_conecta" style="background: #ffffff; border-radius: 1rem; padding: 1rem; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0; margin-bottom: 1.25rem; width: 100%;">
          <table class="table table-hover align-middle m-0" style="font-size: 0.85rem;">
            <thead class="table-light">
              <tr>
                <th style="font-weight: 700; color: var(--primary);">Paciente / Leito</th>
                <th style="font-weight: 700; color: var(--primary);">Hora Chegada</th>
                <th style="font-weight: 700; color: var(--primary);">Classificação</th>
                <th style="font-weight: 700; color: var(--primary);">Médico Responsável</th>
                <th style="font-weight: 700; color: var(--primary);">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Ana Paula Ferreira</strong><br><small class="text-muted">Leito 204</small></td>
                <td>14:32</td>
                <td><span class="badge bg-danger">Manchester Vermelho</span></td>
                <td>Dr. Marcelo Tavares</td>
                <td><span class="badge bg-warning-subtle text-warning-emphasis">Em Atendimento</span></td>
              </tr>
              <tr>
                <td><strong>Roberto Albuquerque</strong><br><small class="text-muted">Leito 206</small></td>
                <td>15:10</td>
                <td><span class="badge bg-warning text-dark">Manchester Amarelo</span></td>
                <td>Dra. Camila Nogueira</td>
                <td><span class="badge bg-success-subtle text-success">Aguardando Exame</span></td>
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
          <label class="studio-text form-label" style="font-weight: 700; font-size: 0.85rem; color: #475569;">Nome do Campo <span class="text-danger">*</span></label>
          <input type="text" class="form-control" placeholder="Digite aqui..." style="border-radius: 0.5rem; font-size: 0.88rem;">
        </div>
      `
    },

    'form_select': {
      name: 'Campo de Seleção / Dropdown',
      icon: 'bi-menu-button-wide',
      category: 'forms',
      render: () => `
        <div class="studio-canvas-node mb-3" data-studio-type="form_select" style="width: 100%;">
          <label class="studio-text form-label" style="font-weight: 700; font-size: 0.85rem; color: #475569;">Selecione uma Opção</label>
          <select class="form-select" style="border-radius: 0.5rem; font-size: 0.88rem;">
            <option value="">Selecione...</option>
            <option value="1">Opção Principal 1</option>
            <option value="2">Opção Principal 2</option>
          </select>
        </div>
      `
    },

    'modal_trigger_btn': {
      name: 'Botão Disparador de Modal',
      icon: 'bi-chat-square-dots-fill',
      category: 'forms',
      render: () => `
        <div class="studio-canvas-node" data-studio-type="modal_trigger_btn" data-modal-title="Atenção: Ação Necessária" data-modal-body="Esta ação requer confirmação do usuário." style="display: inline-block; margin-bottom: 0.5rem;">
          <button class="btn btn-warning" style="font-weight: 700; padding: 0.6rem 1.25rem; border-radius: 0.65rem; display: inline-flex; align-items: center; gap: 0.45rem;">
            <i class="bi bi-chat-square-text-fill"></i> <span class="studio-text">Abrir Modal de Aviso</span>
          </button>
        </div>
      `
    },

    'footer_conecta': {
      name: 'Rodapé Fixo Conecta com Turno',
      icon: 'bi-layout-text-sidebar-reverse',
      category: 'layout',
      render: () => `
        <div class="studio-canvas-node main-footer" data-studio-type="footer_conecta" style="background: #ffffff; border-top: 1px solid #e2e8f0; padding: 0.85rem 1.5rem; border-radius: 0.75rem; display: flex; align-items: center; justify-content: space-between; width: 100%; box-shadow: 0 -2px 10px rgba(0,0,0,0.03); margin-top: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
          <div class="main-footer-left">
            <span style="font-size: 0.85rem; color: #64748b; font-weight: 600;">
              <strong style="color: var(--primary);">3</strong> paciente(s) · <strong style="color: var(--primary);">1</strong> intercorrência(s)
            </span>
          </div>
          <div class="main-footer-center" style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="font-weight: 700; font-size: 0.85rem; color: #334155;"><i class="bi bi-clock-history text-primary"></i> Plantão:</span>
            <div class="turno-options" style="display: inline-flex; background: rgba(19, 79, 159, 0.08); padding: 3px; border-radius: 999px;">
              <button class="btn btn-sm btn-white shadow-sm" style="border-radius: 999px; font-weight: 700; color: var(--primary); background: #ffffff; border: 0; padding: 0.25rem 0.85rem;">Dia (07h às 19h)</button>
              <button class="btn btn-sm" style="border-radius: 999px; font-weight: 600; color: #64748b; background: transparent; border: 0; padding: 0.25rem 0.85rem;">Noite (19h às 07h)</button>
            </div>
          </div>
          <div class="main-footer-right" style="display: flex; gap: 0.5rem;">
            <button class="btn btn-outline-secondary btn-sm" style="border-radius: 0.5rem; font-weight: 600;"><i class="bi bi-trash3"></i> Limpar Tela</button>
            <button class="btn btn-save btn-save--highlight btn-sm" style="background: linear-gradient(145deg, var(--primary), var(--primary-light)); color: #ffffff; font-weight: 700; border-radius: 0.5rem; border: 0; padding: 0.4rem 1rem;">
              <i class="bi bi-check-circle"></i> Salvar / Finalizar Passagem
            </button>
          </div>
        </div>
      `
    }
  };

  // --- 100% AUTHENTIC NATIVE SCREENS ---
  const DEFAULT_TEMPLATES = {
  'passagem': () => `
<div class="screen active studio-canvas-node" data-studio-type="screen" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">
<nav class="topbar studio-canvas-node" data-studio-type="topbar">
      <div class="topbar-left" id="topbar-brand" title="Voltar ao menu">
        <i class="bi bi-heart-pulse"></i>
        <span class="topbar-title">Conecta HEAL</span>
      </div>
      <div class="topbar-nav d-none" id="topbar-nav" aria-label="Módulos do sistema">
        <button class="topbar-nav-item" id="nav-passagem" type="button">Passagem de Plantão</button>
        <button class="topbar-nav-item" id="nav-livro" type="button">Livro Administrativo</button>
        <button class="topbar-nav-item" id="nav-escala" type="button">Gestão de Escalas</button>
        <button class="topbar-nav-item" id="nav-dashboard" type="button">Dashboard de Pacientes</button>
        <button class="topbar-nav-item" id="nav-dashboard-pa" type="button">Pronto Atendimento</button>
        <button class="topbar-nav-item" id="nav-auditorias" type="button">Auditorias</button>
      </div>
      <div class="topbar-right">
        <div class="user-dropdown-container" id="user-dropdown-container">
          <button class="user-badge user-badge-clickable" id="user-display" type="button" aria-haspopup="true" aria-expanded="false" title="Alternar perfil">
            <i class="bi bi-person-circle"></i>
            <span class="user-copy">
              <strong id="user-name"></strong>
              <small id="user-profile-label">Perfil assistencial</small>
            </span>
            <i class="bi bi-chevron-down user-badge-chevron"></i>
          </button>
          <div class="user-profile-menu d-none" id="user-profile-menu" role="menu">
            <div class="user-profile-menu-header">
              <i class="bi bi-person-badge"></i> Alternar Perfil
            </div>
            <div class="user-profile-menu-list" id="user-profile-menu-list">
              <!-- Perfis renderizados dinamicamente -->
            </div>
            <button class="user-profile-menu-admin d-none" id="nav-admin" type="button" title="Painel de Administração" aria-label="Administração">
              <i class="bi bi-gear-fill"></i> Painel de Administração
            </button>
          </div>
        </div>
        <button class="btn-logout" id="btn-logout" title="Sair">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </nav>
<div class="app-container " id="workspace-passagem" class="app-container studio-canvas-node active" data-studio-type="app_container">
      <aside class="sidebar" id="sidebar-setores">
        <div class="sidebar-header" style="justify-content: flex-start; gap: 12px;">
          <button class="livro-page-back" id="btn-voltar-passagem-principal" type="button" aria-label="Voltar">
            <i class="bi bi-arrow-left"></i>
          </button>
          <h3 style="margin: 0;"><i class="bi bi-building"></i> Setores</h3>
        </div>
        <div class="sidebar-body" id="setores-list">
          <div class="loading-placeholder">
            <i class="bi bi-arrow-repeat spin"></i> Carregando setores...
          </div>
        </div>
      </aside>

      <button class="sidebar-backdrop " id="sidebar-backdrop" type="button" aria-label="Fechar menu de setores"></button>

      <button class="sidebar-toggle-btn " id="btn-expand-sidebar" type="button" title="Abrir setores" aria-controls="sidebar-setores" aria-expanded="false" aria-label="Abrir setores">
        <i class="bi bi-chevron-right"></i>
      </button>

      <main class="main-content studio-child-zone" id="main-area">
        <div id="pacientes-area" class="pacientes-area">
          <header class="livro-page-header" id="passagem-page-header">
            <div class="livro-page-heading">
              <button class="livro-page-back" id="btn-passagem-voltar-header" type="button" aria-label="Voltar ao menu de Passagem de Plantão">
                <i class="bi bi-arrow-left"></i>
              </button>
              <span class="livro-page-icon"><i class="bi bi-arrow-left-right"></i></span>
              <div>
                <span class="livro-page-eyebrow">Passagem de Plantão</span>
                <h2>Lançar nova passagem</h2>
                <p id="passagem-context">Selecione o setor e o turno para carregar os pacientes.</p>
              </div>
            </div>
          </header>
          <div class="empty-state d-none" id="empty-state">
            <div class="empty-icon">
              <i class="bi bi-arrow-left-circle"></i>
            </div>
            <h4>Selecione um setor</h4>
            <p>Escolha um setor na barra lateral para carregar os pacientes.</p>
          </div>
          <div id="pacientes-list" class="pacientes-list "></div>
        </div>

        <div class="main-footer " id="main-footer">
          <div class="main-footer-left">
            <div class="footer-info">
              <span id="pacientes-count">0</span> paciente(s) · <span id="intercorrencias-count">0</span> intercorrência(s)
            </div>
          </div>

          <div class="main-footer-center" id="main-footer-turno-wrapper">
            <div class="turno-label" id="turno-label-dinamico">
              <i class="bi bi-clock-history"></i> Plantão: <span class="required-star">*</span>
            </div>
            <div class="turno-options" id="turno-options-dinamico">
              <!-- As opções de turno serão injetadas via JS baseado no perfil -->
            </div>
          </div>

          <div class="main-footer-right">
            <button class="btn-clear-patients" id="btn-clear-patients" type="button" title="Limpar pacientes da tela">
              <i class="bi bi-trash3"></i> Limpar Tela
            </button>
            <button class="btn-save" id="btn-salvar" type="button">
              <i class="bi bi-check-circle"></i> Salvar / Finalizar Passagem
            </button>
          </div>
        </div>
      </main>
    </div>
</div>
`,
  'dashboard_pa': () => `
<div class="screen active studio-canvas-node" data-studio-type="screen" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">
<nav class="topbar studio-canvas-node" data-studio-type="topbar">
      <div class="topbar-left" id="topbar-brand" title="Voltar ao menu">
        <i class="bi bi-heart-pulse"></i>
        <span class="topbar-title">Conecta HEAL</span>
      </div>
      <div class="topbar-nav d-none" id="topbar-nav" aria-label="Módulos do sistema">
        <button class="topbar-nav-item" id="nav-passagem" type="button">Passagem de Plantão</button>
        <button class="topbar-nav-item" id="nav-livro" type="button">Livro Administrativo</button>
        <button class="topbar-nav-item" id="nav-escala" type="button">Gestão de Escalas</button>
        <button class="topbar-nav-item" id="nav-dashboard" type="button">Dashboard de Pacientes</button>
        <button class="topbar-nav-item" id="nav-dashboard-pa" type="button">Pronto Atendimento</button>
        <button class="topbar-nav-item" id="nav-auditorias" type="button">Auditorias</button>
      </div>
      <div class="topbar-right">
        <div class="user-dropdown-container" id="user-dropdown-container">
          <button class="user-badge user-badge-clickable" id="user-display" type="button" aria-haspopup="true" aria-expanded="false" title="Alternar perfil">
            <i class="bi bi-person-circle"></i>
            <span class="user-copy">
              <strong id="user-name"></strong>
              <small id="user-profile-label">Perfil assistencial</small>
            </span>
            <i class="bi bi-chevron-down user-badge-chevron"></i>
          </button>
          <div class="user-profile-menu d-none" id="user-profile-menu" role="menu">
            <div class="user-profile-menu-header">
              <i class="bi bi-person-badge"></i> Alternar Perfil
            </div>
            <div class="user-profile-menu-list" id="user-profile-menu-list">
              <!-- Perfis renderizados dinamicamente -->
            </div>
            <button class="user-profile-menu-admin d-none" id="nav-admin" type="button" title="Painel de Administração" aria-label="Administração">
              <i class="bi bi-gear-fill"></i> Painel de Administração
            </button>
          </div>
        </div>
        <button class="btn-logout" id="btn-logout" title="Sair">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </nav>
<section class="dashboard-workspace " id="workspace-dashboard" class="app-container studio-canvas-node active" data-studio-type="app_container">
      <div class="dashboard-header-panel">
        <div class="dashboard-header-main">
          <div class="dashboard-brand">
            <div class="dashboard-logo">
              <i class="bi bi-heart-pulse"></i>
            </div>
            <div>
              <h2>Dashboard de Pacientes</h2>
              <span>Conecta Heal</span>
            </div>
          </div>

          <div class="dashboard-stats" id="dashboard-stats-cards">
            <div class="dashboard-stat">
              <span>Total Pacientes</span>
              <strong id="dashboard-total">0</strong>
            </div>
            <div class="dashboard-stat dashboard-stat-red">
              <span>Prescrição de Agora</span>
              <strong id="dashboard-medicacao">0</strong>
            </div>
            <div class="dashboard-stat dashboard-stat-yellow">
              <span>Checagens Pendentes</span>
              <strong id="dashboard-checagens">0</strong>
            </div>
          </div>

          <div class="dashboard-controls">
            <select id="dashboard-setor" class="form-select dashboard-setor-select">
              <option value="">Selecione o setor...</option>
            </select>
            <div class="dashboard-clock">
              <span class="dashboard-turno-inline" id="dashboard-turno-label">Turno</span>
              <span class="dot-sep">·</span>
              <div class="dashboard-clock-text">
                <strong id="dashboard-clock-time">--:--:--</strong>
                <span id="dashboard-clock-date">--/--/----</span>
              </div>
              <button class="dashboard-refresh-btn" id="btn-dashboard-refresh" type="button" title="Atualizar">
                <i class="bi bi-arrow-clockwise"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="dashboard-update-bar">
          <span><span class="dashboard-pulse"></span> Atualização automática a cada 30 segundos</span>
          <span id="dashboard-last-update">Aguardando setor...</span>
        </div>
      </div>

      <div class="dashboard-feedback" id="dashboard-feedback">
        <i class="bi bi-building"></i>
        <span>Selecione um setor para visualizar os pacientes.</span>
      </div>

      <div class="dashboard-patients-grid" id="dashboard-pacientes-grid"></div>
    </section>
</div>
`,
  'pacientes': () => `
<div class="screen active studio-canvas-node" data-studio-type="screen" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">
<nav class="topbar studio-canvas-node" data-studio-type="topbar">
      <div class="topbar-left" id="topbar-brand" title="Voltar ao menu">
        <i class="bi bi-heart-pulse"></i>
        <span class="topbar-title">Conecta HEAL</span>
      </div>
      <div class="topbar-nav d-none" id="topbar-nav" aria-label="Módulos do sistema">
        <button class="topbar-nav-item" id="nav-passagem" type="button">Passagem de Plantão</button>
        <button class="topbar-nav-item" id="nav-livro" type="button">Livro Administrativo</button>
        <button class="topbar-nav-item" id="nav-escala" type="button">Gestão de Escalas</button>
        <button class="topbar-nav-item" id="nav-dashboard" type="button">Dashboard de Pacientes</button>
        <button class="topbar-nav-item" id="nav-dashboard-pa" type="button">Pronto Atendimento</button>
        <button class="topbar-nav-item" id="nav-auditorias" type="button">Auditorias</button>
      </div>
      <div class="topbar-right">
        <div class="user-dropdown-container" id="user-dropdown-container">
          <button class="user-badge user-badge-clickable" id="user-display" type="button" aria-haspopup="true" aria-expanded="false" title="Alternar perfil">
            <i class="bi bi-person-circle"></i>
            <span class="user-copy">
              <strong id="user-name"></strong>
              <small id="user-profile-label">Perfil assistencial</small>
            </span>
            <i class="bi bi-chevron-down user-badge-chevron"></i>
          </button>
          <div class="user-profile-menu d-none" id="user-profile-menu" role="menu">
            <div class="user-profile-menu-header">
              <i class="bi bi-person-badge"></i> Alternar Perfil
            </div>
            <div class="user-profile-menu-list" id="user-profile-menu-list">
              <!-- Perfis renderizados dinamicamente -->
            </div>
            <button class="user-profile-menu-admin d-none" id="nav-admin" type="button" title="Painel de Administração" aria-label="Administração">
              <i class="bi bi-gear-fill"></i> Painel de Administração
            </button>
          </div>
        </div>
        <button class="btn-logout" id="btn-logout" title="Sair">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </nav>
<section class="dashboard-workspace " id="workspace-dashboard-internacao" class="app-container studio-canvas-node active" data-studio-type="app_container">
      <div class="dashboard-header-panel">
        <div class="dashboard-header-main">
          <div class="dashboard-brand">
            <div class="dashboard-logo">
              <i class="bi bi-heart-pulse"></i>
            </div>
            <div>
              <h2>Pronto Atendimento</h2>
              <span>Conecta Heal</span>
            </div>
          </div>

          <div class="dashboard-pa-stats" id="dashboard-pa-stats-cards">
            <div class="dashboard-stat dashboard-stat-primary">
              <span>Total Pacientes</span>
              <strong id="pa-total-count">0</strong>
            </div>
          </div>

          <div class="dashboard-controls">
            <div class="dashboard-clock">
              <span class="dashboard-turno-inline" id="dashboard-internacao-turno-label">Turno</span>
              <span class="dot-sep">·</span>
              <div class="dashboard-clock-text">
                <strong id="dashboard-internacao-clock-time">--:--:--</strong>
                <span id="dashboard-internacao-clock-date">--/--/----</span>
              </div>
              <button class="dashboard-refresh-btn" id="btn-dashboard-internacao-refresh" type="button" title="Atualizar">
                <i class="bi bi-arrow-clockwise"></i>
              </button>
            </div>
          </div>
        </div>

        <div class="dashboard-update-bar">
          <span><span class="dashboard-pulse"></span> Atualização automática a cada 30 segundos</span>
          <span id="dashboard-internacao-last-update">Aguardando carregamento...</span>
        </div>
      </div>

      <div class="dashboard-feedback " id="dashboard-pa-feedback">
        <i class="bi bi-arrow-repeat spin"></i>
        <span>Carregando...</span>
      </div>

      <div class="dashboard-pa-patients-grid" id="dashboard-pa-patients-grid"></div>
    </section>
</div>
`,
  'livro': () => `
<div class="screen active studio-canvas-node" data-studio-type="screen" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">
<nav class="topbar studio-canvas-node" data-studio-type="topbar">
      <div class="topbar-left" id="topbar-brand" title="Voltar ao menu">
        <i class="bi bi-heart-pulse"></i>
        <span class="topbar-title">Conecta HEAL</span>
      </div>
      <div class="topbar-nav d-none" id="topbar-nav" aria-label="Módulos do sistema">
        <button class="topbar-nav-item" id="nav-passagem" type="button">Passagem de Plantão</button>
        <button class="topbar-nav-item" id="nav-livro" type="button">Livro Administrativo</button>
        <button class="topbar-nav-item" id="nav-escala" type="button">Gestão de Escalas</button>
        <button class="topbar-nav-item" id="nav-dashboard" type="button">Dashboard de Pacientes</button>
        <button class="topbar-nav-item" id="nav-dashboard-pa" type="button">Pronto Atendimento</button>
        <button class="topbar-nav-item" id="nav-auditorias" type="button">Auditorias</button>
      </div>
      <div class="topbar-right">
        <div class="user-dropdown-container" id="user-dropdown-container">
          <button class="user-badge user-badge-clickable" id="user-display" type="button" aria-haspopup="true" aria-expanded="false" title="Alternar perfil">
            <i class="bi bi-person-circle"></i>
            <span class="user-copy">
              <strong id="user-name"></strong>
              <small id="user-profile-label">Perfil assistencial</small>
            </span>
            <i class="bi bi-chevron-down user-badge-chevron"></i>
          </button>
          <div class="user-profile-menu d-none" id="user-profile-menu" role="menu">
            <div class="user-profile-menu-header">
              <i class="bi bi-person-badge"></i> Alternar Perfil
            </div>
            <div class="user-profile-menu-list" id="user-profile-menu-list">
              <!-- Perfis renderizados dinamicamente -->
            </div>
            <button class="user-profile-menu-admin d-none" id="nav-admin" type="button" title="Painel de Administração" aria-label="Administração">
              <i class="bi bi-gear-fill"></i> Painel de Administração
            </button>
          </div>
        </div>
        <button class="btn-logout" id="btn-logout" title="Sair">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </nav>
<section class="livro-workspace livro-stitch-page " id="workspace-livro" class="app-container studio-canvas-node active" data-studio-type="app_container">
      <header class="livro-page-header">
        <div class="livro-page-heading">
          <button class="livro-page-back" id="btn-livro-voltar" type="button" aria-label="Voltar ao menu do Livro Administrativo">
            <i class="bi bi-arrow-left"></i>
          </button>
          <span class="livro-page-icon"><i class="bi bi-journal-medical"></i></span>
          <div>
            <span class="livro-page-eyebrow">Escala assistencial</span>
            <h2>Lançar / Editar Livro Administrativo</h2>
            <p>Organize a equipe e registre as informações do plantão.</p>
          </div>
        </div>
        <span class="livro-page-status"><i class="bi bi-shield-check"></i> Registro seguro</span>
      </header>

      <div class="livro-filter-panel" aria-label="Identificação do plantão">
        <div class="livro-field">
          <label for="livro-setor">Setor <span class="required-star">*</span></label>
          <select id="livro-setor" class="form-select">
            <option value="">Selecione...</option>
          </select>
        </div>
        <div class="livro-field">
          <label for="livro-data-plantao">Data do plantão</label>
          <input type="date" id="livro-data-plantao">
        </div>
        <div class="livro-field">
          <span class="livro-field-label">Turno <span class="required-star">*</span></span>
          <div class="livro-turno-options">
            <label class="livro-turno-option">
              <input type="radio" name="livro-turno" value="M" checked>
              <span><i class="bi bi-sun"></i> Diurno</span>
            </label>
            <label class="livro-turno-option">
              <input type="radio" name="livro-turno" value="N">
              <span><i class="bi bi-moon"></i> Noturno</span>
            </label>
          </div>
        </div>
        <div class="livro-field">
          <label for="livro-enfermeiro">Enfermeiro responsável <span class="required-star">*</span></label>
          <select id="livro-enfermeiro" class="form-select">
            <option value="">Selecione...</option>
          </select>
        </div>
      </div>

      <div class="livro-sections-grid">
        <div class="livro-section " id="livro-secao-ect-pre">
          <div class="livro-section-header">
            <span><i class="bi bi-person-workspace"></i> Pré-Procedimento</span>
            <button class="btn-sm btn-secondary" id="btn-add-ect-pre" type="button">
              <i class="bi bi-plus-lg"></i> Adicionar
            </button>
          </div>
          <div class="livro-section-body" id="livro-ect-pre-list"></div>
        </div>

        <div class="livro-section " id="livro-secao-ect-sala">
          <div class="livro-section-header">
            <span><i class="bi bi-hospital"></i> Sala de Procedimento</span>
            <button class="btn-sm btn-secondary" id="btn-add-ect-sala" type="button">
              <i class="bi bi-plus-lg"></i> Adicionar
            </button>
          </div>
          <div class="livro-section-body" id="livro-ect-sala-list"></div>
        </div>

        <div class="livro-section " id="livro-secao-ect-recuperacao">
          <div class="livro-section-header">
            <span><i class="bi bi-heart-pulse"></i> Sala de Recuperação</span>
            <button class="btn-sm btn-secondary" id="btn-add-ect-recuperacao" type="button">
              <i class="bi bi-plus-lg"></i> Adicionar
            </button>
          </div>
          <div class="livro-section-body" id="livro-ect-recuperacao-list"></div>
        </div>

        <div class="livro-section" id="livro-secao-tecnicos">
          <div class="livro-section-header">
            <span><i class="bi bi-people"></i> Técnicos do plantão</span>
            <button class="btn-sm btn-secondary" id="btn-add-tecnico" type="button">
              <i class="bi bi-plus-lg"></i> Adicionar técnico
            </button>
          </div>
          <div class="livro-section-body" id="livro-tecnicos-list"></div>
        </div>

        <div class="livro-section" id="livro-secao-patio">
          <div class="livro-section-header">
            <span><i class="bi bi-signpost-split"></i> Pátio</span>
            <button class="btn-sm btn-secondary" id="btn-add-patio" type="button">
              <i class="bi bi-plus-lg"></i> Adicionar técnico
            </button>
          </div>
          <div class="livro-section-body" id="livro-patio-list"></div>
        </div>

        <div class="livro-section" id="livro-secao-circulante">
          <div class="livro-section-header">
            <span><i class="bi bi-arrow-repeat"></i> Circulante</span>
            <button class="btn-sm btn-secondary" id="btn-add-circulante" type="button">
              <i class="bi bi-plus-lg"></i> Adicionar técnico
            </button>
          </div>
          <div class="livro-section-body" id="livro-circulante-list"></div>
        </div>

        <div class="livro-section livro-section-alert" id="livro-secao-faltas">
          <div class="livro-section-header">
            <span><i class="bi bi-calendar-x"></i> Faltas e folgas</span>
            <button class="btn-sm btn-secondary" id="btn-add-falta" type="button">
              <i class="bi bi-plus-lg"></i> Adicionar
            </button>
          </div>
          <div class="livro-section-body" id="livro-faltas-list"></div>
        </div>

        <div class="livro-section" id="livro-secao-avaliacao-externa">
          <div class="livro-section-header">
            <span><i class="bi bi-box-arrow-up-right"></i> Avaliação externa</span>
            <button class="btn-sm btn-secondary" id="btn-add-avaliacao-externa" type="button">
              <i class="bi bi-plus-lg"></i> Adicionar
            </button>
          </div>
          <div class="livro-section-body">
            <div id="livro-avaliacao-externa-list"></div>
          </div>
        </div>

        <div class="livro-section" id="livro-secao-obs">
          <div class="livro-section-header">
            <span><i class="bi bi-chat-left-text"></i> Observações do plantão</span>
          </div>
          <div class="livro-section-body">
            <textarea id="livro-observacoes" rows="4" placeholder="Registre aqui informações gerais e pontos de atenção do plantão"></textarea>
          </div>
        </div>
      </div>

      <div class="livro-preview" id="livro-preview">
        <div class="loading-placeholder">Nenhuma escala carregada para visualização.</div>
      </div>

      <div class="livro-actions livro-action-bar">
        <div class="livro-action-group">
          <button class="btn-secondary " id="btn-livro-historico" type="button">
            <i class="bi bi-clock-history"></i> Histórico <span id="livro-historico-count"></span>
          </button>
          <button class="btn-secondary" id="btn-livro-buscar" type="button">
            <i class="bi bi-search"></i> Ver livros liberados para impressão
          </button>
          <button class="btn-secondary " id="btn-livro-editar" type="button" title="Carregar a escala em modo edição">
            <i class="bi bi-pencil-square"></i> Editar esta escala
          </button>
        </div>
        <div class="livro-action-group livro-action-group-end">
          <button class="btn-secondary livro-clear-btn" id="btn-livro-limpar" type="button">
            <i class="bi bi-eraser"></i> Limpar
          </button>
          <button class="btn-save" id="btn-livro-salvar" type="button">
            <i class="bi bi-check2-circle"></i> Salvar escala
          </button>
        </div>
      </div>
    </section>
</div>
`,
  'escala': () => `
<div class="screen active studio-canvas-node" data-studio-type="screen" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">
<nav class="topbar studio-canvas-node" data-studio-type="topbar">
      <div class="topbar-left" id="topbar-brand" title="Voltar ao menu">
        <i class="bi bi-heart-pulse"></i>
        <span class="topbar-title">Conecta HEAL</span>
      </div>
      <div class="topbar-nav d-none" id="topbar-nav" aria-label="Módulos do sistema">
        <button class="topbar-nav-item" id="nav-passagem" type="button">Passagem de Plantão</button>
        <button class="topbar-nav-item" id="nav-livro" type="button">Livro Administrativo</button>
        <button class="topbar-nav-item" id="nav-escala" type="button">Gestão de Escalas</button>
        <button class="topbar-nav-item" id="nav-dashboard" type="button">Dashboard de Pacientes</button>
        <button class="topbar-nav-item" id="nav-dashboard-pa" type="button">Pronto Atendimento</button>
        <button class="topbar-nav-item" id="nav-auditorias" type="button">Auditorias</button>
      </div>
      <div class="topbar-right">
        <div class="user-dropdown-container" id="user-dropdown-container">
          <button class="user-badge user-badge-clickable" id="user-display" type="button" aria-haspopup="true" aria-expanded="false" title="Alternar perfil">
            <i class="bi bi-person-circle"></i>
            <span class="user-copy">
              <strong id="user-name"></strong>
              <small id="user-profile-label">Perfil assistencial</small>
            </span>
            <i class="bi bi-chevron-down user-badge-chevron"></i>
          </button>
          <div class="user-profile-menu d-none" id="user-profile-menu" role="menu">
            <div class="user-profile-menu-header">
              <i class="bi bi-person-badge"></i> Alternar Perfil
            </div>
            <div class="user-profile-menu-list" id="user-profile-menu-list">
              <!-- Perfis renderizados dinamicamente -->
            </div>
            <button class="user-profile-menu-admin d-none" id="nav-admin" type="button" title="Painel de Administração" aria-label="Administração">
              <i class="bi bi-gear-fill"></i> Painel de Administração
            </button>
          </div>
        </div>
        <button class="btn-logout" id="btn-logout" title="Sair">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </nav>
<section class="livro-workspace escala-stitch-page " id="workspace-escala" class="app-container studio-canvas-node active" data-studio-type="app_container">
      <header class="livro-page-header" id="escala-page-header">
        <div class="livro-page-heading">
          <button class="livro-page-back" id="btn-escala-voltar" type="button" aria-label="Voltar ao menu principal">
            <i class="bi bi-arrow-left"></i>
          </button>
          <span class="livro-page-icon"><i class="bi bi-calendar3"></i></span>
          <div>
            <span class="livro-page-eyebrow">GESTÃO ASSISTENCIAL</span>
            <h2>Gestão de Escalas — Psicologia</h2>
            <p>Gestão e visualização de turnos da equipe multidisciplinar.</p>
          </div>
        </div>
        <div class="escala-header-actions">
        </div>
      </header>

      <div class="escala-filter-panel">
        <div class="livro-field"><label for="escala-mes">Mês de referência</label><input type="month" id="escala-mes"></div>
        <div class="livro-field"><label>Filtrar por turno</label><div class="escala-turno-filter"><button data-turno="" class="active" type="button">Todos</button><button data-turno="M" type="button">Manhã</button><button data-turno="N" type="button">Tarde</button></div></div>
      </div>
      <button class="btn-secondary escala-more-weeks" id="btn-escala-semanas-passadas" type="button"><i class="bi bi-chevron-up"></i> Carregar semanas passadas</button>
      <div class="escala-week-list" id="escala-week-list"></div>
      <button class="btn-secondary escala-more-weeks" id="btn-escala-mais-semanas" type="button"><i class="bi bi-chevron-down"></i> Carregar mais semanas</button>

      <div class="livro-actions livro-action-bar escala-action-bar">
        <div class="livro-action-group escala-action-filter">
          <label for="escala-filtro-profissional">Filtrar profissional</label>
          <div class="escala-search"><i class="bi bi-search"></i><input id="escala-filtro-profissional" type="search" placeholder="Buscar nome..."></div>
        </div>
        <div class="livro-action-group">
          <button class="btn-secondary" id="btn-escala-imprimir" type="button"><i class="bi bi-printer"></i> Imprimir escala liberada</button>
          <button class="btn-secondary livro-clear-btn" id="btn-escala-limpar" type="button"><i class="bi bi-eraser"></i> Limpar</button>
          <button class="btn-save" id="btn-escala-publicar" type="button"><i class="bi bi-check2-circle"></i> Salvar/Publicar escala</button>
        </div>
      </div>
    </section>
</div>
`,
  'auditorias': () => `
<div class="screen active studio-canvas-node" data-studio-type="screen" style="position: relative; width: 100%; height: 100%; display: flex; flex-direction: column;">
<nav class="topbar studio-canvas-node" data-studio-type="topbar">
      <div class="topbar-left" id="topbar-brand" title="Voltar ao menu">
        <i class="bi bi-heart-pulse"></i>
        <span class="topbar-title">Conecta HEAL</span>
      </div>
      <div class="topbar-nav d-none" id="topbar-nav" aria-label="Módulos do sistema">
        <button class="topbar-nav-item" id="nav-passagem" type="button">Passagem de Plantão</button>
        <button class="topbar-nav-item" id="nav-livro" type="button">Livro Administrativo</button>
        <button class="topbar-nav-item" id="nav-escala" type="button">Gestão de Escalas</button>
        <button class="topbar-nav-item" id="nav-dashboard" type="button">Dashboard de Pacientes</button>
        <button class="topbar-nav-item" id="nav-dashboard-pa" type="button">Pronto Atendimento</button>
        <button class="topbar-nav-item" id="nav-auditorias" type="button">Auditorias</button>
      </div>
      <div class="topbar-right">
        <div class="user-dropdown-container" id="user-dropdown-container">
          <button class="user-badge user-badge-clickable" id="user-display" type="button" aria-haspopup="true" aria-expanded="false" title="Alternar perfil">
            <i class="bi bi-person-circle"></i>
            <span class="user-copy">
              <strong id="user-name"></strong>
              <small id="user-profile-label">Perfil assistencial</small>
            </span>
            <i class="bi bi-chevron-down user-badge-chevron"></i>
          </button>
          <div class="user-profile-menu d-none" id="user-profile-menu" role="menu">
            <div class="user-profile-menu-header">
              <i class="bi bi-person-badge"></i> Alternar Perfil
            </div>
            <div class="user-profile-menu-list" id="user-profile-menu-list">
              <!-- Perfis renderizados dinamicamente -->
            </div>
            <button class="user-profile-menu-admin d-none" id="nav-admin" type="button" title="Painel de Administração" aria-label="Administração">
              <i class="bi bi-gear-fill"></i> Painel de Administração
            </button>
          </div>
        </div>
        <button class="btn-logout" id="btn-logout" title="Sair">
          <i class="bi bi-box-arrow-right"></i>
        </button>
      </div>
    </nav>
<section class="livro-workspace livro-stitch-page " id="workspace-auditoria-higiene-form" class="app-container studio-canvas-node active" data-studio-type="app_container">
      <header class="livro-page-header">
        <div class="livro-page-heading"><button class="livro-page-back" id="btn-auditoria-form-voltar" type="button" aria-label="Voltar"><i class="bi bi-arrow-left"></i></button><span class="livro-page-icon"><i class="bi bi-hand-index-thumb"></i></span><div><span class="livro-page-eyebrow">Auditorias · NISA</span><h2>Nova Auditoria de Higiene de Mãos</h2><p>Registre a observação e as oportunidades avaliadas.</p></div></div>
        <span class="livro-page-status"><i class="bi bi-shield-check"></i> Registro seguro</span>
      </header>
      <div class="livro-filter-panel auditoria-form-grid" aria-label="Informações da observação">
        <div class="livro-field"><label for="auditoria-data">Data <span class="required-star">*</span></label><input type="date" id="auditoria-data" required></div>
        <div class="livro-field"><label for="auditoria-setor">Setor <span class="required-star">*</span></label><select id="auditoria-setor" class="form-select" required><option value="">Selecione...</option></select></div>
        <div class="livro-field"><label for="auditoria-avaliador">Avaliador <span class="required-star">*</span></label><select id="auditoria-avaliador" class="form-select" required><option value="">Selecione...</option></select></div>
        <div class="livro-field auditoria-profissional-field"><label for="auditoria-profissional">Categoria <span class="required-star">*</span></label><select id="auditoria-profissional" class="form-select" required><option value="">Selecione...</option></select></div>
      </div>
      <div class="livro-section auditoria-section">
        <div class="livro-section-header"><span><i class="bi bi-person-check"></i> Oportunidades</span></div>
        <div class="livro-section-body">
          <div id="auditoria-oportunidades" class="auditoria-oportunidades"></div>
        </div>
      </div>
      <div class="livro-section auditoria-section"><div class="livro-section-header"><span><i class="bi bi-chat-left-text"></i> Observações</span></div><div class="livro-section-body"><textarea id="auditoria-observacoes" rows="4" placeholder="Registre observações complementares da auditoria."></textarea></div></div>
      <div class="auditoria-feedback d-none" id="auditoria-feedback" role="status"></div>
      <div class="livro-actions livro-action-bar">
        <div class="livro-action-group">
          <button class="btn-secondary" id="btn-auditoria-ver-historico" type="button">
            <i class="bi bi-search"></i> Ver auditorias realizadas
          </button>
        </div>
        <div class="livro-action-group livro-action-group-end">
          <button class="btn-secondary livro-clear-btn" id="btn-auditoria-cancelar" type="button">Cancelar</button>
          <button class="btn-save" id="btn-auditoria-salvar" type="button"><i class="bi bi-check2-circle"></i> Salvar</button>
        </div>
      </div>
    </section>
</div>
`,
};
;;

  // --- INITIALIZATION ---
  window.addEventListener('DOMContentLoaded', () => {
    initUrlParams();
    renderPalette();
    initCanvasEvents();
    initInspector();
    initTopActions();
    initViewModes();
    initCodeEditor();
    loadPageData();
  });

  function initUrlParams() {
    const params = new URLSearchParams(window.location.search);
    state.pageId = params.get('page');
  }

  // --- PALETTE RENDERING ---
  function renderPalette() {
    const container = document.getElementById('palette-content');
    if (!container) return;

    const categories = {
      'layout': { title: 'Estrutura & Layout', items: [] },
      'components': { title: 'Componentes Conecta', items: [] },
      'forms': { title: 'Formulários & Ações', items: [] }
    };

    Object.keys(COMPONENT_DEFINITIONS).forEach(key => {
      const comp = COMPONENT_DEFINITIONS[key];
      if (categories[comp.category]) {
        categories[comp.category].items.push({ id: key, ...comp });
      }
    });

    let html = '';
    Object.keys(categories).forEach(catKey => {
      const cat = categories[catKey];
      html += `
        <div class="studio-palette-group">
          <div class="studio-palette-group-title">${cat.title}</div>
          <div class="studio-palette-items">
            ${cat.items.map(item => `
              <div class="studio-palette-item" draggable="true" data-type="${item.id}" title="Arraste para o canvas">
                <i class="bi ${item.icon}"></i>
                <span>${item.name}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;

    // Drag start on palette items
    container.querySelectorAll('.studio-palette-item').forEach(item => {
      item.addEventListener('dragstart', (e) => {
        state.draggedType = item.getAttribute('data-type');
        e.dataTransfer.setData('text/plain', state.draggedType);
        e.dataTransfer.effectAllowed = 'copy';
      });

      // Quick click to insert
      item.addEventListener('click', () => {
        const type = item.getAttribute('data-type');
        insertComponent(type);
      });
    });

    // Palette search filter
    const searchInput = document.getElementById('palette-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase().trim();
        container.querySelectorAll('.studio-palette-item').forEach(el => {
          const text = el.innerText.toLowerCase();
          el.style.display = text.includes(term) ? 'flex' : 'none';
        });
      });
    }
  }

  // --- CANVAS & DRAG/DROP ENGINE ---
  function initCanvasEvents() {
    const canvas = document.getElementById('studio-canvas-root');
    if (!canvas) return;

    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      const target = e.target.closest('.studio-child-zone, .studio-canvas-node, .studio-canvas-root');
      if (target) target.classList.add('drag-over');
    });

    canvas.addEventListener('dragleave', (e) => {
      const target = e.target.closest('.studio-child-zone, .studio-canvas-node, .studio-canvas-root');
      if (target) target.classList.remove('drag-over');
    });

    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      canvas.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      const type = e.dataTransfer.getData('text/plain') || state.draggedType;
      if (!type || !COMPONENT_DEFINITIONS[type]) return;

      insertComponentAtDrop(type, e.target);
      saveHistoryState();
      syncCodeEditor();
    });

    // Click to select node
    canvas.addEventListener('click', (e) => {
      if (state.isPreview) {
        handlePreviewClick(e);
        return;
      }
      if (state.isResizing) return;

      const node = e.target.closest('.studio-canvas-node');
      if (node) {
        e.stopPropagation();
        selectNode(node);
      } else {
        deselectNode();
      }
    });

    // Double click to edit text inline
    canvas.addEventListener('dblclick', (e) => {
      if (state.isPreview) return;
      const textTarget = e.target.closest('.studio-text, h1, h2, h3, h4, h5, p, span, strong, label');
      if (textTarget) {
        e.stopPropagation();
        textTarget.setAttribute('contenteditable', 'true');
        textTarget.focus();
        textTarget.classList.add('studio-inline-editing');

        const finishEditing = () => {
          textTarget.removeAttribute('contenteditable');
          textTarget.classList.remove('studio-inline-editing');
          saveHistoryState();
          syncCodeEditor();
          textTarget.removeEventListener('blur', finishEditing);
        };
        textTarget.addEventListener('blur', finishEditing);
      }
    });
  }

  function insertComponent(type) {
    const canvas = document.getElementById('studio-canvas-root');
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
    syncCodeEditor();
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

  // --- SELECTION, FLOATING ACTIONS & DRAG-TO-RESIZE ---
  function selectNode(node) {
    deselectNode();
    state.selectedNode = node;
    node.classList.add('studio-selected');

    createFloatingActionBar(node);
    createResizeHandles(node);
    syncInspectorWithSelectedNode();
    if (state.activeCodeTab === 'html-selected') syncCodeEditor();
  }

  function deselectNode() {
    if (state.selectedNode) {
      state.selectedNode.classList.remove('studio-selected');
    }
    state.selectedNode = null;
    removeFloatingActionBar();
    removeResizeHandles();
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
        syncCodeEditor();
      }
    });

    document.getElementById('btn-node-down').addEventListener('click', (e) => {
      e.stopPropagation();
      if (node.nextElementSibling) {
        node.parentNode.insertBefore(node.nextElementSibling, node);
        saveHistoryState();
        syncCodeEditor();
      }
    });

    document.getElementById('btn-node-dup').addEventListener('click', (e) => {
      e.stopPropagation();
      removeFloatingActionBar();
      removeResizeHandles();
      const clone = node.cloneNode(true);
      clone.classList.remove('studio-selected');
      node.parentNode.insertBefore(clone, node.nextSibling);
      selectNode(clone);
      saveHistoryState();
      syncCodeEditor();
    });

    document.getElementById('btn-node-del').addEventListener('click', (e) => {
      e.stopPropagation();
      node.remove();
      deselectNode();
      saveHistoryState();
      syncCodeEditor();
    });
  }

  function removeFloatingActionBar() {
    const existing = document.getElementById('studio-floating-bar');
    if (existing) existing.remove();
  }

  // --- RESIZE HANDLES (DRAG-TO-RESIZE) ---
  function createResizeHandles(node) {
    removeResizeHandles();

    const handleR = document.createElement('div');
    handleR.className = 'studio-resize-handle studio-resize-handle-r';
    handleR.title = 'Arrastar para alterar largura';

    const handleB = document.createElement('div');
    handleB.className = 'studio-resize-handle studio-resize-handle-b';
    handleB.title = 'Arrastar para alterar altura';

    const handleBR = document.createElement('div');
    handleBR.className = 'studio-resize-handle studio-resize-handle-br';
    handleBR.title = 'Arrastar para alterar tamanho';

    node.appendChild(handleR);
    node.appendChild(handleB);
    node.appendChild(handleBR);

    initResizeHandleEvents(handleR, node, 'r');
    initResizeHandleEvents(handleB, node, 'b');
    initResizeHandleEvents(handleBR, node, 'br');
  }

  function removeResizeHandles() {
    document.querySelectorAll('.studio-resize-handle').forEach(h => h.remove());
  }

  function initResizeHandleEvents(handle, node, direction) {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.isResizing = true;

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = node.getBoundingClientRect().width;
      const startHeight = node.getBoundingClientRect().height;

      const onMouseMove = (moveEvent) => {
        if (!state.isResizing) return;
        const deltaX = moveEvent.clientX - startX;
        const deltaY = moveEvent.clientY - startY;

        if (direction === 'r' || direction === 'br') {
          const newWidth = Math.max(80, startWidth + deltaX);
          node.style.width = `${Math.round(newWidth)}px`;
          const propWidth = document.getElementById('prop-width');
          if (propWidth) propWidth.value = `${Math.round(newWidth)}px`;
        }

        if (direction === 'b' || direction === 'br') {
          const newHeight = Math.max(40, startHeight + deltaY);
          node.style.height = `${Math.round(newHeight)}px`;
          const propHeight = document.getElementById('prop-height');
          if (propHeight) propHeight.value = `${Math.round(newHeight)}px`;
        }
      };

      const onMouseUp = () => {
        state.isResizing = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        saveHistoryState();
        syncCodeEditor();
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
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

    // Content input
    const textInput = document.getElementById('prop-text');
    if (textInput) {
      textInput.addEventListener('input', (e) => {
        if (!state.selectedNode) return;
        const textTarget = state.selectedNode.querySelector('.studio-text') || state.selectedNode;
        textTarget.innerText = e.target.value;
        saveHistoryState();
        syncCodeEditor();
      });
    }

    // Width & Height inputs
    const propWidth = document.getElementById('prop-width');
    if (propWidth) {
      propWidth.addEventListener('input', (e) => {
        if (!state.selectedNode) return;
        state.selectedNode.style.width = e.target.value;
        saveHistoryState();
        syncCodeEditor();
      });
    }

    document.querySelectorAll('[data-width]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!state.selectedNode) return;
        const val = btn.getAttribute('data-width');
        state.selectedNode.style.width = val;
        if (propWidth) propWidth.value = val;
        saveHistoryState();
        syncCodeEditor();
      });
    });

    const propHeight = document.getElementById('prop-height');
    if (propHeight) {
      propHeight.addEventListener('input', (e) => {
        if (!state.selectedNode) return;
        state.selectedNode.style.height = e.target.value;
        saveHistoryState();
        syncCodeEditor();
      });
    }

    document.querySelectorAll('[data-height]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!state.selectedNode) return;
        const val = btn.getAttribute('data-height');
        state.selectedNode.style.height = val;
        if (propHeight) propHeight.value = val;
        saveHistoryState();
        syncCodeEditor();
      });
    });

    const propPadding = document.getElementById('prop-padding');
    if (propPadding) {
      propPadding.addEventListener('change', (e) => {
        if (!state.selectedNode) return;
        state.selectedNode.style.padding = e.target.value;
        saveHistoryState();
        syncCodeEditor();
      });
    }

    document.querySelectorAll('[data-grid-cols]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!state.selectedNode) return;
        const cols = btn.getAttribute('data-grid-cols');
        state.selectedNode.style.display = 'grid';
        state.selectedNode.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        saveHistoryState();
        syncCodeEditor();
      });
    });

    // Style inputs
    const bgInput = document.getElementById('prop-bg');
    if (bgInput) {
      bgInput.addEventListener('input', (e) => {
        if (!state.selectedNode) return;
        state.selectedNode.style.backgroundColor = e.target.value;
        saveHistoryState();
        syncCodeEditor();
      });
    }

    const radiusSelect = document.getElementById('prop-radius');
    if (radiusSelect) {
      radiusSelect.addEventListener('change', (e) => {
        if (!state.selectedNode) return;
        state.selectedNode.style.borderRadius = e.target.value;
        saveHistoryState();
        syncCodeEditor();
      });
    }

    const shadowSelect = document.getElementById('prop-shadow');
    if (shadowSelect) {
      shadowSelect.addEventListener('change', (e) => {
        if (!state.selectedNode) return;
        state.selectedNode.style.boxShadow = e.target.value;
        saveHistoryState();
        syncCodeEditor();
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
        syncCodeEditor();
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
        syncCodeEditor();
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

    const propWidth = document.getElementById('prop-width');
    if (propWidth) propWidth.value = state.selectedNode.style.width || '';

    const propHeight = document.getElementById('prop-height');
    if (propHeight) propHeight.value = state.selectedNode.style.height || '';

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
    const propWidth = document.getElementById('prop-width');
    if (propWidth) propWidth.value = '';
    const propHeight = document.getElementById('prop-height');
    if (propHeight) propHeight.value = '';
    const pulseToggle = document.getElementById('prop-pulse-toggle');
    if (pulseToggle) pulseToggle.checked = false;
  }

  // --- VIEW MODES & LIVE CODE EDITOR ---
  function initViewModes() {
    const btnVisual = document.getElementById('btn-mode-visual');
    const btnSplit = document.getElementById('btn-mode-split');
    const btnCode = document.getElementById('btn-mode-code');

    const setMode = (mode) => {
      state.viewMode = mode;
      document.body.classList.remove('mode-split', 'mode-code');
      [btnVisual, btnSplit, btnCode].forEach(b => { if (b) b.classList.remove('active'); });

      if (mode === 'split') {
        document.body.classList.add('mode-split');
        if (btnSplit) btnSplit.classList.add('active');
      } else if (mode === 'code') {
        document.body.classList.add('mode-code');
        if (btnCode) btnCode.classList.add('active');
      } else {
        if (btnVisual) btnVisual.classList.add('active');
      }
      syncCodeEditor();
    };

    if (btnVisual) btnVisual.addEventListener('click', () => setMode('visual'));
    if (btnSplit) btnSplit.addEventListener('click', () => setMode('split'));
    if (btnCode) btnCode.addEventListener('click', () => setMode('code'));
  }

  function initCodeEditor() {
    const textarea = document.getElementById('studio-code-editor-textarea');
    const autoApplyCheckbox = document.getElementById('code-auto-apply');
    const btnApply = document.getElementById('btn-apply-code');
    const btnFormat = document.getElementById('btn-format-code');

    // Code tabs
    document.querySelectorAll('.code-editor-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.code-editor-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.activeCodeTab = btn.getAttribute('data-code-tab');
        syncCodeEditor();
      });
    });

    // Auto apply debounce
    let debounceTimer;
    if (textarea) {
      textarea.addEventListener('input', () => {
        if (autoApplyCheckbox && autoApplyCheckbox.checked) {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            applyCodeEditorChanges();
          }, 350);
        }
      });

      // Tab key support
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
          e.preventDefault();
          const start = textarea.selectionStart;
          const end = textarea.selectionEnd;
          textarea.value = textarea.value.substring(0, start) + '  ' + textarea.value.substring(end);
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }
      });
    }

    if (btnApply) {
      btnApply.addEventListener('click', () => {
        applyCodeEditorChanges();
      });
    }

    if (btnFormat) {
      btnFormat.addEventListener('click', () => {
        if (textarea) {
          textarea.value = formatCode(textarea.value, state.activeCodeTab === 'css-custom' ? 'css' : 'html');
        }
      });
    }
  }

  function cleanHtml(rawHtml) {
    const temp = document.createElement('div');
    temp.innerHTML = rawHtml;
    temp.querySelectorAll('#studio-floating-bar, .studio-resize-handle').forEach(el => el.remove());
    temp.querySelectorAll('.studio-selected, .drag-over').forEach(el => el.classList.remove('studio-selected', 'drag-over'));
    return temp.innerHTML.trim();
  }

  function syncCodeEditor() {
    const textarea = document.getElementById('studio-code-editor-textarea');
    const info = document.getElementById('code-editor-info');
    const canvas = document.getElementById('studio-canvas-root');
    if (!textarea || !canvas) return;

    if (state.activeCodeTab === 'html-all') {
      textarea.value = cleanHtml(canvas.innerHTML);
      if (info) info.innerText = 'HTML Completo da Tela · Edição ao Vivo';
    } else if (state.activeCodeTab === 'html-selected') {
      if (state.selectedNode) {
        textarea.value = cleanHtml(state.selectedNode.outerHTML);
        if (info) info.innerText = 'HTML do Bloco Selecionado';
      } else {
        textarea.value = '<!-- Nenhum bloco selecionado. Clique em um elemento no canvas para editar seu HTML. -->';
        if (info) info.innerText = 'Selecione um bloco no canvas';
      }
    } else if (state.activeCodeTab === 'css-custom') {
      textarea.value = state.customCss || '/* Escreva regras CSS customizadas aqui */';
      if (info) info.innerText = 'CSS Customizado da Página';
    }
  }

  function applyCodeEditorChanges() {
    const textarea = document.getElementById('studio-code-editor-textarea');
    const canvas = document.getElementById('studio-canvas-root');
    if (!textarea || !canvas) return;

    const val = textarea.value.trim();

    if (state.activeCodeTab === 'html-all') {
      removeFloatingActionBar();
      removeResizeHandles();
      canvas.innerHTML = val;
      deselectNode();
      saveHistoryState();
    } else if (state.activeCodeTab === 'html-selected') {
      if (state.selectedNode && state.selectedNode.parentNode) {
        removeFloatingActionBar();
        removeResizeHandles();
        const temp = document.createElement('div');
        temp.innerHTML = val;
        const newNode = temp.firstElementChild;
        if (newNode) {
          state.selectedNode.parentNode.replaceChild(newNode, state.selectedNode);
          selectNode(newNode);
          saveHistoryState();
        }
      }
    } else if (state.activeCodeTab === 'css-custom') {
      state.customCss = val;
      state.pageData.custom_css = val;
      injectCustomCss(val);
      saveHistoryState();
    }
  }

  function injectCustomCss(cssText) {
    let styleEl = document.getElementById('studio-live-custom-css');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'studio-live-custom-css';
      document.head.appendChild(styleEl);
    }
    styleEl.innerHTML = cssText || '';
  }

  function formatCode(code, type = 'html') {
    if (type === 'css') return code;
    let formatted = '';
    let pad = 0;
    const tokens = code.replace(/>\s*</g, '><').split(/(?=<)|(?<=>)/);
    tokens.forEach(node => {
      if (!node.trim()) return;
      if (node.match(/^<\/\w/)) {
        if (pad > 0) pad -= 1;
      }
      formatted += '  '.repeat(pad) + node.trim() + '\n';
      if (node.match(/^<\w[^>]*[^\/]>/) && !node.startsWith('<!') && !node.match(/<(img|hr|br|input)/i)) {
        pad += 1;
      }
    });
    return formatted.trim();
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

    const cb = e.target.closest('input[type="checkbox"]');
    if (cb) cb.checked = !cb.checked;

    const turnoBtn = e.target.closest('.turno-bar button, .turno-options button');
    if (turnoBtn) {
      const parent = turnoBtn.parentElement;
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

    removeFloatingActionBar();
    removeResizeHandles();

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
      syncCodeEditor();
    }
  }

  function redo() {
    if (state.historyIndex < state.history.length - 1) {
      state.historyIndex++;
      const canvas = document.getElementById('studio-canvas-root');
      canvas.innerHTML = state.history[state.historyIndex];
      deselectNode();
      syncCodeEditor();
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
        const canvas = document.getElementById('studio-canvas-root');
        const htmlCode = cleanHtml(canvas.innerHTML);
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
      syncCodeEditor();
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
          }

          if (state.pageData.custom_css) {
            state.customCss = state.pageData.custom_css;
            injectCustomCss(state.customCss);
          }

          saveHistoryState();
          syncCodeEditor();
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
          if (parsed.custom_css) {
            state.customCss = parsed.custom_css;
            injectCustomCss(parsed.custom_css);
          }
        } catch (e) {}
      }
    }
    saveHistoryState();
    syncCodeEditor();
  }

  async function savePageData() {
    const btnSave = document.getElementById('btn-save-page');
    const canvas = document.getElementById('studio-canvas-root');
    removeFloatingActionBar();
    removeResizeHandles();

    const htmlOutput = cleanHtml(canvas.innerHTML);
    state.pageData.html_output = htmlOutput;
    state.pageData.custom_css = state.customCss;
    state.pageData.layout_json = JSON.stringify({
      version: '2.0',
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

    localStorage.setItem(`conecta_studio_${state.pageData.id}`, JSON.stringify(state.pageData));

    setTimeout(() => {
      btnSave.innerHTML = '<i class="bi bi-floppy2-fill"></i> Salvar Tela';
    }, 2200);
  }

})();
