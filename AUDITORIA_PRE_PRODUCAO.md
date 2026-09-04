# Auditoria pré-produção — Conecta Modular

**Data:** 02/09/2026  
**Escopo:** revisão estática de backend, frontend, infraestrutura, banco, autenticação e integrações; validações não destrutivas no ambiente local em execução. Nenhum código, configuração, dado de negócio ou container em execução foi alterado por esta auditoria.

## Resumo executivo

**Classificação final: NÃO APTO PARA PRODUÇÃO.**

Foram encontrados controles de autorização ausentes no módulo de Recepção, credenciais de integração embutidas no código-fonte, Redis como ponto único de falha com healthcheck que informa sucesso indevidamente, chamadas externas e do frontend sem timeout, e condições de corrida em fluxos operacionais. Esses pontos permitem acesso indevido a dados de pacientes, gravações duplicadas/inconsistentes e falhas amplas sem detecção pelo orquestrador.

### Achados por severidade

| Severidade | Quantidade |
|---|---:|
| CRÍTICO | 3 |
| ALTO | 10 |
| MÉDIO | 6 |
| BAIXO | 2 |
| **Total** | **21** |

## Problemas críticos

### C-01 — Credenciais de TASY Reports embutidas no código

- **Severidade:** CRÍTICO
- **Arquivo / componente:** `backend/src/modules/recepcao/tasyReportsClient.js` — `getTasyUser`, `getTasyPassword`, `getTasyClientId` e `getTasyScope`.
- **Problema identificado:** há valores funcionais de integração, incluindo credencial de serviço, como fallback no código. Se a variável de ambiente ou a configuração SQLite estiver ausente, a aplicação tenta autenticar usando esse segredo conhecido. A existência desses valores no repositório e em camadas de imagem/log aumenta a exposição.
- **Cenário real:** cópia do repositório, acesso de leitura ao código, backup ou vazamento de imagem permite reutilizar as credenciais contra o TASY Reports.
- **Impacto para o usuário:** emissão indevida de relatórios e acesso a informações clínicas associadas ao serviço.
- **Impacto para a plataforma:** comprometimento da integração, necessidade de rotação emergencial, possível indisponibilidade por bloqueio da conta e incidente LGPD.
- **Correção recomendada:** revogar/rotacionar imediatamente todas as credenciais expostas; remover qualquer fallback secreto do fonte; exigir secret manager/variável obrigatória validada na inicialização; impedir que segredos apareçam em `docker compose config`, logs e respostas administrativas.
- **Risco de regressão da correção:** médio — exige provisionar segredos no ambiente antes do deploy.

### C-02 — Recepção não aplica autorização por módulo, permissão ou setor no backend

- **Severidade:** CRÍTICO
- **Arquivo / componente:** `backend/src/routes.js`, `backend/src/modules/recepcao/routes.js`, `backend/src/modules/recepcao/recepcaoController.js`.
- **Problema identificado:** o roteador central aplica somente `requireAuth` a `/api/recepcao`. Diferentemente de Passagem, Registros, Auditorias e Dashboard, os controllers de Recepção não chamam `validarModuloPermissao`, nem validam setor/atendimento pertencente ao perfil ativo.
- **Cenário real:** qualquer usuário autenticado, inclusive sem o módulo Recepção no menu, pode chamar diretamente por URL ou ferramenta HTTP os endpoints de busca de pessoa, fila, cadastro/alteração de pessoa, abertura de atendimento, GED e relatórios.
- **Impacto para o usuário:** exposição de PII/dados clínicos e possibilidade de operar fluxos de recepção sem perfil autorizado.
- **Impacto para a plataforma:** violação de segregação de funções, registros indevidos no TASY e incidente de segurança/LGPD. O bloqueio visual do frontend não protege a API.
- **Correção recomendada:** criar middleware de autorização no backend por módulo, ação e escopo de setor; aplicá-lo a todas as rotas de Recepção e validar o vínculo do recurso solicitado ao setor/atendimento autorizado. Cobrir com testes de 401/403 para cada rota mutável e de leitura sensível.
- **Risco de regressão da correção:** alto — requer definição formal dos perfis e permissões da Recepção, mas é obrigatório antes da produção.

### C-03 — Redis é ponto único de falha e seus healthchecks reportam sucesso falso

