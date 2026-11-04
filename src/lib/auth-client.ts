import { createAuthClient } from "better-auth/client";
import { twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

/** Browser-side sign-in helper for passkeys. `staff` = the team app, `portal` = the customer portal. */
export const authClient = (ns: "staff" | "portal") => createAuthClient({ basePath: `/api/auth/${ns}`, plugins: [passkeyClient(), twoFactorClient()] });
