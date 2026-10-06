const fs = require('fs');
let code = fs.readFileSync('frontend/src/modules/evolucao/evolucao.js', 'utf8');

const regex = /const res = await api\.request\('\/api\/evolucao\/criar', \{[\s\S]*?body: JSON\.stringify\(\{ nrAtendimento, texto \}\)\s*\}\);\s*const data = await res\.json\(\);/m;

const replacement = `const data = await api.post('/api/evolucao/criar', { nrAtendimento, texto });`;

if (regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('frontend/src/modules/evolucao/evolucao.js', code, 'utf8');
    console.log('Successfully updated evolucao.js');
} else {
    console.log('Could not find target block to replace.');
}
