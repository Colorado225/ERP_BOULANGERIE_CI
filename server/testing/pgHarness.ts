/**
 * Harnais de test : PostgreSQL réel éphémère (embedded-postgres), schéma
 * appliqué depuis server/schema.sql. Sert à tester le SQL des services sans
 * dépendre de Neon. Dev/test uniquement.
 */
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import type { SqlClient } from "../db";
import type { SalesDb } from "../services/salesService";

const here = dirname(fileURLToPath(import.meta.url));

export interface TestDb extends SalesDb {
  pool: pg.Pool;
  stop: () => Promise<void>;
}

export const startTestDb = async (): Promise<TestDb> => {
  const port = 40000 + Math.floor(Math.random() * 15000);
  const pgd = new EmbeddedPostgres({
    databaseDir: mkdtempSync(join(tmpdir(), "erp-pg-")),
    user: "postgres",
    password: "postgres",
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  });
  await pgd.initialise();
  await pgd.start();
  await pgd.createDatabase("erp_test");

  const pool = new pg.Pool({
    connectionString: `postgres://postgres:postgres@localhost:${port}/erp_test`,
    max: 10,
  });
  await pool.query(readFileSync(join(here, "..", "schema.sql"), "utf-8"));

  const runner = (client: { query: pg.Pool["query"] }) => ({
    query: async <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
      (await client.query(text, params)).rows as T[],
    queryOne: async <T = Record<string, unknown>>(text: string, params: unknown[] = []) =>
      ((await client.query(text, params)).rows[0] ?? null) as T | null,
  });

  const db: TestDb = {
    pool,
    ...runner(pool),
    transaction: async <T>(fn: (tx: SqlClient) => Promise<T>): Promise<T> => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await fn(runner(client));
        await client.query("COMMIT");
        return result;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
    stop: async () => {
      await pool.end();
      await pgd.stop();
    },
  };
  return db;
};

/** Jeu de données minimal : deux boutiques, des produits, un client. */
export const seedSalesFixtures = async (db: TestDb): Promise<void> => {
  await db.query(
    `INSERT INTO stores (id, name, location, phone, manager_name) VALUES
       ('store-1','Boutique 1','Abidjan','0700000000','Gérant 1'),
       ('store-2','Boutique 2','Bouaké','0700000001','Gérant 2')`,
  );
  await db.query(
    `INSERT INTO products (id, sku, name, category, price, vat_rate, stock, store_id, is_active) VALUES
       ('prod-pain','P1','Pain','pains',300,0,1000,'store-1',true),
       ('prod-pat','P2','Pâtisserie','patisseries',1200,18,1000,'store-1',true),
       ('prod-off','P3','Hors ligne','patisseries',500,18,1000,'store-1',false),
       ('prod-b2','P4','Autre boutique','patisseries',700,18,1000,'store-2',true)`,
  );
  await db.query(
    `INSERT INTO customers (id, name, type) VALUES ('cust-1','Hôtel Test','b2b')`,
  );
};
