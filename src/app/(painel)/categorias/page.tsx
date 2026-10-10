import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { listAccountPlans, listCategories } from "@/services/structure";
import { CrudPage } from "@/components/crud-page";

export const dynamic = "force-dynamic";

export default async function CategoriasPage() {
  const ctx = await requirePermission(PERMISSIONS.CATEGORIES_MANAGE);
  const [categories, plans] = await Promise.all([
    listCategories(ctx.companyId),
    listAccountPlans(ctx.companyId),
  ]);

  return (
    <CrudPage
      title="Categorias"
      description="Classifique receitas e despesas para relatórios gerenciais."
      endpoint="/api/categories"
      itemLabel="categoria"
      createPermission={PERMISSIONS.CATEGORIES_MANAGE}
      updatePermission={PERMISSIONS.CATEGORIES_MANAGE}
      deletePermission={PERMISSIONS.CATEGORIES_MANAGE}
      columns={[
        { key: "name", label: "Nome" },
        {
          key: "type",
          label: "Tipo",
          type: "badge",
          labels: { INCOME: "Receita", EXPENSE: "Despesa" },
        },
        { key: "active", label: "Ativa", type: "boolean", align: "center" },
      ]}
      fields={[
        { key: "name", label: "Nome", type: "text", required: true, colSpan: 2 },
        {
          key: "type",
          label: "Tipo",
          type: "select",
          required: true,
          options: [
            { value: "INCOME", label: "Receita" },
            { value: "EXPENSE", label: "Despesa" },
          ],
        },
        {
          key: "parentId",
          label: "Categoria pai",
          type: "select",
          options: categories.map((c) => ({
            value: c.id,
            label: `${c.name} (${c.type === "INCOME" ? "Receita" : "Despesa"})`,
          })),
        },
        {
          key: "accountPlanId",
          label: "Conta contábil",
          type: "select",
          colSpan: 2,
          options: plans.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
        },
        { key: "active", label: "Ativa", type: "checkbox", defaultValue: true },
      ]}
      filters={[
        { key: "q", label: "Buscar", type: "text", placeholder: "Nome…" },
        {
          key: "type",
          label: "Tipo",
          type: "select",
          options: [
            { value: "INCOME", label: "Receita" },
            { value: "EXPENSE", label: "Despesa" },
          ],
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
