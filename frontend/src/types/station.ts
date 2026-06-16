export interface ApiError {
  code: string;
  detail: string;
}

export interface ApiResponse<T> {
  data?: T;
  message?: string;
  meta?: Record<string, unknown>;
  success: boolean;
  error?: ApiError;
}

export interface StationDetail {
  address: string;
  line: string;
  oldAddress?: string;
  phone?: string;
  roadAddress?: string;
  stationId: string;
  stationName: string;
}

export interface ElevatorItem {
  districtName: string;
  dongName: string;
  elevatorId: string;
  latitude: number;
  longitude: number;
  nodeType: string;
  stationCode: string;
  stationName: string;
  wkt: string;

  // 현재 화면 UI에서 쓰지만 API 응답에는 없는 값이라 optional 처리
  status?: "정상" | "점검 중";
  exitNumber?: string;
  route?: string;
}

export interface ElevatorData {
  items: ElevatorItem[];
  stationId: string;
  stationName: string;
}

export interface ContactData {
  line: string;
  phone: string;
  stationId: string;
  stationName: string;
}