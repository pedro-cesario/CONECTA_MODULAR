module.exports = {
  apps: [{
    name: 'conecta-backend',
    script: './run.sh',
    interpreter: 'bash',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
