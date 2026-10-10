"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client";
import { useApiQuery } from "@/lib/hooks";
import { useToast } from "@/components/toast";
import { fileToDataUrl } from "@/lib/image";
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
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "@/components/ui";
import {
  formatPixKey,
  maskPhone,
  PIX_KEY_TYPE_LABELS,
} from "@/lib/format";

interface BillingSettings {
  pixKeyType: string | null;
  pixKey: string | null;
  pixHolder: string | null;
  bankName: string | null;
  paymentInstructions: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  defaultAmount: number | null;
  defaultDueDays: number | null;
  qrCodeUrl: string | null;
}

type FormState = Record<string, string>;

export function AdminSettingsView() {
  const { notify } = useToast();
  const { data, loading, error, reload } =
    useApiQuery<BillingSettings>("/api/admin/settings");

  const [form, setForm] = useState<FormState>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function hydrate(d: BillingSettings) {
    setForm({
      pixKeyType: d.pixKeyType ?? "",
      pixKey: d.pixKey ?? "",
      pixHolder: d.pixHolder ?? "",
      bankName: d.bankName ?? "",
      contactEmail: d.contactEmail ?? "",
      contactPhone: d.contactPhone ?? "",
      paymentInstructions: d.paymentInstructions ?? "",
      defaultAmount: d.defaultAmount != null ? String(d.defaultAmount) : "",
      defaultDueDays: d.defaultDueDays != null ? String(d.defaultDueDays) : "",
      qrCodeUrl: d.qrCodeUrl ?? "",
    });
  }

  async function onPickQr(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setFormError(null);
    try {
      const url = await fileToDataUrl(file, {
        maxDimension: 700,
        format: "image/png",
      });
      setForm((f) => ({ ...f, qrCodeUrl: url }));
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Falha ao processar a imagem.",
      );
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
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
    return (
      <EmptyState
        title="Erro ao carregar"
        description={error}
        action={
          <button onClick={reload} className="text-primary">
            Tentar novamente
          </button>
        }
      />
    );
  }
  if (!data) return null;

  if (Object.keys(form).length === 0) {
    setTimeout(() => hydrate(data), 0);
  }

  async function save() {
    setSaving(true);
    setFormError(null);
    try {
      await api.put("/api/admin/settings", {
        pixKeyType: form.pixKeyType || null,
        pixKey: form.pixKey || null,
        pixHolder: form.pixHolder || null,
        bankName: form.bankName || null,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        paymentInstructions: form.paymentInstructions || null,
        defaultAmount: form.defaultAmount ? Number(form.defaultAmount) : undefined,
        defaultDueDays: form.defaultDueDays
          ? Number(form.defaultDueDays)
          : undefined,
        qrCodeUrl: form.qrCodeUrl || null,
      });
      notify("Configurações salvas.", "success");
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Configurações da plataforma"
        description="Dados usados nas cobranças enviadas às empresas (chave Pix, contato e instruções)."
      />

      <Card>
        <CardHeader>
          <CardTitle>Pagamento via PIX</CardTitle>
          <CardDescription>
            A chave abaixo é usada como padrão ao emitir cobranças.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tipo de chave">
              <Select
                value={form.pixKeyType ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pixKeyType: e.target.value,
                    pixKey: formatPixKey(e.target.value, f.pixKey ?? ""),
                  }))
                }
              >
                <option value="">Selecione…</option>
                {Object.entries(PIX_KEY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Chave Pix"
              hint={
                form.pixKey
                  ? `Prévia: ${formatPixKey(form.pixKeyType, form.pixKey)}`
                  : "Formatada automaticamente conforme o tipo."
              }
            >
              <Input
                value={form.pixKey ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pixKey: formatPixKey(f.pixKeyType, e.target.value),
                  }))
                }
                placeholder="Informe a chave"
                autoComplete="off"
              />
            </Field>
            <Field label="Titular da conta">
              <Input
                value={form.pixHolder ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pixHolder: e.target.value }))
                }
                placeholder="Nome do favorecido"
              />
            </Field>
            <Field label="Banco">
              <Input
                value={form.bankName ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bankName: e.target.value }))
                }
                placeholder="Ex.: Nubank, Inter, Itaú…"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QR Code para pagamento</CardTitle>
          <CardDescription>
            Envie a imagem (foto/print) do QR Code Pix. Ele aparece para a
            empresa em “Minhas cobranças” para ser lido pelo aplicativo do banco.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-40 w-40 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
              {form.qrCodeUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={form.qrCodeUrl}
                  alt="QR Code de pagamento"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="px-3 text-center text-xs text-muted-foreground">
                  Nenhum QR Code enviado
                </span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void onPickQr(e.target.files?.[0])}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? <Spinner /> : null}
                  {form.qrCodeUrl ? "Trocar imagem" : "Enviar imagem"}
                </Button>
                {form.qrCodeUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() =>
                      setForm((f) => ({ ...f, qrCodeUrl: "" }))
                    }
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Use uma imagem nítida (PNG ou JPEG). A imagem é redimensionada
                automaticamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contato e padrões</CardTitle>
          <CardDescription>
            Como as empresas falam com o suporte e os valores sugeridos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="E-mail de contato">
              <Input
                type="email"
                value={form.contactEmail ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, contactEmail: e.target.value }))
                }
                placeholder="financeiro@suaempresa.com"
              />
            </Field>
            <Field label="Telefone / WhatsApp">
              <Input
                value={form.contactPhone ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    contactPhone: maskPhone(e.target.value),
                  }))
                }
                inputMode="numeric"
                placeholder="(00) 00000-0000"
              />
            </Field>
            <Field label="Valor padrão da cobrança (R$)">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.defaultAmount ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, defaultAmount: e.target.value }))
                }
                placeholder="0,00"
              />
            </Field>
            <Field label="Prazo padrão de vencimento (dias)">
              <Input
                type="number"
                min="0"
                value={form.defaultDueDays ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, defaultDueDays: e.target.value }))
                }
                placeholder="Ex.: 5"
              />
            </Field>
            <Field
              label="Instruções de pagamento"
              className="sm:col-span-2"
              hint="Texto incluído no fim de cada cobrança."
            >
              <Textarea
                value={form.paymentInstructions ?? ""}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    paymentInstructions: e.target.value,
                  }))
                }
                placeholder="Ex.: Após o pagamento, envie o comprovante para liberarmos o acesso."
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {formError ? (
          <p className="mr-auto rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}
        <Button onClick={save} disabled={saving}>
          {saving ? <Spinner /> : null} Salvar configurações
        </Button>
      </div>
    </div>
  );
}
