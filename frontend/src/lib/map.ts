// ──────────────────────────────────────────────────────────-
//
//  src/lib/map.ts
// ────────────────────────────────────────────────────────────

export interface Coordinate {
  lat: number;
  lng: number;
}

/** 두 좌표 간 직선 거리(m) 계산 — Haversine 공식 */
export function haversineDistance(a: Coordinate, b: Coordinate): number {
  const R = 6371000;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** 현재 GPS 위치 가져오기 (브라우저 Geolocation API 래퍼) */
export function getCurrentPosition(): Promise<Coordinate> {
  return new Promise((resolve, reject) => {

    // ✅ 외부 IP API 직접 호출 제거 → Next.js API Route 프록시로 교체 (CORS 해결)
    const fallbackToIpLocation = async () => {
      try {
        console.warn('⚠️ CoreLocation 실패 → IP 기반 위치로 최종 폴백합니다.');
        const res = await fetch('/api/location'); // 서버 사이드 프록시
        const data = await res.json();
        if (data.lat && data.lng) {
          console.info('✅ IP 기반 위치 성공 (정밀도 낮음, 약 도시 단위)');
          resolve({ lat: data.lat, lng: data.lng });
        } else {
          reject(new Error('IP 기반 위치도 실패했습니다. 네트워크를 확인해 주세요.'));
        }
      } catch {
        reject(new Error('위치를 가져올 수 없습니다. 네트워크를 확인해 주세요.'));
      }
    };

    if (!navigator.geolocation) {
      fallbackToIpLocation();
      return;
    }

    const errorMessages: Record<number, string> = {
      1: '위치 권한이 거부되었습니다. 브라우저 또는 시스템 설정에서 위치 권한을 허용해 주세요.',
      2: 'GPS 신호를 찾을 수 없습니다.',
      3: '위치 요청이 시간 초과되었습니다.',
    };

    // 1차: 고정밀 GPS
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // 2차: Wi-Fi/IP 기반 (enableHighAccuracy: false)
        console.warn('⚠️ GPS 실패 → Wi-Fi/IP 기반 위치로 재시도합니다.');
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => {
            console.warn(`⚠️ Wi-Fi 위치도 실패 (code ${err.code}: ${errorMessages[err.code]}) → IP 폴백 시도`);
            fallbackToIpLocation();
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
        );
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    );
  });
}

/**
 * 카카오맵 초기화
 * @param container - 지도를 렌더링할 HTMLElement
 * @param center    - 초기 중심 좌표
 * @param zoom      - 초기 줌 레벨 (1~14, 낮을수록 확대)
 */
export function initMap(
  container: HTMLElement,
  center: Coordinate,
  zoom = 3,
): kakao.maps.Map {
  const options: kakao.maps.MapOptions = {
    center: new kakao.maps.LatLng(center.lat, center.lng),
    level: zoom,
  };
  return new kakao.maps.Map(container, options);
}

/**
 * 현위치 마커 생성
 */
export function addCurrentLocationMarker(
  map: kakao.maps.Map,
  coord: Coordinate,
): { marker: kakao.maps.CustomOverlay } {
  const content = `
    <div style="
      width:20px; height:20px;
      background:#2563eb;
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 2px 8px rgba(37,99,235,0.5);
    "></div>
  `;
  const marker = new kakao.maps.CustomOverlay({
    position: new kakao.maps.LatLng(coord.lat, coord.lng),
    content,
    map,
    yAnchor: 0.5,
    zIndex: 10,
  });
  return { marker };
}

/**
 * 경로 폴리라인 그리기
 * @returns 생성된 Polyline 인스턴스 (나중에 setMap(null)로 제거 가능)
 */
export function drawRouteLine(
  map: kakao.maps.Map,
  coordinates: Coordinate[],
  color = '#2563eb',
): kakao.maps.Polyline {
  const path = coordinates.map(
    (c) => new kakao.maps.LatLng(c.lat, c.lng),
  );
  const polyline = new kakao.maps.Polyline({
    path,
    strokeWeight: 5,
    strokeColor: color,
    strokeOpacity: 0.85,
    strokeStyle: 'solid',
    map,
  });
  return polyline;
}

/**
 * 지도 중심을 특정 좌표로 부드럽게 이동
 */
export function panTo(map: kakao.maps.Map, coord: Coordinate): void {
  map.panTo(new kakao.maps.LatLng(coord.lat, coord.lng));
}

/**
 * 줌 레벨 변경
 */
export function setZoom(map: kakao.maps.Map, level: number): void {
  map.setLevel(level, { animate: true });
}
