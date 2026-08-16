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
let map;
let routeLayers = [];

function markerIcon(index, isActive) {
  return L.divIcon({
    className: `route-marker${isActive ? " is-active" : ""}`,
    html: String(index + 1).padStart(2, "0"),
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

function initializeMap() {
  if (typeof L === "undefined") {
    document.getElementById("travel-map").innerHTML = '<p class="map-error">지도를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>';
    return;
  }
  map = L.map("travel-map", { zoomControl: false, scrollWheelZoom: true, keyboard: true });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);
  L.control.zoom({ position: "topright" }).addTo(map);
}

function renderMap(fitRoute) {
  if (!map) return;
  routeLayers.forEach(layer => layer.remove());
  const day = itinerary[activeDay];
  const coordinates = day.stops.map(stop => [stop.lat, stop.lon]);

  const routeHalo = L.polyline(coordinates, {
    color: "#fffdf7", weight: 11, opacity: 0.9, lineCap: "round", lineJoin: "round", interactive: false
  }).addTo(map);
  const routeLine = L.polyline(coordinates, {
    color: "#d94a3a", weight: 5, opacity: 0.96, lineCap: "round", lineJoin: "round", interactive: false
  }).addTo(map);

  const markers = day.stops.map((stop, index) => {
    const marker = L.marker([stop.lat, stop.lon], {
      icon: markerIcon(index, index === activeStop),
      keyboard: true,
      title: `${index + 1}. ${stop.name}`,
      alt: `${index + 1}. ${stop.name}`
    }).addTo(map);
    marker.bindTooltip(stop.name, {
      permanent: index === activeStop,
      direction: "top",
      offset: [0, -18],
      className: "momotabi-tooltip"
    });
    if (index === activeStop) marker.openTooltip();
    marker.on("click", () => {
      activeStop = index;
      render(false);
    });
    return marker;
  });
  routeLayers = [routeHalo, routeLine, ...markers];

  if (fitRoute) {
    map.fitBounds(L.latLngBounds(coordinates), { padding: [74, 74], maxZoom: 13, animate: true });
  } else {
    const selected = day.stops[activeStop];
    map.panTo([selected.lat, selected.lon], { animate: true, duration: 0.35 });
  }
  requestAnimationFrame(() => map.invalidateSize());
}

function render(fitRoute = false) {
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
  document.querySelectorAll("[data-stop]").forEach(button => button.addEventListener("click", () => { activeStop = Number(button.dataset.stop); render(false); }));
  document.getElementById("map-label").textContent = `DAY ${activeDay + 1} ROUTE · ${day.stops.length} STOPS`;
  document.getElementById("map-step").textContent = `DAY ${activeDay + 1} · STOP ${String(activeStop + 1).padStart(2, "0")}`;
  document.getElementById("map-name").textContent = selected.name;
  document.getElementById("map-detail").textContent = `${selected.time} 도착 추천 · ${selected.duration} 머물기`;
  document.getElementById("open-map").href = `https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lon}#map=16/${selected.lat}/${selected.lon}`;
  renderMap(fitRoute);
}

document.querySelectorAll("[data-day]").forEach(button => button.addEventListener("click", () => { activeDay = Number(button.dataset.day); activeStop = 0; render(true); }));
document.getElementById("save-button").addEventListener("click", event => {
  const saved = event.currentTarget.getAttribute("aria-pressed") !== "true";
  event.currentTarget.setAttribute("aria-pressed", String(saved));
  event.currentTarget.classList.toggle("is-saved", saved);
  event.currentTarget.textContent = saved ? "저장됨 ✓" : "내 코스 저장";
});
initializeMap();
render(true);
