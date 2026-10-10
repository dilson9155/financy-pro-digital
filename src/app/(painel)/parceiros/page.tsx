import { requirePermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/permissions";
import { CrudPage } from "@/components/crud-page";

export const dynamic = "force-dynamic";

export default async function ParceirosPage() {
  await requirePermission(PERMISSIONS.PARTNERS_MANAGE);

  return (
    <CrudPage
      title="Fornecedores e clientes"
      description="Cadastro de parceiros usados em contas a pagar e a receber."
      endpoint="/api/partners"
      itemLabel="parceiro"
      createPermission={PERMISSIONS.PARTNERS_MANAGE}
      updatePermission={PERMISSIONS.PARTNERS_MANAGE}
      deletePermission={PERMISSIONS.PARTNERS_MANAGE}
      columns={[
        { key: "name", label: "Nome" },
        {
          key: "type",
          label: "Tipo",
          type: "badge",
          labels: {
            CUSTOMER: "Cliente",
            SUPPLIER: "Fornecedor",
            BOTH: "Cliente/Fornecedor",
          },
        },
        { key: "document", label: "Documento", hideOnMobile: true },
        { key: "email", label: "E-mail", hideOnMobile: true },
        { key: "phone", label: "Telefone", hideOnMobile: true },
        { key: "active", label: "Ativo", type: "boolean", align: "center" },
      ]}
      fields={[
        { key: "name", label: "Nome", type: "text", required: true, colSpan: 2 },
        {
          key: "type",
          label: "Tipo",
          type: "select",
          required: true,
          options: [
            { value: "SUPPLIER", label: "Fornecedor" },
            { value: "CUSTOMER", label: "Cliente" },
            { value: "BOTH", label: "Cliente/Fornecedor" },
          ],
        },
        { key: "document", label: "CNPJ / CPF", type: "text" },
        { key: "email", label: "E-mail", type: "email" },
        { key: "phone", label: "Telefone", type: "text" },
        { key: "notes", label: "Observações", type: "textarea", colSpan: 2 },
        { key: "active", label: "Ativo", type: "checkbox", defaultValue: true },
      ]}
      filters={[
        { key: "q", label: "Buscar", type: "text", placeholder: "Nome ou documento…" },
        {
          key: "type",
          label: "Tipo",
          type: "select",
          options: [
            { value: "SUPPLIER", label: "Fornecedor" },
            { value: "CUSTOMER", label: "Cliente" },
            { value: "BOTH", label: "Cliente/Fornecedor" },
          ],
        },
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
