import { ensureDatabase } from "@/db/init";
import { getD1 } from "@/db";
import {
  buildCustomCourse,
  calculateDistanceKm,
  styleLabels,
  type PlaceCatalog,
  type PlaceRecommendation,
  type TravelCourse,
  type TravelPlace,
  type TravelRegion,
  type TravelStyle,
} from "@/lib/travel-types";

type PlaceRow = TravelPlace & {
  regionId: string;
  dayGroup: number;
  sortOrder: number;
  styleTags: string;
};

type SavedCourseRow = PlaceRow & {
  itineraryId: string;
  itineraryTitle: string;
  itineraryStyle: TravelStyle;
  itineraryDayCount: number;
  itineraryCreatedAt: number;
  itemDayNumber: number;
  itemPosition: number;
  regionNameKo: string;
  regionNameEn: string;
  regionNameJp: string;
  regionEyebrow: string;
  regionHeadline: string;
  regionIntro: string;
  regionTipTitle: string;
  regionTipText: string;
  regionCenterLat: number;
  regionCenterLon: number;
};

export async function getRegions(): Promise<TravelRegion[]> {
  await ensureDatabase();
  const result = await getD1()
    .prepare(
      `SELECT "id", "nameKo", "nameEn", "nameJp", "eyebrow", "headline", "intro",
              "tipTitle", "tipText", "centerLat", "centerLon"
       FROM "region"
       ORDER BY CASE "id"
         WHEN 'tokyo' THEN 1 WHEN 'kyoto' THEN 2 WHEN 'osaka' THEN 3
         WHEN 'fukuoka' THEN 4 WHEN 'sapporo' THEN 5 ELSE 99 END`,
    )
    .all<TravelRegion>();
  return result.results;
}

function dayTransit(places: TravelPlace[]) {
  const distance = places
    .slice(1)
    .reduce(
      (total, place, index) => total + calculateDistanceKm(places[index], place),
      0,
    );
  const rounded = distance < 10 ? distance.toFixed(1) : Math.round(distance).toString();
  return `직선거리 약 ${rounded}km · ${places.length}개 장소`;
}

