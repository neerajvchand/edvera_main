/* ------------------------------------------------------------------ */
/* ServiceError — typed error wrapper for the service layer            */
/* ------------------------------------------------------------------ */

/**
 * All service functions throw `ServiceError` on failure.
 * Hooks catch it and surface `error.message` to the UI.
 *
 * Usage:
 *   throw new ServiceError("Failed to load students", originalError);
 */
export class ServiceError extends Error {
  /** The original Supabase / network / unknown error. */
  readonly cause: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.cause = cause;
  }
}

/**
 * Wrap a caught `unknown` in a `ServiceError`.
 * Use at the boundary of every service function:
 *
 * ```ts
 * try { ... }
 * catch (err) { throw handleServiceError("load students", err); }
 * ```
 */
export function handleServiceError(
  action: string,
  err: unknown
): ServiceError {
  if (err instanceof ServiceError) return err;

  // Supabase PostgrestError is a plain object with `.message` — not an Error instance.
  const detail =
    err instanceof Error
      ? err.message
      : typeof err === "object" &&
          err !== null &&
          "message" in err &&
          typeof (err as { message: unknown }).message === "string"
        ? (err as { message: string }).message
        : String(err ?? "Unknown error");

  return new ServiceError(`Failed to ${action}: ${detail}`, err);
}
