"use client";

import { useCallback, useEffect, useRef } from "react";
import type {
  GeoJSONSource,
  Map as MapLibreMap,
  Marker as MapLibreMarker,
} from "maplibre-gl";
import type { TravelPlace } from "@/lib/travel-types";

type MapLibreModule = typeof import("maplibre-gl");

export default function TravelMapFallback({
  places,
  startPlace,
  activePlaceId,
  center,
  onSelect,
}: {
  places: TravelPlace[];
  startPlace?: TravelPlace | null;
  activePlaceId: string;
  center: [number, number];
  onSelect: (placeId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const mapLibreRef = useRef<MapLibreModule | null>(null);
  const markersRef = useRef<MapLibreMarker[]>([]);
  const loadedRef = useRef(false);
  const placesRef = useRef(places);
  const startPlaceRef = useRef(startPlace);
  const activeRef = useRef(activePlaceId);
  const centerRef = useRef(center);
  const onSelectRef = useRef(onSelect);

  const renderRoute = useCallback(() => {
    const map = mapRef.current;
    const maplibre = mapLibreRef.current;
    if (!map || !maplibre || !loadedRef.current) return;

    const currentPlaces = placesRef.current;
    const currentStartPlace = startPlaceRef.current;
    const routePlaces = currentStartPlace
      ? [currentStartPlace, ...currentPlaces]
      : currentPlaces;
    const source = map.getSource("momotabi-route") as GeoJSONSource | undefined;
    source?.setData({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: routePlaces.map((place) => [place.longitude, place.latitude]),
      },
    });

    markersRef.current.forEach((marker) => marker.remove());
    const startMarker = currentStartPlace
      ? (() => {
          const marker = document.createElement("div");
          marker.className = "map-hotel-marker";
          marker.textContent = "宿";
          marker.setAttribute("aria-label", `${currentStartPlace.name}, 숙소 또는 출발지`);
          return new maplibre.Marker({ element: marker, anchor: "center" })
            .setLngLat([currentStartPlace.longitude, currentStartPlace.latitude])
            .addTo(map);
        })()
      : null;
    const placeMarkers = currentPlaces.map((place, index) => {
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = `map-route-marker${place.id === activeRef.current ? " is-active" : ""}`;
      markerButton.textContent = String(index + 1).padStart(2, "0");
      markerButton.setAttribute("aria-label", `${place.name}, 지도에서 보기`);
      markerButton.addEventListener("click", () => onSelectRef.current(place.id));
      return new maplibre.Marker({ element: markerButton, anchor: "center" })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);
    });
    markersRef.current = startMarker ? [startMarker, ...placeMarkers] : placeMarkers;

    if (routePlaces.length > 0) {
      const bounds = new maplibre.LngLatBounds();
      routePlaces.forEach((place) => bounds.extend([place.longitude, place.latitude]));
      map.fitBounds(bounds, { padding: 92, maxZoom: 13.5, duration: 550 });
    } else {
      map.jumpTo({ center: centerRef.current, zoom: 11 });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initializeMap() {
      if (!containerRef.current) return;
      const mapLibrary = await import("maplibre-gl");
      if (cancelled || !containerRef.current) return;
      const maplibre = mapLibrary;
      mapLibreRef.current = maplibre;
      const map = new maplibre.Map({
        container: containerRef.current,
        style: "https://tiles.openfreemap.org/styles/bright",
        center: centerRef.current,
        zoom: 11,
        localIdeographFontFamily: '"Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
      });
      map.addControl(new maplibre.NavigationControl({ showCompass: false }), "top-right");
      mapRef.current = map;

      map.on("load", () => {
        if (cancelled) return;
        map.addSource("momotabi-route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: [] },
          },
        });
        map.addLayer({
          id: "momotabi-route-halo",
          type: "line",
          source: "momotabi-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.9 },
        });
        map.addLayer({
          id: "momotabi-route-line",
          type: "line",
          source: "momotabi-route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#2563eb", "line-width": 4, "line-opacity": 0.96 },
        });
        loadedRef.current = true;
        renderRoute();
      });
    }

    void initializeMap();
    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      mapRef.current?.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
  }, [renderRoute]);

  useEffect(() => {
    placesRef.current = places;
    startPlaceRef.current = startPlace;
    activeRef.current = activePlaceId;
    centerRef.current = center;
    onSelectRef.current = onSelect;
    renderRoute();
  }, [places, startPlace, activePlaceId, center, onSelect, renderRoute]);

  return (
    <div
      ref={containerRef}
      className="map-canvas"
      role="region"
      aria-label="추천 여행 코스 지도"
    />
  );
}