function toTravelPlace(place: PlaceRow): TravelPlace {
  return {
    id: place.id,
    name: place.name,
    category: place.category,
    description: place.description,
    suggestedTime: place.suggestedTime,
    durationMinutes: place.durationMinutes,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

async function getRegionAndPlaceRows(regionId: string) {
  await ensureDatabase();
  const database = getD1();
  const [region, placeResult] = await Promise.all([
    database
      .prepare(
        `SELECT "id", "nameKo", "nameEn", "nameJp", "eyebrow", "headline", "intro",
                "tipTitle", "tipText", "centerLat", "centerLon"
         FROM "region" WHERE "id" = ? LIMIT 1`,
      )
      .bind(regionId)
      .first<TravelRegion>(),
    database
      .prepare(
        `SELECT "id", "regionId", "dayGroup", "sortOrder", "name", "category", "description",
                "suggestedTime", "durationMinutes", "latitude", "longitude", "styleTags"
         FROM "place" WHERE "regionId" = ?
         ORDER BY "dayGroup", "sortOrder"`,
      )
      .bind(regionId)
      .all<PlaceRow>(),
  ]);

  if (!region) throw new Error("REGION_NOT_FOUND");
  return { region, placeRows: placeResult.results };
}

export async function getPlaceCatalog(regionId: string): Promise<PlaceCatalog> {
  const { region, placeRows } = await getRegionAndPlaceRows(regionId);
  return {
    region,
    mustVisits: placeRows.filter((place) => place.sortOrder === 1).map(toTravelPlace),
    places: placeRows.map(toTravelPlace),
  };
}

export async function recommendNearbyPlaces({
  regionId,
  anchorPlaceIds,
  style,
}: {
  regionId: string;
  anchorPlaceIds: string[];
  style: TravelStyle;
}): Promise<PlaceRecommendation[]> {
  const { placeRows } = await getRegionAndPlaceRows(regionId);
  const anchorSet = new Set(anchorPlaceIds);
  const anchors = placeRows.filter((place) => anchorSet.has(place.id));
  if (anchors.length === 0) throw new Error("ANCHOR_NOT_FOUND");

  return placeRows
    .filter((place) => !anchorSet.has(place.id))
    .map((place) => {
      const nearest = anchors
        .map((anchor) => ({
          anchor,
          distance: calculateDistanceKm(place, anchor),
        }))
        .sort((a, b) => a.distance - b.distance)[0];
      const tags = place.styleTags.split(",");
      const styleBoost = style !== "balanced" && tags.includes(style) ? 0.8 : 0;
      return {
        ...place,
        distanceKm: Number(nearest.distance.toFixed(1)),
        nearAnchorName: nearest.anchor.name,
        rank: nearest.distance - styleBoost + place.sortOrder * 0.03,
      };
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 8)
    .map((place) => ({
      ...toTravelPlace(place),
      distanceKm: place.distanceKm,
      nearAnchorName: place.nearAnchorName,
    }));
}

function scorePlace(place: PlaceRow, style: TravelStyle) {
  if (style === "balanced") return 100 - place.sortOrder;
  const tags = place.styleTags.split(",");
  return (tags.includes(style) ? 100 : 0) + (tags.includes("balanced") ? 10 : 0) - place.sortOrder;
}

function buildCourse(
  region: TravelRegion,
  places: PlaceRow[],
  style: TravelStyle,
  dayCount: number,
): TravelCourse {
  const days = Array.from({ length: dayCount }, (_, index) => {
    const dayNumber = index + 1;
    const selected = places
      .filter((place) => place.dayGroup === dayNumber)
      .sort((a, b) => scorePlace(b, style) - scorePlace(a, style))
      .slice(0, 3)
      .sort((a, b) => a.suggestedTime.localeCompare(b.suggestedTime));

    return {
      dayNumber,
      label: `${region.nameKo} ${dayNumber}일차 · ${styleLabels[style]}`,
      transit: dayTransit(selected),
      places: selected.map((place) => ({
        id: place.id,
        name: place.name,
        category: place.category,
        description: place.description,
        suggestedTime: place.suggestedTime,
        durationMinutes: place.durationMinutes,
        latitude: place.latitude,
        longitude: place.longitude,
      })),
    };
  });

  return {
    title: `${region.nameKo} ${dayCount}일 추천 코스`,
    style,
    styleLabel: styleLabels[style],
    dayCount,
    region,
    days,
  };
}

export async function recommendCourse({
  regionId,
  style = "balanced",
  dayCount = 3,
}: {
  regionId: string;
  style?: TravelStyle;
  dayCount?: number;
}): Promise<TravelCourse> {
  await ensureDatabase();
  const database = getD1();
  const [region, placeResult] = await Promise.all([
    database
      .prepare(
        `SELECT "id", "nameKo", "nameEn", "nameJp", "eyebrow", "headline", "intro",
                "tipTitle", "tipText", "centerLat", "centerLon"
         FROM "region" WHERE "id" = ? LIMIT 1`,
      )
      .bind(regionId)
      .first<TravelRegion>(),
    database
      .prepare(
        `SELECT "id", "regionId", "dayGroup", "sortOrder", "name", "category", "description",
                "suggestedTime", "durationMinutes", "latitude", "longitude", "styleTags"
         FROM "place" WHERE "regionId" = ? AND "dayGroup" <= ?
         ORDER BY "dayGroup", "sortOrder"`,
      )
      .bind(regionId, dayCount)
      .all<PlaceRow>(),
  ]);

  if (!region) throw new Error("REGION_NOT_FOUND");
  return buildCourse(region, placeResult.results, style, dayCount);
}

export async function saveCourse({
  userId,
  regionId,
  style,
  dayCount,
  placeIds,
}: {
  userId: string;
  regionId: string;
  style: TravelStyle;
  dayCount: number;
  placeIds?: string[];
}) {
  let course: TravelCourse;
  if (placeIds?.length) {
    const { region, placeRows } = await getRegionAndPlaceRows(regionId);
    const placeMap = new Map(placeRows.map((place) => [place.id, place]));
    const uniquePlaceIds = [...new Set(placeIds)].slice(0, 9);
    const selectedPlaces = uniquePlaceIds.map((id) => placeMap.get(id));
    if (selectedPlaces.some((place) => !place)) throw new Error("PLACE_NOT_FOUND");
    course = buildCustomCourse({
      region,
      places: selectedPlaces.map((place) => toTravelPlace(place!)),
      style,
    });
  } else {
    course = await recommendCourse({ regionId, style, dayCount });
  }
  const database = getD1();
  const itineraryId = crypto.randomUUID();
  const now = Date.now();
  const statements = [
    database
      .prepare(
        `INSERT INTO "itinerary"
          ("id", "userId", "regionId", "title", "style", "dayCount", "createdAt", "updatedAt")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        itineraryId,
        userId,
        regionId,
        course.title,
        style,
        course.dayCount,
        now,
        now,
      ),
    database
      .prepare(
        `INSERT INTO "userPreference" ("userId", "preferredStyle", "lastRegionId", "updatedAt")
         VALUES (?, ?, ?, ?)
         ON CONFLICT("userId") DO UPDATE SET
           "preferredStyle" = excluded."preferredStyle",
           "lastRegionId" = excluded."lastRegionId",
           "updatedAt" = excluded."updatedAt"`,
      )
      .bind(userId, style, regionId, now),
  ];

  for (const day of course.days) {
    day.places.forEach((place, index) => {
      statements.push(
        database
          .prepare(
            `INSERT INTO "itineraryItem"
              ("id", "itineraryId", "placeId", "dayNumber", "position", "scheduledTime", "createdAt")
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            itineraryId,
            place.id,
            day.dayNumber,
            index + 1,
            place.suggestedTime,
            now,
          ),
      );
    });
  }

  await database.batch(statements);
  return { ...course, id: itineraryId, savedAt: now };
}

