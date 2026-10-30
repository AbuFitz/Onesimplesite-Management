import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { env } from "./env";

/**
 * Secrets in the team vault are encrypted before they reach the database (AES-256-GCM).
 * The key is VAULT_KEY (base64, 32 bytes) when set, otherwise derived from BETTER_AUTH_SECRET.
 * Whoever can read the database alone sees only ciphertext.
 */
function key(): Buffer {
  const e = env();
  if (e.VAULT_KEY) {
    const k = Buffer.from(e.VAULT_KEY.trim(), "base64");
    if (k.length !== 32) throw new Error("VAULT_KEY must be 32 bytes, base64 encoded (openssl rand -base64 32).");
    return k;
  }
  return Buffer.from(hkdfSync("sha256", e.BETTER_AUTH_SECRET, "oss-vault-salt", "oss-vault-v1", 32));
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(stored: string): string {
  const [v, iv, tag, ct] = stored.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unreadable vault entry.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
}
