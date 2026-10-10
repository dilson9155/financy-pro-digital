# Deploy em VPS (Hostinger) — Financy Pro Digital

Guia passo a passo para colocar a aplicação em produção em um VPS com
**Node.js + PM2 + Nginx** e banco **PostgreSQL (Neon)**.

> Requisitos: Node 20+ no VPS, domínio apontado (DNS) para o IP do VPS.

---

## 1. Banco de dados (Neon)

1. Crie um projeto no [Neon](https://neon.tech) e obtenha duas connection strings:
   - **`DATABASE_URL`** — pooled (PgBouncer) para a aplicação em runtime;
   - **`DIRECT_URL`** — direta (sem pooler) para migrations/seed.
2. Guarde-as para o passo do `.env`.

## 2. Repositório e checkout no VPS

```bash
git clone git@github.com:<seu-usuario>/financy-pro-digital.git
cd financy-pro-digital
```

## 3. Variáveis de ambiente

```bash
cp .env.example .env.production
# edite e preencha:
#   NODE_ENV=production
#   DATABASE_URL  (pooled)
#   DIRECT_URL    (direta)
#   APP_URL=https://app.seudominio.com
#   AUTH_SECRET   (gere: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
#   BACKUP_DIR=./storage/backups
# NUNCA rode o seed com SEED_DEMO_DATA=true
```

Carregue no ambiente do PM2 (veja `ecosystem.config.js`): copie para `~/.financy/.env`
e ajuste o `env_file` ou exporte as variáveis no próprio comando de start.

## 4. Instalar e buildar

```bash
npm ci --omit=dev
npx prisma generate

# aplicar as migrations no Neon (usa DIRECT_URL/define nas variaveis)
export $(grep -v '^#' .env.production | xargs)   # ou: set -a; source .env.production; set +a
npx prisma migrate deploy

# admin de sistema (idempotente)
SEED_ADMIN_EMAIL=admin@seudominio.com SEED_ADMIN_PASSWORD="senha-muito-forte" npm run prisma:seed

# build de producao (standalone)
npm run build
```

## 5. PM2

```bash
npm i -g pm2
mkdir -p logs storage/backups
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # siga a instrução impressa (systemd)
```

Verificações:

```bash
pm2 status                 # deve mostrar "online"
pm2 logs financy-pro-digital
curl -I http://127.0.0.1:3000/login
```

## 6. Nginx + HTTPS (Let's Encrypt)

1. Instale o Nginx. Coloque `deploy/nginx.conf` em
   `/etc/nginx/sites-available/financy-pro-digital` e ajuste `server_name`.
2. Ative e recarregue:
   ```bash
   sudo ln -s /etc/nginx/sites-available/financy-pro-digital /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```
3. Emita o certificado:
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d app.seudominio.com
   ```

## 7. Atualizações

```bash
cd ~/financy-pro-digital
git pull
npm ci --omit=dev
npx prisma migrate deploy   # novas migrations
npm run build
pm2 restart financy-pro-digital
```

## Segurança operacional

- Altere o `AUTH_SECRET` do ambiente antes de subir para produção.
- Rode `npm run prisma:seed` apenas com `SEED_DEMO_DATA=false` (padrão) para
  criar o admin; **nunca** importe os dados demo para produção.
- Backups lógicos são gravados em `BACKUP_DIR`; mova-os periodicamente para
  armazenamento externo (o app registra a operação na tabela `backups`).
- Ative a autenticação de dois fatores na conta Neon e limite o acesso ao VPS por
  firewall/SSH.