- **Severidade:** CRÍTICO
- **Arquivo / componente:** `backend/server.js`, `backend/src/core/config/redisClient.js`, `docker-compose.yml`.
- **Problema identificado:** sessões e rate limiting dependem diretamente de Redis. O cliente conecta de modo assíncrono, sem a inicialização aguardar disponibilidade, sem timeout/fallback controlado e sem modo explícito para fila offline. Além disso, o healthcheck Redis executa `redis-cli ping` sem senha: a verificação atual retorna `NOAUTH Authentication required`, mas sai com código 0 e o Docker a marca como saudável. O healthcheck Node consulta `/metrics`, que não valida Oracle nem Redis.
- **Cenário real:** Redis indisponível, senha incorreta, DNS falho ou conexão ainda não estabelecida. As requisições de API podem falhar, ficar pendentes ou perder sessão; ainda assim o orquestrador mantém Redis e Node como `healthy`.
- **Impacto para o usuário:** login/sessão e chamadas de API podem deixar de funcionar ou ficar em loading indefinido, sem reinício automático confiável.
- **Impacto para a plataforma:** indisponibilidade transversal de autenticação e API, diagnósticos falsos, atraso de recuperação e escalonamento incorreto de incidentes.
- **Correção recomendada:** definir política explícita de falha para Redis; aguardar conexão antes de aceitar tráfego ou implementar degradação segura; configurar reconexão, timeout e tratamento de erros do store/limiter; corrigir healthcheck com autenticação e fazer o Node testar dependências essenciais em endpoint de readiness distinto de liveness.
- **Risco de regressão da correção:** médio — altera a estratégia de startup, sessão e rate limiting; testar indisponibilidade e reconexão antes do deploy.

## Achados altos

### A-01 — Pool Oracle não aplica o timeout de chamada configurado

- **Severidade:** ALTO
- **Arquivo / componente:** `backend/src/core/database/index.js` — `initPool` e `getConnection`.
- **Problema identificado:** `DB_CALL_TIMEOUT` é documentado no ambiente, porém não é usado na criação do pool nem em conexões. Consultas travadas ou rede degradada podem reter conexões até limites inferiores da pilha.
- **Cenário real:** Oracle/TASY lento, lock de banco ou falha parcial de rede durante consulta de dashboard, recepção ou escalas; 15 conexões ficam ocupadas e novas requisições atingem `queueTimeout`.
- **Impacto para o usuário:** erros ou loading prolongado em vários módulos.
- **Impacto para a plataforma:** esgotamento do pool, cascata de 500 e indisponibilidade do backend para todos os módulos Oracle.
- **Correção recomendada:** aplicar timeout de chamada compatível com `node-oracledb`, validar limites numéricos (`min <= max`, incremento, queue timeout), registrar métricas de fila/uso e devolver erro de dependência controlado.
- **Risco de regressão da correção:** médio — consultas legítimas longas precisam de timeout específico e monitoramento.

### A-02 — A aplicação pode iniciar sem Oracle e expor módulos inevitavelmente quebrados

- **Severidade:** ALTO
- **Arquivo / componente:** `backend/server.js` — `start`; `.env` em uso no ambiente.
- **Problema identificado:** com `DB_REQUIRED_ON_STARTUP=false`, erro na criação/validação do pool apenas gera aviso e o servidor passa a atender. Quase todos os módulos dependem do Oracle.
- **Cenário real:** banco indisponível no restart do Node; `/metrics` retorna 200 e o container permanece saudável, mas telas autenticadas falham em cascata.
- **Impacto para o usuário:** login pode até iniciar, mas dashboard, passagem, recepção, escalas, registros e auditorias falham.
- **Impacto para a plataforma:** publicação de instância degradada como saudável e erro em massa.
- **Correção recomendada:** em produção exigir Oracle no startup ou expor explicitamente modo de manutenção que bloqueie login/rotas dependentes; usar readiness que retorne 503 enquanto a dependência não estiver pronta.
- **Risco de regressão da correção:** baixo a médio — muda a disponibilidade durante indisponibilidade planejada.

### A-03 — TASY Reports/GED não possuem timeout, limite de resposta ou cancelamento

