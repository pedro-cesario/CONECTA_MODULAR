# FECHAMENTO COM EVIDÊNCIAS ATUAIS — LIVRO ADMINISTRATIVO

Este relatório consolida o fechamento do incidente do Livro Administrativo (Escala Ativa 403 e Salvamento Parcial), com base na versão atual do código e nas exigências de segurança (filtros e acoplamento de escrita). O incidente encontra-se solucionado em nível de código e validado por testes automatizados (backend) e inspeção estática (frontend).

## 1. Autorização e Filtros de Consultas Agregadas

O sistema garante que um perfil (ex: restrito ao Livro e apenas em determinados setores) não tenha acesso a dados de setores proibidos através de requisições agregadas globais.

### 1.1 `GET /api/escala-tecnica/todas`
- **Handler:** `listarTodasEscalasLiberadas` em `ocorrenciaController.js`.
- **Filtro Aplicado:** O controlador realiza iteração ativa eliminando itens de setores não permitidos.
```javascript
const adminGranted = configCache.perfilTemPermissao(perfilAtivo, 'livro', 'admin') || configCache.perfilTemPermissao(perfilAtivo, 'escala', 'admin');
if (!adminGranted) {
  resultado = resultado.filter(escala => setoresPermitidos.has(Number(escala.cd_setor_atendimento)));
}
```

### 1.2 `GET /api/escala-tecnica` (Sem `cd_setor`)
- **Handler:** `obterEscalaTecnica` em `ocorrenciaController.js`.
- **Filtro Aplicado:** Retorna um objeto único. Se o usuário omitir o `cd_setor`, o controlador avalia o objeto retornado e o anula se pertencer a um setor não autorizado:
```javascript
let resultado = await ocorrenciaService.obterEscalaTecnica(data, cdSetor, turno);
if (cdSetor === null && resultado) {
  // ... extração de perfil
  if (!adminGranted) {
    if (!setoresPermitidos.has(Number(resultado.cd_setor_atendimento))) {
      resultado = null;
    }
  }
}
```

### 1.3 `GET /api/escala-ativa/patio-circulante-global`
- **Handler:** `buscarPatioCirculanteGlobal` em `escalaAtivaController.js`.
- **Ajuste na Query (`escalaAtivaRepository.js`):** A coluna `CD_SETOR_ATENDIMENTO` foi adicionada no `SELECT` da query SQL original.
```sql
SELECT DISTINCT a.IE_TIPO, a.CD_PESSOA_FISICA, a.CD_SETOR_ATENDIMENTO,
       obter_nome_usuario(u.nm_usuario) AS nome
FROM CONECTA_ESCALA_ATIVA a
JOIN usuario u ON u.cd_pessoa_fisica = a.CD_PESSOA_FISICA
WHERE TRUNC(a.DT_PLANTAO) = TO_DATE(:dt_plantao, 'YYYY-MM-DD')
  AND a.IE_TURNO = :ie_turno
  AND a.IE_TIPO IN ('PATIO', 'CIRCULANTE')
ORDER BY a.IE_TIPO, nome
```
- **Filtro Aplicado:** O controller agora intercepta esse retorno e limpa as instâncias cujo setor esteja fora do perímetro de autorização, desduplicando o usuário no final:
```javascript
if (!adminGranted) {
  data.patio = data.patio.filter(p => setoresPermitidos.has(p.cd_setor_atendimento));
  data.circulante = data.circulante.filter(c => setoresPermitidos.has(c.cd_setor_atendimento));
}
// Deduplicação subseqüente por cd_pessoa_fisica...
```

## 2. Acoplamento de Escrita: Módulo vs. Setor

Os handlers de escrita exigem o middleware `requireEscalaOuLivroEscrita`, garantindo acesso por Livro OU Escala (permissão `editar_publicar_escala`). O acoplamento estrito do acesso aos setores dentro do contexto validado encontra-se nos handlers finais.

