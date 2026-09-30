// Database errors the services turn into a refusal instead of a crash.

/** PostgreSQL unique violation (23505), whether the driver error is wrapped by Drizzle or not. */
export function isUniqueViolation(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 5; depth += 1) {
    if (typeof current === "object" && (current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
