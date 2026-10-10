import type { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * Endpoint TEMPORARIO de diagnostico.
 * Uso: /api/diag?key=financy-diag-2026
 * Nao expoe segredos (senha). Remover depois do diagnostico.
 */
const KEY = "financy-diag-2026";

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("key") !== KEY) {
    return Response.json({ ok: false }, { status: 404 });
  }

  const dbUrl = process.env.DATABASE_URL ?? "";
  const directUrl = process.env.DIRECT_URL ?? "";

  const hostOf = (u: string) => {
    try {
      return new URL(u).host;
    } catch {
      return "URL_INVALIDA";
    }
  };

  const info: Record<string, unknown> = {
    node: process.version,
    nodeEnv: process.env.NODE_ENV,
    cwd: process.cwd(),
    hasDatabaseUrl: dbUrl.length > 0,
    hasDirectUrl: directUrl.length > 0,
    hasAuthSecret: Boolean(process.env.AUTH_SECRET),
    appUrl: process.env.APP_URL,
    dbHost: hostOf(dbUrl),
    dbIsPooler: dbUrl.includes("-pooler"),
    dbHasChannelBinding: dbUrl.includes("channel_binding"),
    dbUrlLength: dbUrl.length,
  };

  const prisma = new PrismaClient({ log: ["error"] });
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ now: Date }>>(
      "SELECT now() as now",
    );
    info.dbConnect = "OK";
    info.dbNow = String(rows?.[0]?.now ?? "");
    info.userCount = await prisma.user.count();
  } catch (e) {
    info.dbConnect = "ERROR";
    info.dbErrorName = (e as Error)?.name;
    info.dbErrorMessage = String((e as Error)?.message ?? e);
    const code = (e as { code?: string })?.code;
    if (code) info.dbErrorCode = code;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  return Response.json(info);
}
