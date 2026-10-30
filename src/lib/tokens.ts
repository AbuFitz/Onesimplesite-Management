import { createHash, randomBytes } from "node:crypto";

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
/** 256-bit URL-safe token; only the hash is persisted. */
export const newToken = () => {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: sha256(token) };
};
