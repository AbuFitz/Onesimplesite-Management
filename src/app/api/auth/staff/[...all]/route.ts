import { toNextJsHandler } from "better-auth/next-js";
import { staffAuth } from "@/lib/auth";
export const GET = (r: Request) => toNextJsHandler(staffAuth()).GET(r);
export const POST = (r: Request) => toNextJsHandler(staffAuth()).POST(r);