- **Severidade:** ALTO
- **Arquivo / componente:** `backend/src/modules/recepcao/tasyReportsClient.js` — `requestHttp`, `loginTasy`, `loginTasyUser`, `gerarRelatorioPdf`, `uploadArquivoTasyStorage`.
- **Problema identificado:** `http.request`/`https.request` não usam `setTimeout`, `AbortSignal` ou limite de bytes. Respostas são acumuladas integralmente em `Buffer.concat`.
- **Cenário real:** TASY Reports aceita conexão mas não responde, envia PDF muito grande ou Storage fica lento. O login aguarda a autenticação auxiliar do TASY; relatório e GED mantêm request e memória presos.
- **Impacto para o usuário:** login, geração de relatório ou upload não terminam; tela ou popup fica sem resposta.
- **Impacto para a plataforma:** acúmulo de sockets/buffers, consumo de memória e degradação do Node para demais módulos.
- **Correção recomendada:** implementar timeout por fase (conexão, headers e resposta), destruir request em timeout, limitar tamanho de PDF/upload, validar status e conteúdo antes de bufferizar e propagar erro 503/504 amigável.
- **Risco de regressão da correção:** médio — definir limites compatíveis com os relatórios aceitos.

### A-04 — Cliente HTTP do frontend não possui timeout global

- **Severidade:** ALTO
- **Arquivo / componente:** `frontend/src/core/api.js` — `api.request`; também `frontend/src/modules/recepcao/recepcao.js` — consulta ViaCEP.
- **Problema identificado:** todos os `fetch` centrais aguardam indefinidamente; não há `AbortController`, timeout nem estratégia uniforme de erro/retry. Vários fluxos só restauram botões no `finally`, que não ocorre enquanto o fetch está pendente.
- **Cenário real:** API, Redis, Oracle, TASY ou rede perde resposta após a conexão. O botão fica em “Salvando/Buscando”, e o usuário não recebe opção de recuperar sem recarregar.
- **Impacto para o usuário:** loading infinito, botão desabilitado e possível reenvio após refresh.
- **Impacto para a plataforma:** aumento de requests pendentes e amplificação de indisponibilidades de dependências.
- **Correção recomendada:** centralizar timeout/cancelamento no cliente API, diferenciar 401/403/429/5xx/timeout, restaurar estado de UI e impedir retry cego de operações mutáveis.
- **Risco de regressão da correção:** médio — operações longas devem ter timeout por rota.

### A-05 — Upload GED aceita arquivo e MIME controlados pelo cliente sem validação de tamanho/tipo no servidor

- **Severidade:** ALTO
- **Arquivo / componente:** `backend/server.js`, `backend/src/modules/recepcao/recepcaoService.js`, `frontend/src/modules/recepcao/recepcao.js` — `abrirUploadGED`.
- **Problema identificado:** o backend aceita base64 em JSON de até 25 MB, converte para `Buffer` e monta outro buffer multipart inteiro. Não valida extensão, MIME real, tamanho, PDF/imagem válido, atendimento obrigatório ou consistência do binário. O `accept` HTML não é proteção.
- **Cenário real:** usuário autenticado envia base64 arbitrário, arquivo grande ou MIME falso diretamente à API; múltiplos uploads simultâneos multiplicam memória e tráfego para TASY Storage.
- **Impacto para o usuário:** upload pode travar, anexar conteúdo impróprio ou terminar em erro sem recuperação clara.
- **Impacto para a plataforma:** risco de DoS/memória, conteúdo não permitido no GED e integração TASY degradada.
- **Correção recomendada:** usar upload multipart com streaming e limite servidor; validar tamanho, magic bytes, MIME permitido, extensão normalizada, atendimento/pessoa e permissão; rejeitar base64 inválido antes de alocar buffers.
- **Risco de regressão da correção:** médio — exige ajustar cliente e limites operacionais.

### A-06 — Corrida ao chamar próxima senha pode chamar o mesmo paciente duas vezes

- **Severidade:** ALTO
- **Arquivo / componente:** `backend/src/modules/recepcao/recepcaoRepository.js` — `chamarProximaSenha`.
- **Problema identificado:** o fluxo faz `SELECT ... ROWNUM = 1` e só depois `UPDATE` pelo identificador, sem `FOR UPDATE SKIP LOCKED`, sem condição `dt_chamada IS NULL` no update e sem verificar `rowsAffected`.
- **Cenário real:** dois guichês ou duplo clique chegam antes do primeiro commit. Ambos selecionam a mesma senha e ambos registram chamada/histórico.
- **Impacto para o usuário:** paciente pode ser chamado em duplicidade e a fila fica incoerente.
- **Impacto para a plataforma:** registros operacionais duplicados, auditoria imprecisa e conflitos entre guichês.
- **Correção recomendada:** tornar a reserva atômica por lock (`FOR UPDATE SKIP LOCKED`) ou `UPDATE ... WHERE dt_chamada IS NULL RETURNING`; validar uma única linha afetada e cobrir com teste concorrente.
- **Risco de regressão da correção:** médio — depende de semântica de prioridade e Oracle.

