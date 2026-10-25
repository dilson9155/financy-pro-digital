"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardContent,
  Field,
  Input,
  Spinner,
  buttonClasses,
} from "@/components/ui";
import { BrandAuthHeader } from "@/components/brand";
import { BRAND } from "@/lib/branding";
import { api } from "@/lib/client";

interface ForgotResponse {
  message: string;
  devUrl: string | null;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ForgotResponse | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await api.post<ForgotResponse>("/api/auth/forgot-password", {
        email,
      });
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Nao foi possivel solicitar a recuperacao.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-md">
        <BrandAuthHeader
          title={BRAND.name}
          subtitle="Gestão financeira empresarial"
        />
        <Card>
          <CardContent className="p-6">
            {result ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Verifique seu e-mail</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {result.message}
                  </p>
                </div>

                {result.devUrl ? (
                  <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="font-medium">Ambiente local: link de teste</p>
                    <p className="text-xs">
                      O envio de e-mail não está configurado. Use o link abaixo
                      para redefinir a senha.
                    </p>
                    <Link
                      href={result.devUrl}
                      className="block break-all font-medium underline"
                    >
                      {result.devUrl}
                    </Link>
                  </div>
                ) : null}

                <p className="text-sm text-muted-foreground">
                  O link expira em 30 minutos e só pode ser usado uma vez.
                </p>

                <Link
                  href="/login"
                  className={buttonClasses("primary", "md", "w-full")}
                >
                  Voltar para o login
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <h2 className="text-base font-semibold">Recuperar senha</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Informe o e-mail da sua conta. Enviaremos um link para criar
                    uma nova senha.
                  </p>
                </div>

                <Field label="E-mail">
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="voce@empresa.com.br"
                  />
                </Field>

                {error ? (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !email}
                >
                  {loading ? <Spinner /> : null}
                  Enviar link de recuperação
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  <Link href="/login" className="font-medium text-primary">
                    Voltar para o login
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
