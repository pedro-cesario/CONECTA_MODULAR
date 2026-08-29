# 🏥 Conecta HEAL Assistencial 2.0 — Enterprise Modular

> **Plataforma Hospitalar Integrada de Passagem de Plantão, Livro Administrativo, Gestão de Escalas, Dashboard de Leitos/P.A., Auditorias e Registros Clínicos.**  
> *100% Modular, Nativo em ES Modules no Frontend e Domain-Driven Design (DDD) no Backend Node.js conectado ao Oracle TASY.*

---

## 🏛️ 1. Visão Geral da Arquitetura

O **Conecta Assistencial** foi projetado seguindo as melhores práticas de engenharia de software para garantir alta performance (< 200ms de tempo de resposta), isolamento total de módulos e zero acoplamento em código legado.

```
CONECTA_MODULAR/
├── frontend/                     # Interface SPA em ES Modules Nativos
│   ├── index.html                # Ponto de entrada HTML único (v=...)
│   ├── admin.html                # Painel Administrativo de Perfis/Permissões
│   ├── css/
│   │   ├── main.css              # Master stylesheet que orquestra os temas
│   │   ├── style.css             # Variáveis, componentes e tipografia
│   │   └── modules/              # Estilos encapsulados por domínio
│   │       ├── passagem.css
│   │       ├── dashboard.css
│   │       ├── livro.css
│   │       ├── escalas.css
│   │       ├── auditorias.css
│   │       ├── registros.css
│   │       └── skeleton.css      # Efeito pulsante/shimmer de carregamento
│   └── src/
│       ├── main.js               # Bootstrap, Lifecycle, Lazy Loader e Listeners
│       ├── core/                 # 7 Serviços Transversais
│       │   ├── api.js            # Cliente HTTP com Correlation ID e CSRF
│       │   ├── auth.js           # Sessão, perfis, dropdowns e autorização
│       │   ├── draft.js          # Engine de rascunhos assíncronos e autosave
│       │   ├── moduleLoader.js   # Lazy loading dinâmico via import()
│       │   ├── router.js         # Workspaces, modais e topbar dinâmico
│       │   ├── state.js          # Single Source of Truth reativo
│       │   ├── ui.js             # Modais, toasts, rich text editor e skeletons
│       │   └── utils.js          # Debounce, escapeHtml, datas e formatadores
│       └── modules/              # 6 Módulos de Domínio Isolados
│           ├── passagem/passagem.js
│           ├── dashboard/dashboard.js
│           ├── livro/livro.js
│           ├── escala/escala.js
│           ├── registros/registros.js
│           └── auditorias/auditorias.js
│
├── backend/                      # API RESTful Enterprise em Camadas (DDD)
│   ├── server.js                 # Boot Express, Helmet, CORS, Rate Limit, Redis
│   └── src/
│       ├── routes.js             # Roteador central da API
│       ├── core/                 # Infraestrutura Transversal
│       │   ├── config/           # ldap.js, modulos.js, redisClient.js, configCache.js
│       │   ├── database/         # Pool de conexões Oracle Tasy e migrations
│       │   ├── errors/           # AppError e catálogo de exceções
│       │   ├── middlewares/      # authMiddleware, correlationId, errorHandler, responseHandler
│       │   └── utils/            # logger.js estruturado, parseBoolean, acesso.js
│       └── modules/              # 10 Módulos de Domínio (Routes -> Controller -> Service -> Repository)
│           ├── admin/
│           ├── auditorias/
│           ├── auth/
│           ├── dashboard/
│           ├── escalas/
│           ├── ocorrencias/
│           ├── pacientes/
│           ├── registros/
│           ├── setores/
│           └── usuarios/
│
├── auth.sqlite/                  # Banco SQLite local para permissões dinâmicas
├── docker-compose.yml            # Orquestração do Node.js + Redis 7
├── Dockerfile                    # Container com Oracle Instant Client e Node 20
└── ARQUITETURA_E_PADROES.md      # Manual de engenharia para IAs e desenvolvedores
```

---

## 🎯 2. Módulos de Domínio e Funcionalidades

### 🏥 2.1 Passagem de Plantão (`passagem`)
- **Visualização de Pacientes:** Lista leitos e pacientes internados do setor selecionado com dados cadastrais, tempo de internação e médico responsável.
- **Intercorrências & Checkboxes:** Registro estruturado de cuidados críticos (*Contenção, Risco de Fuga, Acompanhante, Broncoaspiração, Lesão, Queda, TAE, Jejum*).
- **Lançamento em Lote:** Permite preencher múltiplos setores em sequência e salvar todos de forma atômica no lote.
- **Passagem de Setor Livre:** Registro de passagem mesmo quando não há pacientes internados no setor.
- **Rascunho Automático (Autosave):** Previne perda de dados caso a página seja recarregada ou a conexão oscile.
- **Histórico & Filtros:** Consulta de passagens anteriores por setor e período.

### 📊 2.2 Dashboard de Leitos & Pronto Atendimento (`dashboard`)
- **Dashboard de Internação:** Cards visuais de leitos com alertas em tempo real (*Prescrição de Agora, Medicação Suspensa, Material de Agora, Checagem Pendente, Contenção SN, Alta Médica Liberada*).
- **Dashboard do P.A. (Pronto Atendimento):** Visão completa da fila de espera, tempos de permanência, classificação de risco e triagem.
- **Regulação de Vagas PSI:** Modal para visualização de solicitações de internação com aceite/recusa médica e alteração com justificativa.
- **Prewarm Inteligente de Cache:** O backend pré-aquece em memória os setores mais movimentados (`68, 28, 34, 59, 83`) para respostas em < 5ms.

