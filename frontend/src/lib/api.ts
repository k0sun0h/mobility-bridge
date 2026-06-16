
// ────────────────────────────────────────────────────────────
//  Mobility Bridge — API 레이어
//   
// ────────────────────────────────────────────────────────────

import type {
  Route,
  Station,
  Elevator,
  SearchResult,
  AccessibilityMode,
} from '../types';

// ── 기본 설정 ──────────────────────────────────────────────
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// ── 공통 fetch 래퍼 ────────────────────────────────────────
async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`[API ${res.status}] ${url}`);
  }
  return res.json() as Promise<T>;
}

// ── 응답 → 프론트 타입 어댑터 ──────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adaptElevator(r: any): Elevator {
  return {
    id:     r.id          ?? r.elevator_id    ?? r.elevatorId    ?? String(r.no ?? ''),
    label:  r.label       ?? r.location_nm    ?? r.locationNm    ?? r.name     ?? '',
    floors: r.floors      ?? r.updn_nm        ?? r.updnNm        ?? r.floor    ?? '',
    status: (r.status     ?? r.work_dc        ?? r.workDc        ?? '정상') === '정상' ? '정상' : '점검 중',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adaptStation(r: any, elevators?: Elevator[]): Station {
  return {
    id:            r.id            ?? r.station_id    ?? r.stationId    ?? '',
    name:          r.name          ?? r.station_nm    ?? r.stationNm    ?? r.stationName ?? '',
    lines: (r.lines ?? r.line_info ?? r.lineInfo ?? []).map((l: any) => ({
      name:  l.name  ?? l.line_nm  ?? l.lineNm  ?? '',
      color: l.color ?? l.line_color ?? l.lineColor ?? '#6b7280',
    })),
    address:       r.address       ?? r.addr          ?? '',
    hours:         r.hours         ?? r.operating_hours ?? r.operatingHours ?? '',
    phone:         r.phone         ?? r.tel            ?? r.telNo         ?? '',
    disabledPhone: r.disabledPhone ?? r.disabled_phone ?? r.welfarePhone   ?? '1588-5678',
    facilities:    r.facilities    ?? r.facility_list  ?? r.facilityList   ?? [],
    wheelchairSeats: r.wheelchairSeats ?? r.wheelchair_seats ?? r.wcSeats ?? [],
    elevators:     elevators       ?? (r.elevators     ?? r.elevator_list ?? r.elevatorList ?? []).map(adaptElevator),
    accessRoute:   r.accessRoute   ?? r.access_route   ?? r.accessRoute   ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function adaptSearchResult(r: any): SearchResult {
  const isStation =
    r.type === 'station' ||
    r.category === '지하철역' ||
    r.station_nm !== undefined ||
    r.stationNm !== undefined ||
    r.stationName !== undefined;

  const name    = r.name    ?? r.station_nm  ?? r.stationNm  ?? r.stationName ?? r.place_name ?? '';
  const address = r.address ?? r.addr        ?? r.road_address_name ?? r.addressName ?? '';
  const tag     = r.tag     ?? r.accessibility_tag ?? (isStation ? '♿ 접근 가능' : undefined);

  return {
    icon:    isStation ? '🚉' : (r.icon ?? '📍'),
    name,
    address,
    tag,
  };
}

// ── 목(mock) 데이터 — API 미응답 시 폴백 ──────────────────

const MOCK_ROUTES: Route[] = [
  {
    id: 1,
    type: '추천',
    title: '휠체어 접근 경로',
    icon: '♿',
    time: '23분',
    distance: '1.4km',
    transport: '도보 + 지하철',
    tags: ['엘리베이터 있음', '단차 없음'],
    steps: [
      { icon: '🚶', text: '도보 5분 (350m) — 완전 평탄', stationLink: false },
      { icon: '🛗', text: '2호선 잠실역 엘리베이터 이용', stationLink: true },
      { icon: '🚇', text: '지하철 2정거장 (8분)', stationLink: false },
      { icon: '🛗', text: '강남역 엘리베이터 출구 5번', stationLink: false },
      { icon: '🚶', text: '도보 3분 (200m)', stationLink: false },
    ],
    caution: null,
    aiScore: 92,
    aiSummary: '휠체어 사용자에게 가장 안전하고 편리한 경로입니다. 전 구간 엘리베이터가 확보되어 있고 단차가 없어 이동 부담이 최소화됩니다.',
    scoreFactors: [
      { label: '접근성', score: 96, desc: '전 구간 엘리베이터·경사로 완비' },
      { label: '안전성', score: 90, desc: '공사·위험 구간 없음' },
      { label: '편의시설', score: 95, desc: '장애인 화장실·휴식 공간 2곳' },
      { label: '소요시간', score: 82, desc: '평균 대비 +3분, 안전 우선' },
    ],
  },
  {
    id: 2,
    type: '빠름',
    title: '저상버스 경로',
    icon: '🚌',
    time: '18분',
    distance: '2.1km',
    transport: '도보 + 버스',
    tags: ['저상버스', '경사로 있음'],
    steps: [
      { icon: '🚶', text: '도보 2분 (150m)' },
      { icon: '🚌', text: '342번 저상버스 탑승 (10분)' },
      { icon: '🚶', text: '도보 3분 (200m)' },
    ],
    caution: '⚠️ 잠실대로 공사 구간 주의',
    aiScore: 74,
    aiSummary: '가장 빠른 경로이나 공사 구간과 경사로가 포함되어 휠체어 사용 시 주의가 필요합니다.',
    scoreFactors: [
      { label: '접근성', score: 68, desc: '일부 구간 경사로·단차 존재' },
      { label: '안전성', score: 62, desc: '잠실대로 공사 구간 통과' },
      { label: '편의시설', score: 70, desc: '버스 정류장 근처 편의시설 제한' },
      { label: '소요시간', score: 96, desc: '전 경로 중 가장 빠름' },
    ],
  },
];

// ── API 함수 ───────────────────────────────────────────────

/**
 * 역 검색
 * GET /api/stations/search?keyword={query}
 */
export async function searchStations(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  try {
    const raw = await apiFetch<unknown[]>(
      `/api/stations/search?keyword=${encodeURIComponent(query)}`, // ✅ keyword=, /api/ 추가
    );
    return raw.map(adaptSearchResult);
  } catch (err) {
    console.warn('[API] searchStations 실패 → mock 반환', err);
    return [
      { icon: '🚉', name: `${query}역`, address: '지하철 2호선', tag: '♿ 접근 가능' },
      { icon: '🏥', name: `${query} 병원`, address: '서울 강남구 테헤란로 123', tag: '♿ 접근 가능' },
      { icon: '🏢', name: `${query} 센터`, address: '서울 강남구 역삼동 456', tag: '🛗 엘리베이터' },
    ];
  }
}

/**
 * 역 상세 조회
 * GET /api/stations/{stationId}
 */
export async function fetchStation(stationId: string): Promise<Station> {
  try {
    const raw = await apiFetch<unknown>(
      `/api/stations/${encodeURIComponent(stationId)}`, // ✅ /api/ 추가
    );
    return adaptStation(raw);
  } catch (err) {
    console.warn('[API] fetchStation 실패 → mock 반환', err);
    return MOCK_STATION_FALLBACK;
  }
}

/**
 * 엘리베이터 목록 조회
 * GET /api/stations/{stationId}/elevators
 */
export async function fetchElevators(stationId: string): Promise<Elevator[]> {
  try {
    const raw = await apiFetch<unknown[]>(
      `/api/stations/${encodeURIComponent(stationId)}/elevators`, // ✅ /api/ 추가
    );
    return raw.map(adaptElevator);
  } catch (err) {
    console.warn('[API] fetchElevators 실패 → fetchStation에서 추출 시도', err);
    const station = await fetchStation(stationId);
    return station.elevators;
  }
}

/**
 * 역 대표번호 조회
 * GET /api/stations/{stationId}/contact
 * 응답: { stationName: string, telNo: string }
 */
export async function fetchStationPhone(
  stationId: string,
): Promise<{ phone: string; disabledPhone: string }> {
  try {
    const raw = await apiFetch<{ stationName?: string; telNo?: string }>(
      `/api/stations/${encodeURIComponent(stationId)}/contact`, // ✅ phone → contact
    );
    return {
      phone:         raw.telNo ?? '', // ✅ telNo 로 변경
      disabledPhone: '1588-5678',
    };
  } catch (err) {
    console.warn('[API] fetchStationPhone 실패 → fetchStation에서 추출', err);
    const station = await fetchStation(stationId);
    return { phone: station.phone, disabledPhone: station.disabledPhone };
  }
}

/**
 * 경로 목록 조회
 * TODO(api): GET /api/routes?origin=...&dest=...&mode=...
 */
export async function fetchRoutes(
  _origin: string,
  _destination: string,
  _mode: AccessibilityMode,
): Promise<Route[]> {
  await delay(300);
  return MOCK_ROUTES;
}

/**
 * 경로 평가 제출
 * TODO(api): POST /api/reviews
 */
export async function submitReview(payload: {
  routeId: number;
  rating: number;
  issues: string[];
  comment: string;
}): Promise<void> {
  await delay(300);
  console.info('[mock] review submitted', payload);
}

// ── 내부 헬퍼 ─────────────────────────────────────────────

function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// ── mock 폴백 데이터 ───────────────────────────────────────
const MOCK_STATION_FALLBACK: Station = {
  id: 'jamsil',
  name: '잠실역',
  lines: [
    { name: '2호선', color: '#2DB400' },
    { name: '8호선', color: '#E6186C' },
  ],
  address: '서울특별시 송파구 올림픽로 지하 265',
  hours: '05:30 ~ 24:00 (막차 기준)',
  phone: '02-6110-2161',
  disabledPhone: '1588-5678',
  facilities: ['엘리베이터 4대', '장애인 화장실 2곳', '점자 블록', '시각장애 음성 안내', '휠체어 대여'],
  wheelchairSeats: ['1-4', '4-4', '7-1', '10-1'],
  elevators: [
    { id: 'EV-1', label: '3번 출구', floors: '지상 ↔ 대합실', status: '정상' },
    { id: 'EV-2', label: '7번 출구', floors: '지상 ↔ 대합실', status: '정상' },
    { id: 'EV-3', label: '대합실 A', floors: '대합실 ↔ 2호선 승강장', status: '정상' },
    { id: 'EV-4', label: '대합실 B', floors: '대합실 ↔ 8호선 승강장', status: '점검 중' },
  ],
  accessRoute: [
    { step: 1, icon: '🚶', title: '3번 출구 접근', desc: '역 외부 3번 출구 앞 평탄 보도 이용', tag: '지상' },
    { step: 2, icon: '🛗', title: 'EV-1 엘리베이터 탑승', desc: '지상 → 대합실 (약 20초)', tag: '엘리베이터' },
    { step: 3, icon: '🎫', title: '교통카드 태그 후 개찰구 통과', desc: '장애인 전용 넓은 게이트 이용 (우측)', tag: '대합실' },
    { step: 4, icon: '🛗', title: 'EV-3 엘리베이터 탑승', desc: '대합실 → 2호선 승강장 (약 30초)', tag: '엘리베이터' },
    { step: 5, icon: '🚇', title: '2호선 내선 방향 탑승', desc: '스크린도어 3·4번 칸 — 휠체어 공간 있음', tag: '승강장' },
  ],
};
