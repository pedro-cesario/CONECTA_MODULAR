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
    const res = await conn.execute("SELECT OBJECT_NAME FROM ALL_OBJECTS WHERE OBJECT_TYPE = 'PROCEDURE' AND OBJECT_NAME LIKE 'EHR%'");
    console.log("PROCS:", JSON.stringify(res.rows.map(r => r.OBJECT_NAME)));
  } catch(e) { console.error(e); }
  finally { if(conn) await conn.close(); process.exit(0); }
}
test();
