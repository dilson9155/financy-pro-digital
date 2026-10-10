"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  Label,
  Select,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  statusTone,
} from "@/components/ui";
import { Modal } from "@/components/modal";
import { FilterBar, type FilterField, type FilterValues } from "@/components/filter-bar";
import { useToast } from "@/components/toast";
import { useCan } from "@/components/session-context";
import { api, buildQuery } from "@/lib/client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

export type ColumnType =
  | "text"
  | "currency"
  | "date"
  | "datetime"
  | "badge"
  | "boolean"
  | "percent"
  | "code";

export interface ColumnDef {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  type?: ColumnType;
  labels?: Record<string, string>;
  hideOnMobile?: boolean;
}

export interface FieldDef {
  key: string;
  label: string;
  type:
    | "text"
    | "email"
    | "number"
    | "money"
    | "date"
    | "select"
    | "textarea"
    | "checkbox";
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
  defaultValue?: string | number | boolean;
  colSpan?: 1 | 2;
}

export interface CrudPageProps {
  title: string;
  description?: string;
  endpoint: string;
  itemLabel: string;
  columns: ColumnDef[];
  fields?: FieldDef[];
  filters?: FilterField[];
  defaultFilters?: FilterValues;
  createPermission?: string;
  updatePermission?: string;
  deletePermission?: string;
  readOnly?: boolean;
  headerActions?: React.ReactNode;
  pageSize?: number;
  createLabel?: string;
}

type Row = Record<string, unknown>;

function cellValue(row: Row, col: ColumnDef): React.ReactNode {
  const raw = row[col.key];
  if (raw === null || raw === undefined || raw === "") return "—";
  switch (col.type) {
    case "currency":
      return formatCurrency(raw as string);
    case "date":
      return formatDate(raw as string);
    case "datetime":
      return formatDateTime(raw as string);
    case "percent":
      return `${Number(raw).toFixed(1)}%`;
    case "boolean":
      return raw ? <Badge tone="green">Sim</Badge> : <Badge>Não</Badge>;
    case "badge": {
      const key = String(raw);
      return (
        <Badge tone={statusTone(key)}>
          {col.labels?.[key] ?? key}
        </Badge>
      );
    }
    case "code":
      return <span className="font-mono text-xs">{String(raw)}</span>;
    default:
      return String(raw);
  }
}

