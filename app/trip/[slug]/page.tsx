import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PolicyLinks from "../../policy-links";
import SiteLink from "../../site-link";
import TripActions from "./trip-actions";
import { calculateBudgetSummary } from "@/lib/budget";
import { getSharedTrip } from "@/lib/shared-trips";
import { styleLabels, transportLabels } from "@/lib/travel-types";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const trip = await getSharedTrip(slug);
  if (!trip) return { title: "공유 코스를 찾을 수 없어요 | 모모타비" };
  const description = `${trip.regionName} ${trip.dayCount}일, ${trip.placeCount}곳을 담은 여행 일정입니다.`;
  return {
    title: `${trip.title} | 모모타비`,
    description,
    robots: { index: false, follow: false },
    openGraph: { title: trip.title, description },
  };
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

function directionsUrl(trip: NonNullable<Awaited<ReturnType<typeof getSharedTrip>>>) {
  const places = trip.plan.places;
  if (places.length < 2) {
    const place = places[0];
    return place?.externalUrl || `https://www.google.com/maps/search/?api=1&query=${place?.latitude},${place?.longitude}`;
  }
  const coordinate = (place: (typeof places)[number]) => `${place.latitude},${place.longitude}`;
  const parameters = new URLSearchParams({
    api: "1",
    origin: trip.plan.preferences.startLocation.trim() || coordinate(places[0]),
    destination: coordinate(places[places.length - 1]),
    travelmode: trip.plan.preferences.transport === "transit"
      ? "transit"
      : trip.plan.preferences.transport === "driving" ? "driving" : "walking",
  });
  const waypoints = trip.plan.preferences.startLocation.trim()
    ? places.slice(0, -1)
    : places.slice(1, -1);
  if (waypoints.length) parameters.set("waypoints", waypoints.map(coordinate).join("|"));
  return `https://www.google.com/maps/dir/?${parameters.toString()}`;
}

export default async function SharedTripPage({ params }: PageProps) {
  const { slug } = await params;
  const trip = await getSharedTrip(slug);
  if (!trip) notFound();
  const plan = trip.plan.itineraryPlan;
  const budget = trip.plan.budget
    ? calculateBudgetSummary(trip.plan.budget, trip.dayCount)
    : null;
  const yen = new Intl.NumberFormat("ja-JP");
  const won = new Intl.NumberFormat("ko-KR");

  return (
    <div className="shared-trip-shell">
      <header className="topbar info-topbar no-print">
        <SiteLink className="brand" href="/" aria-label="모모타비 홈">
          <span className="brand-mark">も</span><span>MOMOTABI</span>
        </SiteLink>
        <nav aria-label="주요 메뉴">
          <SiteLink className="section-link" href="/#planner">새 코스 만들기</SiteLink>
          <SiteLink className="sign-in-link" href="/login">로그인</SiteLink>
        </nav>
      </header>

      <main className="shared-trip-main">
        <header className="shared-trip-hero">
          <div>
            <p>SHARED MOMOTABI ROUTE</p>
            <h1>{trip.title}</h1>
            <span>{trip.regionName} · {styleLabels[trip.plan.style]} · {transportLabels[trip.plan.preferences.transport]}</span>
          </div>
          <dl>
            <div><dt>기간</dt><dd>{trip.dayCount}일</dd></div>
            <div><dt>장소</dt><dd>{trip.placeCount}곳</dd></div>
            <div><dt>출발</dt><dd>{trip.plan.preferences.startDate || "날짜 미정"}</dd></div>
          </dl>
          <TripActions
            editPath={`/?share=${slug}`}
            regionId={trip.plan.regionId}
            dayCount={trip.dayCount}
            placeCount={trip.placeCount}
          />
        </header>

        {plan ? (
          <section className="shared-itinerary" aria-labelledby="shared-itinerary-title">
            <div className="shared-section-heading">
              <span>DAILY PLAN</span><h2 id="shared-itinerary-title">하루별 일정</h2>
            </div>
            <div className="shared-days">
              {plan.days.map((day) => (
                <article key={day.dayNumber}>
                  <header><div><span>DAY {String(day.dayNumber).padStart(2, "0")}</span><strong>{day.date || `${day.dayNumber}일차`}</strong></div><small>이동 {formatMinutes(day.totalTravelMinutes)} · {day.totalDistanceKm.toFixed(1)}km</small></header>
                  <ol>
                    {day.activities.map((activity) => (
                      <li key={activity.kind === "place" ? activity.place.id : activity.id} className={activity.kind === "meal" ? "is-meal" : ""}>
                        <time>{activity.scheduledTime}</time>
                        <i aria-hidden="true" />
                        <div>
                          <strong>{activity.kind === "place" ? activity.place.name : activity.label}</strong>
                          <small>{activity.kind === "place" ? `${activity.place.category} · ${activity.endTime}까지` : `${activity.nearPlaceName} 주변`}</small>
                          {activity.kind === "place" && activity.openingNote ? <em>{activity.openingNote}</em> : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          </section>
        ) : (
          <section className="shared-itinerary" aria-labelledby="shared-places-title">
            <div className="shared-section-heading"><span>ROUTE STOPS</span><h2 id="shared-places-title">담아둔 장소</h2></div>
            <ol className="shared-place-list">
              {trip.plan.places.map((place, index) => (
                <li key={place.id}><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{place.name}</strong><span>{place.category} · {place.suggestedTime} 추천</span><p>{place.description}</p></div></li>
              ))}
            </ol>
          </section>
        )}

        {budget ? (
          <section className="shared-budget" aria-labelledby="shared-budget-title">
            <div className="shared-section-heading"><span>TRIP BUDGET</span><h2 id="shared-budget-title">예상 여행 경비</h2></div>
            <div>
              <p><span>전체 예상</span><strong>¥{yen.format(budget.totalYen)}</strong><small>약 {won.format(budget.totalKrw)}원</small></p>
              <p><span>1인당 예상</span><strong>¥{yen.format(budget.perPersonYen)}</strong><small>약 {won.format(budget.perPersonKrw)}원</small></p>
            </div>
            <small>항공권을 제외한 계획용 추정치이며 실제 비용과 환율은 달라질 수 있습니다.</small>
          </section>
        ) : null}

        <a className="shared-directions no-print" href={directionsUrl(trip)} target="_blank" rel="noreferrer">Google Maps에서 전체 동선 열기 <span aria-hidden="true">↗</span></a>
        <p className="shared-disclaimer">운영시간, 요금과 교통편은 변동될 수 있으니 출발 전에 공식 정보를 다시 확인해 주세요.</p>
      </main>

      <footer className="info-footer no-print">
        <div><strong>MOMOTABI</strong><span>취향대로 만드는 일본 여행 코스</span></div>
        <PolicyLinks />
        <small>© 2026 MOMOTABI</small>
      </footer>
    </div>
  );
}
