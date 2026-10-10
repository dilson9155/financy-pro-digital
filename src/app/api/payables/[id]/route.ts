import type { NextRequest } from "next/server";
import { route } from "@/lib/http";
import {
  titleDeleteHandler,
  titleGetHandler,
  titleUpdateHandler,
} from "@/services/title-endpoints";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (req: NextRequest, ctx: Ctx) =>
  titleGetHandler("PAYABLE")(req, (await ctx.params).id),
);

export const PATCH = route(async (req: NextRequest, ctx: Ctx) =>
  titleUpdateHandler("PAYABLE")(req, (await ctx.params).id),
);

export const DELETE = route(async (req: NextRequest, ctx: Ctx) =>
  titleDeleteHandler("PAYABLE")(req, (await ctx.params).id),
);
