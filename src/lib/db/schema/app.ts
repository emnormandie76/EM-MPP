import { pgTable, text } from "drizzle-orm/pg-core";

/**
 * Technical key-value store (architecture §4.3). Only key: `environment`, set to
 * `production` on the production database by scripts/migrate.ts, which forbids seeding it.
 */
export const appMeta = pgTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value"),
});
