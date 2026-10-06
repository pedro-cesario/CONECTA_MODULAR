require('dotenv').config();
const { dbTasy } = require('./src/core/database');

async function run() {
    try {
        console.log("Searching for policy tables...");
        const result = await dbTasy.execute(
            `SELECT table_name FROM all_tables WHERE table_name LIKE '%POLICY%' OR table_name LIKE '%POLITICA%' OR table_name LIKE '%ASSINAT%'`
        );
        console.log("Tables found:", result.map(r => r.TABLE_NAME || r.table_name || Object.values(r)[0]).join(", "));
        
        const cols = await dbTasy.execute(
            `SELECT column_name FROM all_tab_columns WHERE table_name = 'TASY_ASSINATURA_DIGITAL'`
        );
        console.log("TASY_ASSINATURA_DIGITAL cols:", cols.map(r => Object.values(r)[0]).join(", "));
    } catch (e) {
        console.error("DB error:", e);
    }
    process.exit(0);
}
run();