### A-07 — Atualização concorrente da escala ativa pode sobrescrever ou duplicar estado

- **Severidade:** ALTO
- **Arquivo / componente:** `backend/src/modules/escalas/escalaAtivaRepository.js` — `saveAtiva`.
- **Problema identificado:** lê a versão máxima, copia registros ao log, apaga o conjunto ativo e reinsere itens, sem lock do contexto, constraint única ou versionamento otimista. Duas transações podem calcular a mesma versão e apagar o trabalho uma da outra.
- **Cenário real:** dois usuários editam o mesmo setor/data/turno em abas diferentes e salvam quase simultaneamente.
- **Impacto para o usuário:** perda silenciosa da escala recém-editada ou versão inconsistente.
- **Impacto para a plataforma:** dados operacionais divergentes, log não confiável e necessidade de intervenção manual.
- **Correção recomendada:** impor chave única por contexto/item, controlar versão no request e fazer update condicional, ou serializar com lock transacional; retornar conflito HTTP 409 para rebase do usuário.
- **Risco de regressão da correção:** alto — define contrato de concorrência do módulo.

### A-08 — DDL e migração de tabela Oracle acontecem no caminho de startup e erros são suprimidos

- **Severidade:** ALTO
- **Arquivo / componente:** `backend/src/core/database/index.js` — `initEscalaAtivaTables`; `backend/src/modules/escalas/escalaAtivaRepository.js` — `initTables`.
- **Problema identificado:** o servidor tenta criar tabelas/sequência Oracle em runtime. Falhas de permissão, lock ou corrida entre réplicas viram apenas `console.warn`; a aplicação continua, deixando o módulo Escala quebrado somente quando utilizado.
- **Cenário real:** usuário de produção não possui privilégio DDL, objeto existe em owner diferente, ou dois containers iniciam juntos.
- **Impacto para o usuário:** módulo de Escala falha após login com 500.
- **Impacto para a plataforma:** deploy aparentemente saudável com falha funcional oculta e alterações de schema não rastreadas.
- **Correção recomendada:** mover DDL para migração versionada executada e aprovada antes do deploy; falhar a readiness se schema obrigatório estiver ausente; não executar DDL pelo usuário da aplicação.
- **Risco de regressão da correção:** médio — requer pipeline de banco e validação de grants.

### A-09 — XSS armazenado ao renderizar passagem anterior

- **Severidade:** ALTO
- **Arquivo / componente:** `frontend/src/modules/passagem/passagem.js` — `renderDetail`; `backend/src/modules/ocorrencias/ocorrenciaService.js` — `sanitizeTexto`.
- **Problema identificado:** `item.ds_ocorrencia` é inserido diretamente em `innerHTML`. No backend, `sanitizeTexto` apenas aplica `trim`, não escapa HTML. Conteúdo textual salvo na passagem pode executar script/event handlers quando outro usuário abrir o histórico. A CSP foi desabilitada em `backend/server.js`.
- **Cenário real:** autor inclui HTML malicioso na intercorrência; usuário com permissão de consulta abre o registro histórico.
- **Impacto para o usuário:** execução de conteúdo não confiável na sessão, alteração visual, ações em nome do usuário e possível exfiltração de dados apresentados.
- **Impacto para a plataforma:** escalonamento de privilégio entre perfis e incidente de segurança.
- **Correção recomendada:** renderizar como `textContent`/nós de texto ou escapar o conteúdo antes de `innerHTML`; reabilitar CSP apropriada; revisar todas as inserções de dados externos em HTML.
- **Risco de regressão da correção:** baixo a médio — pode alterar a apresentação de quebras de linha, que deve ser preservada com conversão segura.

### A-10 — Cookies de sessão podem ser transmitidos sem flag `Secure`

