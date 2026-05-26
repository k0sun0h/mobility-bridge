// ────────────────────────────────────────────────────────────
//  카카오맵 SDK TypeScript 타입 선언
//  필요한 부분만 선언 — 추가 API 사용 시 확장하세요.
// ────────────────────────────────────────────────────────────

declare namespace kakao {
  namespace maps {
    // ── 초기화 ────────────────────────────────────────────
    function load(callback: () => void): void;

    // ── 지도 ──────────────────────────────────────────────
    class Map {
      constructor(container: HTMLElement, options: MapOptions);
      setCenter(latlng: LatLng): void;
      getCenter(): LatLng;
      setLevel(level: number, options?: { animate?: boolean }): void;
      getLevel(): number;
      panTo(latlng: LatLng): void;
      relayout(): void;
    }

    interface MapOptions {
      center: LatLng;
      level: number;
      mapTypeId?: MapTypeId;
    }

    // ── 좌표 ──────────────────────────────────────────────
    class LatLng {
      constructor(lat: number, lng: number);
      getLat(): number;
      getLng(): number;
    }

    class LatLngBounds {
      constructor(sw?: LatLng, ne?: LatLng);
      extend(latlng: LatLng): void;
    }

    // ── 마커 ──────────────────────────────────────────────
    class Marker {
      constructor(options: MarkerOptions);
      setMap(map: Map | null): void;
      setPosition(latlng: LatLng): void;
      getPosition(): LatLng;
    }

    interface MarkerOptions {
      position: LatLng;
      map?: Map;
      image?: MarkerImage;
      title?: string;
      zIndex?: number;
    }

    class MarkerImage {
      constructor(src: string, size: Size, options?: MarkerImageOptions);
    }

    interface MarkerImageOptions {
      offset?: Point;
      spriteSize?: Size;
      spriteOrigin?: Point;
    }

    // ── 오버레이 ───────────────────────────────────────────
    class CustomOverlay {
      constructor(options: CustomOverlayOptions);
      setMap(map: Map | null): void;
      setPosition(latlng: LatLng): void;
      setContent(content: string | HTMLElement): void;
    }

    interface CustomOverlayOptions {
      position: LatLng;
      content: string | HTMLElement;
      map?: Map;
      zIndex?: number;
      yAnchor?: number;
    }

    // ── 폴리라인 ───────────────────────────────────────────
    class Polyline {
      constructor(options: PolylineOptions);
      setMap(map: Map | null): void;
      getLength(): number;
    }

    interface PolylineOptions {
      path: LatLng[];
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      strokeStyle?: 'solid' | 'shortdash' | 'shortdot' | 'dot' | 'dash';
      map?: Map;
    }

    // ── 원 ────────────────────────────────────────────────
    class Circle {
      constructor(options: CircleOptions);
      setMap(map: Map | null): void;
    }

    interface CircleOptions {
      center: LatLng;
      radius: number;
      strokeWeight?: number;
      strokeColor?: string;
      strokeOpacity?: number;
      fillColor?: string;
      fillOpacity?: number;
      map?: Map;
    }

    // ── 인포윈도우 ─────────────────────────────────────────
    class InfoWindow {
      constructor(options: InfoWindowOptions);
      open(map: Map, marker?: Marker): void;
      close(): void;
    }

    interface InfoWindowOptions {
      content: string | HTMLElement;
      removable?: boolean;
      zIndex?: number;
    }

    // ── 크기 / 포인트 ──────────────────────────────────────
    class Size {
      constructor(width: number, height: number);
    }

    class Point {
      constructor(x: number, y: number);
    }

    // ── 지도 타입 ──────────────────────────────────────────
    enum MapTypeId {
      ROADMAP = 1,
      SKYVIEW = 2,
      HYBRID = 3,
    }

    // ── 이벤트 ────────────────────────────────────────────
    namespace event {
      function addListener(
        target: Map | Marker,
        type: string,
        handler: (e?: MouseEvent) => void,
      ): void;
      function removeListener(
        target: Map | Marker,
        type: string,
        handler: (e?: MouseEvent) => void,
      ): void;
    }

    // ── 장소 검색 / 주소 변환 (services 라이브러리) ───────────
    namespace services {
      class Places {
        keywordSearch(
          keyword: string,
          callback: (result: PlaceResult[], status: Status) => void,
          options?: KeywordSearchOptions,
        ): void;

        categorySearch(
          code: string,
          callback: (result: PlaceResult[], status: Status) => void,
          options?: CategorySearchOptions,
        ): void;
      }

      // ✅ 추가: 좌표 → 주소 변환
      class Geocoder {
        coord2Address(
          lng: number,
          lat: number,
          callback: (result: CoordToAddressResult[], status: Status) => void,
        ): void;
      }

      interface PlaceResult {
        id: string;
        place_name: string;
        address_name: string;
        road_address_name: string;
        category_name: string;
        phone: string;
        x: string; // lng
        y: string; // lat
      }

      // ✅ 추가: coord2Address 응답 타입
      interface CoordToAddressResult {
        road_address: {
          address_name: string;
        } | null;
        address: {
          address_name: string;
        };
      }

      interface KeywordSearchOptions {
        x?: string | number;
        y?: string | number;
        radius?: number;
        size?: number;
      }

      interface CategorySearchOptions {
        location?: kakao.maps.LatLng;
        radius?: number;
        size?: number;
      }

      enum Status {
        OK = 'OK',
        ZERO_RESULT = 'ZERO_RESULT',
        ERROR = 'ERROR',
      }
    }
  }
}
