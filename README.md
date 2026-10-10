# Financy Pro Digital 💼

Sistema de gestão financeira empresarial **multi-tenant (SaaS)** — contas a pagar/receber, lançamentos, transferências, conciliação bancária, fluxo de caixa e relatórios, com controle de acesso por papéis (RBAC) e trilha de auditoria completa.

> Stack: **Next.js 15 (App Router) · React 19 · TypeScript · PostgreSQL (Neon) · Prisma ORM · Tailwind CSS · Vitest**

---

## ✨ Funcionalidades

| Módulo | Descrição |
| --- | --- |
| **Dashboard** | Visão geral com valores a receber/pagar, saldo das contas e alertas de vencimento |
| **Contas a pagar / receber** | Títulos com parcelas, baixa com juros/multa/desconto, estorno, cancelamento |
| **Lançamentos** | Movimentações manuais na conta/caixa (ledger) com saldo atualizado por transação |
| **Transferências** | Movimentação entre contas/caixas com lançamentos nos dois lados e estorno |
| **Conciliação bancária** | Importação de extrato (CSV/manual), sugestões automáticas de correspondência |
| **Fluxo de caixa** | Projeção diária (realizado + previsto) e saldo acumulado |
| **Relatórios** | Por categoria, por centro de custo, aging (vencimento) e posição das contas |
| **Estruturas** | Categorias, plano de contas, centros de custo, parceiros e contas/caixas |
| **Administração** | Usuários, papéis (RBAC), auditoria imutável, configurações e backups |

## 🏗️ Princípios

- **Multi-tenant por `companyId`**: todo dado operacional pertence a uma empresa; isolamento também no nível de autorização (RBAC).
- **Cartas de movimento (ledger)**: todo movimento de dinheiro tem um registro em `Transaction` com `balanceAfter`; transferências e baixas atualizam os dois lados.
- **Consistência com transações SQL**: movimentações de saldo, status de títulos e auditoria acontecem em uma única transação (`prisma.$transaction`), com **controle de concorrência** (versionamento `version`).
- **Auditoria imutável**: `AuditLog` registra `action`, `entity`, `before/after` (JSON) e metadados de solicitação para qualquer operação relevante.
- **Dinheiro com `Prisma.Decimal`** (`Decimal(18,2)` no Postgres) — sem erros de arredondamento de ponto flutuante.
- **Filtros dinâmicos e combináveis**: todas as listagens aceitam query strings (`status`, datas, texto, paginação) que podem ser combinadas e são validadas/limitadas por lista de permissão.
- **Sem dados falsos em produção**: o seed cria apenas o administrador de sistema; dados de demonstração exigem `SEED_DEMO_DATA=true`.

## 📁 Estrutura

```
src/
  app/
    (painel)/            # telas autenticadas (App Shell + RBAC por página)
    api/                 # API routes (banco de dados servem o cliente)
  components/
    views/               # telas client-side (consomem /api)
    ui.tsx               # kit de componentes base
  lib/                   # utilitarios: auth, money, permissions, filters, validation...
  services/              # camada de dominio (regras de negocio + transacoes)
prisma/
  schema.prisma          # modelo de dados
  seed.ts                # seed opcional (admin + dados demo)
  migrations/0001_init/  # migration SQL gerada (deploy offline)
deploy/                  # nginx.conf de exemplo
.github/workflows/ci.yml # CI: typecheck + testes + build
```

## 🚀 Começando (desenvolvimento)

Pré-requisitos: Node 20+ e um banco PostgreSQL (Neon).

```bash
npm install

# 1. Configure as variáveis
cp .env.example .env   # preencha DATABASE_URL e DIRECT_URL (Neon)

# 2. Aplicar schema e criar o admin
npx prisma migrate dev          # (ou: npx prisma migrate deploy com a migration pronta)
SEED_ADMIN_EMAIL=admin@empresa.com SEED_ADMIN_PASSWORD="senha-segura" npm run prisma:seed

# 3. Rodar
npm run dev
```

Acesse `http://localhost:3000`, faça login e crie/entre na empresa. Em produção, o fluxo completo está em [`docs/DEPLOY.md`](docs/DEPLOY.md).

### Comandos úteis

```bash
npm run dev          # dev server
npm run typecheck    # tsc --noEmit
npm test             # testes unitarios (Vitest)
npm run build        # build de produção (standalone)
npm run prisma:seed  # seed (cria admin; demo se SEED_DEMO_DATA=true)
```

## 🧪 Testes

66 testes unitários cobrem os utilitários críticos:

- **`money`** — aritmética e rateio de parcelas (`splitInstallments`) com soma exata dos centavos;
- **`filters`** — parse/validação de query strings, paginação clamps, ranges de datas;
- **`validation`** — schemas Zod das entradas da API;
- **`client`** — serialização de query string e erros de API.

## 🧭 Fluxo de deploy (resumo)

1. Crie o repositório GitHub e conecte ao VPS (Hostinger).
2. Configure `.env.production` (Neon + secrets).
3. `npx prisma migrate deploy` para aplicar as migrations.
4. `npm run build` e suba com PM2 (`ecosystem.config.js`).
5. Aponte o domínio com **Nginx** (`deploy/nginx.conf`) e HTTPS via Let's Encrypt.

Detalhes completos: [`docs/DEPLOY.md`](docs/DEPLOY.md) e [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## 🔒 Segurança

- Senhas com **bcrypt** (12 rounds) e sessões com token aleatório em cookie `httpOnly`.
- Proteção contra força bruta: bloqueio temporário após `AUTH_MAX_LOGIN_ATTEMPTS` tentativas.
- RBAC por papel com catálogo central de permissões (`src/lib/permissions.ts`) e checagem em páginas **e** em todas as rotas `/api`.
- Headers de segurança (nosniff, frame-deny, referrer-policy, permissions-policy) no `next.config.mjs`.
- Nunca commitamos `.env` (ver `.gitignore`).

## 📜 Licença

Projeto privado — use sob acordo com o mantenedor.