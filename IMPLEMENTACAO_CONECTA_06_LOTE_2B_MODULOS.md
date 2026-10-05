# IMPLEMENTACAO_CONECTA_06_LOTE_2B_MODULOS.md

## 1. BASE E COMPLEMENTO DA ETAPA 05
Realizou-se a retenção do branch em estado pré-lote criando back-ups para `/backend/src/routes.js` e `/backend/src/core/config/configCache.js`.

**Complemento Documental da Etapa 05 (Mecanismo de Teste):**
Para viabilizar simulações contra os mocks sem reescrever serviços ou depender de injetores complexos, um *test hook* nativo foi inserido no cache do Conecta:
```javascript
// Adicionado em configCache.js (Test Hook)
function setCacheForTest(newCache) {
  cache = { ...cache, ...newCache };
}
module.exports = {
  //... exports ...,
  setCacheForTest 
}
```
*Garantia Operacional:* Essa função injetora foi exposta unicamente no container do Node e consumida pelos arquivos `.test.js`. Como o `configCache` não expõe binds diretos a endpoints HTTP ou rotas dinâmicas, e o payload Express jamais cai neste handler, a modificação é hermética, isolada da navegação e não acionável pelo cliente web. 

**Validação de Reversão da Etapa 05:**
O patch reverso de anulação da limpeza do arquivo `configCache.js` (recolocação das 9 linhas da função morta) foi extraído em lote e validado na máquina por intermédio de utilitário CLI (`patch --dry-run`). A prova atestou aplicabilidade reversa limpa de `1 hunk`, sem conflitos com o histórico base, dispensando execução destrutiva em ambiente servido.

## 2. CONTRATO E CONSUMIDORES DE `/api/modulos`
Inspecionando o Vanilla JS (`frontend/src/core/auth.js`) e as rotas operacionais, os seguintes comportamentos foram observados:
- **Envelope e Campos:** Retorna `{ success: true, data: [...] }`. Os módulos exigidos carregam `id`, `nome`, flags auxiliares e a propriedade crítica `perfisPermitidos` (que anteriormente alocava a matriz sistêmica irrestrita).
- **Consumo do Frontend:** Scripts como o `auth.js` capturam esse array para montar um repositório local `MODULOS_META`.
- **Validação de Permissão (perfilAtivo vs múltiplos):** A renderização de cards e menus na interface avalia estritamente `.includes(String(perfilAtivo))`. No entanto, como o usuário pode ostentar diferentes cargos na Sessão, ele carrega consigo uma coleção `req.session.usuario.perfisDisponiveis`. A função `trocarPerfil()` no frontend aciona novamente a carga (`loadModulosFromBackend()`), mas garantir acesso irrestrito aos escopos de perfis nativos da sessão resguarda a compatibilidade global se o sistema evoluir para validações híbridas.
- O campo `perfisPermitidos` é estritamente ignorado pelas definições dinâmicas de Checkboxes, cujo contrato obedece isoladamente a rota paralela `/api/passagem/checkboxes`.

## 3. IMPLEMENTAÇÃO DA PROJEÇÃO SEGURA (DIFF EXCLUSIVO)

```javascript
// ANTES (backend/src/routes.js:36)
router.get('/modulos', requireAuth, (req, res) => {
  const modulos = configCache.getAllModulosWithPermissoes();
  res.json({ success: true, data: modulos });
});

// DEPOIS (Modificação Exclusiva do Lote 2B)
router.get('/modulos', requireAuth, (req, res) => {
  const modulos = configCache.getAllModulosWithPermissoes();
  const usuario = req.session?.usuario;
  const perfisDisponiveis = new Set((usuario?.perfisDisponiveis || []).map(p => String(p.id)));

  const projecao = modulos.map(mod => ({
    ...mod,
    perfisPermitidos: (mod.perfisPermitidos || []).filter(pId => perfisDisponiveis.has(String(pId)))
  }));

  res.json({ success: true, data: projecao });
});
```

*Regras respeitadas:*
- O cache nativo é inalterado (empregou-se mapeamento puro por cópia).
- Administradores também recebem projeções exclusivas, e caso necessitem consultar matrizes organizacionais, o sistema os roteia para sua página dedicada através da API restrita independente `GET /api/admin/modulos`. Nenhuma API paralela precisou ser fabricada.

## 4. TESTES ISOLADOS (8 Cenários)