### 📖 2.3 Livro Administrativo (`livro`)
- **Montagem de Equipe:** Seleção de Enfermeiro do plantão, Técnicos de Enfermagem, Pátio, Circulante e procedimentos de ECT (Pré, Sala e Recuperação).
- **Distribuição Técnica:** Vinculação inteligente de pacientes aos técnicos com trava de conflito (impede que técnicos de pátio recebam pacientes de leito).
- **Faltas & Folgas:** Registro de ausências justificadas e não justificadas.
- **Impressão de Escalas:** Geração consolidada do espelho do livro em PDF/impressão com filtro por setor e turno.

### 📅 2.4 Gestão de Escalas (`escala`)
- **Grade Semanal:** Calendário semanal de profissionais (Psicologia e Enfermagem).
- **Edição & Rascunho:** Alteração de células de plantão com controle de modificações.
- **Publicação Atômica com Justificativa:** Arquivamento da versão anterior em `CONECTA_ESCALA_LOG` e publicação da nova escala.
- **Impressão de Semanas Liberadas:** Exportação formatada para corpo clínico.

### 📝 2.5 Registros & Demanda Espontânea (`registros`)
- **Busca Unificada:** Pesquisa rápida de pessoa física/paciente por CPF, CNS, Nome ou Data de Nascimento.
- **Formulário de Demanda Espontânea:** Registro ágil de queixa, conduta e encaminhamentos com histórico de atendimentos anteriores.

### 🔍 2.6 Auditorias Assistenciais (`auditorias`)
- **Higiene de Mãos:** Formulário de observação dos 5 momentos da OMS por categoria profissional com cálculo instantâneo da taxa de adesão (meta hospitalar).
- **Processos Assistenciais:** Auditoria por paciente com checklist de segurança (identificação, pulseira, risco de queda, lesão por pressão).
- **Relatórios & Exportação:** Gráficos de indicadores e exportação de dados consolidados em Excel.

---

## ⚡ 3. Destaques de Engenharia e Performance

1. **Lazy Loading Dinâmico (`frontend/src/core/moduleLoader.js`):**
   - Os módulos de tela são importados sob demanda via `import()`. Reduz o tempo de boot inicial em **~60%** e poupa memória nos computadores dos postos de enfermagem.
2. **Skeleton Loaders (`frontend/css/modules/skeleton.css`):**
   - Elimina mensagens estáticas de "Carregando..." e renderiza cards pulsantes com efeito *shimmer*, trazendo uma UX moderna e estável.
3. **Correlation ID (`X-Request-Id`) & Structured Logging:**
   - Cada requisição recebe um ID único rastreado do frontend ao Oracle, facilitando o diagnóstico imediato de qualquer inconsistência em produção.
4. **Engine de Rascunhos Assíncronos (`draft.js`):**
   - Dirty checking em memória + localStorage com serialização segura para garantir que nenhum dado digitado pelo profissional de saúde se perca.
5. **Zero Monolito:**
   - 100% do código legado foi refatorado em 14 módulos ES Modules modernos, validados via AST sem nenhuma variável órfã.

---

## 🚀 4. Como Executar o Projeto

### Pré-requisitos
- **Docker** e **Docker Compose** instalados.
- Conectividade de rede com o banco Oracle TASY e servidor LDAP/Active Directory.

### 1. Clonar o Repositório
```bash
git clone http://git.heal.br/pedro.cesario/CONECTA-MODULAR.git
cd CONECTA-MODULAR
```

### 2. Configurar Variáveis de Ambiente
Crie o arquivo `.env` a partir do `.env.example`:
```bash
cp .env.example .env
```
Preencha as credenciais do banco Oracle, LDAP e chaves de sessão:
```env
# Oracle TASY
DB_HOST=192.168.1.21
DB_PORT=1521
DB_SERVICE=tasyhml
DB_USER=tasy
DB_PASSWORD=sua_senha_oracle

# LDAP / Active Directory
LDAP_ENABLED=true
LDAP_URL=ldap://192.168.1.4:389
LDAP_BASE_DN=DC=heal,DC=local
LDAP_USER_DOMAIN=heal
LDAP_ADMIN_USER=servico.ldap
LDAP_ADMIN_PASSWORD=sua_senha_ldap

# Redis & Sessão
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=sua_senha_redis
SESSION_SECRET=chave_secreta_longa_e_aleatoria
```

### 3. Iniciar com Docker Compose
```bash
docker compose up -d --build
```
A aplicação estará disponível em: **`http://localhost:3020`** (ou porta configurada).

---

## 🔍 5. Endpoints de Monitoramento & Health Check

- **`GET /health`**: Retorna o status operacional da aplicação, pool de conexões Oracle e conectividade com o Redis.
- **`GET /metrics`**: Métricas de consumo de memória, tempo de atividade e estatísticas de conexões ativas no pool Oracle.

---

## 📘 6. Diretrizes para IAs & Desenvolvedores
Para regras de contribuição, padrões de importação, gerenciamento de estado e validação via AST, consulte o arquivo oficial:  
👉 [`ARQUITETURA_E_PADROES.md`](./ARQUITETURA_E_PADROES.md)

---

## 📄 Licença
Sistema interno exclusivo do Hospital Espírita André Luiz (HEAL). Todos os direitos reservados.
