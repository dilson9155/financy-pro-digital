import type { NextRequest } from "next/server";
import { route } from "@/lib/http";
import { requireApiAuth } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import { openBackupFile } from "@/services/backup";

export const dynamic = "force-dynamic";
// O download le do bucket: garante runtime Node (SDK da AWS).
export const runtime = "nodejs";

/** Baixa o JSON de um backup concluido (bucket S3 ou disco local). */
export const GET = route(
  async (_req: NextRequest, context: { params: Promise<{ id: string }> }) => {
    const ctx = await requireApiAuth(PERMISSIONS.BACKUPS_VIEW);
    const { id } = await context.params;

    const file = await openBackupFile(ctx.companyId, id);
    const body =
      file.body instanceof Buffer
        ? new Uint8Array(file.body)
        : (file.body as ReadableStream);

    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file.fileName}"`,
      "Cache-Control": "no-store",
    });
    if (file.sizeBytes) {
      headers.set("Content-Length", String(file.sizeBytes));
    }

    return new Response(body, { status: 200, headers });
  },
);
