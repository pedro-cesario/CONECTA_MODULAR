const request = require('supertest');

const API_URL = process.env.API_URL || 'http://node:3006';

global.api = request(API_URL);

global.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

beforeAll(async () => {
  console.log('\n=== INICIANDO TESTES AUTOMATIZADOS ===');
});

afterAll(async () => {
  console.log('\n=== TESTES FINALIZADOS ===');
});