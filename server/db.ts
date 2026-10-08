/**
 * Couche d'acces a la base Neon (Postgres serverless).
 *
 * On utilise le Pool WebSocket de @neondatabase/serverless (et non la
 * fonction HTTP neon()), car le driver HTTP ne conserve pas de session
 * entre deux requetes : impossible d'y enchainer BEGIN / COMMIT.
 * Le Pool permet de vraies transactions atomiques, indispensables pour les
 * operations metier multi-tables (vente + stock, reception + dette).
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { config } from "./config";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: config.databaseUrl });

/** Executeur de requetes SQL : signature generique preservee. */
export type SqlRunner = <T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

/** Executeur renvoyant une ligne unique (ou null). */
export type SqlRunnerOne = <T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<T | null>;

/** Client SQL expose aux callbacks de transaction. */
export interface SqlClient {
  query: SqlRunner;
  queryOne: SqlRunnerOne;
}

/**
 * Execute une requete SQL parametree et renvoie les lignes.
 * Requetes parametrees uniquement : jamais d'interpolation de chaine,
 * pour eviter toute injection SQL.
 */
export const query: SqlRunner = async <T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> => {
  const result = await pool.query(text, params);
  return result.rows as T[];
};

/** Renvoie la premiere ligne, ou null si aucune. */
export const queryOne: SqlRunnerOne = async <T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> => {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
};

/**
 * Execute une serie d'operations dans une transaction atomique : soit tout
 * est valide (COMMIT), soit tout est annule (ROLLBACK).
 */
export const transaction = async <T>(
  fn: (tx: SqlClient) => Promise<T>,
): Promise<T> => {
  const client = await pool.connect();

  const txQuery: SqlRunner = async <R = Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
  ): Promise<R[]> => {
    const result = await client.query(text, params);
    return result.rows as R[];
  };

  const txQueryOne: SqlRunnerOne = async <R = Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
  ): Promise<R | null> => {
    const result = await client.query(text, params);
    return (result.rows[0] ?? null) as R | null;
  };

  try {
    await client.query("BEGIN");
    const result = await fn({ query: txQuery, queryOne: txQueryOne });
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export { pool };
