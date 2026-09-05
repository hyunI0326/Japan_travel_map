"use client";

import { useRef } from "react";
import {
  calculateBudgetSummary,
  normalizeBudgetEstimate,
  type BudgetEstimate,
} from "@/lib/budget";
import { trackFunnelEvent } from "@/lib/analytics-client";

const yen = new Intl.NumberFormat("ja-JP");
const won = new Intl.NumberFormat("ko-KR");

type NumberField = {
  key: keyof BudgetEstimate;
  label: string;
  suffix: string;
  help: string;
  min?: number;
  max?: number;
  step?: number;
};

const fields: NumberField[] = [
  { key: "travelers", label: "여행 인원", suffix: "명", help: "비용을 나눌 전체 인원", min: 1, max: 10 },
  { key: "nights", label: "숙박 일수", suffix: "박", help: "당일 여행이면 0박", min: 0, max: 30 },
  { key: "accommodationTotal", label: "숙박비", suffix: "엔", help: "전체 인원의 숙박비 합계", max: 10_000_000, step: 1_000 },
  { key: "mealsPerPersonDay", label: "식비", suffix: "엔", help: "1인 하루 기준", max: 1_000_000, step: 500 },
  { key: "transportPerPersonDay", label: "현지 교통", suffix: "엔", help: "1인 하루 기준", max: 1_000_000, step: 500 },
  { key: "activitiesPerPerson", label: "입장·체험", suffix: "엔", help: "1인 여행 전체 기준", max: 5_000_000, step: 500 },
  { key: "shoppingAndOtherTotal", label: "쇼핑·기타", suffix: "엔", help: "전체 인원의 기타 비용", max: 10_000_000, step: 1_000 },
  { key: "krwPerHundredYen", label: "적용 환율", suffix: "원", help: "100엔당 원화 금액", min: 1, max: 100_000, step: 10 },
];

export default function BudgetCalculator({
  value,
  dayCount,
  regionId,
  onChange,
}: {
  value: BudgetEstimate;
  dayCount: number;
  regionId: string;
  onChange: (value: BudgetEstimate) => void;
}) {
  const trackedRef = useRef(false);
  const summary = calculateBudgetSummary(value, dayCount);

  function update(key: keyof BudgetEstimate, nextValue: string) {
    const next = normalizeBudgetEstimate({ ...value, [key]: Number(nextValue) });
    onChange(next);
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackFunnelEvent("budget_calculated", { regionId, dayCount });
    }
  }

  return (
    <section className="budget-calculator" aria-labelledby="budget-title" data-reveal>
      <div className="saved-heading budget-heading">
        <div><span>TRIP BUDGET</span><h2 id="budget-title">여행 경비 계산기</h2></div>
        <small>{value.travelers}명 · {dayCount}일</small>
      </div>
      <p className="budget-intro">현재 여행 조건으로 시작 금액을 채워두었어요. 실제 예약 금액과 환율에 맞게 수정해 보세요.</p>
      <div className="budget-fields">
        {fields.map((field) => (
          <label key={field.key}>
            <span>{field.label}<small>{field.help}</small></span>
            <span className="budget-input-wrap">
              <input
                type="number"
                inputMode="numeric"
                min={field.min ?? 0}
                max={field.max}
                step={field.step ?? 1}
                value={value[field.key]}
                onChange={(event) => update(field.key, event.target.value)}
              />
              <b>{field.suffix}</b>
            </span>
          </label>
        ))}
      </div>
      <div className="budget-summary" aria-live="polite">
        <div><span>예상 총경비</span><strong>¥{yen.format(summary.totalYen)}</strong><small>약 {won.format(summary.totalKrw)}원</small></div>
        <div><span>1인당 예상</span><strong>¥{yen.format(summary.perPersonYen)}</strong><small>약 {won.format(summary.perPersonKrw)}원</small></div>
      </div>
      <p className="budget-note">항공권은 포함하지 않은 계획용 추정치입니다. 자동차 이동은 렌터카·주유·통행료를 합쳐 입력해 주세요.</p>
    </section>
  );
}
