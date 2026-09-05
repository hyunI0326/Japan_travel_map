"use client";

import { useState } from "react";
import { trackFunnelEvent } from "@/lib/analytics-client";

export default function TripActions({
  editPath,
  regionId,
  dayCount,
  placeCount,
}: {
  editPath: string;
  regionId: string;
  dayCount: number;
  placeCount: number;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function printTrip() {
    trackFunnelEvent("print_opened", { regionId, dayCount, placeCount });
    window.print();
  }

  return (
    <div className="shared-trip-actions no-print">
      <a href={editPath}>이 코스로 다시 계획하기</a>
      <button type="button" onClick={copyLink}>{copied ? "링크 복사됨 ✓" : "링크 복사"}</button>
      <button type="button" onClick={printTrip}>인쇄·PDF 저장</button>
    </div>
  );
}
