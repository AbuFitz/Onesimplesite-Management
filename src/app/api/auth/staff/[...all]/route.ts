import { toNextJsHandler } from "better-auth/next-js";
import { staffAuth } from "@/lib/auth";
export const { GET, POST } = toNextJsHandler(staffAuth);
