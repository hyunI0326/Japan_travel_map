let activeRegion = 0;
let activeDay = 0;
let activeStop = 0;
let activeNearby = null;
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

function nearbyIcon(type, isActive) {
  return L.divIcon({
    className: `nearby-marker ${type}${isActive ? " is-active" : ""}`,
    html: type === "food" ? "맛" : "숍",
    iconSize: [30, 30],
    iconAnchor: [15, 15]
  });
}

function initializeMap() {
  if (typeof L === "undefined") {
    document.getElementById("travel-map").innerHTML = '<p class="map-error">지도를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>';
    return;
  }
  map = L.map("travel-map", { zoomControl: false, scrollWheelZoom: true, keyboard: true });
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map);
  L.control.zoom({ position: "topright" }).addTo(map);
}

function renderMap(fitRoute) {
  if (!map) return;
  routeLayers.forEach(layer => layer.remove());
  const region = regions[activeRegion];
  const day = region.days[activeDay];
  const coordinates = day.stops.map(stop => [stop.lat, stop.lon]);
  const nearbyCoordinates = day.nearby.map(place => [place.lat, place.lon]);

  const routeHalo = L.polyline(coordinates, {
    color: "#ffffff", weight: 9, opacity: 0.92, lineCap: "round", lineJoin: "round", interactive: false
  }).addTo(map);
  const routeLine = L.polyline(coordinates, {
    color: "#df5140", weight: 4, opacity: 0.96, lineCap: "round", lineJoin: "round", interactive: false
  }).addTo(map);

  const markers = day.stops.map((stop, index) => {
    const marker = L.marker([stop.lat, stop.lon], {
      icon: markerIcon(index, activeNearby === null && index === activeStop),
      keyboard: true,
      title: `${index + 1}. ${stop.name}`,
      alt: `${index + 1}. ${stop.name}`
    }).addTo(map);
    const tooltipDirections = ["top", "right", "bottom"];
    const tooltipOffsets = [[0, -17], [17, 0], [0, 17]];
    marker.bindTooltip(stop.name, {
      permanent: true,
      direction: tooltipDirections[index],
      offset: tooltipOffsets[index],
      className: `momotabi-tooltip${activeNearby === null && index === activeStop ? " is-active-tooltip" : ""}`
    });
    if (index === activeStop) marker.openTooltip();
    marker.on("click", () => {
      activeStop = index;
      activeNearby = null;
      render(false);
    });
    return marker;
  });
  const nearbyMarkers = day.nearby.map((place, index) => {
    const marker = L.marker([place.lat, place.lon], {
      icon: nearbyIcon(place.type, activeNearby === index),
      keyboard: true,
      title: place.name,
      alt: place.name
    }).addTo(map);
    const direction = index % 2 === 0 ? "left" : "right";
    marker.bindTooltip(place.name, {
      permanent: true,
      direction,
      offset: index % 2 === 0 ? [-16, 0] : [16, 0],
      className: `nearby-tooltip ${place.type}${activeNearby === index ? " is-active" : ""}`
    }).openTooltip();
    marker.on("click", () => {
      activeNearby = index;
      render(false);
    });
    return marker;
  });
  routeLayers = [routeHalo, routeLine, ...markers, ...nearbyMarkers];

  if (fitRoute) {
    map.fitBounds(L.latLngBounds([...coordinates, ...nearbyCoordinates]), { padding: [100, 100], maxZoom: 15, animate: true });
  } else {
    const selected = activeNearby === null ? day.stops[activeStop] : day.nearby[activeNearby];
    map.panTo([selected.lat, selected.lon], { animate: true, duration: 0.35 });
  }
  requestAnimationFrame(() => map.invalidateSize());
}

function renderRegionSwitcher() {
  document.getElementById("regions").innerHTML = regions.map((region, index) => `
    <button class="${index === activeRegion ? "selected" : ""}" role="tab" aria-selected="${index === activeRegion}" data-region="${index}">
      ${region.nameKo}
    </button>`).join("");
  document.querySelectorAll("[data-region]").forEach(button => button.addEventListener("click", () => {
    activeRegion = Number(button.dataset.region);
    activeDay = 0;
    activeStop = 0;
    activeNearby = null;
    render(true);
  }));
}

function render(fitRoute = false) {
  const region = regions[activeRegion];
  const day = region.days[activeDay];
  const selected = activeNearby === null ? day.stops[activeStop] : day.nearby[activeNearby];

  document.title = `모모타비 — ${region.nameKo} 3일 여행 코스`;
  document.getElementById("city-en").textContent = region.nameEn;
  document.getElementById("city-jp").textContent = region.nameKo;
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
    activeNearby = null;
    render(false);
  }));

  document.getElementById("nearby").setAttribute("aria-label", `${region.nameKo} ${activeDay + 1}일차 주변 추천`);
  document.getElementById("nearby").innerHTML = day.nearby.map((place, index) => `
    <button class="nearby-card ${place.type}${activeNearby === index ? " active" : ""}" data-nearby="${index}" role="listitem" aria-label="${place.name}, 지도에서 보기">
      <span class="nearby-badge">${place.type === "food" ? "맛집·카페" : "쇼핑·시장"}</span>
      <strong>${place.name}</strong>
      <small>${place.note}</small>
    </button>`).join("");
  document.querySelectorAll("[data-nearby]").forEach(button => button.addEventListener("click", () => {
    activeNearby = Number(button.dataset.nearby);
    render(false);
  }));

  document.getElementById("map-label").textContent = `${region.nameKo} · ${activeDay + 1}일차 코스`;
  document.getElementById("map-step").textContent = activeNearby === null
    ? `${region.nameKo} · ${activeDay + 1}일차 · 코스 ${String(activeStop + 1).padStart(2, "0")}`
    : `${region.nameKo} · ${activeDay + 1}일차 · ${selected.type === "food" ? "맛집·카페" : "쇼핑·시장"}`;
  document.getElementById("map-name").textContent = selected.name;
  document.getElementById("map-detail").textContent = activeNearby === null ? `${selected.time} 도착 추천 · ${selected.duration} 머물기` : selected.note;
  document.getElementById("open-map").href = `https://www.openstreetmap.org/?mlat=${selected.lat}&mlon=${selected.lon}#map=16/${selected.lat}/${selected.lon}`;
  renderMap(fitRoute);
}

document.querySelectorAll("[data-day]").forEach(button => button.addEventListener("click", () => {
  activeDay = Number(button.dataset.day);
  activeStop = 0;
  activeNearby = null;
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
