// ────────────────────────────────────────────────────────────
//  MapView — 카카오맵 SDK 연동 지도 컴포넌트
// ────────────────────────────────────────────────────────────
'use client';

import { useEffect, useRef, useCallback } from "react";
import { useKakaoMap } from "../lib/useKakaoMap";
import {
  initMap,
  addCurrentLocationMarker,
  drawRouteLine,
  panTo,
  setZoom,
  getCurrentPosition,
  type Coordinate,
} from "../lib/map";

interface RouteSegment {
  trafficType: number;
  coords: Coordinate[];
}

interface MapViewProps {
  variant?: "home" | "navigation";
  routeCoords?: Coordinate[];
  routeSegments?: RouteSegment[];
  height?: number;
  center?: Coordinate;
  zoom?: number;
}

const DEFAULT_CENTER: Coordinate = {
  lat: 37.5665,
  lng: 126.978,
};

export function MapView({
  variant = "home",
  routeCoords,
  routeSegments,
  height = 300,
  center,
  zoom = 3,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const mapRef =
    useRef<kakao.maps.Map | null>(null);

  const polylineRefs =
    useRef<kakao.maps.Polyline[]>([]);

  const locationMarkerRef =
    useRef<kakao.maps.CustomOverlay | null>(
      null,
    );

  const { isLoaded, isLoading, isError } =
    useKakaoMap();

  // ─────────────────────────────────────────
  // 지도 초기화
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !containerRef.current)
      return;

    if (mapRef.current) return;

    const map = initMap(
      containerRef.current,
      center ?? DEFAULT_CENTER,
      zoom,
    );

    mapRef.current = map;

    getCurrentPosition()
      .then((coord) => {
        if (!mapRef.current) return;

        if (!center) {
          panTo(mapRef.current, coord);
        }

        if (locationMarkerRef.current) {
          locationMarkerRef.current.setMap(
            null,
          );
        }

        const { marker } =
          addCurrentLocationMarker(
            mapRef.current,
            coord,
          );

        locationMarkerRef.current =
          marker;
      })
      .catch(() => {});
  }, [isLoaded, center, zoom]);

  // ─────────────────────────────────────────
  // 실제 경로 그리기
  // ─────────────────────────────────────────
  useEffect(() => {
    if (!isLoaded || !mapRef.current)
      return;

    const map = mapRef.current;

    /**
     * 기존 라인 제거
     */
    polylineRefs.current.forEach(
      (line) => line.setMap(null),
    );

    polylineRefs.current = [];

    /**
     * bounds
     */
    const bounds =
      new kakao.maps.LatLngBounds();

    /**
     * 실제 구간별 라인
     */
    if (
      routeSegments &&
      routeSegments.length > 0
    ) {
      routeSegments.forEach((segment) => {
        if (
          !segment.coords ||
          segment.coords.length < 2
        ) {
          return;
        }

        const path =
          segment.coords.map((coord) => {
            const latlng =
              new kakao.maps.LatLng(
                coord.lat,
                coord.lng,
              );

            bounds.extend(latlng);

            return latlng;
          });

        /**
         * 색상
         */
        let strokeColor = "#2563eb";

        if (segment.trafficType === 1) {
          strokeColor = "#16a34a";
        }

        if (segment.trafficType === 3) {
          strokeColor = "#6b7280";
        }

        const polyline =
          new kakao.maps.Polyline({
            map,
            path,
            strokeWeight:
              segment.trafficType === 3
                ? 4
                : 6,
            strokeColor,
            strokeOpacity: 0.95,
            strokeStyle:
              segment.trafficType === 3
                ? "shortdash"
                : "solid",
          });

        polylineRefs.current.push(
          polyline,
        );
      });

      /**
       * 자동 fit (안전장치 추가)
       */
      if (routeSegments && routeSegments.length > 0) {
        (map as any).setBounds(bounds);
      }

      return;
    }

    /**
     * fallback (대체 경로)
     */
    if (
      routeCoords &&
      routeCoords.length >= 2
    ) {
      const polyline = drawRouteLine(
        map,
        routeCoords,
      );

      polylineRefs.current.push(
        polyline,
      );

      routeCoords.forEach((coord) => {
        bounds.extend(
          new kakao.maps.LatLng(
            coord.lat,
            coord.lng,
          ),
        );
      });

      // 🚨 [핵심 에러 해결] 여기서 routeSegments가 아니라 routeCoords의 길이를 확인하도록 수정했습니다!
      if (routeCoords && routeCoords.length > 0) {
        (map as any).setBounds(bounds);
      }
    }
  }, [
    isLoaded,
    routeCoords,
    routeSegments,
  ]);

  // ─────────────────────────────────────────
  // 줌 인
  // ─────────────────────────────────────────
  const handleZoomIn = useCallback(() => {
    if (!mapRef.current) return;

    setZoom(
      mapRef.current,
      mapRef.current.getLevel() - 1,
    );
  }, []);

  // ─────────────────────────────────────────
  // 줌 아웃
  // ─────────────────────────────────────────
  const handleZoomOut = useCallback(() => {
    if (!mapRef.current) return;

    setZoom(
      mapRef.current,
      mapRef.current.getLevel() + 1,
    );
  }, []);

  // ─────────────────────────────────────────
  // 현위치 재중심
  // ─────────────────────────────────────────
  const handleRecenter = useCallback(() => {
    if (!mapRef.current) return;

    getCurrentPosition()
      .then((coord) => {
        if (!mapRef.current) return;

        panTo(mapRef.current, coord);

        if (locationMarkerRef.current) {
          locationMarkerRef.current.setPosition(
            new kakao.maps.LatLng(
              coord.lat,
              coord.lng,
            ),
          );
        } else {
          const { marker } =
            addCurrentLocationMarker(
              mapRef.current,
              coord,
            );

          locationMarkerRef.current =
            marker;
        }
      })
      .catch(() =>
        alert(
          "현재 위치를 가져올 수 없습니다.",
        ),
      );
  }, []);

  // ─────────────────────────────────────────
  // 에러
  // ─────────────────────────────────────────
  if (isError) {
    return (
      <div
        className="relative w-full flex flex-col items-center justify-center bg-gray-100 gap-2"
        style={{ height }}
      >
        <span style={{ fontSize: 32 }}>
          🗺️
        </span>

        <p
          className="text-center px-4"
          style={{
            fontSize: 13,
            color: "#6b7280",
          }}
        >
          지도를 불러올 수 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative w-full"
      style={{ height }}
    >
      {/* 지도 */}
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full"
      />

      {/* 로딩 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
          <div className="flex flex-col items-center gap-2">
            <div
              className="w-8 h-8 border-4 border-blue-500 rounded-full"
              style={{
                borderTopColor:
                  "transparent",
                animation:
                  "spin 0.8s linear infinite",
              }}
            />

            <span
              style={{
                fontSize: 12,
                color: "#6b7280",
              }}
            >
              지도 불러오는 중...
            </span>
          </div>

          <style>{`
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      )}

      {/* navigation */}
      {variant === "navigation" && (
        <>
          <div className="absolute left-3 top-3 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-md z-10">
            <span
              style={{
                fontSize: 11,
                color: "#374151",
                fontWeight: 600,
              }}
            >
              ♿ 단차 없는 경로 안내 중
            </span>
          </div>

          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-1 z-10">
            <button
              onClick={handleZoomIn}
              className="w-9 h-9 bg-white border border-gray-300 rounded-lg flex items-center justify-center shadow-sm"
            >
              +
            </button>

            <button
              onClick={handleZoomOut}
              className="w-9 h-9 bg-white border border-gray-300 rounded-lg flex items-center justify-center shadow-sm"
            >
              −
            </button>
          </div>

          <button
            onClick={handleRecenter}
            className="absolute left-3 bottom-3 w-9 h-9 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-md z-10"
          >
            ⌖
          </button>
        </>
      )}
    </div>
  );
}