"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("A senha deve conter letras e números.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas informadas não coincidem.");
      return;
    }

    setLoading(true);
    try {
      await api.post("/api/auth/reset-password", {
        token,
        password,
        confirmPassword,
      });
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível redefinir a senha. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Link inválido</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Este link de recuperação está incompleto ou expirou. Solicite uma
            nova recuperação de senha.
          </p>
        </div>
        <Link
          href="/recuperar-senha"
          className={buttonClasses("primary", "md", "w-full")}
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Senha redefinida</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sua nova senha foi salva com sucesso. Você já pode acessar o
            sistema.
          </p>
        </div>
        <Link
          href="/login"
          className={buttonClasses("primary", "md", "w-full")}
        >
          Entrar no sistema
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">Criar nova senha</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Escolha uma senha forte com pelo menos 8 caracteres, contendo letras e
          números.
        </p>
      </div>

      <Field label="Nova senha">
        <Input
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </Field>

      <Field label="Confirmar nova senha">
        <Input
          type="password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="••••••••"
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
        disabled={loading || !password || !confirmPassword}
      >
        {loading ? <Spinner /> : null}
        Salvar nova senha
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/recuperar-senha" className="font-medium text-primary">
          Solicitar um novo link
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <div className="w-full max-w-md">
        <BrandAuthHeader
          title={BRAND.name}
          subtitle="Gestão financeira empresarial"
        />
        <Card>
          <CardContent className="p-6">
            <Suspense
              fallback={
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              }
            >
              <ResetPasswordForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
