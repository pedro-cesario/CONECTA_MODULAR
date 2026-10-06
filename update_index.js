const fs = require('fs');
let html = fs.readFileSync('frontend/index.html', 'utf8');

// Find the screen-evolucao block
const startIdx = html.indexOf('<!-- TELA DE TESTE DE EVOLUÇÃO -->');
const endIdx = html.indexOf('</body>');

if (startIdx !== -1 && endIdx !== -1) {
  let evolucaoBlock = html.substring(startIdx, endIdx).trim();
  html = html.substring(0, startIdx) + '\n</body>' + html.substring(endIdx + 7);

  // modify the block to be a section
  evolucaoBlock = evolucaoBlock.replace('<div id="screen-evolucao" class="screen p-4">', '<section id="sec-evolucao" class="app-container d-none p-4">');
  // Need to replace the matching closing div for screen-evolucao. It's the last </div> before the end.
  const lastDivIdx = evolucaoBlock.lastIndexOf('</div>');
  evolucaoBlock = evolucaoBlock.substring(0, lastDivIdx) + '</section>' + evolucaoBlock.substring(lastDivIdx + 6);

  // Now insert it before the closing of #screen-app.
  const targetIdx = html.lastIndexOf('  </div>\n\n  <div class="toast-container"');
  if (targetIdx !== -1) {
    html = html.substring(0, targetIdx) + '\n    ' + evolucaoBlock + '\n' + html.substring(targetIdx);
    fs.writeFileSync('frontend/index.html', html, 'utf8');
    console.log('Successfully moved and modified evolucao block.');
  } else {
    console.log('Could not find target insertion point.');
  }
} else {
  console.log('Could not find screen-evolucao block.');
}
