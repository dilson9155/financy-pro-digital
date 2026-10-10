import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctx.companyId) redirect("/selecionar-empresa");
  redirect("/dashboard");
}
