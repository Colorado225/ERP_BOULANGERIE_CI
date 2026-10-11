/**
 * Tests d'intégration de la liaison manuelle fiche ↔ compte Neon (lot 1, secours).
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { linkUserToAuthAccount } from "./services/userLinkService";
import { startTestDb, type TestDb } from "./testing/pgHarness";

let db: TestDb;

before(async () => {
  db = await startTestDb();
  await db.query(
    `INSERT INTO stores (id, name, location, phone, manager_name)
     VALUES ('store-1','B1','Abidjan','0700000000','G')`,
  );
}, { timeout: 180_000 });

after(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.query(`DELETE FROM users`);
  await db.query(
    `INSERT INTO users (id, name, email, role, store_id, auth_user_id) VALUES
       ('u-free','Libre','libre@x.ci','caissier','store-1',NULL),
       ('u-bound','Liée','liee@x.ci','caissier','store-1','sub-existing')`,
  );
});

const authOf = async (id: string) =>
  (await db.queryOne<{ auth_user_id: string | null }>(`SELECT auth_user_id FROM users WHERE id=$1`, [id]))!
    .auth_user_id;

describe("linkUserToAuthAccount", () => {
  it("lie une fiche non liée", async () => {
    const r = await linkUserToAuthAccount(db, "u-free", "  sub-new-1  ");
    assert.deepEqual(r, { ok: true });
    assert.equal(await authOf("u-free"), "sub-new-1");
  });

  it("ne remplace jamais une liaison existante (409)", async () => {
    const r = await linkUserToAuthAccount(db, "u-bound", "sub-other");
    assert.equal(r.ok, false);
    assert.equal(r.ok === false && r.status, 409);
    assert.equal(await authOf("u-bound"), "sub-existing");
  });

  it("refuse un sub déjà utilisé par une autre fiche (409)", async () => {
    const r = await linkUserToAuthAccount(db, "u-free", "sub-existing");
    assert.equal(r.ok === false && r.status, 409);
    assert.equal(await authOf("u-free"), null);
  });

  it("404 pour un utilisateur inconnu", async () => {
    const r = await linkUserToAuthAccount(db, "u-nope", "sub-x");
    assert.equal(r.ok === false && r.status, 404);
  });

  it("400 pour un identifiant vide, absent ou non textuel", async () => {
    for (const bad of ["", "   ", undefined, 42, "x".repeat(129)]) {
      const r = await linkUserToAuthAccount(db, "u-free", bad);
      assert.equal(r.ok === false && r.status, 400, `attendu 400 pour ${JSON.stringify(bad)}`);
    }
    assert.equal(await authOf("u-free"), null);
  });
});
