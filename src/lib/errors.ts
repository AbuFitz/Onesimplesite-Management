export type ErrorCode = "forbidden" | "validation" | "stale_version" | "expired_link" | "not_found" | "conflict" | "unavailable";

export class DomainError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
  }
}
export const forbidden = (m = "You do not have access to this.") => new DomainError("forbidden", m);
export const notFound = (m = "Not found.") => new DomainError("not_found", m);
export const stale = () => new DomainError("stale_version", "This record changed since you opened it. Reload and try again.");
