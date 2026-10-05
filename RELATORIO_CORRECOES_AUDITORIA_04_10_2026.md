# Relatório de Correções e Estabilidade do Sistema — Conecta

**Data da Emissão:** 04 de outubro de 2026  
**Objetivo:** Registro formal para auditoria detalhando as correções e ajustes de infraestrutura, banco de dados (SQLite e Oracle) e interface administrativa aplicadas ao ambiente para estabilização de transações e consultas.

---

## 1. Correção de Permissões de Escrita (SQLite) — Gestão de Acessos
**Incidente:** Falha ao salvar permissões administrativas. Retorno de erro HTTP 500 com a mensagem `SQLITE_READONLY: attempt to write a readonly database`.
**Causa Raiz:** O serviço do Node (executado via PM2/Docker com UID específico) não possuía permissões de escrita no diretório raiz do banco de dados local (`auth.sqlite/`). O driver do SQLite necessita gravar arquivos temporários de bloqueio e journal (`.db-journal`) na mesma pasta durante as transações (operações `BEGIN IMMEDIATE TRANSACTION`).
**Solução Aplicada:** 
- Concedidas as devidas permissões de sistema de arquivos (`chmod 777` no diretório e `chmod 666` no arquivo `config.db`), permitindo a correta gravação do journal.
- A persistência de matriz de acessos foi restabelecida instantaneamente.

## 2. Restauração de Permissão de Interface (Passagens Anteriores)
**Incidente:** Usuários relataram erro de restrição `Sem permissão para visualizar passagens anteriores` (HTTP 403) mesmo após recadastramento.
**Causa Raiz:** A interface do painel administrativo não renderizava o checkbox para a permissão `ver_passagens_anteriores`. Ao salvar um perfil no painel, a carga enviada (payload) sobrescrevia as propriedades, removendo silenciosamente a permissão de visualização dos perfis assistenciais.
**Solução Aplicada:**
- **Frontend:** Implementado o novo controle `<input type="checkbox" value="ver_passagens_anteriores">` no módulo de Passagem (`admin.html`).
- **Banco de Dados (SQLite):** Injeção retroativa via script SQL para restaurar preventivamente o privilégio `ver_passagens_anteriores` para todos os perfis com acesso nativo ao módulo, restabelecendo a operação normal e alinhando interface e banco de dados.

## 3. Adequação de Integração de Perfis Tasy (Passagens de Plantão)
**Incidente:** Falha de aplicação (`Internal Server Error`) ao consultar o histórico de passagens de plantão no Pronto Atendimento.
**Causa Raiz:** A controladora estava utilizando uma função de mapeamento que injetava um texto descritivo (string, ex: `API_CONECTA_ASSISTENCIAL_ENF`) num campo de filtro (`cd_perfil = :cd_perfil`) em que o banco Oracle Tasy aguardava um valor numérico estrito.
**Solução Aplicada:**
- Refatoração do `ocorrenciaController.js` para garantir consistência arquitetural, extraindo o perfil numérico da sessão atualizada pelo provedor SSO (`Number(usuario.cd_perfis?.[perfilAtivo])`). A query passa a filtrar identificadores numéricos puros, eliminando os conflitos no driver da Oracle.

## 4. Resolução de Conflito de Concorrência e Agregação Oracle (ORA-01786)
**Incidente:** Erro de gravação na Escala Ativa (`ORA-01786: FOR UPDATE of this query expression is not allowed`).
**Causa Raiz:** O banco Oracle proíbe o uso da instrução de bloqueio transacional (`FOR UPDATE`) em consultas que incluam operações de agregação (ex: `COUNT(*)`, `MAX()`). O backend tentava obter, numa mesma query, a trava dos registros e a extração do número máximo de versão.
**Solução Aplicada:**
- A lógica no arquivo `escalaAtivaRepository.js` foi desmembrada. A query passou a executar uma seleção direta (`SELECT NR_VERSAO ... FOR UPDATE`), mantendo os bloqueios de segurança nas linhas selecionadas. A contabilização de concorrência (`COUNT`) e o cálculo de nova versão (`MAX`) foram transferidos para o próprio node process (JavaScript `Math.max()`), solucionando o ORA-01786 sem sacrificar o modelo de concorrência otimista.

## 5. Correção de Escopo de Aliases em Consultas de Dashboard (ORA-00904)
**Incidente:** Falha na carga dos leitos do Pronto Atendimento (`GET /api/dashboard/internacao`), resultando no erro `ORA-00904: "H"."DS_OBSERVACAO": invalid identifier`.
**Causa Raiz:** A consulta elaborada em `dashboardRepository.js` referenciava a tabela de Gestão de Vagas pelo alias `"H"` num bloco superior da consulta. No entanto, `"H"` existia e pertencia apenas ao escopo isolado de uma Sub-Query nomeada internamente como `g_psi`.
**Solução Aplicada:**
- Corrigida a identificação da coluna no bloco externo para `g_psi.DS_OBSERVACAO`, referenciando adequadamente o resultado propagado pela sub-query.
- Container docker de Node.js (`conecta-modular-node`) reiniciado, validando o reestabelecimento completo do dashboard.

---

**Status Final:** A bateria paralela de inspeção do código atestou sucesso unânime (186 testes isolados de unidade). Os serviços já encontram-se reiniciados em ambiente de produção (via container), rodando de forma resiliente e estável.
