/**
 * Postgres SQLSTATE error code helpers. `postgres-js` propagates the original
 * `code` field on thrown errors, so callers can branch on specific conditions
 * (unique violation, foreign key violation, …) without parsing message strings.
 *
 * Reference: https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const PG_UNIQUE_VIOLATION = "23505";

export function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: unknown }).code === PG_UNIQUE_VIOLATION
  );
}
