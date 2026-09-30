// Entry point of the Better Auth CLI only, which generates src/lib/db/schema/auth.ts (see README).
// The application uses getAuth(), which does not create the instance at import.
import { getAuth } from "./auth";

export const auth = getAuth();
