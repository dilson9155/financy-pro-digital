"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, Field, Input, Spinner } from "@/components/ui";
import { api } from "@/lib/client";

interface Company {
  companyId: string;
  name: string;
  role: string;
}

export function CompanyPicker({
  companies,
  activeCompanyId,
  userName,
}: {
  companies: Company[];
  activeCompanyId: string | null;
  userName: string;
}) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDoc, setNewDoc] = useState("");

  async function select(companyId: string) {
    setLoadingId(companyId);
    try {
      await api.post("/api/companies/active", { companyId });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao selecionar.");
      setLoadingId(null);
    }
  }

  async function createCompany(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const company = await api.post<{ id: string }>("/api/companies", {
        name: newName,
        document: newDoc || null,
      });
      await select(company.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar empresa.");
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-xl space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold">Olá, {userName}</h1>
          <p className="text-sm text-muted-foreground">
            Selecione a empresa para continuar
          </p>
        </div>

        <Card>
          <CardContent className="space-y-2 p-4">
            {companies.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Você ainda não possui empresas.
              </p>
            ) : (
              companies.map((c) => (
                <button
                  key={c.companyId}
                  type="button"
                  onClick={() => select(c.companyId)}
                  disabled={loadingId !== null}
                  className="flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-colors hover:bg-accent disabled:opacity-60"
                >
                  <span>
                    <span className="block text-sm font-medium">{c.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.role}
                    </span>
                  </span>
                  {loadingId === c.companyId ? (
                    <Spinner />
                  ) : c.companyId === activeCompanyId ? (
                    <span className="text-xs font-medium text-primary">
                      Ativa
                    </span>
                  ) : null}
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {creating ? (
          <Card>
            <CardContent className="p-4">
              <form onSubmit={createCompany} className="space-y-3">
                <Field label="Nome da nova empresa">
                  <Input
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </Field>
                <Field label="CNPJ / CPF (opcional)">
                  <Input
                    value={newDoc}
                    onChange={(e) => setNewDoc(e.target.value)}
                  />
                </Field>
                <Button type="submit" className="w-full">
                  Criar e acessar
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={() => setCreating(true)}>
              Criar nova empresa
            </Button>
            <Button
              variant="ghost"
              onClick={async () => {
                await api.post("/api/auth/logout");
                window.location.href = "/login";
              }}
            >
              Sair
            </Button>
          </div>
        )}

        {error ? (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
