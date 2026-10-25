import type { NextRequest } from "next/server";
import { z } from "zod";
import { jsonOk, route } from "@/lib/http";
import { clientMeta } from "@/lib/api";
import { requestPasswordReset } from "@/services/password-reset";

export const dynamic = "force-dynamic";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Informe um e-mail valido."),
});

/** Solicita o link de recuperacao de senha (resposta sempre generica). */
export const POST = route(async (req: NextRequest) => {
  const { email } = forgotPasswordSchema.parse(await req.json());
  const result = await requestPasswordReset(email, clientMeta(req).ip);

  if (!result.ok) {
    return jsonOk({ message: result.error, devUrl: null });
  }

  return jsonOk({ message: result.message, devUrl: result.devUrl });
});
