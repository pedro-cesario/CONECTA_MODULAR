require('dotenv').config();
const { getConnection } = require('./src/core/database');
const configCache = require('./src/core/config/configCache');

async function test() {
  await configCache.load(); // This loads DB configs from sqlite
  const dbModule = require('./src/core/database');
  // Need to force reload connection info by calling initPool with config
  const sysConfig = configCache.getSystemConfig();
  await dbModule.initPool({
    host: sysConfig.db_host,
    port: sysConfig.db_port,
    service: sysConfig.db_service,
    user: sysConfig.db_user,
    password: process.env.DB_PASSWORD // if it's in .env?
  });
  
  let conn;
  try {
    conn = await getConnection();
    const res = await conn.execute("SELECT * FROM EHR_TEMPLATE_CONTEUDO WHERE NR_SEQ_TEMPLATE = 100051");
    console.log("CONTEUDO:", JSON.stringify(res.rows, null, 2));

    const res2 = await conn.execute("SELECT * FROM EHR_TEMPLATE WHERE NR_SEQUENCIA = 100051");
    console.log("TEMPLATE:", JSON.stringify(res2.rows, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    if(conn) await conn.close();
    process.exit(0);
  }
}
test();
