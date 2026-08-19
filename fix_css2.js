const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'frontend', 'css', 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');

css = css.replace(/#workspace-livro \.livro-page-eyebrow,/g, '#workspace-livro .livro-page-eyebrow, #workspace-passagens-anteriores .livro-page-eyebrow,');
css = css.replace(/#workspace-livro \.livro-page-back,/g, '#workspace-livro .livro-page-back, #workspace-passagens-anteriores .livro-page-back,');

fs.writeFileSync(cssPath, css, 'utf8');
console.log('CSS updated successfully');
