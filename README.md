# Conecta HEAL - Sistema de Integração Assistencial

O **Conecta HEAL** é um sistema web responsivo desenvolvido para modernizar e integrar as rotinas assistenciais do corpo clínico e de enfermagem. Ele atua como um hub de gestão de plantões, escalas e dashboards hospitalares, com forte integração ao sistema TASY (Oracle) e autenticação segura (Active Directory / LDAP / SSO).

---

## 🚀 Tecnologias Utilizadas

### Backend (Node.js)
- **Framework:** Express.js
- **Banco de Dados:**
  - **Oracle DB** (`oracledb`): Integração direta com o sistema TASY (Prontuário Eletrônico).
  - **SQLite3**: Armazenamento local de configurações e perfis.
  - **Redis**: Gerenciamento de sessão, cache de alta performance e Rate Limiting.
- **Segurança & Autenticação:**
  - `ldapjs`: Autenticação integrada com Active Directory (AD).
  - Native SSO Service: Autenticação via Single Sign-On para facilitar o login corporativo.
  - `helmet`, `cors`, `express-rate-limit`: Proteção de cabeçalhos e mitigação de ataques (DDoS/Brute Force).

### Frontend (Vanilla Stack)
- **HTML5 & CSS3:** Arquitetura flexível com CSS Grid e Flexbox, garantindo simetria absoluta e responsividade (ex: contrapeso matemático perfeito no Topbar para telas como 1366x768).
- **JavaScript (Vanilla):** Manipulação de DOM, requisições AJAX dinâmicas (`fetch`), gerenciamento de estado (modo de visualização, seleção de turno, perfis ativos) sem dependência pesada de frameworks.
- **Design System:** Baseado em princípios modernos de UI/UX, utilizando paleta de cores consistente (ex: Slate, Primary Blue), gradientes suaves, glassmorphism (`backdrop-filter`) e ícones Bootstrap.

---

## 🧩 Módulos do Sistema

1. **Passagem de Plantão:** Permite que a equipe de enfermagem visualize e transfira o cuidado dos pacientes de forma estruturada.
2. **Livro Administrativo:** Gestão de ocorrências e registros administrativos vitais para a supervisão do andar/setor.
3. **Gestão de Escalas:** Controle dinâmico da alocação de profissionais por turno e setor.
4. **Dashboard de Pacientes:** Visão macro em tempo real de estatísticas como checagens, atrasos de medicação e volume de pacientes por setor.
5. **Pronto Atendimento:** Monitoramento ágil de indicações de internação e decisões de triagem (Dashboard P.A.).
6. **Painel de Administração:** Restrito a usuários do grupo `API_CONECTA_ADMIN`, permite configurações sistêmicas.

---

## 🔄 Fluxo de Funcionamento

1. **Autenticação (Login):**
   - O usuário acessa a tela de login.
   - O Backend intercepta a requisição e valida as credenciais contra o Servidor LDAP (Active Directory) ou por SSO Nativo.
   - Uma vez validado, o sistema recupera os grupos de AD do usuário e gera uma sessão segura (armazenada em Redis).
2. **Seleção de Perfil / Modos:**
   - Com base nos grupos do AD, o Frontend renderiza os módulos permitidos.
   - O usuário seleciona o perfil (ex: *Enfermagem*, *Técnico de Enfermagem*, *Psicologia*). A interface oculta ou exibe abas dinamicamente no **Topbar** e na área de seleção de modos.
3. **Navegação (Single Page Application feel):**
   - O usuário alterna entre os módulos (Passagem, Escalas, Dashboard) através do menu superior alinhado simetricamente.
   - Ao trocar de aba, o JavaScript manipula as classes `.d-none` (Display None) para exibir a *Workspace* correspondente.
4. **Comunicação com o TASY:**
   - O Backend recebe as chamadas da API (ex: `GET /api/pacientes/setor/X`) e executa queries no Oracle DB do TASY.
   - Os dados são formatados e enviados em JSON para o Frontend pintar os "cards" de pacientes ou os medidores do Dashboard.

---

## ⚙️ Comandos Essenciais (Setup e Deploy)

### 1. Instalação de Dependências
Certifique-se de ter o Node.js v18+ instalado.
```bash
npm install
```

### 2. Configuração do Banco de Dados Local (SQLite)
Na primeira execução, inicialize o banco de configurações locais:
```bash
npm run db:init
```

### 3. Executando o Servidor
**Em modo de Desenvolvimento (Hot Reload no servidor):**
```bash
npm run dev
```

**Em modo de Produção:**
```bash
npm start
```

### 4. Executando Testes
Para rodar a suíte de testes de Single Sign-On (SSO):
```bash
npm run test:sso
```

---

## 📂 Estrutura de Diretórios

```text
/
├── backend/
│   ├── config/          # Instâncias do banco de dados (Oracle, SQLite, Redis), LDAP
│   ├── controllers/     # Lógica de controle de rotas (Auth, Pacientes, SSO)
│   ├── middleware/      # Interceptadores (Autenticação, Permissões)
│   ├── repositories/    # Camada de acesso a dados (Queries SQL encapsuladas)
│   ├── routes/          # Definição dos endpoints REST da API
│   ├── services/        # Regras de negócio e integrações pesadas
│   └── utils/           # Funções auxiliares compartilhadas
├── frontend/
│   ├── css/             # Estilos (style.css contém regras avançadas de layout simétrico)
│   ├── img/             # Assets, ícones, fundos
│   ├── js/              # app.js (Lógica de interação, chamadas API, UI state)
│   ├── index.html       # Single Page Application container
│   └── admin.html       # View separada para o Painel Administrativo
├── scripts/             # Scripts de setup estrutural (init db)
├── package.json         # Dependências e scripts de automação
└── README.md            # Documentação raiz
```

---

## 🎨 Notas de Design & UI/UX
- **Simetria Geométrica:** O Topbar superior não usa compensações engessadas de pixels, mas sim alinhamento de bloco com igualdade de áreas de preenchimento e ancorado puramente em matemática via `position: absolute; left: 50%`. As tipografias orgânicas fecham a balança visual entre os botões.
- **Menu Dinâmico:** A Engrenagem de Administração fica agrupada logicamente dentro do *Dropdown* do usuário ativo, impedindo que a presença da aba quebre a centralização visual do cabeçalho.
- **Scroll Inteligente:** O cabeçalho dos submódulos (como "Lançar nova passagem") desliza naturalmente e de forma fluída junto ao rolar dos cards de pacientes, maximizando o espaço útil da tela.

---

*Conecta HEAL - Construído com rigor técnico e atenção meticulosa aos detalhes visuais.*
