import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("createdAt", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

const updatedAt = () =>
  integer("updatedAt", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("emailVerified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("user_email_unique").on(table.email)],
);

export const sessions = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text("ipAddress"),
    userAgent: text("userAgent"),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("session_token_unique").on(table.token),
    index("idx_session_user_id").on(table.userId),
  ],
);

export const accounts = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("accountId").notNull(),
    providerId: text("providerId").notNull(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text("accessToken"),
    refreshToken: text("refreshToken"),
    idToken: text("idToken"),
    accessTokenExpiresAt: integer("accessTokenExpiresAt", {
      mode: "timestamp_ms",
    }),
    refreshTokenExpiresAt: integer("refreshTokenExpiresAt", {
      mode: "timestamp_ms",
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    uniqueIndex("account_issuer_account_id_unique").on(
      table.issuer,
      table.accountId,
    ),
    index("idx_account_user_id").on(table.userId),
  ],
);

export const verifications = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expiresAt", { mode: "timestamp_ms" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("idx_verification_identifier").on(table.identifier)],
);

export const rateLimits = sqliteTable(
  "rateLimit",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    count: integer("count").notNull(),
    lastRequest: integer("lastRequest").notNull(),
  },
  (table) => [uniqueIndex("rate_limit_key_unique").on(table.key)],
);

export const regions = sqliteTable("region", {
  id: text("id").primaryKey(),
  nameKo: text("nameKo").notNull(),
  nameEn: text("nameEn").notNull(),
  nameJp: text("nameJp").notNull(),
  eyebrow: text("eyebrow").notNull(),
  headline: text("headline").notNull(),
  intro: text("intro").notNull(),
  tipTitle: text("tipTitle").notNull(),
  tipText: text("tipText").notNull(),
  centerLat: real("centerLat").notNull(),
  centerLon: real("centerLon").notNull(),
});

export const places = sqliteTable(
  "place",
  {
    id: text("id").primaryKey(),
    regionId: text("regionId")
      .notNull()
      .references(() => regions.id, { onDelete: "cascade" }),
    dayGroup: integer("dayGroup").notNull(),
    sortOrder: integer("sortOrder").notNull(),
    name: text("name").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    suggestedTime: text("suggestedTime").notNull(),
    durationMinutes: integer("durationMinutes").notNull(),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    styleTags: text("styleTags").notNull(),
  },
  (table) => [
    index("idx_place_region_day_order").on(
      table.regionId,
      table.dayGroup,
      table.sortOrder,
    ),
  ],
);

export const itineraries = sqliteTable(
  "itinerary",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    regionId: text("regionId")
      .notNull()
      .references(() => regions.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    style: text("style").notNull(),
    dayCount: integer("dayCount").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index("idx_itinerary_user_updated").on(table.userId, table.updatedAt),
  ],
);

export const itineraryItems = sqliteTable(
  "itineraryItem",
  {
    id: text("id").primaryKey(),
    itineraryId: text("itineraryId")
      .notNull()
      .references(() => itineraries.id, { onDelete: "cascade" }),
    placeId: text("placeId")
      .notNull()
      .references(() => places.id, { onDelete: "restrict" }),
    dayNumber: integer("dayNumber").notNull(),
    position: integer("position").notNull(),
    scheduledTime: text("scheduledTime").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("itinerary_item_slot_unique").on(
      table.itineraryId,
      table.dayNumber,
      table.position,
    ),
    index("idx_itinerary_item_itinerary").on(table.itineraryId),
  ],
);

export const userPreferences = sqliteTable("userPreference", {
  userId: text("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  preferredStyle: text("preferredStyle").notNull().default("balanced"),
  lastRegionId: text("lastRegionId").references(() => regions.id, {
    onDelete: "set null",
  }),
  updatedAt: updatedAt(),
});