- **Severidade:** ALTO
- **Arquivo / componente:** `backend/server.js` — configuração de sessão; `.env.example`.
- **Problema identificado:** `COOKIE_SECURE` aceita `false` e a limpeza de logout força `secure: false`. Em cenário HTTPS terminado por proxy, configuração incorreta permite cookie sem `Secure`; o logout pode não limpar um cookie emitido como seguro.
- **Cenário real:** acesso por HTTP interno, proxy mal configurado ou downgrade na rede; cookie de sessão é exposto/retido.
- **Impacto para o usuário:** sequestro de sessão ou sessão aparentemente encerrada que continua válida até TTL.
- **Impacto para a plataforma:** acesso não autorizado e incidente de autenticação.
- **Correção recomendada:** em produção tornar `Secure` obrigatório, validar `TRUST_PROXY`, usar mesmo conjunto de atributos no `clearCookie` e separar configuração de desenvolvimento.
- **Risco de regressão da correção:** médio — ambientes sem HTTPS correto deixarão de autenticar, o que é desejável para produção.

## Achados médios

### M-01 — `KEYS sess:*` pode bloquear Redis e listar sessões sem paginação

- **Severidade:** MÉDIO
- **Arquivo / componente:** `backend/src/modules/admin/adminController.js` — `listarSessoes`.
- **Problema identificado:** uso de `KEYS` e `mGet` de todas as sessões em uma única operação.
- **Cenário real:** crescimento de sessões ativas ou dados persistidos; um administrador abre a tela de sessões.
- **Impacto para o usuário:** lentidão/intermitência de sessão e rate limit.
- **Impacto para a plataforma:** Redis monothread pode bloquear comandos de toda a aplicação.
- **Correção recomendada:** usar `SCAN` paginado, limite de resultados e índice próprio de sessões administrativas.
- **Risco de regressão da correção:** baixo.

### M-02 — Consultas de lista sem limite e filtros não sargáveis podem degradar Oracle

- **Severidade:** MÉDIO
- **Arquivo / componente:** `backend/src/modules/recepcao/recepcaoRepository.js` — `listarSenhasEspera`, `listarDocumentosGED`; `backend/src/modules/escalas/escalaAtivaRepository.js`; demais consultas com `TRUNC(coluna_data)`.
- **Problema identificado:** filas/documentos retornam todos os registros do contexto; filtros `TRUNC(coluna)` dificultam uso de índice padrão na coluna de data. Não há paginação ou teto no controller para esses casos.
- **Cenário real:** fila extensa, GED acumulado ou escala/histórico crescendo; múltiplos usuários com polling.
- **Impacto para o usuário:** resposta lenta e telas que parecem travadas.
- **Impacto para a plataforma:** pressão no Oracle e contribuição para esgotamento do pool.
- **Correção recomendada:** paginação/limites, índices compatíveis e predicados por intervalo de data (`>=` e `<`) em vez de função na coluna.
- **Risco de regressão da correção:** médio — validar ordenação e paginação com usuários.

### M-03 — Parâmetros numéricos inválidos chegam ao Oracle como `NaN`/nulos ambíguos

- **Severidade:** MÉDIO
- **Arquivo / componente:** `backend/src/modules/recepcao/recepcaoRepository.js`, `backend/src/modules/dashboard/dashboardController.js`, `backend/src/modules/pacientes/pacienteController.js`.
- **Problema identificado:** diversos handlers fazem `parseInt` ou `Number` sem validar `Number.isInteger` antes de bind. Alguns serviços validam apenas presença.
- **Cenário real:** URL com `fila=abc`, ID negativo, data inválida ou corpo alterado fora do frontend.
- **Impacto para o usuário:** 500/erro técnico em vez de 400 explicativo.
- **Impacto para a plataforma:** ruído de logs, consumo de pool e maior superfície de falha de conversão Oracle.
- **Correção recomendada:** validadores de schema por rota, limites de faixa e formato; normalizar datas e IDs antes de entrar em service/repository.
- **Risco de regressão da correção:** baixo a médio.

### M-04 — O teste de infraestrutura depende de rede real e não encerra recursos adequadamente

