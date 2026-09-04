module.exports = {
  apps: [{
    name: 'conecta-backend',
    script: 'backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      LD_LIBRARY_PATH: '/tmp/ic19'
    }
  }]
};