export async function getSavedCourses(userId: string): Promise<TravelCourse[]> {
  await ensureDatabase();
  const result = await getD1()
    .prepare(
      `SELECT
         i."id" AS "itineraryId", i."title" AS "itineraryTitle", i."style" AS "itineraryStyle",
         i."dayCount" AS "itineraryDayCount", i."createdAt" AS "itineraryCreatedAt",
         ii."dayNumber" AS "itemDayNumber", ii."position" AS "itemPosition",
         p."id", p."regionId", p."dayGroup", p."sortOrder", p."name", p."category",
         p."description", ii."scheduledTime" AS "suggestedTime", p."durationMinutes",
         p."latitude", p."longitude", p."styleTags",
         r."nameKo" AS "regionNameKo", r."nameEn" AS "regionNameEn", r."nameJp" AS "regionNameJp",
         r."eyebrow" AS "regionEyebrow", r."headline" AS "regionHeadline", r."intro" AS "regionIntro",
         r."tipTitle" AS "regionTipTitle", r."tipText" AS "regionTipText",
         r."centerLat" AS "regionCenterLat", r."centerLon" AS "regionCenterLon"
       FROM "itinerary" i
       JOIN "region" r ON r."id" = i."regionId"
       JOIN "itineraryItem" ii ON ii."itineraryId" = i."id"
       JOIN "place" p ON p."id" = ii."placeId"
       WHERE i."userId" = ?
         AND i."id" IN (SELECT "id" FROM "itinerary" WHERE "userId" = ? ORDER BY "updatedAt" DESC LIMIT 10)
       ORDER BY i."updatedAt" DESC, ii."dayNumber", ii."position"`,
    )
    .bind(userId, userId)
    .all<SavedCourseRow>();

  const courses = new Map<string, TravelCourse>();
  for (const row of result.results) {
    let course = courses.get(row.itineraryId);
    if (!course) {
      course = {
        id: row.itineraryId,
        title: row.itineraryTitle,
        style: row.itineraryStyle,
        styleLabel: styleLabels[row.itineraryStyle],
        dayCount: row.itineraryDayCount,
        savedAt: row.itineraryCreatedAt,
        region: {
          id: row.regionId,
          nameKo: row.regionNameKo,
          nameEn: row.regionNameEn,
          nameJp: row.regionNameJp,
          eyebrow: row.regionEyebrow,
          headline: row.regionHeadline,
          intro: row.regionIntro,
          tipTitle: row.regionTipTitle,
          tipText: row.regionTipText,
          centerLat: row.regionCenterLat,
          centerLon: row.regionCenterLon,
        },
        days: [],
      };
      courses.set(row.itineraryId, course);
    }

    let day = course.days.find((candidate) => candidate.dayNumber === row.itemDayNumber);
    if (!day) {
      day = {
        dayNumber: row.itemDayNumber,
        label: `${course.region.nameKo} ${row.itemDayNumber}일차 · ${course.styleLabel}`,
        transit: "",
        places: [],
      };
      course.days.push(day);
    }
    day.places.push({
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      suggestedTime: row.suggestedTime,
      durationMinutes: row.durationMinutes,
      latitude: row.latitude,
      longitude: row.longitude,
    });
  }

  for (const course of courses.values()) {
    course.days.forEach((day) => {
      day.transit = dayTransit(day.places);
    });
  }
  return [...courses.values()];
}