- **Severidade:** MÉDIO
- **Arquivo / componente:** `backend/test/infra.test.js`, `backend/src/modules/admin/adminController.js`.
- **Problema identificado:** a suíte executa diagnóstico Oracle/LDAP real. A execução de `npm test` passou 24 testes, mas ficou pendurada no teste de infraestrutura por aproximadamente 111 s e precisou ser interrompida; o runner terminou com 1 teste cancelado. No host, o Oracle não carregou o cliente nativo e tentou Thin mode, que não suporta o verificador de senha do alvo.
- **Cenário real:** CI sem rede/Oracle/LDAP ou com Instant Client incompleto.
- **Impacto para o usuário:** não direto, mas defeitos de integração podem chegar à produção sem gate confiável.
- **Impacto para a plataforma:** pipeline instável, testes dependentes de credenciais e possível vazamento de tráfego para serviços reais.
- **Correção recomendada:** separar unitários de integração, mockar Oracle/LDAP/TASY por padrão, usar ambiente de homologação explícito e teardown de pool/clientes; falhar por timeout controlado.
- **Risco de regressão da correção:** baixo.

### M-05 — Não há build, lint ou testes automatizados do frontend configurados

- **Severidade:** MÉDIO
- **Arquivo / componente:** `package.json`, `frontend/`.
- **Problema identificado:** os scripts disponíveis são `start`, `dev`, `test`, `test:sso` e `db:init`; não existe build/lint nem teste de rotas/browser. O frontend é servido como módulos nativos, portanto import quebrado, seletor inexistente e fluxo de UI não são cobertos pelo teste Node.
- **Cenário real:** alteração no HTML/CSS/JS introduz import ausente, erro de execução ou listener duplicado; Docker continua construindo.
- **Impacto para o usuário:** tela branca, botão sem ação ou loading preso após deploy.
- **Impacto para a plataforma:** regressão visual/funcional não detectada no pipeline.
- **Correção recomendada:** adicionar lint estático, teste de importação, testes e2e críticos (login, sessão expirada, navegação direta, submit duplo e falha de API) e gate de CI.
- **Risco de regressão da correção:** baixo.

### M-06 — Dependências de produção possuem vulnerabilidades conhecidas e pacotes descontinuados

- **Severidade:** MÉDIO
- **Arquivo / componente:** `package-lock.json`, `package.json`.
- **Problema identificado:** `npm audit --omit=dev` encontrou 8 vulnerabilidades: 1 crítica, 3 altas, 3 moderadas e 1 baixa. Cadeias incluem `tar` transitivo de `sqlite3`, `path-to-regexp` do Express 4, `brace-expansion`, `qs`, `ip-address`, `uuid`/`exceljs` e `body-parser`. A build também emitiu avisos de `ldapjs`, `glob`, `inflight` e outros pacotes descontinuados.
- **Cenário real:** uso de caminho vulnerável por payload, parsing ou futura ampliação funcional; dependência não mantida impede patch rápido.
- **Impacto para o usuário:** risco de indisponibilidade ou comportamento inseguro em entradas maliciosas.
- **Impacto para a plataforma:** superfície de ataque e dívida operacional.
- **Correção recomendada:** elaborar atualização controlada do lockfile e dependências diretas (especialmente Express e ExcelJS), revisar breaking changes e repetir audit/testes. Não aplicar `npm audit fix --force` sem homologação.
- **Risco de regressão da correção:** alto para atualizações major; médio para patches compatíveis.

## Achados baixos

### B-01 — `/metrics` está público e a variável de token não é aplicada

- **Severidade:** BAIXO
- **Arquivo / componente:** `backend/server.js` — rota `/metrics`; `.env.example` — `METRICS_TOKEN`.
- **Problema identificado:** endpoint retorna uptime, memória e estado/limites do pool sem autenticação; `METRICS_TOKEN` não é lido.
- **Cenário real:** qualquer origem com acesso à porta publicada consulta detalhes operacionais. A auditoria confirmou HTTP 200 sem credencial.
- **Impacto para o usuário:** indireto.
- **Impacto para a plataforma:** exposição de informação útil para reconhecimento e ausência de proteção prometida por configuração.
- **Correção recomendada:** proteger por rede e token/mTLS, ou remover o endpoint externo; manter apenas métricas necessárias.
- **Risco de regressão da correção:** baixo — atualizar o coletor de métricas.

### B-02 — Rota de API inexistente devolve 401 antes do 404 esperado para não autenticados

