/**
 * Ecosystem PM2 para o Financy Pro Digital (Next.js standalone).
 *
 * Uso no VPS (Hostinger):
 *   npm ci                              # COM devDependencies (o build precisa)
 *   npx prisma migrate deploy           # aplica as migrations no Neon
 *   npm run build
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save && pm2 startup
 *
 * As variaveis de ambiente de producao ficam em .env na raiz do projeto;
 * o Next.js (`next start`) e o Prisma carregam esse arquivo automaticamente.
 * A variavel PORT e usada pelo `next start` (veja package.json).
 */
module.exports = {
  apps: [
    {
      name: "financy-pro-digital",
      script: "node_modules/next/dist/bin/next",
      args: "start -p ${PORT:-3000}",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // reinicia o app em caso de crash; sem auto-restart em loop a cada 5s
      autorestart: true,
      restart_delay: 5000,
      out_file: "logs/out.log",
      error_file: "logs/error.log",
      merge_logs: true,
      time: true,
    },
  ],
};