- **`PUT /api/escala-ativa`** (`saveEscalaAtiva`):
```javascript
const podeLivro = temLivro && configCache.perfilPodeVisualizarSetor(perfilAtivo, cdSetor, 'livro');
const podeEscala = temEscalaEdit && configCache.perfilPodeVisualizarSetor(perfilAtivo, cdSetor, 'escala');
if (!podeLivro && !podeEscala) {
  return res.status(403).json({ success: false, message: 'Setor não autorizado para o perfil ativo' });
}
```
- **`POST /api/escala-tecnica`** (`salvarEscalaTecnica`):
Possui exata replicação da checagem e rejeita requisições se não houver um alinhamento direto do tipo de perfil com a liberação de setor, prevenindo manipulações inter-módulos indevidas.

## 3. Cobertura de Testes e Evidências

Foi criada a suíte **"4. Validação de Acesso Agregado e Escrita Restrita"** no arquivo `investigacao_escala_403.test.js` com a comprovação via `assert.strictEqual`. 

### Comando e Saída
```bash
$ node --test test/investigacao_escala_403.test.js
```
```text
  ▶ 4. Validação de Acesso Agregado e Escrita Restrita
    ✔ 4.1 /escala-tecnica/todas filtra setores proibidos para perfil Livro (2.760688ms)
    ✔ 4.2 /escala-tecnica sem cd_setor filtra setores proibidos (2.274923ms)
    ✔ 4.3 /escala-ativa/patio-circulante-global filtra setores proibidos (2.753955ms)
    ✔ 4.4 Escrita restrita combina módulo e setor corretamente (1.701695ms)
  ✔ 4. Validação de Acesso Agregado e Escrita Restrita (10.09362ms)
✔ Incidente 1 — Livro Administrativo / Escala Ativa 403 e Salvamento Parcial (96.526165ms)
ℹ tests 17
ℹ suites 5
ℹ pass 17
ℹ fail 0
```

## 4. Handler Frontend: Inspeção Estática e Reteste Pendente

Declaramos que a cobertura do tratador visual de salvamento parcial e de tela (`livro.js`) atesta sua correção mediante **inspeção estática rigorosa**, não existindo atualmente bateria autônoma em Node capaz de processar JSDOM integrado ao Ecossistema nativamente sem manipulação ou acréscimo de pacotes restritos de rede.

A rotina simulada `simulateGranularSaveFlow` valida a mecânica temporal da API e falhas predeterminadas, mas *não* executa o handler DOM autêntico. Portanto, um reteste frontend em ambiente real/homologação permanece pendente para homologar totalmente a interface de falhas.

Foram sanadas as duplicações de mensagem garantindo que `loadLivroAdministrativoByDate` propague as falhas adequadamente com `throw err`, sendo tratadas cirurgicamente (e unicamente) pelos métodos chamadores (`loadLivroContextoDebounced`, `onLivroSetorChange`).

## 5. Status da Etapa 11

A Etapa 11 (Padronização da Leitura de Pacientes por Setor) encontra-se **PAUSADA**.

- **Arquivos alterados (preliminares, na branch local):**
  - `backend/src/modules/pacientes/pacienteController.js`
  - `backend/src/modules/dashboard/dashboardRepository.js`
  - `backend/src/modules/dashboard/routes.js`
  - `backend/test/etapa11_pacientes_setor.test.js`
- **Commits:** Nenhum. As alterações habitam apenas a working tree temporária ("commitadas" no relatório anterior referia-se a "salvas em disco local", erro de redação corrigido).
- **Testes executados:** O suíte foi parcialmente desenvolvido e aponta a falha simulada (500 via erro oracledb mock).
- **Tarefas Pendentes:** Restaurar prioridade da tarefa, terminar de ajustar os mapeamentos e realizar teste end-to-end garantindo que o frontend assimile perfeitamente a mudança de contrato REST.

## 6. Snapshot e Dry-Run de Reversão

```bash
$ git diff frontend/src/modules/livro/livro.js backend/src/modules/ocorrencias/ocorrenciaController.js backend/src/modules/escalas/escalaAtivaController.js backend/src/modules/escalas/escalaAtivaRepository.js | patch -R --dry-run -p1
patching file backend/src/modules/escalas/escalaAtivaController.js
patching file backend/src/modules/escalas/escalaAtivaRepository.js
patching file backend/src/modules/ocorrencias/ocorrenciaController.js
patching file frontend/src/modules/livro/livro.js
```
Saída da verificação: Exited with code `0`.
