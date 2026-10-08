const path = require('path');
const dotenv = require('dotenv');
const envPath = path.resolve(__dirname, '../.env');
console.log('Env path:', envPath);
const res = dotenv.config({ path: envPath });
console.log('Result:', res);
console.log('DB_HOST:', process.env.DB_HOST);
