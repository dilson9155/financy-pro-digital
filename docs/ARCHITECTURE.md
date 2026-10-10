# Arquitetura — Financy Pro Digital

Este documento descreve as decisões de arquitetura, o modelo de dados e como as
regras de movimentação financeira garantem consistência.

---

## 1. Visão geral

```
Browser (React client)
   │  usa o kit UI + hooks (useApiQuery)
   ▼
/ api/* (App Router Route Handlers)
   │  auth (sessao httpOnly) + RBAC (requireApiAuth)
   ▼
src/services/*  (camada de dominio / regras de negocio)
   │  transacoes prisma.$transaction + ledger + auditoria
   ▼
PostgreSQL (Neon) — Prisma ORM
```

Layering:

- **`src/app/api/**`** — fina: autentica (`requireApiAuth`), valida query com
  `src/lib/filters.ts`, chama o serviço e responde `{ ok, data }` / `{ ok:false, error }`.
- **`src/services/**`** — regras de negócio, sempre em `prisma.$transaction`.
- **`src/components/views/**`** — telas client-side que consomem `/api`, sem lógica financeira.
- **`src/lib/**`** — utilitários puros (money, filters, validation, audit, auth) — os únicos testados com Vitest.

## 2. Multi-tenant e RBAC

- **Tenant**: `Company`. Todos os modelos operacionais têm `companyId`; toda
  consulta de serviço filtra por ele. Chaves de exclusividade relevantes são
  compostas com `companyId` (ex.: `@@unique([companyId, code])`).
- **Sessão**: token aleatório (`crypto.randomBytes(32)`) com hash SHA-256 em
  `UserSession`, cookie `httpOnly` (`AUTH_COOKIE_NAME`).
- **RBAC**: `Role` → `RolePermission[]` (strings do catálogo em
  `src/lib/permissions.ts`). `Membership` liga `User` → `Role` → `Company`.
  Papéis de sistema (Administrador, Gestor, Analista, Consulta) são criados por
  `ensureSystemRoles()` e não podem ser renomeados/excluídos.
- **Checagem dupla**: páginas usam `requirePermission(...)` (redireciona para
  `/sem-permissao`); rotas `/api` usam `requireApiAuth(...)` (401/403 JSON).

## 3. Modelo financeiro (peças-chave)

| Modelo | Papel |
| --- | --- |
| `FinancialTitle` | Conta a pagar (`PAYABLE`) ou receber (`RECEIVABLE`), modelo unificado por `direction` |
| `TitleInstallment` | Parcelas do título; `amount` + `paidAmount`; status derivado |
| `Settlement` | Baixa de uma parcela; `principal + juros + multa − desconto = total` (caixa) |
| `SettlementReversal` | Estorno de uma baixa (guarda `reason`, gera lançamento espelho) |
| `Transaction` | **Ledger da conta/caixa**: único registro de movimento de dinheiro |
| `Transfer` | Movimentação entre contas; gera `Transaction` de saída + entrada |
| `BankStatement`/`BankStatementLine` | Extrato importado e linhas a conciliar |
| `Reconciliation` | Vínculo linha-do-extrato ↔ lançamento |
| `AuditLog` | Trilha imutável de operações (`before`/`after` em JSON) |
| `Backup` | Registro de backups lógicos gerados por empresa |

## 4. Consistência do dinheiro

Toda movimentação segue o mesmo padrão no `ledger` (`src/services/ledger.ts`):

1. `POST` em `Transaction` com `amount > 0` e `type` (`INFLOW`/`OUTFLOW`).
2. O saldo é atualizado com **row lock** (`SELECT ... FOR UPDATE`) sobre o
   `BankAccount` — nada de leitura com corrida — e `balanceAfter` é gravado na
   própria transação.
3. Tudo isso acontece em **uma** `prisma.$transaction`; qualquer erro aborta tudo.

Elas usam esse ledger de forma orquestrada:

- **Baixa de título** (`settlements.ts`): valida valores não negativos, parcela
  aberta, não estornada; calcula `total` e distribui num único movimento; atualiza
  `paidAmount`, status da parcela (`OPEN→PARTIAL→PAID`) e do título; audita.
- **Estorno de baixa** (`settlements.ts` `reverseSettlement`): só permite estornar
  uma vez; reverte saldo com lançamento de `REVERSAL`; devolve o status.
- **Transferência** (`transfers.ts`): lançamento de saída na origem e entrada no
  destino, com o mesmo `amount`, na mesma transação.
- **Lançamento manual** (`transactions.ts`): valida conta e envia ao ledger.
- **Estorno de lançamento** (`transactions.ts`): espelha com valor oposto,
  `origin=REVERSAL`, e marca o original como `REVERSED`.

**Controle de concorrência**: modelos mutáveis (`BankAccount`, `FinancialTitle`,
`TitleInstallment`, `Transaction`) têm coluna `version` e os serviços usam
`updateMany` com `version: <esperado>` para detectar escrita concorrente, além do
lock de linha no saldo.

## 5. Auditoria

`recordAudit(tx, ...)` (em `src/lib/audit.ts`) grava dentro da mesma transação da
operação: `action`, `entity`, `entityId`, `before`, `after`, `ip`, `userAgent`.
Ações típicas: `CREATE`, `UPDATE`, `DELETE`, `SETTLE`, `REVERSE`, `CANCEL`,
`LOGIN`, `LOGIN_FAILED`, `TRANSFER`, `RECONCILE`, `UNRECONCILE`, `BACKUP`,
`ROLE_CHANGE`. A tela de auditoria permite filtrar por período/ação e inspecionar
os JSONs antes/depois.

## 6. Filtros dinâmicos

`src/lib/filters.ts` normaliza valores de query string (string, número, booleano,
data, enum, listas CSV, paginação e ordenação). Regras:

- valores vazios são ignorados → filtros são **combináveis** e independentes;
- enums são validados contra whitelist;
- paginação é limitada (`maxPageSize`);
- datas `YYYY-MM-DD` são interpretadas como **meia-noite local** (sem deslocamento
  de fuso) e ranges aplicam início/fim do dia.

## 7. Backups

`src/services/backup.ts` gera um JSON lógico por empresa (estruturas, títulos,
baixas, lançamentos, transferências, settings — **sem segredos**), grava em
`BACKUP_DIR`, atualiza a tabela `backups` com status/tamanho/quantidade e audita a
operação. O download/restauração é intencionalmente manual no VPS (arquivo JSON).

## 8. Testes

Testes unitários (Vitest, ambiente `node`) cobrem os utilitários puros — a
camada onde se concentra a lógica de negócio testável sem banco. A integração
com o banco fica para o CI que executa as migrations contra PostgreSQL real e
valida o build de produção (workflow `.github/workflows/ci.yml`).

## 9. Segurança

- Senha: bcrypt (12 rounds). Sessão: cookie httpOnly, `SameSite=Lax`, `Secure`
  em produção; brute-force com bloqueio temporário; hash de token na coluna.
- Nunca expor `AUTH_SECRET`/`DATABASE_URL`: só `NODE_ENV=production` no VPS.
- Headers de segurança em `next.config.mjs` (nosniff, X-Frame-Options DENY,
  Referrer-Policy, Permissions-Policy).