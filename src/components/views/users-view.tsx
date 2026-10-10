"use client";

import { useEffect, useMemo, useState } from "react";
import { api, buildQuery } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { fileToDataUrl } from "@/lib/image";
import { useCan } from "@/components/session-context";
import { useToast } from "@/components/toast";
import { FilterBar, type FilterValues } from "@/components/filter-bar";
import { Modal } from "@/components/modal";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Field,
  Input,
  Select,
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
import { PERMISSIONS } from "@/lib/permissions";

interface UserRow {
  membershipId: string;
  membershipStatus: string;
  userId: string;
  name: string;
  email: string;
  userStatus: string;
  lastLoginAt: string | null;
  isSuperAdmin: boolean;
  avatarUrl: string | null;
  roleId: string;
  roleName: string;
}

interface ListResponse {
  items: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface RoleOption {
  id: string;
  name: string;
  isSystem: boolean;
}

const MEMBERSHIP_STATUS: Record<string, { label: string; tone?: "green" | "yellow" | "red" }> = {
  ACTIVE: { label: "Ativo", tone: "green" },
  INVITED: { label: "Convidado", tone: "blue" as never },
  SUSPENDED: { label: "Suspenso", tone: "yellow" },
};

export function UsersView() {
  const { notify } = useToast();
  const can = useCan();
  const [values, setValues] = useState<FilterValues>({});
  const [applied, setApplied] = useState<FilterValues>({});
  const [page, setPage] = useState(1);

  const [roles, setRoles] = useState<RoleOption[]>([]);
  useEffect(() => {
    api
      .get<RoleOption[]>("/api/roles")
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  const url = useMemo(
    () => `/api/users${buildQuery({ ...applied, page, pageSize: 50 })}`,
    [applied, page],
  );
  const { data, loading, error, reload } = useApiQuery<ListResponse>(url);

  // ---- cria usuario ----
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});

  function openCreate() {
    setForm({
      name: "",
      email: "",
      password: "",
      roleId: roles.find((r) => r.name === "Analista")?.id ?? roles[0]?.id ?? "",
      status: "ACTIVE",
    });
    setFormError(null);
    setOpen(true);
  }

  async function create() {
    setSaving(true);
    setFormError(null);
    try {
      await api.post("/api/users", {
        name: form.name,
        email: form.email,
        password: form.password,
        roleId: form.roleId,
        status: form.status,
      });
      notify("Usuário vinculado com sucesso.", "success");
      setOpen(false);
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao criar.");
    } finally {
      setSaving(false);
    }
  }

  // ---- edita vinculo (papel / situacao / foto) ----
  const [editState, setEditState] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  function openEdit(row: UserRow) {
    setEditState(row);
    setEditForm({
      roleId: row.roleId,
      status: row.membershipStatus,
      avatarUrl: row.avatarUrl ?? "",
    });
    setEditError(null);
    setAvatarError(null);
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAvatarError(null);
    try {
      const dataUrl = await fileToDataUrl(file, {
        maxDimension: 256,
        format: "image/jpeg",
        quality: 0.85,
      });
      setEditForm((f) => ({ ...f, avatarUrl: dataUrl }));
    } catch (err) {
      setAvatarError(
        err instanceof Error ? err.message : "Erro ao processar a imagem.",
      );
    }
  }

  async function saveMembership() {
    if (!editState) return;
    setEditing(true);
    setEditError(null);
    try {
      await api.patch(`/api/memberships/${editState.membershipId}`, {
        roleId: editForm.roleId,
        status: editForm.status,
      });
      if ((editForm.avatarUrl ?? "") !== (editState.avatarUrl ?? "")) {
        await api.patch(`/api/users/${editState.userId}`, {
          avatarUrl: editForm.avatarUrl || null,
        });
      }
      notify("Vínculo atualizado.", "success");
      setEditState(null);
      await reload();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setEditing(false);
    }
  }

  // ---- reset de senha ----
  const [pwdState, setPwdState] = useState<UserRow | null>(null);
  const [pwd, setPwd] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  async function resetPassword() {
    if (!pwdState) return;
    setPwdSaving(true);
    setPwdError(null);
    try {
      await api.post(`/api/users/${pwdState.userId}/password`, { password: pwd });
      notify("Senha redefinida. Sessões ativas foram revogadas.", "success");
      setPwdState(null);
      setPwd("");
    } catch (err) {
      setPwdError(err instanceof Error ? err.message : "Erro ao redefinir.");
    } finally {
      setPwdSaving(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / 50));

  const filterFields = useMemo(
    () => [
      { key: "q", label: "Buscar", type: "text" as const, placeholder: "Nome ou e-mail…" },
      {
        key: "status",
        label: "Situação",
        type: "select" as const,
        options: Object.entries(MEMBERSHIP_STATUS).map(([value, s]) => ({
          value,
          label: s.label,
        })),
      },
    ],
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Acesso e papéis de cada pessoa nesta empresa.
          </p>
        </div>
        {can(PERMISSIONS.USERS_MANAGE) ? (
          <Button onClick={openCreate}>Vincular usuário</Button>
        ) : null}
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
            <EmptyState title="Nenhum usuário" description="Vincule o primeiro usuário à empresa." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Usuário</TH>
                  <TH className="hidden md:table-cell">Último acesso</TH>
                  <TH>Papel</TH>
                  <TH>Situação</TH>
                  <TH align="right">Ações</TH>
                </TR>
              </THead>
              <TBody>
                {(data?.items ?? []).map((u) => {
                  const ms = MEMBERSHIP_STATUS[u.membershipStatus];
                  return (
                    <TR key={u.membershipId}>
                      <TD>
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} src={u.avatarUrl} size="sm" />
                          <div className="min-w-0">
                            <p className="font-medium">{u.name}</p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </TD>
                      <TD className="hidden whitespace-nowrap text-muted-foreground md:table-cell">
                        {u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "Nunca"}
                      </TD>
                      <TD>
                        <Badge tone={u.isSuperAdmin ? "purple" : "blue"}>{u.roleName}</Badge>
                      </TD>
                      <TD>
                        <Badge tone={ms?.tone ?? "gray"}>{ms?.label ?? u.membershipStatus}</Badge>
                      </TD>
                      <TD align="right">
                        <div className="flex justify-end gap-1">
                          {can(PERMISSIONS.USERS_MANAGE) ? (
                            <>
                              <Button variant="ghost" size="sm" onClick={() => openEdit(u)}>
                                Editar
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => {
                                  setPwdState(u);
                                  setPwd("");
                                  setPwdError(null);
                                }}
                              >
                                Senha
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{data?.total ?? 0} usuário(s)</span>
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

      {/* Modal criar usuário */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Vincular usuário"
        description="Adiciona um usuário (novo ou existente) à empresa com um papel."
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={create} disabled={saving}>
              {saving ? <Spinner /> : null} Salvar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome">
            <Input required value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="E-mail">
            <Input type="email" required value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </Field>
          <Field label="Senha inicial" hint="Mínimo 8 caracteres.">
            <Input type="password" required value={form.password ?? ""} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
          </Field>
          <Field label="Papel">
            <Select required value={form.roleId ?? ""} onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}>
              <option value="">Selecione…</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </Field>
        </div>
        {formError ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        ) : null}
      </Modal>

      {/* Modal editar vinculo */}
      <Modal
        open={Boolean(editState)}
        onClose={() => setEditState(null)}
        title={`Editar vínculo — ${editState?.name ?? ""}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditState(null)}>Cancelar</Button>
            <Button onClick={saveMembership} disabled={editing}>
              {editing ? <Spinner /> : null} Salvar
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Foto do usuário"
            className="sm:col-span-2"
            hint="PNG ou JPEG, até ~1,5 MB."
          >
            <div className="flex flex-wrap items-center gap-3">
              <Avatar
                name={editState?.name ?? "?"}
                src={editForm.avatarUrl || null}
                size="lg"
              />
              <label className="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent">
                Escolher foto
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={onAvatarChange}
                />
              </label>
              {editForm.avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => setEditForm((f) => ({ ...f, avatarUrl: "" }))}
                >
                  Remover
                </Button>
              ) : null}
            </div>
            {avatarError ? (
              <p className="mt-2 text-xs text-red-600">{avatarError}</p>
            ) : null}
          </Field>
          <Field label="Papel">
            <Select value={editForm.roleId ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, roleId: e.target.value }))}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Situação do vínculo">
            <Select value={editForm.status ?? ""} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="ACTIVE">Ativo</option>
              <option value="INVITED">Convidado</option>
              <option value="SUSPENDED">Suspenso</option>
            </Select>
          </Field>
        </div>
        {editError ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</p>
        ) : null}
      </Modal>

      {/* Modal reset senha */}
      <Modal
        open={Boolean(pwdState)}
        onClose={() => setPwdState(null)}
        title={`Redefinir senha — ${pwdState?.name ?? ""}`}
        description="Sessões ativas do usuário serão revogadas."
        footer={
          <>
            <Button variant="outline" onClick={() => setPwdState(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={resetPassword} disabled={pwdSaving || pwd.length < 8}>
              {pwdSaving ? <Spinner /> : null} Redefinir
            </Button>
          </>
        }
      >
        <Field label="Nova senha" hint="Mínimo 8 caracteres.">
          <Input type="password" required value={pwd} onChange={(e) => setPwd(e.target.value)} />
        </Field>
        {pwdError ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{pwdError}</p>
        ) : null}
      </Modal>
    </div>
  );
}