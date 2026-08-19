const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const session = require('express-session');
const cors = require('cors');
const helmet = require('helmet');

const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3007;

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  console.error('[Test Server] ERRO: SESSION_SECRET não definido.');
  process.exit(1);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: true }));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000,
    sameSite: 'lax',
    secure: false
  }
}));

app.use(express.static(path.join(__dirname, 'frontend')));

app.use('/api', routes);

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend/index.html'));
});

app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  const isProd = process.env.NODE_ENV === 'production';
  const message = isProd ? 'Erro interno do servidor' : (err.message || 'Erro interno do servidor');
  res.status(err.status || 500).json({
    success: false,
    message
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n[Servidor] Testes Conecta HEAL rodando em http://localhost:${PORT}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[Servidor] ERRO: Porta ${PORT} já está em uso!`);
    process.exit(1);
  }
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

module.exports = app;