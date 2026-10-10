import type { NextRequest } from "next/server";
import { route } from "@/lib/http";
import { titleSettleHandler } from "@/services/title-endpoints";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (req: NextRequest, ctx: Ctx) =>
  titleSettleHandler("RECEIVABLE")(req, (await ctx.params).id),
);
