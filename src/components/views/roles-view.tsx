"use client";

import { useState } from "react";
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
  Field,
  Input,
  Spinner,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Textarea,
} from "@/components/ui";
import { PERMISSION_GROUPS, SYSTEM_ROLES, PERMISSIONS } from "@/lib/permissions";

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: { id: string; roleId: string; permission: string }[];
  _count: { memberships: number };
}

const SYSTEM_ROLE_NAMES = new Set(SYSTEM_ROLES.map((r) => r.name));

export function RolesView() {
  const { notify } = useToast();
  const can = useCan();
  const { data: roles, loading, error, reload } = useApiQuery<RoleRow[]>("/api/roles");

  // ---- criar/editar ----
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; permissions: Set<string> }>({
    name: "",
    description: "",
    permissions: new Set(),
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", description: "", permissions: new Set() });
    setFormError(null);
    setOpen(true);
  }

  function openEdit(role: RoleRow) {
    setEditing(role);
    setForm({
      name: role.name,
      description: role.description ?? "",
      permissions: new Set(role.permissions.map((p) => p.permission)),
    });
    setFormError(null);
    setOpen(true);
  }

  function togglePermission(permission: string) {
    setForm((f) => {
      const next = new Set(f.permissions);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return { ...f, permissions: next };
    });
  }

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        permissions: Array.from(form.permissions),
      };
      if (editing) {
        await api.patch(`/api/roles/${editing.id}`, payload);
        notify("Papel atualizado.", "success");
      } else {
        await api.post("/api/roles", payload);
        notify("Papel criado.", "success");
      }
      setOpen(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(role: RoleRow) {
    if (!window.confirm(`Excluir o papel "${role.name}"?`)) return;
    try {
      await api.delete(`/api/roles/${role.id}`);
      notify("Papel excluído.", "success");
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Erro ao excluir.", "error");
    }
  }

  const canManage = can(PERMISSIONS.ROLES_MANAGE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Papéis e permissões</h1>
          <p className="text-sm text-muted-foreground">
            Controle de acesso baseado em papéis (RBAC) por empresa.
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreate}>Novo papel</Button>
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
          ) : (roles?.length ?? 0) === 0 ? (
            <EmptyState title="Nenhum papel" description="Existem papéis de sistema. Recarregue a página." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Papel</TH>
                  <TH>Descrição</TH>
                  <TH className="hidden md:table-cell">Permissões</TH>
                  <TH align="center" className="hidden sm:table-cell">Usuários</TH>
                  <TH align="right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {(roles ?? []).map((r) => (
                  <TR key={r.id}>
                    <TD>
                      <p className="font-medium">{r.name}</p>
                      {r.isSystem ? <Badge tone="blue">Sistema</Badge> : null}
                    </TD>
                    <TD className="max-w-[280px] text-sm text-muted-foreground">
                      {r.description ?? "—"}
                    </TD>
                    <TD className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {r.permissions.length} permissão(ões)
                      </span>
                    </TD>
                    <TD align="center" className="hidden sm:table-cell">
                      {r._count.memberships}
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-1">
                        {canManage ? (
                          <>
                            {!SYSTEM_ROLE_NAMES.has(r.name) ? (
                              <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                                Editar
                              </Button>
                            ) : (
                              <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                                Ver
                              </Button>
                            )}
                            {!r.isSystem ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => remove(r)}
                              >
                                Excluir
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal papel */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? (SYSTEM_ROLE_NAMES.has(editing.name) ? `Papel de sistema — ${editing.name}` : `Editar papel — ${editing.name}`) : "Novo papel"}
        size="xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? <Spinner /> : null} Salvar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <Input
              required
              disabled={Boolean(editing && SYSTEM_ROLE_NAMES.has(editing.name))}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Descrição">
            <Textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
        </div>

        <div className="mt-5 space-y-4">
          {PERMISSION_GROUPS.map((group) => {
            const allSelected = group.permissions.every((p) => form.permissions.has(p.key));
            const someSelected = group.permissions.some((p) => form.permissions.has(p.key));
            return (
              <div key={group.group} className="rounded-lg border">
                <div className="flex items-center justify-between border-b px-4 py-2">
                  <p className="text-sm font-semibold">{group.label}</p>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someSelected && !allSelected;
                      }}
                      onChange={(e) => {
                        const next = new Set(form.permissions);
                        if (e.target.checked) {
                          group.permissions.forEach((p) => next.add(p.key));
                        } else {
                          group.permissions.forEach((p) => next.delete(p.key));
                        }
                        setForm((f) => ({ ...f, permissions: next }));
                      }}
                      className="h-4 w-4 rounded border"
                    />
                    Marcar grupo
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-1 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group.permissions.map((p) => (
                    <label
                      key={p.key}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <input
                        type="checkbox"
                        checked={form.permissions.has(p.key)}
                        onChange={() => togglePermission(p.key)}
                        className="h-4 w-4 rounded border"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          {form.permissions.size} permissão(ões) selecionada(s).
        </p>
        {formError ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        ) : null}
      </Modal>
    </div>
  );
}