export function CrudPage({
  title,
  description,
  endpoint,
  itemLabel,
  columns,
  fields,
  filters,
  defaultFilters,
  createPermission,
  updatePermission,
  deletePermission,
  readOnly,
  headerActions,
  pageSize = 20,
  createLabel,
}: CrudPageProps) {
  const { notify } = useToast();
  const can = useCan();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<FilterValues>(defaultFilters ?? {});
  const [applied, setApplied] = useState<FilterValues>(defaultFilters ?? {});

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canCreate = !readOnly && (!createPermission || can(createPermission));
  const canUpdate = !readOnly && (!updatePermission || can(updatePermission));
  const canDelete = !readOnly && (!deletePermission || can(deletePermission));

  const query = useMemo(
    () => buildQuery({ ...applied, page, pageSize }),
    [applied, page, pageSize],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Row[] | { items: Row[]; total: number }>(
        `${endpoint}${query}`,
      );
      if (Array.isArray(res)) {
        setRows(res);
        setTotal(res.length);
      } else {
        setRows(res.items ?? []);
        setTotal(res.total ?? (res.items?.length ?? 0));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar.");
    } finally {
      setLoading(false);
    }
  }, [endpoint, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const clientPagedRows = rows;
  const isServerPaged = total > rows.length;
  const visibleRows = !isServerPaged
    ? clientPagedRows.slice((page - 1) * pageSize, page * pageSize)
    : rows;

  function openCreate() {
    const initial: Record<string, unknown> = {};
    for (const f of fields ?? []) {
      initial[f.key] =
        f.defaultValue ?? (f.type === "checkbox" ? true : "");
    }
    setForm(initial);
    setEditing(null);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(row: Row) {
    const initial: Record<string, unknown> = {};
    for (const f of fields ?? []) {
      const v = row[f.key];
      initial[f.key] =
        v === null || v === undefined
          ? f.type === "checkbox"
            ? false
            : ""
          : f.type === "date" && typeof v === "string"
            ? v.slice(0, 10)
            : v;
    }
    setForm(initial);
    setEditing(row);
    setFormError(null);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const f of fields ?? []) {
        const raw = form[f.key];
        if (f.type === "checkbox") {
          payload[f.key] = Boolean(raw);
          continue;
        }
        if (raw === "" || raw === undefined || raw === null) continue;
        if (f.type === "money" || f.type === "number") {
          payload[f.key] = Number(raw);
        } else {
          payload[f.key] = raw;
        }
      }
      if (editing) {
        await api.patch(`${endpoint}/${String(editing.id)}`, payload);
        notify(`${itemLabel} atualizado(a) com sucesso.`, "success");
      } else {
        await api.post(endpoint, payload);
        notify(`${itemLabel} criado(a) com sucesso.`, "success");
      }
      setOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: Row) {
    if (
      !window.confirm(
        `Confirma a exclusão de "${String(row.name ?? row.id)}"? Esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    try {
      await api.delete(`${endpoint}/${String(row.id)}`);
      notify(`${itemLabel} excluído(a).`, "success");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao excluir.", "error");
    }
  }

  const showActions = canUpdate || canDelete;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {headerActions}
          {canCreate && fields ? (
            <Button onClick={openCreate}>
              {createLabel ?? `Novo(a) ${itemLabel}`}
            </Button>
          ) : null}
        </div>
      </div>

      {filters ? (
        <FilterBar
          fields={filters}
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
      ) : null}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Spinner /> Carregando…
            </div>
          ) : error ? (
            <EmptyState title="Erro ao carregar" description={error} />
          ) : visibleRows.length === 0 ? (
            <EmptyState
              title="Nenhum registro encontrado"
              description="Ajuste os filtros ou cadastre um novo registro."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  {columns.map((c) => (
                    <TH
                      key={c.key}
                      align={c.align}
                      className={c.hideOnMobile ? "hidden md:table-cell" : undefined}
                    >
                      {c.label}
                    </TH>
                  ))}
                  {showActions ? <TH align="right">Ações</TH> : null}
                </TR>
              </THead>
              <TBody>
                {visibleRows.map((row, idx) => (
                  <TR key={String(row.id ?? idx)}>
                    {columns.map((c) => (
                      <TD
                        key={c.key}
                        align={c.align}
                        className={c.hideOnMobile ? "hidden md:table-cell" : undefined}
                      >
                        {cellValue(row, c)}
                      </TD>
                    ))}
                    {showActions ? (
                      <TD align="right">
                        <div className="flex justify-end gap-1">
                          {canUpdate && fields ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(row)}
                            >
                              Editar
                            </Button>
                          ) : null}
                          {canDelete ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => remove(row)}
                            >
                              Excluir
                            </Button>
                          ) : null}
                        </div>
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} registro(s)
          {visibleRows.length > 0
            ? ` · exibindo ${(page - 1) * pageSize + 1}–${(page - 1) * pageSize + visibleRows.length}`
            : ""}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span className="px-2">Página {page}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page * pageSize >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Editar ${itemLabel}` : `Novo(a) ${itemLabel}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Spinner /> : null}
              Salvar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {(fields ?? []).map((f) => (
            <div
              key={f.key}
              className={f.colSpan === 2 ? "sm:col-span-2" : undefined}
            >
              {f.type === "checkbox" ? (
                <label className="flex items-center gap-2 pt-6 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form[f.key])}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, [f.key]: e.target.checked }))
                    }
                    className="h-4 w-4 rounded border"
                  />
                  {f.label}
                </label>
              ) : (
                <Field label={f.label} hint={f.hint}>
                  {f.type === "select" ? (
                    <Select
                      value={String(form[f.key] ?? "")}
                      required={f.required}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, [f.key]: e.target.value }))
                      }
                    >
                      <option value="">Selecione…</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  ) : f.type === "textarea" ? (
                    <Textarea
                      value={String(form[f.key] ?? "")}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, [f.key]: e.target.value }))
                      }
                    />
                  ) : (
                    <Input
                      type={
                        f.type === "money" || f.type === "number"
                          ? "number"
                          : f.type === "date"
                            ? "date"
                            : f.type === "email"
                              ? "email"
                              : "text"
                      }
                      step={f.type === "money" ? "0.01" : undefined}
                      required={f.required}
                      value={String(form[f.key] ?? "")}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, [f.key]: e.target.value }))
                      }
                    />
                  )}
                </Field>
              )}
            </div>
          ))}
        </div>
        {formError ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}
      </Modal>
    </div>
  );
}
