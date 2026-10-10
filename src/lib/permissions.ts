/**
 * Catalogo central de permissoes do sistema (RBAC).
 * Cada permissao e uma string "recurso.acao". Papeis recebem um subconjunto.
 */
export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",

  PAYABLES_VIEW: "payables.view",
  PAYABLES_CREATE: "payables.create",
  PAYABLES_UPDATE: "payables.update",
  PAYABLES_DELETE: "payables.delete",
  PAYABLES_SETTLE: "payables.settle",
  PAYABLES_REVERSE: "payables.reverse",

  RECEIVABLES_VIEW: "receivables.view",
  RECEIVABLES_CREATE: "receivables.create",
  RECEIVABLES_UPDATE: "receivables.update",
  RECEIVABLES_DELETE: "receivables.delete",
  RECEIVABLES_SETTLE: "receivables.settle",
  RECEIVABLES_REVERSE: "receivables.reverse",

  TRANSACTIONS_VIEW: "transactions.view",
  TRANSACTIONS_CREATE: "transactions.create",
  TRANSACTIONS_UPDATE: "transactions.update",
  TRANSACTIONS_DELETE: "transactions.delete",
  TRANSACTIONS_REVERSE: "transactions.reverse",

  CATEGORIES_MANAGE: "categories.manage",
  ACCOUNT_PLAN_MANAGE: "account_plan.manage",
  COST_CENTERS_MANAGE: "cost_centers.manage",
  PARTNERS_MANAGE: "partners.manage",
  BANK_ACCOUNTS_MANAGE: "bank_accounts.manage",

  TRANSFERS_VIEW: "transfers.view",
  TRANSFERS_CREATE: "transfers.create",
  TRANSFERS_REVERSE: "transfers.reverse",

  RECONCILIATION_VIEW: "reconciliation.view",
  RECONCILIATION_MANAGE: "reconciliation.manage",

  REPORTS_VIEW: "reports.view",
  CASH_FLOW_VIEW: "cash_flow.view",

  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",

  AUDIT_VIEW: "audit.view",
  SETTINGS_MANAGE: "settings.manage",
  BACKUPS_VIEW: "backups.view",
  BACKUPS_MANAGE: "backups.manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSIONS);

export const ALL_PERMISSIONS_SET = new Set<string>(ALL_PERMISSIONS);

