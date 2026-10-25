import type { NextRequest } from "next/server";
import { z } from "zod";
import { badRequest, jsonOk, route } from "@/lib/http";
import { resetPasswordWithToken } from "@/services/password-reset";

export const dynamic = "force-dynamic";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Link invalido."),
  password: z.string().min(1, "Informe a nova senha."),
  confirmPassword: z.string().min(1, "Confirme a nova senha."),
});

/** Redefine a senha a partir do token enviado por e-mail. */
export const POST = route(async (req: NextRequest) => {
  const body = resetPasswordSchema.parse(await req.json());
  const result = await resetPasswordWithToken(
    body.token,
    body.password,
    body.confirmPassword,
  );

  if (!result.ok) throw badRequest(result.error);

  return jsonOk({ reset: true });
});
