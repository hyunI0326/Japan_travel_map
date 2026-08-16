let activeRegion = 0;
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
  const region = regions[activeRegion];
  const day = region.days[activeDay];
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

function renderRegionSwitcher() {
  document.getElementById("regions").innerHTML = regions.map((region, index) => `
    <button class="${index === activeRegion ? "selected" : ""}" role="tab" aria-selected="${index === activeRegion}" data-region="${index}">
      ${region.nameKo}<small>${region.nameJp}</small>
    </button>`).join("");
  document.querySelectorAll("[data-region]").forEach(button => button.addEventListener("click", () => {
    activeRegion = Number(button.dataset.region);
    activeDay = 0;
    activeStop = 0;
    render(true);
  }));
}

function render(fitRoute = false) {
  const region = regions[activeRegion];
  const day = region.days[activeDay];
  const selected = day.stops[activeStop];

  document.title = `모모타비 — ${region.nameKo} 3일 여행 코스`;
  document.getElementById("city-en").textContent = region.nameEn;
  document.getElementById("city-jp").textContent = region.nameJp;
  document.getElementById("region-eyebrow").textContent = region.eyebrow;
  document.getElementById("region-title").innerHTML = `${region.headline[0]}<br>${region.headline[1]}`;
  document.getElementById("region-intro").innerHTML = `${region.intro[0]}<br>${region.intro[1]}`;
  document.getElementById("tip-copy").innerHTML = `<strong>${region.tipTitle}</strong> ${region.tipText}`;
  renderRegionSwitcher();

  document.querySelectorAll("[data-day]").forEach((button, index) => {
    button.classList.toggle("selected", index === activeDay);
    button.setAttribute("aria-selected", String(index === activeDay));
  });
  document.getElementById("day-label").textContent = day.label;
  document.getElementById("day-title").textContent = day.title;
  document.getElementById("day-transit").textContent = day.transit;
  document.getElementById("stops").setAttribute("aria-label", `${region.nameKo} ${activeDay + 1}일차 장소`);
  document.getElementById("stops").innerHTML = day.stops.map((stop, index) => `
    <button class="stop-card ${index === activeStop ? "active" : ""}" data-stop="${index}" role="listitem" aria-label="${stop.time} ${stop.name}, 지도에서 보기">
      <span class="stop-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="stop-copy"><span class="stop-time">${stop.time} · ${stop.type}</span><strong>${stop.name}</strong><span class="stop-note">${stop.note}</span></span>
      <span class="duration">${stop.duration}</span>
    </button>`).join("");
  document.querySelectorAll("[data-stop]").forEach(button => button.addEventListener("click", () => {
    activeStop = Number(button.dataset.stop);
    render(false);
  }));

  document.getElementById("map-label").textContent = `${region.nameEn} · DAY ${activeDay + 1} ROUTE`;
  document.getElementById("map-step").textContent = `${region.nameKo} · DAY ${activeDay + 1} · STOP ${String(activeStop + 1).padStart(2, "0")}`;
  document.getElementById("map-name").textContent = selected.name;
  document.getElementById("map-detail").textContent = `${selected.time} 도착 추천 · ${selected.duration} 머물기`;
  document.getElementById("open-map").href = `https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lon}#map=16/${selected.lat}/${selected.lon}`;
  renderMap(fitRoute);
}

document.querySelectorAll("[data-day]").forEach(button => button.addEventListener("click", () => {
  activeDay = Number(button.dataset.day);
  activeStop = 0;
  render(true);
}));

document.getElementById("save-button").addEventListener("click", event => {
  const saved = event.currentTarget.getAttribute("aria-pressed") !== "true";
  event.currentTarget.setAttribute("aria-pressed", String(saved));
  event.currentTarget.classList.toggle("is-saved", saved);
  event.currentTarget.textContent = saved ? "저장됨 ✓" : "내 코스 저장";
});

initializeMap();
render(true);