/** Metadados amigaveis para exibicao na tela de papeis. */
export const PERMISSION_GROUPS: {
  group: string;
  label: string;
  permissions: { key: Permission; label: string }[];
}[] = [
  {
    group: "dashboard",
    label: "Dashboard",
    permissions: [{ key: PERMISSIONS.DASHBOARD_VIEW, label: "Visualizar dashboard" }],
  },
  {
    group: "payables",
    label: "Contas a pagar",
    permissions: [
      { key: PERMISSIONS.PAYABLES_VIEW, label: "Visualizar" },
      { key: PERMISSIONS.PAYABLES_CREATE, label: "Criar" },
      { key: PERMISSIONS.PAYABLES_UPDATE, label: "Editar" },
      { key: PERMISSIONS.PAYABLES_DELETE, label: "Excluir" },
      { key: PERMISSIONS.PAYABLES_SETTLE, label: "Baixar" },
      { key: PERMISSIONS.PAYABLES_REVERSE, label: "Estornar" },
    ],
  },
  {
    group: "receivables",
    label: "Contas a receber",
    permissions: [
      { key: PERMISSIONS.RECEIVABLES_VIEW, label: "Visualizar" },
      { key: PERMISSIONS.RECEIVABLES_CREATE, label: "Criar" },
      { key: PERMISSIONS.RECEIVABLES_UPDATE, label: "Editar" },
      { key: PERMISSIONS.RECEIVABLES_DELETE, label: "Excluir" },
      { key: PERMISSIONS.RECEIVABLES_SETTLE, label: "Baixar" },
      { key: PERMISSIONS.RECEIVABLES_REVERSE, label: "Estornar" },
    ],
  },
  {
    group: "transactions",
    label: "Lancamentos",
    permissions: [
      { key: PERMISSIONS.TRANSACTIONS_VIEW, label: "Visualizar" },
      { key: PERMISSIONS.TRANSACTIONS_CREATE, label: "Criar" },
      { key: PERMISSIONS.TRANSACTIONS_UPDATE, label: "Editar" },
      { key: PERMISSIONS.TRANSACTIONS_DELETE, label: "Excluir" },
      { key: PERMISSIONS.TRANSACTIONS_REVERSE, label: "Estornar" },
    ],
  },
  {
    group: "estruturas",
    label: "Estruturas",
    permissions: [
      { key: PERMISSIONS.CATEGORIES_MANAGE, label: "Categorias" },
      { key: PERMISSIONS.ACCOUNT_PLAN_MANAGE, label: "Plano de contas" },
      { key: PERMISSIONS.COST_CENTERS_MANAGE, label: "Centros de custo" },
      { key: PERMISSIONS.PARTNERS_MANAGE, label: "Fornecedores/clientes" },
      { key: PERMISSIONS.BANK_ACCOUNTS_MANAGE, label: "Contas e caixas" },
    ],
  },
  {
    group: "transfers",
    label: "Transferencias",
    permissions: [
      { key: PERMISSIONS.TRANSFERS_VIEW, label: "Visualizar" },
      { key: PERMISSIONS.TRANSFERS_CREATE, label: "Criar" },
      { key: PERMISSIONS.TRANSFERS_REVERSE, label: "Estornar" },
    ],
  },
  {
    group: "reconciliation",
    label: "Conciliacao",
    permissions: [
      { key: PERMISSIONS.RECONCILIATION_VIEW, label: "Visualizar" },
      { key: PERMISSIONS.RECONCILIATION_MANAGE, label: "Conciliar" },
    ],
  },
  {
    group: "relatorios",
    label: "Relatorios",
    permissions: [
      { key: PERMISSIONS.REPORTS_VIEW, label: "Relatorios" },
      { key: PERMISSIONS.CASH_FLOW_VIEW, label: "Fluxo de caixa" },
    ],
  },
  {
    group: "administracao",
    label: "Administracao",
    permissions: [
      { key: PERMISSIONS.USERS_VIEW, label: "Visualizar usuarios" },
      { key: PERMISSIONS.USERS_MANAGE, label: "Gerenciar usuarios" },
      { key: PERMISSIONS.ROLES_MANAGE, label: "Gerenciar papeis" },
      { key: PERMISSIONS.AUDIT_VIEW, label: "Auditoria" },
      { key: PERMISSIONS.SETTINGS_MANAGE, label: "Configuracoes" },
      { key: PERMISSIONS.BACKUPS_VIEW, label: "Visualizar backups" },
      { key: PERMISSIONS.BACKUPS_MANAGE, label: "Gerenciar backups" },
    ],
  },
];

export const SYSTEM_ROLES: {
  name: string;
  description: string;
  permissions: Permission[];
}[] = [
  {
    name: "Administrador",
    description: "Acesso total ao sistema.",
    permissions: ALL_PERMISSIONS,
  },
  {
    name: "Gestor",
    description: "Operacao financeira completa, sem administracao de usuarios.",
    permissions: ALL_PERMISSIONS.filter(
      (p) =>
        !(
          [
            PERMISSIONS.USERS_MANAGE,
            PERMISSIONS.ROLES_MANAGE,
            PERMISSIONS.BACKUPS_MANAGE,
            PERMISSIONS.SETTINGS_MANAGE,
          ] as string[]
        ).includes(p),
    ),
  },
  {
    name: "Analista",
    description: "Cria e baixa titulos, lanca movimentos e emite relatorios.",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PAYABLES_VIEW,
      PERMISSIONS.PAYABLES_CREATE,
      PERMISSIONS.PAYABLES_UPDATE,
      PERMISSIONS.PAYABLES_SETTLE,
      PERMISSIONS.RECEIVABLES_VIEW,
      PERMISSIONS.RECEIVABLES_CREATE,
      PERMISSIONS.RECEIVABLES_UPDATE,
      PERMISSIONS.RECEIVABLES_SETTLE,
      PERMISSIONS.TRANSACTIONS_VIEW,
      PERMISSIONS.TRANSACTIONS_CREATE,
      PERMISSIONS.PARTNERS_MANAGE,
      PERMISSIONS.TRANSFERS_VIEW,
      PERMISSIONS.TRANSFERS_CREATE,
      PERMISSIONS.RECONCILIATION_VIEW,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.CASH_FLOW_VIEW,
    ],
  },
  {
    name: "Consulta",
    description: "Somente leitura.",
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.PAYABLES_VIEW,
      PERMISSIONS.RECEIVABLES_VIEW,
      PERMISSIONS.TRANSACTIONS_VIEW,
      PERMISSIONS.TRANSFERS_VIEW,
      PERMISSIONS.RECONCILIATION_VIEW,
      PERMISSIONS.REPORTS_VIEW,
      PERMISSIONS.CASH_FLOW_VIEW,
      PERMISSIONS.AUDIT_VIEW,
    ],
  },
];
