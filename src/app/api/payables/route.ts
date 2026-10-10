import { route } from "@/lib/http";
import {
  titleCreateHandler,
  titleListHandler,
} from "@/services/title-endpoints";

export const dynamic = "force-dynamic";

export const GET = route(titleListHandler("PAYABLE"));
export const POST = route(titleCreateHandler("PAYABLE"));
