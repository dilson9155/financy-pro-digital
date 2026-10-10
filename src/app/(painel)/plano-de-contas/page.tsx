import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { listAccountPlans } from "@/services/structure";
import { CrudPage } from "@/components/crud-page";

export const dynamic = "force-dynamic";

const TYPE_LABELS: Record<string, string> = {
  ASSET: "Ativo",
  LIABILITY: "Passivo",
  EQUITY: "Patrimônio líquido",
  REVENUE: "Receita",
  EXPENSE: "Despesa",
};

export default async function PlanoDeContasPage() {
  const ctx = await requirePermission(PERMISSIONS.ACCOUNT_PLAN_MANAGE);
  const plans = await listAccountPlans(ctx.companyId);

  return (
    <CrudPage
      title="Plano de contas"
      description="Estrutura contábil hierárquica usada pelos lançamentos."
      endpoint="/api/account-plans"
      itemLabel="conta"
      createPermission={PERMISSIONS.ACCOUNT_PLAN_MANAGE}
      updatePermission={PERMISSIONS.ACCOUNT_PLAN_MANAGE}
      deletePermission={PERMISSIONS.ACCOUNT_PLAN_MANAGE}
      columns={[
        { key: "code", label: "Código", type: "code" },
        { key: "name", label: "Nome" },
        { key: "type", label: "Tipo", type: "badge", labels: TYPE_LABELS },
        { key: "isAnalytical", label: "Analítica", type: "boolean", align: "center" },
        { key: "active", label: "Ativa", type: "boolean", align: "center" },
      ]}
      fields={[
        { key: "code", label: "Código", type: "text", required: true },
        {
          key: "type",
          label: "Tipo",
          type: "select",
          required: true,
          options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
        },
        { key: "name", label: "Nome", type: "text", required: true, colSpan: 2 },
        {
          key: "parentId",
          label: "Conta pai",
          type: "select",
          colSpan: 2,
          options: plans.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
        },
        { key: "isAnalytical", label: "Conta analítica", type: "checkbox", defaultValue: true },
        { key: "allowManual", label: "Aceita lançamento manual", type: "checkbox", defaultValue: true },
        { key: "active", label: "Ativa", type: "checkbox", defaultValue: true },
      ]}
      filters={[
        { key: "q", label: "Buscar", type: "text", placeholder: "Código ou nome…" },
        {
          key: "type",
          label: "Tipo",
          type: "select",
          options: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
        },
        {
          key: "active",
          label: "Situação",
          type: "select",
          options: [
            { value: "true", label: "Ativas" },
            { value: "false", label: "Inativas" },
          ],
        },
      ]}
    />
  );
}
