require('dotenv').config();
const configCache = require('./src/core/config/configCache');
async function test() {
  await configCache.load();
  const dbModule = require('./src/core/database');
  const sysConfig = configCache.getSystemConfig();
  await dbModule.initPool({
    host: sysConfig.db_host, port: sysConfig.db_port, service: sysConfig.db_service, user: sysConfig.db_user, password: process.env.DB_PASSWORD
  });
  let conn;
  try {
    conn = await dbModule.getConnection();
    const res = await conn.execute("SELECT NR_SEQUENCIA, DS_LABEL, NR_SEQ_ELEMENTO FROM EHR_TEMPLATE_CONTEUDO WHERE NR_SEQUENCIA IN (288985, 288950, 288932)");
    console.log("ESPECIFICOS:", JSON.stringify(res.rows, null, 2));
    
    // Also fetch their elements
    const res2 = await conn.execute("SELECT * FROM EHR_ELEMENTO WHERE NR_SEQUENCIA IN (SELECT NR_SEQ_ELEMENTO FROM EHR_TEMPLATE_CONTEUDO WHERE NR_SEQUENCIA IN (288985, 288950, 288932))");
    console.log("DEF_ELEMENTOS:", JSON.stringify(res2.rows, null, 2));
  } catch(e) { console.error(e); }
  finally { if(conn) await conn.close(); process.exit(0); }
}
test();
