import type { Metadata } from "next";
import Link from "next/link";
import InfoPage from "../info-page";

export const metadata: Metadata = {
  title: "일본 여행 코스 만들기 가이드 | 모모타비",
  description: "필수 관광지 선택부터 근교 추천, 동선 정리와 출발 전 확인까지 일본 여행 코스를 만드는 실전 방법을 안내합니다.",
};

const regions = [
  { name: "도쿄", label: "큰 도시를 작은 권역으로", body: "아사쿠사·우에노, 시부야·하라주쿠처럼 가까운 생활권을 하루 단위로 묶어 보세요. 도시 전체를 지그재그로 오가는 것보다 환승과 체력 부담을 줄이기 쉽습니다." },
  { name: "교토", label: "인기 명소는 이른 시간부터", body: "동쪽 사찰권, 아라시야마, 도심 골목을 각각 나누면 이동이 단순해집니다. 꼭 보고 싶은 사찰을 오전 첫 장소로 두고 주변 산책지를 이어 붙여 보세요." },
  { name: "오사카", label: "낮의 관광과 밤의 먹거리", body: "오사카성 주변과 우메다, 난바·도톤보리의 분위기는 서로 다릅니다. 낮에는 전망·공원, 저녁에는 시장·먹거리 골목처럼 시간대에 맞춰 배치하면 좋습니다." },
  { name: "후쿠오카", label: "도심과 근교를 분리", body: "하카타·텐진은 대중교통으로 묶고, 다자이후나 이토시마 같은 근교는 별도 반나절 또는 하루로 잡아 이동 시간을 확보하세요." },
  { name: "삿포로", label: "계절과 이동 수단 먼저", body: "도심 코스와 오타루 같은 근교 코스를 나누고, 겨울에는 같은 거리라도 이동 시간을 넉넉히 잡으세요. 날씨에 따라 실내 장소를 대안으로 준비하면 안정적입니다." },
];

export default function GuidePage() {
  return (
    <InfoPage
      eyebrow="TRIP PLANNING GUIDE"
      title="저장한 장소를, 실제로 걸을 수 있는 코스로."
      intro="좋은 일정은 장소를 많이 넣는 일정이 아니라 이동과 체류의 리듬이 자연스러운 일정입니다. 모모타비를 이용해 필수 관광지부터 하루 동선까지 정리하는 방법을 소개합니다."
    >
      <section>
        <span className="info-number">01</span>
        <h2>필수 관광지는 하루의 기준점으로 고르세요</h2>
        <p>먼저 이번 여행에서 놓치면 가장 아쉬울 장소를 고릅니다. 사진이 잘 나오는 곳이나 유명한 곳만 고르기보다 예약 시간, 함께 가는 사람의 관심사, 계절을 기준으로 우선순위를 정하는 편이 좋습니다. 하루에 멀리 떨어진 필수 장소를 여러 개 넣으면 근교 추천이 좋아도 이동이 길어질 수 있습니다.</p>
        <div className="guide-checklist">
          <strong>선택 전 확인할 세 가지</strong>
          <ul>
            <li>입장 예약이나 시간 지정이 필요한가?</li>
            <li>오전·일몰·야간 중 가장 좋은 방문 시간이 있는가?</li>
            <li>같이 가는 사람 모두가 오래 머물 수 있는 장소인가?</li>
          </ul>
        </div>
      </section>

      <section>
        <span className="info-number">02</span>
        <h2>근교 추천은 숫자보다 조합을 보세요</h2>
        <p>필수 관광지 주변의 추천 결과에서는 거리만 보지 말고 역할을 나눠 보세요. 대표 명소 하나, 걷기 좋은 거리 하나, 식사나 휴식을 위한 장소 하나처럼 성격이 다른 곳을 조합하면 일정의 밀도가 자연스러워집니다. 마음에 드는 장소를 담은 뒤에는 지도에서 동선이 되돌아가지는 않는지 확인합니다.</p>
      </section>

      <section>
        <span className="info-number">03</span>
        <h2>지역별로 묶는 기준이 달라요</h2>
        <div className="region-guide-grid">
          {regions.map((region) => (
            <article key={region.name}>
              <span>{region.name}</span>
              <h3>{region.label}</h3>
              <p>{region.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section>
        <span className="info-number">04</span>
        <h2>자동 일정은 초안으로 활용하세요</h2>
        <p>여행 시작일과 일수, 숙소, 이동 수단, 여행 속도를 입력하면 선택한 장소를 가까운 권역으로 묶어 초안을 만들 수 있습니다. 생성된 일정에서는 첫 장소까지의 이동 시간과 마지막 장소에서 숙소로 돌아오는 시간을 특히 확인하세요. 식사 시간은 예약 여부와 대기 시간을 고려해 여유를 더하는 것이 좋습니다.</p>
      </section>

      <section>
        <span className="info-number">05</span>
        <h2>출발 전에는 최신 정보로 다시 확인하세요</h2>
        <div className="guide-checklist">
          <ul>
            <li>휴관일, 임시 휴업, 마지막 입장 시간을 공식 홈페이지에서 확인합니다.</li>
            <li>Google 지도에서 당일 교통편과 공사·운휴 정보를 확인합니다.</li>
            <li>비나 폭설 예보가 있다면 실내 대체 장소와 이동 여유 시간을 준비합니다.</li>
            <li>사진 촬영, 음식물 반입, 수하물 보관 같은 현장 규칙을 확인합니다.</li>
          </ul>
        </div>
        <Link className="info-cta" href="/#planner">내 여행 코스 만들기 <span aria-hidden="true">→</span></Link>
      </section>
    </InfoPage>
  );
}
