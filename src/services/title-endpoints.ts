import type { NextRequest } from "next/server";
import { jsonOk } from "@/lib/http";
import { requireApiAuth, searchParams } from "@/lib/api";
import { PERMISSIONS } from "@/lib/permissions";
import {
  cancelTitleSchema,
  createTitleSchema,
  settleSchema,
  updateTitleSchema,
} from "@/lib/validation";
import {
  cancelTitle,
  createTitle,
  deleteTitle,
  getTitle,
  listTitles,
  updateTitle,
} from "./titles";
import { settle } from "./settlements";

export type TitleDirection = "PAYABLE" | "RECEIVABLE";

const PERMS = {
  PAYABLE: {
    view: PERMISSIONS.PAYABLES_VIEW,
    create: PERMISSIONS.PAYABLES_CREATE,
    update: PERMISSIONS.PAYABLES_UPDATE,
    del: PERMISSIONS.PAYABLES_DELETE,
    settle: PERMISSIONS.PAYABLES_SETTLE,
  },
  RECEIVABLE: {
    view: PERMISSIONS.RECEIVABLES_VIEW,
    create: PERMISSIONS.RECEIVABLES_CREATE,
    update: PERMISSIONS.RECEIVABLES_UPDATE,
    del: PERMISSIONS.RECEIVABLES_DELETE,
    settle: PERMISSIONS.RECEIVABLES_SETTLE,
  },
} as const;

/** Handlers compartilhados entre contas a pagar e a receber. */

export function titleListHandler(direction: TitleDirection) {
  return async (req: NextRequest) => {
    const ctx = await requireApiAuth(PERMS[direction].view);
    const data = await listTitles(ctx.companyId, searchParams(req), {
      direction,
    });
    return jsonOk(data);
  };
}

export function titleCreateHandler(direction: TitleDirection) {
  return async (req: NextRequest) => {
    const ctx = await requireApiAuth(PERMS[direction].create);
    const body = createTitleSchema.parse(await req.json());
    const title = await createTitle(ctx.companyId, ctx.user.id, {
      ...body,
      direction,
    });
    return jsonOk(title, 201);
  };
}

export function titleGetHandler(direction: TitleDirection) {
  return async (req: NextRequest, id: string) => {
    const ctx = await requireApiAuth(PERMS[direction].view);
    const title = await getTitle(ctx.companyId, id);
    return jsonOk(title);
  };
}

export function titleUpdateHandler(direction: TitleDirection) {
  return async (req: NextRequest, id: string) => {
    const ctx = await requireApiAuth(PERMS[direction].update);
    const body = updateTitleSchema.parse(await req.json());
    const title = await updateTitle(ctx.companyId, ctx.user.id, id, body);
    return jsonOk(title);
  };
}

export function titleDeleteHandler(direction: TitleDirection) {
  return async (_req: NextRequest, id: string) => {
    const ctx = await requireApiAuth(PERMS[direction].del);
    await deleteTitle(ctx.companyId, ctx.user.id, id);
    return jsonOk({ deleted: true });
  };
}

export function titleSettleHandler(direction: TitleDirection) {
  return async (req: NextRequest, id: string) => {
    const ctx = await requireApiAuth(PERMS[direction].settle);
    const body = settleSchema.parse(await req.json());
    const title = await getTitle(ctx.companyId, id);
    if (title.direction !== direction) {
      // Garante que a baixa ocorre pelo modulo correto.
      throw new Error("Direcao do titulo incompativel com o endpoint.");
    }
    const settlement = await settle(ctx.companyId, ctx.user.id, body);
    return jsonOk(settlement, 201);
  };
}

export function titleCancelHandler(direction: TitleDirection) {
  return async (req: NextRequest, id: string) => {
    const ctx = await requireApiAuth(PERMS[direction].update);
    const body = cancelTitleSchema.parse(await req.json());
    const title = await cancelTitle(ctx.companyId, ctx.user.id, id, body.reason);
    return jsonOk(title);
  };
}
