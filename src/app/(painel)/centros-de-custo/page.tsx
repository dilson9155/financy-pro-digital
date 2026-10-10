import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { listCostCenters } from "@/services/structure";
import { CrudPage } from "@/components/crud-page";

export const dynamic = "force-dynamic";

export default async function CentrosDeCustoPage() {
  const ctx = await requirePermission(PERMISSIONS.COST_CENTERS_MANAGE);
  const centers = await listCostCenters(ctx.companyId);

  return (
    <CrudPage
      title="Centros de custo"
      description="Segmente despesas e receitas por área, projeto ou filial."
      endpoint="/api/cost-centers"
      itemLabel="centro de custo"
      createPermission={PERMISSIONS.COST_CENTERS_MANAGE}
      updatePermission={PERMISSIONS.COST_CENTERS_MANAGE}
      deletePermission={PERMISSIONS.COST_CENTERS_MANAGE}
      columns={[
        { key: "code", label: "Código", type: "code" },
        { key: "name", label: "Nome" },
        { key: "active", label: "Ativo", type: "boolean", align: "center" },
      ]}
      fields={[
        { key: "code", label: "Código", type: "text", required: true },
        { key: "name", label: "Nome", type: "text", required: true },
        {
          key: "parentId",
          label: "Centro pai",
          type: "select",
          colSpan: 2,
          options: centers.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
        },
        { key: "active", label: "Ativo", type: "checkbox", defaultValue: true },
      ]}
      filters={[
        { key: "q", label: "Buscar", type: "text", placeholder: "Código ou nome…" },
        {
          key: "active",
          label: "Situação",
          type: "select",
          options: [
            { value: "true", label: "Ativos" },
            { value: "false", label: "Inativos" },
          ],
        },
      ]}
    />
  );
}
