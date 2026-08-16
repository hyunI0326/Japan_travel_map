const itinerary = [
  {
    label: "동쪽의 오래된 풍경", title: "아사쿠사에서 긴자까지", transit: "도보 5.2km · 지하철 2회",
    stops: [
      { time: "09:00", type: "산책", name: "아사쿠사 & 센소지", note: "붐비기 전 나카미세 골목과 오래된 절의 아침을 천천히 만나요.", duration: "2h", lat: 35.7148, lon: 139.7967 },
      { time: "12:30", type: "커피", name: "기요스미시라카와", note: "창고를 개조한 로스터리와 정원이 있는 동네에서 잠깐 쉬어가요.", duration: "2h", lat: 35.6797, lon: 139.8001 },
      { time: "17:00", type: "저녁", name: "긴자 골목", note: "화려한 대로 뒤편, 작은 식당과 오래된 바가 모인 골목을 걸어요.", duration: "3h", lat: 35.6717, lon: 139.7650 }
    ]
  },
  {
    label: "느긋한 도쿄의 오후", title: "다이칸야마에서 시부야까지", transit: "도보 6.1km · 전철 1회",
    stops: [
      { time: "10:00", type: "책과 건축", name: "다이칸야마 T-SITE", note: "햇살 좋은 테라스와 서가 사이에서 여행의 속도를 늦춰요.", duration: "2h", lat: 35.6489, lon: 139.6990 },
      { time: "13:00", type: "산책", name: "나카메구로 강변", note: "작은 숍과 카페를 지나 메구로강을 따라 남쪽으로 걸어요.", duration: "2.5h", lat: 35.6436, lon: 139.6987 },
      { time: "18:00", type: "야경", name: "시부야 스카이", note: "해가 지기 40분 전 도착해 도시의 낮과 밤을 함께 봐요.", duration: "2h", lat: 35.6585, lon: 139.7022 }
    ]
  },
  {
    label: "생활의 온도가 남은 곳", title: "야나카에서 가구라자카까지", transit: "도보 4.8km · 지하철 1회",
    stops: [
      { time: "09:30", type: "골목", name: "야나카 긴자", note: "고양이 조형물과 동네 간식이 반기는 낮은 골목을 걸어요.", duration: "2h", lat: 35.7274, lon: 139.7667 },
      { time: "12:30", type: "미술", name: "우에노 공원", note: "박물관 하나를 골라 깊게 보고, 연못가에서 늦은 점심을 즐겨요.", duration: "3h", lat: 35.7155, lon: 139.7731 },
      { time: "17:30", type: "저녁", name: "가구라자카", note: "돌계단과 작은 요정 골목 사이, 마지막 저녁을 여유롭게 마무리해요.", duration: "3h", lat: 35.7020, lon: 139.7404 }
    ]
  }
];

let activeDay = 0;
let activeStop = 0;

function mapUrl(stop) {
  const pad = 0.022;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${stop.lon - pad}%2C${stop.lat - pad}%2C${stop.lon + pad}%2C${stop.lat + pad}&layer=mapnik&marker=${stop.lat}%2C${stop.lon}`;
}

function render() {
  const day = itinerary[activeDay];
  const selected = day.stops[activeStop];
  document.querySelectorAll("[data-day]").forEach((button, index) => {
    button.classList.toggle("selected", index === activeDay);
    button.setAttribute("aria-selected", String(index === activeDay));
  });
  document.getElementById("day-label").textContent = day.label;
  document.getElementById("day-title").textContent = day.title;
  document.getElementById("day-transit").textContent = day.transit;
  document.getElementById("stops").innerHTML = day.stops.map((stop, index) => `
    <button class="stop-card ${index === activeStop ? "active" : ""}" data-stop="${index}" role="listitem" aria-label="${stop.time} ${stop.name}, 지도에서 보기">
      <span class="stop-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="stop-copy"><span class="stop-time">${stop.time} · ${stop.type}</span><strong>${stop.name}</strong><span class="stop-note">${stop.note}</span></span>
      <span class="duration">${stop.duration}</span>
    </button>`).join("");
  document.querySelectorAll("[data-stop]").forEach(button => button.addEventListener("click", () => { activeStop = Number(button.dataset.stop); render(); }));
  document.getElementById("travel-map").src = mapUrl(selected);
  document.getElementById("travel-map").title = `${selected.name} 지도`;
  document.getElementById("map-step").textContent = `DAY ${activeDay + 1} · STOP ${String(activeStop + 1).padStart(2, "0")}`;
  document.getElementById("map-name").textContent = selected.name;
  document.getElementById("map-detail").textContent = `${selected.time} 도착 추천 · ${selected.duration} 머물기`;
  document.getElementById("open-map").href = `https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lon}#map=16/${selected.lat}/${selected.lon}`;
}

document.querySelectorAll("[data-day]").forEach(button => button.addEventListener("click", () => { activeDay = Number(button.dataset.day); activeStop = 0; render(); }));
document.getElementById("save-button").addEventListener("click", event => {
  const saved = event.currentTarget.getAttribute("aria-pressed") !== "true";
  event.currentTarget.setAttribute("aria-pressed", String(saved));
  event.currentTarget.classList.toggle("is-saved", saved);
  event.currentTarget.textContent = saved ? "저장됨 ✓" : "내 코스 저장";
});
render();
