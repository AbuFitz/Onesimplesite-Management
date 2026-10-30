import { toNextJsHandler } from "better-auth/next-js";
import { portalAuth } from "@/lib/auth";
export const GET = (r: Request) => toNextJsHandler(portalAuth()).GET(r);
export const POST = (r: Request) => toNextJsHandler(portalAuth()).POST(r);
