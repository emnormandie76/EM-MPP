import { createAuthClient } from "better-auth/react";

// Browser client (architecture §6.1): sign-in and sign-up go through HTTP, where the attempt
// limits apply. The admin actions are Server Actions, so the admin client plugin is not needed.
export const authClient = createAuthClient();
