import type { Metadata } from "next";
import InfoPage from "../info-page";

export const metadata: Metadata = {
  title: "문의 | 모모타비",
  description: "모모타비의 장소 정보 오류, 기능 문제, 개인정보 및 제휴 문의 방법을 안내합니다.",
};

export default function ContactPage() {
  return (
    <InfoPage
      eyebrow="CONTACT"
      title="여행 정보와 서비스에 관한 이야기를 들려주세요."
      intro="장소 정보 오류, 기능 문제, 개인정보 요청과 서비스 제안을 공식 문의 창구에서 접수합니다. 확인에 필요한 내용을 함께 남겨주시면 더 정확하게 살펴볼 수 있습니다."
    >
      <section>
        <span className="info-number">01</span>
        <h2>어떤 내용을 문의할 수 있나요?</h2>
        <div className="principle-grid">
          <div><strong>장소 정보</strong><p>잘못된 장소명, 운영시간, 위치나 사진처럼 수정이 필요한 정보를 알려주세요.</p></div>
          <div><strong>기능과 계정</strong><p>코스 저장, 로그인, 지도 표시 또는 일정 생성 과정에서 발생한 문제를 알려주세요.</p></div>
          <div><strong>개인정보와 제안</strong><p>개인정보 관련 요청, 콘텐츠 제휴와 서비스 개선 의견을 접수합니다.</p></div>
        </div>
      </section>

      <section>
        <span className="info-number">02</span>
        <h2>문의할 때 함께 알려주세요</h2>
        <div className="guide-checklist">
          <ul>
            <li>문제가 발생한 페이지 주소와 사용한 기능</li>
            <li>선택한 여행 지역과 관광지, 발생한 현상</li>
            <li>가능하다면 오류 문구와 재현 순서</li>
          </ul>
        </div>
        <p className="contact-caution">문의 글은 공개될 수 있습니다. 비밀번호, API 키, 인증 코드, 주민등록번호와 같은 민감한 정보는 절대 포함하지 마세요.</p>
        <a className="info-cta" href="https://github.com/hyunI0326/Japan_travel_map/issues" target="_blank" rel="noreferrer">공식 문의 창구 열기 <span aria-hidden="true">↗</span></a>
      </section>

      <section>
        <span className="info-number">03</span>
        <h2>외부 장소 정보에 관하여</h2>
        <p>Google 지도에서 제공되는 상호, 운영시간, 사진이나 경로 자체의 수정은 Google 지도에서 해당 장소의 정보 수정을 제안하는 편이 가장 빠를 수 있습니다. 모모타비의 설명이나 추천 결과에 관한 문제는 위 문의 창구로 알려주세요.</p>
      </section>
    </InfoPage>
  );
}
