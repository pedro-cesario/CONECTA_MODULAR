const fs = require('fs');
let content = fs.readFileSync('frontend/js/app.js', 'utf8');
content = content.replace(/checkSession\(\);\s*}\)\(\);/, 'checkSession();');
content = content.trim() + '\n\n})();\n';
fs.writeFileSync('frontend/js/app.js', content);
console.log('File modified successfully');
