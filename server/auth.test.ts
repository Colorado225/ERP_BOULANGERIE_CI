/**
 * Tests du contrôle d'accès (lot 1).
 *
 * Exécution : npm test
 *
 * Les jetons sont signés avec une clé Ed25519 générée localement : la vérification
 * de signature, de l'issuer et de l'algorithme est donc réelle. Aucun appel réseau.
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet, type JWK } from "jose";
import {
  createRequireAuth,
  createTokenVerifier,
  requireRole,
  resolveStoreId,
  type AuthedRequest,
  type AuthUser,
  type UserRow,
  type UserStore,
} from "./auth";
import { catalogRouter } from "./routes/catalog.routes";
import { operationsRouter } from "./routes/operations.routes";
import type { NextFunction, Response } from "express";

const ISSUER = "https://ep-test.neon.tech";

/* ---------------------------- Fixtures ----------------------------------- */

async function makeKeys() {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  const publicJwk: JWK = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "EdDSA", use: "sig" };
  const jwks = createLocalJWKSet({ keys: [publicJwk] });
  return { privateKey, jwks };
}

async function signToken(
  privateKey: Awaited<ReturnType<typeof generateKeyPair>>["privateKey"],
  claims: Record<string, unknown> = {},
  options: { issuer?: string; subject?: string; expiresIn?: string | number } = {},
): Promise<string> {
  const builder = new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "EdDSA", kid: "test-key" })
    .setIssuer(options.issuer ?? ISSUER)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? "5m");
  if (options.subject !== "") builder.setSubject(options.subject ?? "auth-user-1");
  return builder.sign(privateKey);
}

const userRow = (overrides: Partial<UserRow> = {}): UserRow => ({
  id: "usr-caissier",
  name: "Aïcha Diallo",
  email: "caissier@boulangeriepro.ci",
  role: "caissier",
  store_id: "store-1",
  is_active: true,
  ...overrides,
});

interface Recorder {
  bound: Array<{ authUserId: string; email: string }>;
}

/** Magasin d'utilisateurs en mémoire, avec traçage des liaisons. */
function fakeStore(rows: UserRow[], linked: Record<string, UserRow> = {}): UserStore & Recorder {
  const bound: Recorder["bound"] = [];
  return {
    bound,
    async findByAuthId(authUserId) {
      return linked[authUserId] ?? null;
    },
    async bindByEmail(authUserId, email) {
      bound.push({ authUserId, email });
      const row = rows.find((r) => r.email.toLowerCase() === email.toLowerCase());
      return row ?? null;
    },
  };
}

/** Exécute le middleware requireAuth sur une fausse requête et renvoie le résultat. */
async function runAuth(
  middleware: ReturnType<typeof createRequireAuth>,
  authorization?: string,
) {
  const req = { headers: authorization ? { authorization } : {} } as AuthedRequest;
  let status = 200;
  let body: unknown = undefined;
  let nextCalled = false;
  const res = {
    status(code: number) {
      status = code;
      return this;
    },
    json(payload: unknown) {
      body = payload;
      return this;
    },
  } as unknown as Response;
  await middleware(req, res, ((err?: unknown) => {
    if (err) throw err;
    nextCalled = true;
  }) as NextFunction);
  return { req, status, body, nextCalled };
}

/* ------------------------ Vérification des jetons ------------------------ */

