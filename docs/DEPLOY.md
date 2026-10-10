# Deploy em VPS (Hostinger) — Financy Pro Digital

Guia passo a passo para colocar a aplicação em produção num VPS com
**Node.js + PM2 + Nginx** e banco **PostgreSQL (Neon)**.

> Requisitos: VPS com Ubuntu 22.04/24.04, acesso SSH (root ou sudo) e um
> **domínio** apontando (registro DNS tipo **A**) para o IP do VPS.
> O Postgres fica no Neon (externo) — **não** instale banco no VPS.

Nos comandos abaixo troque `SEU_DOMINIO` (ex.: `app.suaempresa.com`) e
`SEU_USUARIO` (usuário sudo do VPS) pelos seus valores.

---

## 0. Visão geral

```
Internet → Nginx (80/443, TLS) → 127.0.0.1:3000 (Next.js via PM2) → Neon (Postgres)
```

---

## 1. DNS (no painel do seu domínio)

Crie um registro **A**:

| Tipo | Nome | Valor            |
|------|------|------------------|
| A    | app  | IP.DO.SEU.VPS    |

Espere a propagação (alguns minutos) antes de emitir o certificado.
Confira com: `nslookup SEU_DOMINIO`.

---

## 2. Acesso e pacotes básicos no VPS

```bash
ssh SEU_USUARIO@IP.DO.SEU.VPS

sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx
```

Firewall (se usar ufw):

```bash
sudo ufw allow OpenSSH
sudo ufw allow "Nginx Full"   # libera 80 e 443
sudo ufw enable
```

---

## 3. Node.js 20 (via NodeSource)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v      # deve mostrar v20.x
npm -v
```

---

## 4. Clonar o repositório

O repositório é público, então o clone é por HTTPS (não precisa de chave SSH):

```bash
cd ~
git clone https://github.com/dilson9155/financy-pro-digital.git
cd financy-pro-digital
```

---

## 5. Variáveis de ambiente (`.env`)

O Next.js (`next start`) e o Prisma carregam o arquivo **`.env`** da raiz do
projeto automaticamente. Crie-o:

```bash
nano .env
```

Conteúdo (troque os valores; **não** commite este arquivo):

```dotenv
# Banco (Neon) — use os MESMOS valores do seu .env local
DATABASE_URL="postgresql://USUARIO:SENHA@ep-xxxx-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
DIRECT_URL="postgresql://USUARIO:SENHA@ep-xxxx.sa-east-1.aws.neon.tech/neondb?sslmode=require"

# URL pública do app (com https, sem barra no final)
APP_URL="https://SEU_DOMINIO"

# Segredo de sessão — gere um novo e forte:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
AUTH_SECRET="cole-aqui-o-resultado-do-comando-acima"

NEXT_PUBLIC_APP_NAME="Financy Pro Digital"
BACKUP_DIR="./storage/backups"
```

Proteja o arquivo:

```bash
chmod 600 .env
```

> Os valores de `DATABASE_URL`/`DIRECT_URL` são os mesmos que já estão no seu
> `.env` local (o banco Neon já existe e já tem o admin criado).
> **Nunca** habilite `SEED_DEMO_DATA=true` em produção.

---

## 6. Instalar dependências, migrar e buildar

> Importante: instale **com** devDependencies (`npm ci`, sem `--omit=dev`).
> O `next build` precisa de `typescript`, `tailwindcss`, `postcss` e do CLI do
> `prisma`. Você pode podar depois (passo 8), se quiser.

```bash
npm ci                       # instala tudo (roda prisma generate no postinstall)
npx prisma migrate deploy    # aplica as migrations no Neon (idempotente)
npm run build                # build de produção (standalone)
```

Se estiver usando um banco Neon **novo/vazio**, crie o admin (idempotente):

```bash
SEED_ADMIN_EMAIL="admin@SEU_DOMINIO" SEED_ADMIN_PASSWORD="uma-senha-muito-forte" npm run prisma:seed
```

> O seed só cria o admin; dados de demonstração exigem `SEED_DEMO_DATA=true`.

Crie as pastas de runtime:

```bash
mkdir -p logs storage/backups
```

---

## 7. Subir com PM2

```bash
sudo npm i -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup    # copie e cole o comando que o pm2 imprimir (systemd)
```

Verificações:

```bash
pm2 status                              # financy-pro-digital = "online"
pm2 logs financy-pro-digital --lines 30
curl -I http://127.0.0.1:3000/login     # deve responder HTTP/1.1 200
```

---

## 8. (Opcional) Podar dependências de desenvolvimento

Depois do build, para liberar espaço:

```bash
npm prune --omit=dev
pm2 restart financy-pro-digital
```

> Se rodar isso, o CLI do Prisma é removido — reinstale com `npm i -D prisma`
> antes de rodar uma nova migration.

---

## 9. Nginx (proxy reverso)

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/financy-pro-digital
sudo nano /etc/nginx/sites-available/financy-pro-digital   # ajuste server_name
sudo ln -s /etc/nginx/sites-available/financy-pro-digital /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Teste no navegador: `http://SEU_DOMINIO` deve abrir a tela de login.

---

## 10. HTTPS (Let's Encrypt / certbot)

O arquivo do Nginx começa só com HTTP justamente para o certbot validar o
domínio. Depois ele adiciona o bloco 443 e o redirecionamento:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d SEU_DOMINIO
```

Teste a renovação automática:

```bash
sudo certbot renew --dry-run
```

Pronto: **https://SEU_DOMINIO**.

---

## 11. Primeiro acesso

1. Abra `https://SEU_DOMINIO`.
2. Entre com o admin (o mesmo do seu ambiente atual):
   - e-mail: `admin@financy.local`
   - senha: a que você definiu no seed local.
3. **Troque a senha** em *Configurações* / *Usuários* (ou crie um usuário novo
   com seu e-mail real e desative/pare de usar o admin genérico).

---

## 12. Atualizações (novos deploys)

Cada vez que o código mudar no GitHub:

```bash
cd ~/financy-pro-digital
git pull
npm ci                       # reinstala se mudou package.json
npx prisma migrate deploy    # aplica migrations novas (se houver)
npm run build
pm2 restart financy-pro-digital
```

---

## Segurança operacional

- `AUTH_SECRET` forte e **diferente** do ambiente local.
- Nunca commite `.env` (já está no `.gitignore`).
- Nunca rode o seed com `SEED_DEMO_DATA=true` em produção.
- Backups lógicos vão para `BACKUP_DIR`; mova periodicamente para armazenamento
  externo (o app registra a operação na tabela `backups`).
- Ative 2FA na conta Neon e limite o acesso SSH ao VPS (chave + firewall).

---

## Troubleshooting rápido

| Sintoma | Causa provável | Ação |
|---|---|---|
| `pm2 status` mostra *errored* | `.env` ausente/inválido | `pm2 logs financy-pro-digital`; confira `DATABASE_URL` |
| 502 no Nginx | app não está na porta 3000 | `pm2 status`; `curl -I http://127.0.0.1:3000/login` |
| `nginx -t` falha | directive em contexto errado | veja `deploy/nginx.conf` (rate limit fica fora do `server`) |
| Build falha com "typescript not found" | instalou com `--omit=dev` | `npm ci` (sem `--omit=dev`) e buildar de novo |
| Certbot não valida o domínio | DNS não propagou / porta 80 fechada | `nslookup SEU_DOMINIO`; libere 80 no firewall |
