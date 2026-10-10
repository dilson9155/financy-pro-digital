"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { fileToDataUrl } from "@/lib/image";
import { useToast } from "@/components/toast";
import { useSession } from "@/components/session-context";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Select,
  Spinner,
} from "@/components/ui";

interface SettingsData {
  settings: Record<string, unknown>;
  company: {
    id: string;
    name: string;
    legalName: string | null;
    document: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    currency: string;
    timezone: string;
    logoUrl: string | null;
    status: string;
  };
}

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Fortaleza",
  "America/Recife",
  "America/Porto_Velho",
  "America/Bahia",
  "UTC",
];

/** Configuracoes genericas conhecidas pelo sistema (key/value). */
const GENERIC_SETTINGS: { key: string; label: string; hint?: string }[] = [
  {
    key: "default_terms_days",
    label: "Prazo padrão (dias) para títulos",
    hint: "Usado como sugestão ao criar contas a pagar/receber.",
  },
  {
    key: "reports.default_period_days",
    label: "Período padrão dos relatórios (dias)",
    hint: "Quantidade de dias considerada nos relatórios por padrão.",
  },
];

export function SettingsView() {
  const { notify } = useToast();
  const session = useSession();
  const { data, loading, error, reload } = useApiQuery<SettingsData>("/api/settings");

  const [company, setCompany] = useState<Record<string, string>>({});
  const [generic, setGeneric] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  async function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLogoError(null);
    try {
      const dataUrl = await fileToDataUrl(file, {
        maxDimension: 512,
        format: "image/png",
      });
      setCompany((c) => ({ ...c, logoUrl: dataUrl }));
    } catch (err) {
      setLogoError(
        err instanceof Error ? err.message : "Erro ao processar a imagem.",
      );
    }
  }

  function hydrate() {
    if (!data) return;
    const c: Record<string, string> = {};
    for (const [k, v] of Object.entries(data.company)) {
      c[k] = v === null || v === undefined ? "" : String(v);
    }
    setCompany(c);
    const g: Record<string, string> = {};
    for (const s of GENERIC_SETTINGS) {
      const v = data.settings[s.key];
      g[s.key] = v === undefined || v === null ? "" : String(v);
    }
    setGeneric(g);
  }

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      // Configuracoes genericas — uma requisicao por chave.
      for (const s of GENERIC_SETTINGS) {
        const value = generic[s.key]?.trim();
        await api.post("/api/settings", {
          key: s.key,
          value: value === "" ? null : value,
        });
      }
      // Empresa — ultima requisicao carrega companhia.
      await api.post("/api/settings", {
        key: "company.profile.updated_at",
        value: new Date().toISOString(),
        company: {
          name: company.name,
          legalName: company.legalName || null,
          document: company.document || null,
          email: company.email || null,
          phone: company.phone || null,
          address: company.address || null,
          currency: company.currency || "BRL",
          timezone: company.timezone || "America/Sao_Paulo",
          logoUrl: company.logoUrl || null,
        },
      });
      notify("Configurações salvas com sucesso.", "success");
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
        <Spinner /> Carregando…
      </div>
    );
  }
  if (error) {
    return <EmptyState title="Erro ao carregar" description={error} action={<button onClick={reload} className="text-primary">Tentar novamente</button>} />;
  }
  if (!data) return null;

  const hydrated = Object.keys(company).length > 0;
  if (!hydrated) {
    // Preenche o formulario na primeira renderizacao apos carregar.
    // (usamos setTimeout 0 para evitar setState durante render)
    setTimeout(hydrate, 0);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Dados da empresa e preferências gerais do sistema.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados da empresa</CardTitle>
          <CardDescription>
            Empresa ativa: {session.memberships.find((m) => m.companyId === session.companyId)?.companyName}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Logo da empresa"
              className="sm:col-span-2"
              hint="PNG ou JPEG, até ~1,5 MB. Aparece na barra lateral e no cabeçalho dos relatórios."
            >
              <div className="flex flex-wrap items-center gap-3">
                {company.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={company.logoUrl}
                    alt="Logo da empresa"
                    className="h-14 w-14 shrink-0 rounded-md border object-contain"
                  />
                ) : (
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-md border text-center text-[10px] text-muted-foreground">
                    Sem logo
                  </div>
                )}
                <label className="cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent">
                  Escolher imagem
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={onLogoChange}
                  />
                </label>
                {company.logoUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setCompany((c) => ({ ...c, logoUrl: "" }))}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
              {logoError ? (
                <p className="mt-2 text-xs text-red-600">{logoError}</p>
              ) : null}
            </Field>
            <Field label="Nome fantasia">
              <Input required value={company.name ?? ""} onChange={(e) => setCompany((c) => ({ ...c, name: e.target.value }))} />
            </Field>
            <Field label="Razão social">
              <Input value={company.legalName ?? ""} onChange={(e) => setCompany((c) => ({ ...c, legalName: e.target.value }))} />
            </Field>
            <Field label="CNPJ / CPF">
              <Input value={company.document ?? ""} onChange={(e) => setCompany((c) => ({ ...c, document: e.target.value }))} />
            </Field>
            <Field label="E-mail">
              <Input type="email" value={company.email ?? ""} onChange={(e) => setCompany((c) => ({ ...c, email: e.target.value }))} />
            </Field>
            <Field label="Telefone">
              <Input value={company.phone ?? ""} onChange={(e) => setCompany((c) => ({ ...c, phone: e.target.value }))} />
            </Field>
            <Field label="Endereço">
              <Input value={company.address ?? ""} onChange={(e) => setCompany((c) => ({ ...c, address: e.target.value }))} />
            </Field>
            <Field label="Moeda">
              <Select value={company.currency ?? "BRL"} onChange={(e) => setCompany((c) => ({ ...c, currency: e.target.value }))}>
                <option value="BRL">BRL — Real brasileiro</option>
                <option value="USD">USD — Dólar</option>
                <option value="EUR">EUR — Euro</option>
              </Select>
            </Field>
            <Field label="Fuso horário">
              <Select value={company.timezone ?? "America/Sao_Paulo"} onChange={(e) => setCompany((c) => ({ ...c, timezone: e.target.value }))}>
                {TIMEZONES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferências gerais</CardTitle>
          <CardDescription>Comportamento padrão de módulos do sistema.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {GENERIC_SETTINGS.map((s) => (
              <Field key={s.key} label={s.label} hint={s.hint}>
                <Input
                  value={generic[s.key] ?? ""}
                  onChange={(e) => setGeneric((g) => ({ ...g, [s.key]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {formError ? (
          <p className="mr-auto rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
        ) : null}
        <Button onClick={save} disabled={saving}>
          {saving ? <Spinner /> : null} Salvar configurações
        </Button>
      </div>
    </div>
  );
}