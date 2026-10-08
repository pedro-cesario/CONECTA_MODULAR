const oracledb = require('oracledb');
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

async function run() {
  let conn;
  try {
    conn = await oracledb.getConnection({
      user: process.env.DB_USER || 'tasy',
      password: process.env.DB_PASSWORD || 'tasy',
      connectString: process.env.DB_CONNECTION_STRING || '192.168.12.60:1521/tasy'
    });
    console.log("Connected");
    
    // We can't actually connect due to thick client error unless we run inside the container
  } catch (e) {
    console.error(e);
  }
}
run();