Foi operada suíte exclusiva testando as injeções e bloqueios via `node backend/test/etapa06_lote2b.test.js`:

| Mock / Cenário Projetado | Reação Aprovada do Controlador Restrito |
|---|---|
| **Usuário com 1 Perfil (Enfermagem)** | Recebe array apenas com `"enfermagem"` e campos originais mantidos. |
| **Múltiplos Perfis Legitimos** (Enf + Med) | Array traz os 2 perfis, resguardando direitos amplos do usuário logado. |
| **Troca Simulada e Descompasso do perfilAtivo** | Mantém segurança priorizando a collection de perfis da Sessão (`perfisDisponiveis`). |
| **Administrador Isolado** | Recebe array `["admin"]`. Não quebra o sigilo dos setores médicos. |
| **Usuário Sem Vínculo ou Deslogado** | Expurgo completo, devolve array matriz vazio `[]`. |
| **Mutação de Cache Ausente** | Duas chamadas seqüenciais com sessões opostas mantiveram integridade sem reescrever cache em memória. |

**(Contagem Otimizada: 8 Executados / 8 Aprovados / Tempo de CPU: 6ms)**.

## 5. MAPEAMENTO DE SETORES E RELATÓRIOS (Sem Alterar Políticas)

### 5.1 Setores (Dashboard)
A validação que impede exposição incorreta de leitos usa a chave matriz `perfilPodeVisualizarSetor`.
- **Implementação Atual (Contrato Exato):** `getSetoresPermitidos()` puxa os binds do Oracle/Redis. Se o `array.length > 0` (existem restrições listadas), o sistema confere se o parâmetro `cdSetor` está lá. **Entretanto, se o array for estritamente vazio (`.length === 0`), ele cai no condicional final `return perfilTemAcessoModulo()`**.
- **Natureza do Contrato e Riscos:** Isso NÃO configura ausência de carregamento. O cache carrega arrays vazios por design se a configuração para o Perfil não foi realizada. O contrato dita que **uma lista vazia confere Acesso Geral Global ao módulo inteiro**, o que é incompatível com o conceito de privilégio mínimo. O painel administrativo atualiza chaves em `perfilModuloSetores`, representando-as dinamicamente, o que expõe o sistema a aberturas acidentais ou acessos indesejados à UTI sem blindagem restritiva padrão.

### 5.2 Relatórios (PDFs Dinâmicos)
- **Correção Documental (TTS):** Os relatórios gerados trafegam o documento diretamente de um repositório Tasy, roteando o proxy pelo `TasyAppServer` via Client nativo do Node, e não guardam ligações com o EndPoint Auxiliar de áudios e falas de senhas operado pelo `TTS` (Text-to-Speech).
- **Catálogo e IDs:** As âncoras e IDs listáveis originam de constante global `MAPA_RELATORIOS_OFICIAIS` mergidas dinamicamente do BD, servindo documentos base como TISS 70125.
- **Autorização Observada:** O acesso hoje depende unicamente do aval `reqRec('emitir_relatorio')`. Não há checagem cruzada que impeça o funcionário do Perfil A emitir a `ID=15` e o Perfil B a `ID=20`. Se o cliente sabe a URL, pode acionar o TasyAppServer para qualquer documento.
- **Perguntas Institucionais Necessárias aos Próximos Lotes:**
  1. A instituição aceita manter a permissão monolítica *"se você pode emitir relatórios, você pode emitir todos da Recepção"* ou exigirá o escopo matricial (Acesso Restrito 1-Para-1 entre Perfil X Relatório Y)?
  2. A migração para *Default-Deny* (Bloqueio por Padrão para listas vazias de setores) é aceitável na infraestrutura atual, considerando que pode derrubar o Dashboard PA de perfis cujo cadastro nunca foi pormenorizado no Painel de Admin?

## 6. PENDÊNCIAS E ESTADO
- Nenhuma dependência foi instalada, nenhum SQL modificado e nenhuma restrição alterada durante esta projeção.
- O container não passou por restarts.
- O procedimento de roll-back contra vulnerabilidades na refatoração da rota `/api/modulos` encontra-se pré-salvo e operável manualmente.
- Fica pendente aguardar as diretrizes assistenciais institucionais referentes às travas matriciais mapeadas acima antes da execução de blindagem das Rotas TasyAppServer (Relatórios) e Oracle (Dashboard).
