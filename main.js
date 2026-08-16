let activeRegion = 0;
let activeDay = 0;
let activeStop = 0;
let activeNearby = null;
let map;
let mapReady = false;
let mapMarkers = [];
let pendingFit = true;

function localizeBaseMap() {
  const layers = map.getStyle().layers || [];
  layers.forEach(layer => {
    const textField = layer.layout && layer.layout["text-field"];
    if (layer.type !== "symbol" || !textField || !JSON.stringify(textField).includes("name")) return;
    try {
      map.setLayoutProperty(layer.id, "text-field", [
        "coalesce",
        ["get", "name:ko"],
        ["get", "name:latin"],
        ["get", "name:en"]
      ]);
    } catch {
      // Some icon-only symbol layers do not expose a replaceable name field.
    }
  });
}

function createMapMarker({ kind, label, symbol, position, active, lon, lat, onClick }) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = `map-marker-shell ${kind}${active ? " is-active" : ""} label-${position}`;
  element.setAttribute("aria-label", `${label}, 지도에서 보기`);
  element.innerHTML = `<span class="map-marker-icon">${symbol}</span><span class="map-marker-text">${label}</span>`;
  element.addEventListener("click", onClick);

  return new maplibregl.Marker({ element, anchor: "center" })
    .setLngLat([lon, lat])
    .addTo(map);
}

function initializeMap() {
  if (typeof maplibregl === "undefined") {
    document.getElementById("travel-map").innerHTML = '<p class="map-error">지도를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>';
    return;
  }

  map = new maplibregl.Map({
    container: "travel-map",
    style: "https://tiles.openfreemap.org/styles/bright",
    center: [139.767, 35.681],
    zoom: 11,
    attributionControl: true,
    localIdeographFontFamily: '"Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
    locale: {
      "NavigationControl.ZoomIn": "확대",
      "NavigationControl.ZoomOut": "축소"
    }
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

  map.on("load", () => {
    localizeBaseMap();
    map.addSource("momotabi-route", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: { type: "LineString", coordinates: [] }
      }
    });
    map.addLayer({
      id: "momotabi-route-halo",
      type: "line",
      source: "momotabi-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.92 }
    });
    map.addLayer({
      id: "momotabi-route-line",
      type: "line",
      source: "momotabi-route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#df5140", "line-width": 4, "line-opacity": 0.96 }
    });
    mapReady = true;
    renderMap(true);
  });
}

function renderMap(fitRoute) {
  pendingFit = pendingFit || fitRoute;
  if (!map || !mapReady) return;

  mapMarkers.forEach(marker => marker.remove());
  mapMarkers = [];

  const region = regions[activeRegion];
  const day = region.days[activeDay];
  const coordinates = day.stops.map(stop => [stop.lon, stop.lat]);
  map.getSource("momotabi-route").setData({
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates }
  });

  const routePositions = ["top", "right", "bottom"];
  day.stops.forEach((stop, index) => {
    mapMarkers.push(createMapMarker({
      kind: "route",
      label: stop.name,
      symbol: String(index + 1).padStart(2, "0"),
      position: routePositions[index] || "top",
      active: activeNearby === null && activeStop === index,
      lon: stop.lon,
      lat: stop.lat,
      onClick: () => {
        activeStop = index;
        activeNearby = null;
        render(false);
      }
    }));
  });

  day.nearby.forEach((place, index) => {
    mapMarkers.push(createMapMarker({
      kind: place.type,
      label: place.name,
      symbol: place.type === "food" ? "맛" : "숍",
      position: index === 0 ? "left" : "right",
      active: activeNearby === index,
      lon: place.lon,
      lat: place.lat,
      onClick: () => {
        activeNearby = index;
        render(false);
      }
    }));
  });

  const allPlaces = [...day.stops, ...day.nearby];
  if (pendingFit) {
    const bounds = new maplibregl.LngLatBounds();
    allPlaces.forEach(place => bounds.extend([place.lon, place.lat]));
    map.fitBounds(bounds, {
      padding: { top: 110, right: 110, bottom: 110, left: 110 },
      maxZoom: 15,
      duration: 500
    });
    pendingFit = false;
  } else {
    const selected = activeNearby === null ? day.stops[activeStop] : day.nearby[activeNearby];
    map.easeTo({ center: [selected.lon, selected.lat], duration: 350 });
  }
  requestAnimationFrame(() => map.resize());
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
