module.exports = {
  apps: [
    {
      name: "social-assistant-api",
      script: "./build/index.js",

      // Options reference: https://pm2.keymetrics.io/docs/usage/application-declaration/
      // args: 'one two',
      instances: 1,
      autorestart: true,
      watch: false,
      // max_memory_restart: '1G',
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
    {
      name: "social-assistant-agenda",
      script: "./build/worker.js",

      // Options reference: https://pm2.keymetrics.io/docs/usage/application-declaration/
      // args: 'one two',
      instances: 1,
      autorestart: true,
      watch: false,
      // max_memory_restart: '1G',
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
