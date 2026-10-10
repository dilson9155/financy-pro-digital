"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { api, buildQuery } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { useToast } from "@/components/toast";
import { FilterBar, type FilterValues } from "@/components/filter-bar";
import { Modal } from "@/components/modal";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
} from "@/components/ui";
import {
  COMPANY_STATUS_LABELS,
  formatCurrency,
  formatDate,
} from "@/lib/format";

interface CompanyItem {
  id: string;
  name: string;
  legalName: string | null;
  document: string | null;
  email: string | null;
  billingEmail: string | null;
  phone: string | null;
  status: string;
  suspendedReason: string | null;
  suspendedAt: string | null;
  createdAt: string;
  usersCount: number;
  titlesCount: number;
  openInvoices: number;
  overdueInvoices: number;
  openAmount: number;
  nextDueDate: string | null;
}

interface Summary {
  companiesTotal: number;
  active: number;
  suspended: number;
  canceled: number;
  openInvoices: number;
  openAmount: number;
  overdueInvoices: number;
}

interface ListResponse {
  items: CompanyItem[];
  total: number;
  page: number;
  pageSize: number;
  summary: Summary;
}

const STATUS_FILTERS = [
  { value: "ACTIVE", label: "Ativas" },
  { value: "SUSPENDED", label: "Suspensas" },
  { value: "CANCELED", label: "Canceladas" },
];

const STATUS_TONES: Record<string, "green" | "yellow" | "gray"> = {
  ACTIVE: "green",
  SUSPENDED: "yellow",
  CANCELED: "gray",
};

