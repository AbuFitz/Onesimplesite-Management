import { toNextJsHandler } from "better-auth/next-js";
import { portalAuth } from "@/lib/auth";
export const { GET, POST } = toNextJsHandler(portalAuth);
