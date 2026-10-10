import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { listAccountPlans } from "@/services/structure";
import { CrudPage } from "@/components/crud-page";

export const dynamic = "force-dynamic";

export default async function ContasBancariasPage() {
  const ctx = await requirePermission(PERMISSIONS.BANK_ACCOUNTS_MANAGE);
  const plans = await listAccountPlans(ctx.companyId);

  return (
    <CrudPage
      title="Contas bancárias e caixas"
      description="O saldo atual é sempre calculado a partir dos lançamentos (ledger)."
      endpoint="/api/accounts"
      itemLabel="conta"
      createPermission={PERMISSIONS.BANK_ACCOUNTS_MANAGE}
      updatePermission={PERMISSIONS.BANK_ACCOUNTS_MANAGE}
      deletePermission={PERMISSIONS.BANK_ACCOUNTS_MANAGE}
      columns={[
        { key: "name", label: "Nome" },
        {
          key: "type",
          label: "Tipo",
          type: "badge",
          labels: {
            BANK: "Banco",
            CASH: "Caixa",
            INVESTMENT: "Investimento",
            OTHER: "Outro",
          },
        },
        { key: "bankName", label: "Banco", hideOnMobile: true },
        { key: "currentBalance", label: "Saldo atual", type: "currency", align: "right" },
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
            { value: "BANK", label: "Conta bancária" },
            { value: "CASH", label: "Caixa" },
            { value: "INVESTMENT", label: "Investimento" },
            { value: "OTHER", label: "Outro" },
          ],
        },
        { key: "bankName", label: "Banco", type: "text" },
        { key: "bankCode", label: "Código do banco", type: "text" },
        { key: "agency", label: "Agência", type: "text" },
        { key: "accountNumber", label: "Conta", type: "text" },
        {
          key: "initialBalance",
          label: "Saldo inicial",
          type: "money",
          hint: "Registrado como lançamento de saldo inicial.",
        },
        {
          key: "accountPlanId",
          label: "Conta contábil",
          type: "select",
          options: plans.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` })),
        },
        { key: "active", label: "Ativa", type: "checkbox", defaultValue: true },
      ]}
      filters={[
        {
          key: "type",
          label: "Tipo",
          type: "select",
          options: [
            { value: "BANK", label: "Conta bancária" },
            { value: "CASH", label: "Caixa" },
            { value: "INVESTMENT", label: "Investimento" },
            { value: "OTHER", label: "Outro" },
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
