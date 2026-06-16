// ────────────────────────────────────────────────────────────
//  공유 타입 정의
// ────────────────────────────────────────────────────────────

export type AccessibilityMode = 'wheelchair' | 'visual' | 'senior';

// ── 경로 관련 ──────────────────────────────────────────────

export interface RouteStep {
  icon: string;
  text: string;
  stationLink?: boolean;
}

export interface ScoreFactor {
  label: string;
  score: number;
  desc: string;
}

export interface TopFeature {
  featureName: string;
  importance: number;
}

export interface Route {
  id: number;
  type: string;
  title: string;
  icon: string;
  time: string;
  distance: string;
  transport: string;
  tags: string[];
  steps: RouteStep[];
  caution: string | null;
  aiScore: number;
  aiSummary: string;
  scoreFactors: ScoreFactor[];
  convenienceLevelKo?: string;
  predictedWaitTime?: string;
  confidence?: number;
  explanationSentences?: string[];
  topFeatures?: TopFeature[];
}

// ── 역 관련 ────────────────────────────────────────────────

export interface Line {
  name: string;
  color: string;
}

export interface Elevator {
  id: string;
  label: string;
  floors: string;
  status: '정상' | '점검 중';
}

export interface AccessRouteStep {
  step: number;
  icon: string;
  title: string;
  desc: string;
  tag: string;
}

export interface Station {
  id: string;
  name: string;
  lines: Line[];
  address: string;
  hours: string;
  phone: string;
  disabledPhone: string;
  facilities: string[];
  wheelchairSeats: string[];
  elevators: Elevator[];
  accessRoute: AccessRouteStep[];
}

// ── 검색 결과 ──────────────────────────────────────────────

export interface SearchResult {
  icon: string;
  name: string;
  address: string;
  tag?: string;
}

// ── 내비게이션 스텝 ────────────────────────────────────────

export interface NavStep {
  icon: string;
  direction: string;
  detail: string;
  dist: string;
  type: 'elevator' | 'turn' | 'transit' | 'arrival' | 'walk';
  stationLink: boolean;
}

// ── 주변 접근성 정보 ───────────────────────────────────────

export interface AccessibilityInfo {
  icon: string;
  label: string;
  count: string;
  ok: boolean;
}
