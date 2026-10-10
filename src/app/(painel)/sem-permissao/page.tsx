import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { buttonClasses, Card, CardContent, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SemPermissaoPage() {
  await requireAuth();
  return (
    <div className="mx-auto max-w-md space-y-4 py-16">
      <PageHeader
        title="Sem permissão"
        description="Sua função no sistema não permite acessar este recurso."
      />
      <Card>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Se você acredita que deveria ter acesso a esta funcionalidade,
            solicite ao administrador da empresa que ajuste a função (papel)
            vinculada à sua conta.
          </p>
        </CardContent>
      </Card>
      <div className="flex justify-center gap-3">
        <Link href="/dashboard" className={buttonClasses("primary", "md")}>
          Ir para o painel
        </Link>
        <Link href="/login" className={buttonClasses("outline", "md")}>
          Trocar de conta
        </Link>
      </div>
    </div>
  );
}