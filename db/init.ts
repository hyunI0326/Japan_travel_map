import { getD1 } from "./index";
import { placeSeeds, regionSeeds } from "./travel-seed";

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
  `CREATE TABLE IF NOT EXISTS "region" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "nameKo" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "nameJp" TEXT NOT NULL,
    "eyebrow" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "intro" TEXT NOT NULL,
    "tipTitle" TEXT NOT NULL,
    "tipText" TEXT NOT NULL,
    "centerLat" REAL NOT NULL,
    "centerLon" REAL NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS "place" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "regionId" TEXT NOT NULL,
    "dayGroup" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestedTime" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "latitude" REAL NOT NULL,
    "longitude" REAL NOT NULL,
    "styleTags" TEXT NOT NULL,
    FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_place_region_day_order" ON "place" ("regionId", "dayGroup", "sortOrder")`,
  `CREATE TABLE IF NOT EXISTS "itinerary" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "style" TEXT NOT NULL,
    "dayCount" INTEGER NOT NULL,
    "createdAt" INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
    "updatedAt" INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
    FOREIGN KEY ("regionId") REFERENCES "region"("id") ON DELETE RESTRICT
  )`,
  `CREATE INDEX IF NOT EXISTS "idx_itinerary_user_updated" ON "itinerary" ("userId", "updatedAt")`,
  `CREATE TABLE IF NOT EXISTS "itineraryItem" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "scheduledTime" TEXT NOT NULL,
    "createdAt" INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
    FOREIGN KEY ("itineraryId") REFERENCES "itinerary"("id") ON DELETE CASCADE,
    FOREIGN KEY ("placeId") REFERENCES "place"("id") ON DELETE RESTRICT
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "itinerary_item_slot_unique" ON "itineraryItem" ("itineraryId", "dayNumber", "position")`,
  `CREATE INDEX IF NOT EXISTS "idx_itinerary_item_itinerary" ON "itineraryItem" ("itineraryId")`,
  `CREATE TABLE IF NOT EXISTS "userPreference" (
    "userId" TEXT PRIMARY KEY NOT NULL,
    "preferredStyle" TEXT DEFAULT 'balanced' NOT NULL,
    "lastRegionId" TEXT,
    "updatedAt" INTEGER DEFAULT (unixepoch() * 1000) NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE,
    FOREIGN KEY ("lastRegionId") REFERENCES "region"("id") ON DELETE SET NULL
  )`,
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
  await database.batch(
    regionSeeds.map((region) =>
      database
        .prepare(
          `INSERT OR IGNORE INTO "region"
            ("id", "nameKo", "nameEn", "nameJp", "eyebrow", "headline", "intro", "tipTitle", "tipText", "centerLat", "centerLon")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          region.id,
          region.nameKo,
          region.nameEn,
          region.nameJp,
          region.eyebrow,
          region.headline,
          region.intro,
          region.tipTitle,
          region.tipText,
          region.centerLat,
          region.centerLon,
        ),
    ),
  );
  await database.batch(
    placeSeeds.map((place) =>
      database
        .prepare(
          `INSERT OR IGNORE INTO "place"
            ("id", "regionId", "dayGroup", "sortOrder", "name", "category", "description", "suggestedTime", "durationMinutes", "latitude", "longitude", "styleTags")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          place.id,
          place.regionId,
          place.dayGroup,
          place.sortOrder,
          place.name,
          place.category,
          place.description,
          place.suggestedTime,
          place.durationMinutes,
          place.latitude,
          place.longitude,
          place.styleTags,
        ),
    ),
  );
  await database.prepare("PRAGMA optimize").run();
}
