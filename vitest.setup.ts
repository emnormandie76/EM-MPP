// Same time zone as Vercel: no result may depend on the machine's time zone.
process.env.TZ = "UTC";
// Tests never reach a real database: any getDb() opens an in-memory PGlite.
process.env.DB_DRIVER = "pglite";
process.env.PGLITE_DIR = "";
