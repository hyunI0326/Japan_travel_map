"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TravelPlace } from "@/lib/travel-types";
import TravelMapFallback from "./travel-map-fallback";

let loaderPromise:
  | Promise<[google.maps.MapsLibrary, google.maps.MarkerLibrary]>
  | null = null;

function loadGoogleMaps(apiKey: string) {
  if (!loaderPromise) {
    setOptions({
      key: apiKey,
      v: "weekly",
      language: "ko",
      region: "JP",
    });
    loaderPromise = Promise.all([
      importLibrary("maps"),
      importLibrary("marker"),
    ]);
  }
  return loaderPromise;
}

type TravelMapProps = {
  apiKey: string;
  places: TravelPlace[];
  activePlaceId: string;
  center: [number, number];
  onSelect: (placeId: string) => void;
};

export default function TravelMap(props: TravelMapProps) {
  const [runtimeApiKey, setRuntimeApiKey] = useState("");
  const [configState, setConfigState] = useState<"loading" | "ready" | "error">(
    props.apiKey ? "ready" : "loading",
  );
  const effectiveApiKey = props.apiKey || runtimeApiKey;

  useEffect(() => {
    if (props.apiKey) return;

    let cancelled = false;

    async function loadRuntimeConfig() {
      try {
        const response = await fetch("/api/maps-config", { cache: "no-store" });
        if (!response.ok) throw new Error("maps_config_failed");
        const data = (await response.json()) as { apiKey?: unknown };
        if (typeof data.apiKey !== "string" || !data.apiKey) {
          throw new Error("maps_key_missing");
        }
        if (!cancelled) {
          setRuntimeApiKey(data.apiKey);
          setConfigState("ready");
        }
      } catch {
        if (!cancelled) setConfigState("error");
      }
    }

    void loadRuntimeConfig();
    return () => {
      cancelled = true;
    };
  }, [props.apiKey]);

  if (configState === "loading") {
    return (
      <div className="map-canvas" role="region" aria-label="추천 여행 코스 Google 지도">
        <div className="map-system-message" role="status">
          <strong>Google 지도를 준비하고 있어요</strong>
          <small>잠시만 기다려 주세요.</small>
        </div>
      </div>
    );
  }

  if (configState === "error" || !effectiveApiKey) {
    return (
      <TravelMapFallback
        places={props.places}
        activePlaceId={props.activePlaceId}
        center={props.center}
        onSelect={props.onSelect}
      />
    );
  }
  return <GoogleTravelMap {...props} apiKey={effectiveApiKey} />;
}

function GoogleTravelMap({
  apiKey,
  places,
  activePlaceId,
  center,
  onSelect,
}: TravelMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const routeRef = useRef<google.maps.Polyline | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const advancedMarkerRef = useRef<
    typeof google.maps.marker.AdvancedMarkerElement | null
  >(null);
  const boundsRef = useRef<typeof google.maps.LatLngBounds | null>(null);
  const placesRef = useRef(places);
  const activeRef = useRef(activePlaceId);
  const centerRef = useRef(center);
  const onSelectRef = useRef(onSelect);
  const [mapState, setMapState] = useState<"loading" | "ready" | "error">("loading");

  const renderRoute = useCallback(() => {
    const map = mapRef.current;
    const route = routeRef.current;
    const AdvancedMarkerElement = advancedMarkerRef.current;
    const LatLngBounds = boundsRef.current;
    if (!map || !route || !AdvancedMarkerElement || !LatLngBounds) return;

    const currentPlaces = placesRef.current;
    route.setPath(
      currentPlaces.length > 1
        ? currentPlaces.map((place) => ({
            lat: place.latitude,
            lng: place.longitude,
          }))
        : [],
    );

    markersRef.current.forEach((marker) => {
      marker.map = null;
    });
    markersRef.current = currentPlaces.map((place, index) => {
      const markerButton = document.createElement("button");
      markerButton.type = "button";
      markerButton.className = `map-route-marker${
        place.id === activeRef.current ? " is-active" : ""
      }`;
      markerButton.textContent = String(index + 1).padStart(2, "0");
      markerButton.setAttribute("aria-label", `${place.name}, 지도에서 보기`);
      markerButton.addEventListener("click", () => onSelectRef.current(place.id));

      return new AdvancedMarkerElement({
        map,
        position: { lat: place.latitude, lng: place.longitude },
        title: place.name,
        content: markerButton,
        zIndex: place.id === activeRef.current ? 1000 : index + 1,
      });
    });

    if (currentPlaces.length === 1) {
      map.setCenter({
        lat: currentPlaces[0].latitude,
        lng: currentPlaces[0].longitude,
      });
      map.setZoom(14);
    } else if (currentPlaces.length > 1) {
      const bounds = new LatLngBounds();
      currentPlaces.forEach((place) =>
        bounds.extend({ lat: place.latitude, lng: place.longitude }),
      );
      map.fitBounds(bounds, 92);
    } else {
      map.setCenter({ lat: centerRef.current[1], lng: centerRef.current[0] });
      map.setZoom(11);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    async function initializeMap() {
      try {
        const [mapsLibrary, markerLibrary] = await loadGoogleMaps(apiKey);
        if (cancelled || !containerRef.current) return;

        const map = new mapsLibrary.Map(containerRef.current, {
          center: { lat: centerRef.current[1], lng: centerRef.current[0] },
          zoom: 11,
          mapId: "DEMO_MAP_ID",
          clickableIcons: false,
          fullscreenControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          zoomControl: true,
        });
        const route = new mapsLibrary.Polyline({
          map,
          strokeColor: "#2563eb",
          strokeOpacity: 0.96,
          strokeWeight: 5,
          geodesic: true,
        });

        mapRef.current = map;
        routeRef.current = route;
        advancedMarkerRef.current = markerLibrary.AdvancedMarkerElement;
        boundsRef.current = google.maps.LatLngBounds;
        setMapState("ready");
        renderRoute();
      } catch {
        if (!cancelled) setMapState("error");
      }
    }

    void initializeMap();
    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => {
        marker.map = null;
      });
      markersRef.current = [];
      routeRef.current?.setMap(null);
      routeRef.current = null;
      mapRef.current = null;
    };
  }, [apiKey, renderRoute]);

  useEffect(() => {
    placesRef.current = places;
    activeRef.current = activePlaceId;
    centerRef.current = center;
    onSelectRef.current = onSelect;
    renderRoute();
  }, [places, activePlaceId, center, onSelect, renderRoute]);

  return (
    <div className="map-canvas" role="region" aria-label="추천 여행 코스 Google 지도">
      <div ref={containerRef} className="google-map-surface" />
      {mapState !== "ready" && (
        <div className="map-system-message" role="status">
          <strong>
            {mapState === "loading"
              ? "Google 지도를 불러오는 중이에요"
              : "Google 지도를 불러오지 못했어요"}
          </strong>
          <small>
            잠시 후 새로고침해 주세요.
          </small>
        </div>
      )}
    </div>
  );
}