- **Severidade:** BAIXO
- **Arquivo / componente:** `backend/src/routes.js` — ordem de middlewares/routers.
- **Problema identificado:** uma chamada anônima a `/api/rota-inexistente` retornou 401 porque o middleware `requireAuth` de routers montados em `/` intercepta antes do handler 404 final.
- **Cenário real:** cliente tenta diagnosticar URL errada sem sessão.
- **Impacto para o usuário:** mensagem enganosa de sessão expirada em vez de rota inexistente.
- **Impacto para a plataforma:** baixo; dificulta observabilidade e troubleshooting.
- **Correção recomendada:** separar routers por prefixo ou garantir handler 404 de API antes de middleware catch-all incompatível, preservando proteção das rotas existentes.
- **Risco de regressão da correção:** baixo.

## Pontos únicos de falha e impacto entre módulos

| Dependência / componente compartilhado | Falha | Módulos afetados | Efeito provável |
|---|---|---|---|
| Redis | indisponível, senha/DNS incorreto ou cliente não pronto | autenticação, sessão, rate limit, Passagem em lote, administração | API transversal falha ou fica pendente; containers podem continuar “healthy” |
| Oracle / pool | banco lento, lock, pool esgotado ou startup sem banco | Dashboard, Passagem, Escala, Livro, Recepção, Registros, Auditorias, login | praticamente toda a plataforma funcional fica indisponível |
| LDAP + política central | indisponível | login/SSO | novos logins bloqueados; cache de política somente permite decisões já existentes |
| TASY Reports / Storage | resposta pendente | login, Relatórios, GED/Recepção | login pode atrasar; requests e memória podem acumular |
| Configuração SQLite | volume indisponível/corrompido | perfis, permissões, módulos, Studio, auditoria local | autorização e configuração podem não carregar corretamente |
| Frontend API sem timeout | API/dependência lenta | todos os módulos | loading infinito e botões indisponíveis até refresh |

## Validações executadas

| Validação | Resultado | Observação |
|---|---|---|
| Inventário e status Git | concluído | havia alterações preexistentes em `frontend/css/modules/recepcao.css` e `frontend/index.html`; não foram tocadas |
| Sintaxe JavaScript | aprovado | `node --check` em todos os `.js` de backend, frontend e scripts sem erro |
| `npm test` | **não aprovado como gate** | 24 testes passaram; 1 teste de infraestrutura permaneceu pendente e foi interrompido após ~111 s |
| Docker Compose config | aprovado com ressalvas | configuração é interpretável, mas healthchecks estão incorretos |
| Docker build (`--no-cache`) | aprovado | imagem construída; `npm ci` reportou as 8 vulnerabilidades já listadas |
| Healthcheck atual Node | resposta 200 | `/metrics` retornou dados do pool/Redis sem credencial; não é readiness real |
| Healthcheck `/health` | resposta 200 | Oracle e Redis estavam disponíveis no momento do teste |
| Healthcheck Redis | **falso positivo confirmado** | `redis-cli ping` retornou `NOAUTH`, mas Docker marca o serviço saudável por código de saída 0 |
| Modo Oracle no container | aprovado no momento | aplicação detectou Oracle Thick; no host de teste, o client nativo não carregou e o modo Thin falhou contra o verificador do banco |
| Rota API inexistente anônima | executado | devolveu 401, não 404 |
| `npm audit --omit=dev` | reprovado | 8 vulnerabilidades, incluindo 1 crítica e 3 altas |

## Testes não executados e limitações

- Não foram criados, atualizados ou removidos dados de Oracle, TASY, GED, LDAP ou Redis. Por isso, concorrência real de gravação, rollback em falha de persistência, abertura de atendimento, GED e dupla chamada de senha foram demonstrados estaticamente, não executados contra dados operacionais.
- Não foi interrompido Redis/Oracle/TASY do ambiente em execução, para evitar indisponibilidade operacional. A análise de queda de dependência baseia-se no código e nos healthchecks observados.
- Não foi realizado login com usuário real, teste de SSO end-to-end, teste de sessão expirada nem verificação de permissões por perfil real, pois exigiriam credenciais autorizadas e poderiam afetar trilhas/auditoria externas.
- Não há suíte e2e/browser nem script de build/lint no projeto; não foi possível validar refresh, botão voltar, múltiplas abas e navegação visual automatizada de ponta a ponta.
- Não foram executados planos de `EXPLAIN`, análise de índices ou carga no Oracle; recomenda-se fazê-los em homologação com dados representativos.

## Pendências prioritárias antes da produção

