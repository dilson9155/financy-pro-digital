"use client";

import { useMemo, useState } from "react";
import { api } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { useCan } from "@/components/session-context";
import { useToast } from "@/components/toast";
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
import { BACKUP_STATUS_LABELS, formatBytes, formatDateTime } from "@/lib/format";

interface BackupRow {
  id: string;
  fileName: string;
  sizeBytes: number;
  recordCount: number;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  error: string | null;
  createdAt: string;
  completedAt: string | null;
  requestedBy: { id: string; name: string; email: string } | null;
}

interface ListResponse {
  items: BackupRow[];
  total: number;
  page: number;
  pageSize: number;
}

export function BackupsView() {
  const { notify } = useToast();
  const can = useCan();
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<BackupRow | null>(null);
  const [creating, setCreating] = useState(false);

  const url = useMemo(
    () => `/api/backups?page=${page}&pageSize=20`,
    [page],
  );

  const { data, loading, error, reload } = useApiQuery<ListResponse>(url);
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 20));

  async function create() {
    setCreating(true);
    try {
      const created = await api.post<BackupRow>("/api/backups");
      notify("Backup criado com sucesso.", "success");
      if (created?.id) setDetail(created);
      setPage(1);
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao criar backup.", "error");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backups</h1>
          <p className="text-sm text-muted-foreground">
            Cópias lógicas dos dados operacionais da empresa, geradas sob demanda.
          </p>
        </div>
        {can("backups.manage") ? (
          <Button onClick={create} disabled={creating}>
            {creating ? <Spinner /> : null} Criar backup
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Spinner /> Carregando…
            </div>
          ) : error ? (
            <EmptyState title="Erro ao carregar" description={error} />
          ) : (data?.items.length ?? 0) === 0 ? (
            <EmptyState
              title="Nenhum backup"
              description="Nenhum backup foi gerado ainda. Use o botão “Criar backup” para gerar o primeiro."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Arquivo</TH>
                  <TH>Status</TH>
                  <TH align="right">Registros</TH>
                  <TH align="right">Tamanho</TH>
                  <TH className="hidden md:table-cell">Solicitado por</TH>
                  <TH className="hidden lg:table-cell">Criado em</TH>
                  <TH align="right">Detalhes</TH>
                </TR>
              </THead>
              <TBody>
                {(data?.items ?? []).map((b) => (
                  <TR key={b.id}>
                    <TD>
                      <p className="max-w-[260px] truncate font-mono text-xs">{b.fileName}</p>
                      <p className="text-xs text-muted-foreground">{b.id.slice(0, 8)}</p>
                    </TD>
                    <TD>
                      <Badge tone={statusTone(b.status)}>
                        {BACKUP_STATUS_LABELS[b.status] ?? b.status}
                      </Badge>
                    </TD>
                    <TD align="right" className="tabular-nums">{b.recordCount}</TD>
                    <TD align="right" className="tabular-nums">{formatBytes(b.sizeBytes)}</TD>
                    <TD className="hidden text-muted-foreground md:table-cell">
                      {b.requestedBy?.name ?? "—"}
                    </TD>
                    <TD className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                      {formatDateTime(b.createdAt)}
                    </TD>
                    <TD align="right">
                      <Button variant="ghost" size="sm" onClick={() => setDetail(b)}>
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
        <span>{data?.total ?? 0} backup(s)</span>
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

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        title="Detalhes do backup"
        size="md"
      >
        {detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
                <Badge tone={statusTone(detail.status)}>
                  {BACKUP_STATUS_LABELS[detail.status] ?? detail.status}
                </Badge>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Arquivo</p>
                <p className="truncate font-mono text-xs" title={detail.fileName}>{detail.fileName || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Registros</p>
                <p className="tabular-nums">{detail.recordCount}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Tamanho</p>
                <p className="tabular-nums">{formatBytes(detail.sizeBytes)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Criado em</p>
                <p>{formatDateTime(detail.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-muted-foreground">Concluído em</p>
                <p>{detail.completedAt ? formatDateTime(detail.completedAt) : "—"}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">Solicitado por</p>
                <p>{detail.requestedBy ? `${detail.requestedBy.name} (${detail.requestedBy.email})` : "Sistema"}</p>
              </div>
              {detail.error ? (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium uppercase text-red-600">Erro</p>
                  <pre className="max-h-48 overflow-auto rounded-md bg-red-50 p-3 font-mono text-[11px] leading-relaxed text-red-700">
                    {detail.error}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}