import "dotenv/config";
import { defineConfig } from "prisma/config";

const dbMode = process.env.DB_MODE || "LOCAL_MYSQL";
const isPostgres = dbMode === "CLOUD_POSTGRES";

const url = isPostgres ? process.env.POSTGRES_URL : process.env.MYSQL_URL;
if (!url) throw new Error(isPostgres ? "Missing POSTGRES_URL" : "Missing MYSQL_URL");

export default defineConfig({
  // paths are relative to THIS prisma.config.ts file (project root)
  schema: isPostgres
    ? "prisma/schema.postgres.prisma"
    : "prisma/schema.mysql.prisma",

  migrations: {
    path: isPostgres
      ? "prisma/migrations-postgres"
      : "prisma/migrations-mysql",
  },

  datasource: { url },
});