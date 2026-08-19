const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'frontend', 'css', 'style.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Replace #livro-sub-menu with .livro-sub-menu
css = css.replace(/#livro-sub-menu/g, '.livro-sub-menu');

// 2. Add #workspace-passagens-anteriores where #workspace-livro is used for page headers
css = css.replace(/#workspace-livro \.livro-page-icon,/g, '#workspace-livro .livro-page-icon, #workspace-passagens-anteriores .livro-page-icon,');
css = css.replace(/#workspace-livro \.livro-page-heading p,/g, '#workspace-livro .livro-page-heading p, #workspace-passagens-anteriores .livro-page-heading p,');
css = css.replace(/#workspace-livro \.livro-page-header,/g, '#workspace-livro .livro-page-header, #workspace-passagens-anteriores .livro-page-header,');
css = css.replace(/#workspace-livro \.livro-page-heading,/g, '#workspace-livro .livro-page-heading, #workspace-passagens-anteriores .livro-page-heading,');
css = css.replace(/#workspace-livro \.livro-page-heading h2,/g, '#workspace-livro .livro-page-heading h2, #workspace-passagens-anteriores .livro-page-heading h2,');

fs.writeFileSync(cssPath, css, 'utf8');
console.log('CSS updated successfully');
