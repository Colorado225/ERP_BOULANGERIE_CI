/**
 * Migration : applique le schéma SQL à la base Neon.
 *
 * Usage : npm run db:migrate
 * Nécessite DATABASE_URL dans .env
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./db";

const here = dirname(fileURLToPath(import.meta.url));

const run = async () => {
  const schemaPath = join(here, "schema.sql");
  const sqlText = readFileSync(schemaPath, "utf-8");

  console.log("[db] Application du schéma…");
  await pool.query(sqlText);
  console.log(
    "[db] ✅ Schéma appliqué avec succès (tables, contraintes et index).",
  );
  await pool.end();
};

run().catch((err) => {
  console.error("[db] ❌ Échec de la migration :", err);
  process.exit(1);
});
