import type { Metadata } from "next";
import InfoPage from "../info-page";

export const metadata: Metadata = {
  title: "서비스 소개와 문의 | 모모타비",
  description: "모모타비가 일본 여행 코스를 추천하는 방식과 정보 출처, 문의 방법을 안내합니다.",
};

export default function AboutPage() {
  return (
    <InfoPage
      eyebrow="ABOUT MOMOTABI"
      title="목적지가 아니라, 여행의 순서를 함께 만듭니다."
      intro="모모타비는 유명 장소를 무작정 나열하지 않습니다. 사용자가 꼭 가고 싶은 한 곳을 먼저 고르면, 그 주변에서 함께 둘러보기 좋은 장소를 찾고 실제 일정으로 이어지도록 정리합니다."
    >
      <section>
        <span className="info-number">01</span>
        <h2>왜 만들었나요?</h2>
        <p>여행 정보를 찾다 보면 저장한 장소는 많아지지만, 어느 날 어떤 순서로 가야 할지는 더 어려워집니다. 모모타비는 이 간극을 줄이기 위해 만들었습니다. 지역, 필수 관광지, 여행 취향이라는 세 가지 선택을 중심으로 복잡한 검색 결과를 실행 가능한 코스로 바꿉니다.</p>
      </section>

      <section>
        <span className="info-number">02</span>
        <h2>추천은 어떻게 만들어지나요?</h2>
        <div className="principle-grid">
          <div><strong>사용자 선택 우선</strong><p>필수 관광지는 자동 추천보다 먼저 일정에 반영하며, 사용자가 직접 순서와 포함 여부를 바꿀 수 있습니다.</p></div>
          <div><strong>거리와 맥락 함께 보기</strong><p>가까운 장소라도 여행 흐름에 맞지 않으면 좋은 추천이 아닙니다. 장소 유형, 이동 방식, 체류 시간을 함께 고려합니다.</p></div>
          <div><strong>최종 확인은 여행자에게</strong><p>운영시간과 경로는 변할 수 있으므로 Google 지도 링크와 상세 정보를 제공해 출발 전에 다시 확인하도록 돕습니다.</p></div>
        </div>
      </section>

      <section>
        <span className="info-number">03</span>
        <h2>정보 출처와 한계</h2>
        <p>기본 관광지 설명은 모모타비가 여행 계획에 맞게 직접 구성한 콘텐츠입니다. 장소 검색, 사진, 평점, 운영시간과 지도 표시는 Google Maps Platform의 정보를 활용할 수 있습니다. 외부 정보는 현지 사정이나 제공 업체의 갱신 시점에 따라 실제와 다를 수 있으며, 모모타비는 예약·운영 여부를 보증하지 않습니다.</p>
      </section>

      <section id="contact">
        <span className="info-number">04</span>
        <h2>문의와 오류 제보</h2>
        <p>장소 정보 오류, 기능 문제, 개인정보 관련 요청은 공개 저장소의 문의 창구로 접수할 수 있습니다. 계정 이메일이나 API 키 같은 민감한 정보는 문의 글에 적지 마세요.</p>
        <a className="info-cta" href="https://github.com/hyunI0326/Japan_travel_map/issues" target="_blank" rel="noreferrer">GitHub에서 문의하기 <span aria-hidden="true">↗</span></a>
      </section>
    </InfoPage>
  );
}
