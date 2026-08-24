import { getD1 } from "./index";

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "user" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" INTEGER DEFAULT 0 NOT NULL,
    "image" TEXT,
    "createdAt" INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
    "updatedAt" INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "user_email_unique" ON "user" ("email")`,
  `CREATE TABLE IF NOT EXISTS "session" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "expiresAt" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
    "updatedAt" INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "session_token_unique" ON "session" ("token")`,
  `CREATE INDEX IF NOT EXISTS "idx_session_user_id" ON "session" ("userId")`,
  `CREATE TABLE IF NOT EXISTS "account" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "issuer" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" INTEGER,
    "refreshTokenExpiresAt" INTEGER,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
    "updatedAt" INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "account_issuer_account_id_unique" ON "account" ("issuer", "accountId")`,
  `CREATE INDEX IF NOT EXISTS "idx_account_user_id" ON "account" ("userId")`,
  `CREATE TABLE IF NOT EXISTS "verification" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" INTEGER NOT NULL,
    "createdAt" INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
    "updatedAt" INTEGER DEFAULT (unixepoch() * 1000) NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_verification_identifier" ON "verification" ("identifier")`,
  `CREATE TABLE IF NOT EXISTS "rateLimit" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "rate_limit_key_unique" ON "rateLimit" ("key")`,
];

let initialization: Promise<void> | null = null;

export function ensureDatabase(): Promise<void> {
  if (!initialization) {
    initialization = initializeDatabase().catch((error) => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}

async function initializeDatabase() {
  const database = getD1();
  await database.batch(
    SCHEMA_STATEMENTS.map((statement) => database.prepare(statement)),
  );
  await database.prepare("PRAGMA optimize").run();
}