1. Revogar/rotacionar segredos expostos e remover defaults secretos do repositório/código.
2. Implementar autorização de backend no módulo Recepção por ação, perfil e setor/recurso.
3. Corrigir a estratégia Redis: autenticação no healthcheck, readiness real, startup/reconexão e comportamento em indisponibilidade.
4. Aplicar timeouts e limites em Oracle, TASY Reports, GED e cliente HTTP do frontend.
5. Resolver corridas de fila e escala com operação atômica/controle de versão e testes concorrentes.
6. Corrigir XSS armazenado e adotar CSP segura.
7. Mover DDL Oracle para migrações controladas e adicionar validação de schema no deploy.
8. Atualizar dependências vulneráveis com homologação e criar gates de lint/build/e2e.

## Recomendação final

**NÃO APTO PARA PRODUÇÃO.**

O sistema compila e os serviços estavam ativos no instante da verificação, mas isso não é suficiente: há falhas críticas de segurança e autorização, pontos únicos de falha sem degradação segura, healthchecks enganosos e fluxos concorrentes capazes de gerar inconsistência operacional. A recomendação só deve mudar após correção dos itens críticos, validação em homologação e repetição das verificações de indisponibilidade, permissões, concorrência e sessão.

## Atualização de revalidação — 03/09/2026

**Data da atualização:** 03/09/2026. Nenhum código foi alterado nesta etapa.

### Estado operacional confirmado

- O serviço `conecta-modular-node` foi recriado usando a imagem e o Compose atuais.
- O container está `healthy` e usa o healthcheck correto: `/health/readiness`.
- O readiness retornou 200, com Oracle e Redis `UP`.
- `/metrics` retorna 403 sem token, confirmando a proteção adicionada.
- A sintaxe JavaScript, o Docker build e a suíte `npm test` foram aprovados; testes: 24/24.
- A falha operacional anterior de container `unhealthy` foi resolvida.

### Pendências que permanecem bloqueadoras

- A autorização da Recepção ainda não é granular por ação, setor e recurso; o middleware introduz bypass por nome de usuário/admin que deve ser substituído por regra baseada em grupo/permissão.
- A rotação das credenciais que estavam expostas no código não foi comprovada.
- Oracle continua sem timeout de chamada aplicado, com DDL em startup e sem proteção para concorrência da Escala.
- GED ainda não valida o conteúdo real (magic bytes/MIME), apenas nome/extensão declarada.
- `npm audit --omit=dev` continua reportando 8 vulnerabilidades, incluindo 1 crítica e 3 altas.

## Classificação após a revalidação

**NÃO APTO PARA PRODUÇÃO.**

O bloqueio de healthcheck foi resolvido, mas as pendências restantes incluem autorização incompleta, rotação de segredos não evidenciada, integridade concorrente, resiliência Oracle e vulnerabilidades críticas de dependência. A classificação só deve evoluir após essas correções e nova validação de permissões, concorrência e indisponibilidade.

## Revalidação — commit bb7ddd1 (03/09/2026)

**Resultado:** as correções recentes melhoraram de forma relevante a base de segurança e resiliência, mas a instância ativa ainda não corresponde ao artefato recém-construído.

- **Runtime:** `node` e Redis estão saudáveis; a readiness responde `200` com Oracle e Redis disponíveis. `/metrics` sem credencial responde `403`.
- **Sintaxe:** verificação de todos os arquivos JavaScript concluída sem erro.
- **Testes:** suíte automatizada concluída com 24 testes aprovados.
- **Imagem candidata:** `docker compose build --no-cache` foi concluído com sucesso.
- **Dependências:** a imagem candidata reduz o audit para 4 vulnerabilidades moderadas (sem alta ou crítica); elas ainda exigem tratamento antes da produção.

### Bloqueio atual

O container `node` em execução ainda usa a imagem anterior e versões antigas das dependências, apesar de o código-fonte estar montado. Portanto, a validação do artefato atualizado não representa integralmente o runtime ativo. A recriação controlada do serviço é necessária, seguida de nova verificação de health, permissões, Oracle e concorrência. A proteção concorrente recém-incluída em Escalas também requer teste real em Oracle para confirmar o comportamento do bloqueio e do conflito `409`.

**Classificação mantida: NÃO APTO PARA PRODUÇÃO.** A liberação depende, no mínimo, da recriação com a imagem atual, do tratamento das vulnerabilidades moderadas remanescentes e da evidência de testes ponta a ponta de autorização e concorrência.
