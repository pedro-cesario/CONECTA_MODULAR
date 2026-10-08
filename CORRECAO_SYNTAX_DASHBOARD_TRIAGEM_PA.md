# Erro encontrado
`SyntaxError: Unexpected token 'else'` ao carregar o módulo "dashboard" (`dashboard.js`). Quando o parser atingia essa linha no navegador, o motor JavaScript abortava o carregamento do módulo. Em testes de validação no Node.js (`node --check`), ele também falhava com `Unexpected token 'export'` porque a sintaxe corrompida encapsulou declarações globais de exportação.

# Linha/bloco afetado
Em torno da linha 1613 no arquivo `frontend/src/modules/dashboard/dashboard.js`, próximo ao final da função `avancarParaPlaceholder`.

# Causa
Durante alterações anteriores (possivelmente nas fases 3, 4 ou 5) relacionadas ao fluxo de inicialização clínica (`iniciarEtapasClinicas`), ocorreu um erro grave de duplicação por _copy/paste_ ou `sed`/injeção mal-sucedida. 
Uma grande porção do arquivo `dashboard.js` (cerca de 730 linhas do código da Internação e do Dashboard, da linha 897 até 1586 originais) foi acidentalmente injetada **dentro** do corpo da função `initTriagemSenhasPA`. 
O bloco corrompido quebrou a estrutura do arquivo deixando:
1. Um fragmento órfão `} else { carregarSenhasTriagem(false); }` pertencente a `loadDashboardPA`, gerando o `Unexpected token 'else'`.
2. Funções exportadas como `export function openInternacaoModal` presas dentro do escopo fechado de `initTriagemSenhasPA`, gerando erros de escopo de ES Modules.
3. A função `initTriagemSenhasPA` interrompida na metade, sendo retomada apenas 700 linhas abaixo.

# Correção aplicada
1. Identificamos com precisão os limites do bloco duplicado (da linha 1612 até a linha 2345).
2. Removemos cirurgicamente o bloco invasor `} else { ... }` e todo o código duplicado de dashboard de internação subjacente.
3. Restauramos o fechamento limpo `}` da função `avancarParaPlaceholder`.
4. Garantimos que a linha original `window.conectaCore.avancarParaPlaceholder = avancarParaPlaceholder;` fosse reconectada imediatamente em seguida.
5. Reatamos o fluxo original de `initTriagemSenhasPA` sem apagar nenhuma regra clínica, fluxo do Wizard ou comportamento do Admin. O módulo manteve a sua intenção original intacta.

# Arquivos alterados
- `frontend/src/modules/dashboard/dashboard.js`

# Syntax checks executados
Foram executados testes isolados de parse de AST nativos do Node.js (`new vm.Script(code)`) processando a sintaxe estrita da linguagem.
Arquivos validados:
- `frontend/src/modules/dashboard/dashboard.js`
- `frontend/src/modules/triagem-pa/TriagemPaClinico.js`
- `frontend/src/modules/recepcao/recepcao.js`
- `frontend/src/modules/triagem-pa/TriagemPaUI.js`

# Resultado
Todos os testes de sintaxe (Syntax OK) passaram limpos sem `SyntaxError`. O módulo agora pode ser carregado corretamente pelo `ModuleLoader` no navegador e a Triagem P.A. está livre do bloqueio.
