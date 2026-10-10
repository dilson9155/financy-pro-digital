"use client";

import { useMemo, useState } from "react";
import { buildQuery } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { FilterBar, type FilterValues } from "@/components/filter-bar";
import { Modal } from "@/components/modal";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  statusTone,
} from "@/components/ui";
import { formatDateTime } from "@/lib/format";

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  user: { id: string; name: string; email: string } | null;
}

interface ListResponse {
  items: AuditRow[];
  total: number;
  page: number;
  pageSize: number;
  actions: string[];
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Criação",
  UPDATE: "Edição",
  DELETE: "Exclusão",
  SETTLE: "Baixa",
  REVERSE: "Estorno",
  CANCEL: "Cancelamento",
  LOGIN: "Login",
  LOGOUT: "Logout",
  LOGIN_FAILED: "Falha de login",
  TRANSFER: "Transferência",
  RECONCILE: "Conciliação",
  UNRECONCILE: "Desconciliação",
  BACKUP: "Backup",
  ROLE_CHANGE: "Alteração de papel",
};

export function AuditView() {
  const [values, setValues] = useState<FilterValues>({});
  const [applied, setApplied] = useState<FilterValues>({});
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<AuditRow | null>(null);

  const actions = (applied.actions ?? "")
    .split(",")
    .filter(Boolean);

  const url = useMemo(() => {
    const qs = buildQuery({
      ...applied,
      actions: actions.length > 0 ? actions : undefined,
      page,
      pageSize: 30,
    });
    return `/api/audit${qs}`;
  }, [applied, actions, page]);

  const { data, loading, error, reload } = useApiQuery<ListResponse>(url);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 30));

  const filterFields = useMemo(
    () => [
      { key: "q", label: "Buscar", type: "text" as const, placeholder: "Entidade ou ação…" },
      { key: "from", label: "De", type: "date" as const },
      { key: "to", label: "Até", type: "date" as const },
      {
        key: "actions",
        label: "Ações (separadas por vírgula)",
        type: "text" as const,
        placeholder: "ex: CREATE,SETTLE,REVERSE",
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditoria</h1>
        <p className="text-sm text-muted-foreground">
          Trilha completa e imutável de todas as operações financeiras e administrativas.
        </p>
      </div>

      <FilterBar
        fields={filterFields}
        values={values}
        onChange={setValues}
        onSubmit={() => {
          setPage(1);
          setApplied(values);
        }}
        onReset={() => {
          setPage(1);
          setApplied({});
        }}
        loading={loading}
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Spinner /> Carregando…
            </div>
          ) : error ? (
            <EmptyState title="Erro ao carregar" description={error} />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState title="Nenhum registro" description="Nenhum evento encontrado para os filtros." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Data</TH>
                  <TH>Ação</TH>
                  <TH>Entidade</TH>
                  <TH className="hidden md:table-cell">Usuário</TH>
                  <TH className="hidden lg:table-cell">IP</TH>
                  <TH align="right">Detalhes</TH>
                </TR>
              </THead>
              <TBody>
                {(data?.items ?? []).map((a) => (
                  <TR key={a.id}>
                    <TD className="whitespace-nowrap">{formatDateTime(a.createdAt)}</TD>
                    <TD>
                      <Badge tone={statusTone(a.action)}>
                        {ACTION_LABELS[a.action] ?? a.action}
                      </Badge>
                    </TD>
                    <TD>
                      <p className="font-medium">{a.entity}</p>
                      {a.entityId ? (
                        <p className="font-mono text-[11px] text-muted-foreground">{a.entityId}</p>
                      ) : null}
                    </TD>
                    <TD className="hidden text-muted-foreground md:table-cell">
                      {a.user?.name ?? "Sistema"}
                    </TD>
                    <TD className="hidden text-muted-foreground lg:table-cell">
                      {a.ip ?? "—"}
                    </TD>
                    <TD align="right">
                      <Button variant="ghost" size="sm" onClick={() => setDetail(a)}>
                        Ver
                      </Button>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data?.total ?? 0} registro(s)</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <span className="px-2">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Próxima
          </Button>
        </div>
      </div>

      {/* Modal detalhes */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={`${detail ? ACTION_LABELS[detail.action] ?? detail.action : ""} — ${detail?.entity ?? ""}`}
        size="lg"
      >
        {detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Data</p>
                <p>{formatDateTime(detail.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Usuário</p>
                <p>{detail.user ? `${detail.user.name} (${detail.user.email})` : "Sistema"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Entidade</p>
                <p className="font-mono text-xs">{detail.entity}{detail.entityId ? ` · ${detail.entityId}` : ""}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">IP / Agent</p>
                <p className="truncate">{detail.ip ?? "—"} {detail.userAgent ? `· ${detail.userAgent}` : ""}</p>
              </div>
            </div>
            {detail.before || detail.after ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Antes</p>
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">
                    {detail.before ? JSON.stringify(detail.before, null, 2) : "—"}
                  </pre>
                </div>
                <div>
                  <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Depois</p>
                  <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-3 font-mono text-[11px] leading-relaxed">
                    {detail.after ? JSON.stringify(detail.after, null, 2) : "—"}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}