const sqlite3 = require('sqlite3');
const path = require('path');
const db = new sqlite3.Database(path.resolve('auth.sqlite/config.db'));

db.serialize(() => {
  db.all('SELECT * FROM modulos', (err, rows) => console.log('MODULOS:', err || rows));
  db.all("SELECT * FROM perfil_modulos WHERE modulo_id = 'recepcao'", (err, rows) => console.log('ACESSO RECEPCAO:', err || rows));
  db.all("SELECT * FROM perfil_permissoes WHERE modulo_id = 'recepcao'", (err, rows) => console.log('PERMISSOES RECEPCAO:', err || rows));
});
