const fs = require('fs');
const path = 'frontend/src/modules/dashboard/dashboard.js';
let lines = fs.readFileSync(path, 'utf8').split('\n');

let targetIdx = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('async function salvarENovoAtendimentoTriagem() {')) {
    targetIdx = i;
    break;
  }
}

if (targetIdx !== -1) {
  // Check the lines just before it
  console.log('Before fix:', lines.slice(targetIdx - 5, targetIdx).join('\n'));
  
  // Replace the messed up ending with the correct one
  lines[targetIdx - 3] = '    }';
  lines[targetIdx - 2] = '  } catch (err) {';
  lines[targetIdx - 1] = '    console.error("Erro ao carregar formulário da Triagem:", err);';
  lines.splice(targetIdx, 0, '    ui.showToast("Erro ao carregar o template clínico.", "error");');
  lines.splice(targetIdx + 1, 0, '  }');
  lines.splice(targetIdx + 2, 0, '};');
  lines.splice(targetIdx + 3, 0, '');

  fs.writeFileSync(path, lines.join('\n'));
  console.log('Fixed!');
}