export function AdminCompaniesView() {
  const { notify } = useToast();
  const [filters, setFilters] = useState<FilterValues>({ q: "", status: "" });
  const [applied, setApplied] = useState<FilterValues>({ q: "", status: "" });
  const [page, setPage] = useState(1);

  const query = useMemo(
    () =>
      `/api/admin/companies${buildQuery({
        q: applied.q,
        status: applied.status,
        page,
      })}`,
    [applied, page],
  );
  const { data, loading, error, reload } = useApiQuery<ListResponse>(query);

  const [statusTarget, setStatusTarget] = useState<CompanyItem | null>(null);
  const [statusForm, setStatusForm] = useState({ status: "ACTIVE", reason: "" });
  const [busy, setBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<CompanyItem | null>(null);
  const [confirmName, setConfirmName] = useState("");

  function openStatus(c: CompanyItem) {
    setStatusTarget(c);
    setStatusForm({
      status: c.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
      reason: c.suspendedReason ?? "",
    });
  }

  async function applyStatus() {
    if (!statusTarget) return;
    setBusy(true);
    try {
      await api.post(`/api/admin/companies/${statusTarget.id}/status`, {
        status: statusForm.status,
        reason: statusForm.reason || null,
      });
      notify("Status da empresa atualizado.", "success");
      setStatusTarget(null);
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao atualizar.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!deleteTarget || confirmName !== deleteTarget.name) return;
    setBusy(true);
    try {
      await api.delete(`/api/admin/companies/${deleteTarget.id}`);
      notify("Empresa excluída definitivamente.", "success");
      setDeleteTarget(null);
      setConfirmName("");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao excluir.", "error");
    } finally {
      setBusy(false);
    }
  }

  const summary = data?.summary;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Empresas"
        description="Gestão das empresas cadastradas na plataforma."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Empresas"
          value={String(summary?.companiesTotal ?? "—")}
          hint={`${summary?.active ?? 0} ativa(s) · ${summary?.suspended ?? 0} suspensa(s)`}
        />
        <StatCard
          label="Suspensas/Canceladas"
          value={String(
            (summary?.suspended ?? 0) + (summary?.canceled ?? 0),
          )}
          tone="warning"
          hint="Falta de pagamento ou cancelamento"
        />
        <StatCard
          label="Cobranças em aberto"
          value={String(summary?.openInvoices ?? "—")}
          tone="primary"
          hint={`${formatCurrency(summary?.openAmount ?? 0)} a receber`}
        />
        <StatCard
          label="Cobranças vencidas"
          value={String(summary?.overdueInvoices ?? "—")}
          tone={summary?.overdueInvoices ? "destructive" : "default"}
          hint="Requer atenção"
        />
      </div>

      <FilterBar
        fields={[
          {
            key: "q",
            label: "Buscar",
            type: "text",
            placeholder: "Nome, CNPJ ou e-mail",
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: STATUS_FILTERS,
          },
        ]}
        values={filters}
        onChange={setFilters}
        onSubmit={() => {
          setApplied(filters);
          setPage(1);
        }}
        onReset={() => {
          setApplied({ q: "", status: "" });
          setPage(1);
        }}
        loading={loading}
      />

      <Card>
        <CardContent className="p-0">
          {loading && !data ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Spinner /> Carregando…
            </div>
          ) : error ? (
            <EmptyState
              title="Erro ao carregar"
              description={error}
              action={
                <button onClick={reload} className="text-primary">
                  Tentar novamente
                </button>
              }
            />
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              title="Nenhuma empresa encontrada"
              description="Ajuste os filtros ou aguarde novos cadastros."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Empresa</TH>
                  <TH>Status</TH>
                  <TH align="right" className="hidden md:table-cell">
                    Usuários
                  </TH>
                  <TH align="right">Em aberto</TH>
                  <TH className="hidden lg:table-cell">Próx. vencimento</TH>
                  <TH align="right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((c) => (
                  <TR key={c.id}>
                    <TD>
                      <Link
                        href={`/admin/empresas/${c.id}`}
                        className="font-medium hover:text-primary"
                      >
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {c.document ?? c.email ?? "—"}
                      </p>
                    </TD>
                    <TD>
                      <Badge tone={STATUS_TONES[c.status] ?? "gray"}>
                        {COMPANY_STATUS_LABELS[c.status] ?? c.status}
                      </Badge>
                    </TD>
                    <TD align="right" className="hidden md:table-cell">
                      {c.usersCount}
                    </TD>
                    <TD align="right">
                      {c.openInvoices > 0 ? (
                        <span>
                          {formatCurrency(c.openAmount)}
                          {c.overdueInvoices > 0 ? (
                            <Badge tone="red" className="ml-2">
                              {c.overdueInvoices} vencida(s)
                            </Badge>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TD>
                    <TD className="hidden lg:table-cell">
                      {c.nextDueDate ? formatDate(c.nextDueDate) : "—"}
                    </TD>
                    <TD align="right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Link
                          href={`/admin/empresas/${c.id}`}
                          className="rounded-md border px-2 py-1 text-xs hover:bg-accent"
                        >
                          Gerenciar
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openStatus(c)}
                        >
                          {c.status === "ACTIVE" ? "Inativar" : "Ativar"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive"
                          onClick={() => {
                            setDeleteTarget(c);
                            setConfirmName("");
                          }}
                        >
                          Excluir
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {data && data.total > data.pageSize ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {data.page} de {totalPages} · {data.total} empresa(s)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      ) : null}

      {/* Modal: ativar/inativar */}
      <Modal
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        title={
          statusForm.status === "ACTIVE"
            ? "Ativar empresa"
            : "Inativar empresa"
        }
        description={statusTarget?.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant={statusForm.status === "ACTIVE" ? "success" : "destructive"}
              onClick={applyStatus}
              disabled={busy}
            >
              {busy ? <Spinner /> : null} Confirmar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Novo status">
            <Select
              value={statusForm.status}
              onChange={(e) =>
                setStatusForm((s) => ({ ...s, status: e.target.value }))
              }
            >
              <option value="ACTIVE">Ativa</option>
              <option value="SUSPENDED">Suspensa (bloqueia acesso)</option>
              <option value="CANCELED">Cancelada (bloqueia acesso)</option>
            </Select>
          </Field>
          {statusForm.status !== "ACTIVE" ? (
            <Field
              label="Motivo"
              hint="Ex.: falta de pagamento. Fica registrado na auditoria."
            >
              <Textarea
                value={statusForm.reason}
                onChange={(e) =>
                  setStatusForm((s) => ({ ...s, reason: e.target.value }))
                }
                placeholder="Motivo da inativação"
              />
            </Field>
          ) : null}
          {statusForm.status !== "ACTIVE" ? (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Ao inativar, as sessões dos usuários desta empresa serão
              encerradas e o login ficará bloqueado até a reativação.
            </p>
          ) : null}
        </div>
      </Modal>

      {/* Modal: excluir */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Excluir empresa definitivamente"
        description={deleteTarget?.name}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={doDelete}
              disabled={busy || confirmName !== deleteTarget?.name}
            >
              {busy ? <Spinner /> : null} Excluir definitivamente
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            Esta ação apaga <strong>todos os dados</strong> da empresa (títulos,
            lançamentos, contas, usuários vinculados etc.) e não pode ser
            desfeita.
          </p>
          <Field
            label={`Digite "${deleteTarget?.name ?? ""}" para confirmar`}
          >
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={deleteTarget?.name ?? ""}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