describe("vérification des jetons Neon (EdDSA, issuer, sub)", () => {
  test("accepte un jeton EdDSA signé par la clé publique et d'émetteur attendu", async () => {
    const { privateKey, jwks } = await makeKeys();
    const verify = createTokenVerifier(jwks, ISSUER);
    const token = await signToken(privateKey, { email: "a@b.ci", email_verified: true });

    const verified = await verify(token);

    assert.equal(verified.sub, "auth-user-1");
    assert.equal(verified.email, "a@b.ci");
    assert.equal(verified.emailVerified, true);
  });

  test("rejette un émetteur inattendu", async () => {
    const { privateKey, jwks } = await makeKeys();
    const verify = createTokenVerifier(jwks, ISSUER);
    const token = await signToken(privateKey, {}, { issuer: "https://autre.exemple" });
    await assert.rejects(verify(token));
  });

  test("rejette un jeton HS256 forgé (aucune clé symétrique ne correspond au JWKS)", async () => {
    const { jwks } = await makeKeys();
    const verify = createTokenVerifier(jwks, ISSUER);
    const secret = new TextEncoder().encode("un-secret-quelconque-de-quarante-caracteres!");
    const forged = await new SignJWT({ role: "gerant" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(ISSUER)
      .setSubject("auth-user-1")
      .setExpirationTime("5m")
      .sign(secret);
    await assert.rejects(verify(forged));
  });

  test("rejette un jeton expiré", async () => {
    const { privateKey, jwks } = await makeKeys();
    const verify = createTokenVerifier(jwks, ISSUER);
    const token = await signToken(privateKey, {}, { expiresIn: Math.floor(Date.now() / 1000) - 60 });
    await assert.rejects(verify(token));
  });

  test("rejette un jeton sans identifiant sub", async () => {
    const { privateKey, jwks } = await makeKeys();
    const verify = createTokenVerifier(jwks, ISSUER);
    const token = await signToken(privateKey, {}, { subject: "" });
    await assert.rejects(verify(token));
  });
});

/* ------------------------------ requireAuth ------------------------------ */

describe("requireAuth", () => {
  test("sans en-tête Authorization : 401", async () => {
    const mw = createRequireAuth({
      verify: async () => { throw new Error("ne doit pas être appelé"); },
      users: fakeStore([]),
    });
    const out = await runAuth(mw);
    assert.equal(out.status, 401);
    assert.equal(out.nextCalled, false);
  });

  test("jeton invalide : 401", async () => {
    const mw = createRequireAuth({
      verify: async () => { throw new Error("signature invalide"); },
      users: fakeStore([]),
    });
    const out = await runAuth(mw, "Bearer n-importe-quoi");
    assert.equal(out.status, 401);
  });

  test("jeton valide sans compte rattaché et e-mail non vérifié : 403, aucune liaison", async () => {
    const users = fakeStore([userRow()]);
    const mw = createRequireAuth({
      verify: async () => ({ sub: "auth-x", email: "caissier@boulangeriepro.ci", emailVerified: false }),
      users,
    });
    const out = await runAuth(mw, "Bearer ok");
    assert.equal(out.status, 403);
    assert.equal(users.bound.length, 0, "aucune liaison sans e-mail vérifié");
  });

  test("première connexion avec e-mail vérifié : liaison puis accès", async () => {
    const users = fakeStore([userRow()]);
    const mw = createRequireAuth({
      verify: async () => ({ sub: "auth-new", email: "caissier@boulangeriepro.ci", emailVerified: true }),
      users,
    });
    const out = await runAuth(mw, "Bearer ok");
    assert.equal(out.nextCalled, true);
    assert.deepEqual(users.bound, [{ authUserId: "auth-new", email: "caissier@boulangeriepro.ci" }]);
    assert.equal((out.req.user as AuthUser).userId, "usr-caissier");
  });

  test("le rôle vient de la base, pas du jeton", async () => {
    const users = fakeStore([], { "auth-1": userRow({ role: "caissier" }) });
    const mw = createRequireAuth({
      // Le jeton prétend être gérant : il ne doit pas être cru.
      verify: async () => ({ sub: "auth-1", emailVerified: false, email: undefined }),
      users,
    });
    const out = await runAuth(mw, "Bearer ok");
    assert.equal(out.nextCalled, true);
    assert.equal((out.req.user as AuthUser).role, "caissier");
  });

  test("compte désactivé : 403", async () => {
    const users = fakeStore([], { "auth-1": userRow({ is_active: false }) });
    const mw = createRequireAuth({
      verify: async () => ({ sub: "auth-1", emailVerified: false }),
      users,
    });
    const out = await runAuth(mw, "Bearer ok");
    assert.equal(out.status, 403);
    assert.equal(out.nextCalled, false);
  });
});

/* ------------------------- Autorisation par rôle ------------------------- */

describe("requireRole", () => {
  const runRole = (allowed: Parameters<typeof requireRole>, role: AuthUser["role"]) => {
    const req = { user: { userId: "u", authUserId: "a", name: "n", email: "e", role, storeId: "s" } } as AuthedRequest;
    let status = 200;
    let nextCalled = false;
    const res = { status(c: number) { status = c; return this; }, json() { return this; } } as unknown as Response;
    requireRole(...allowed)(req, res, (() => { nextCalled = true; }) as NextFunction);
    return { status, nextCalled };
  };

  test("refuse un rôle absent de la liste", () => {
    const out = runRole(["gerant"], "caissier");
    assert.equal(out.status, 403);
  });

  test("accepte un rôle présent dans la liste", () => {
    const out = runRole(["gerant", "caissier"], "caissier");
    assert.equal(out.nextCalled, true);
  });

  test("un caissier ne passe pas un contrôle « magasinier » (pas de hiérarchie)", () => {
    const out = runRole(["magasinier"], "caissier");
    assert.equal(out.status, 403);
  });
});

/* ------------------------- Boutique de la session ------------------------ */

describe("resolveStoreId", () => {
  const base = { userId: "u", authUserId: "a", name: "n", email: "e" };

  test("un non-gérant reste sur sa boutique, même si le corps en demande une autre", () => {
    const user: AuthUser = { ...base, role: "caissier", storeId: "store-1" };
    assert.equal(resolveStoreId(user, "store-2"), "store-1");
  });

  test("un gérant peut cibler une autre boutique explicitement", () => {
    const user: AuthUser = { ...base, role: "gerant", storeId: "store-1" };
    assert.equal(resolveStoreId(user, "store-2"), "store-2");
  });

  test("sans boutique demandée, on utilise la boutique de la session", () => {
    const user: AuthUser = { ...base, role: "gerant", storeId: "store-1" };
    assert.equal(resolveStoreId(user, undefined), "store-1");
  });
});

/* ----------------------- Routes protégées (HTTP) ------------------------- */

describe("routes protégées sans session", () => {
  const app = express();
  app.use(express.json());
  app.use("/api/catalog", catalogRouter);
  app.use("/api/operations", operationsRouter);

  let server: ReturnType<typeof app.listen>;
  let base = "";

  before(async () => {
    await new Promise<void>((resolve) => {
      server = app.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    base = `http://127.0.0.1:${typeof address === "object" && address ? address.port : 0}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  const cases: Array<[string, string, string | undefined]> = [
    ["GET", "/api/catalog/products", undefined],
    ["GET", "/api/catalog/materials", undefined],
    ["POST", "/api/catalog/products", "{}"],
    ["GET", "/api/operations/sales", undefined],
    ["POST", "/api/operations/sales", "{}"],
    ["POST", "/api/operations/cash-transactions", "{}"],
  ];

  for (const [method, path, body] of cases) {
    test(`${method} ${path} sans jeton : 401`, async () => {
      const res = await fetch(base + path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : {},
        body,
      });
      assert.equal(res.status, 401);
    });
  }
});
