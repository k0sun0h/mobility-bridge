"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  StationDetail,
  ElevatorItem,
  ContactData,
} from "@/types/station";
import { getLineColor } from "@/lib/lineColors";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

function decodeStationPart(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stationApiPath(stationId: string, suffix = "") {
  return `/api/stations/${encodeURIComponent(stationId)}${suffix}`;
}

async function resolveStationId(stationId: string) {
  const [lineHint, ...nameParts] = stationId.split("_");
  const stationName = nameParts.join("_") || stationId;
  const searchUrl = `/api/stations/search?keyword=${encodeURIComponent(
    stationName.replace(/역$/, "")
  )}`;

  try {
    const res = await fetch(searchUrl);
    const json = await res.json();
    const items = json.data?.items ?? [];
    const match = items.find((item: StationDetail) => {
      const sameLine = !lineHint || item.line === lineHint;
      const sameStation =
        item.stationName === stationName ||
        item.stationName.startsWith(stationName) ||
        stationName.startsWith(item.stationName);

      return sameLine && sameStation;
    });

    return match?.stationId as string | undefined;
  } catch {
    return undefined;
  }
}

function LineBadge({ line }: { line: string }) {
  const color = getLineColor(line);
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-sm font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {line}
    </span>
  );
}

function ElevatorCard({
  elevator,
  index,
}: {
  elevator: ElevatorItem;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isChecking = elevator.status === "점검 중";
  const exitNum = elevator.exitNumber ?? `${index + 1}번`;
  const route = elevator.route ?? "지상 ↔ 대합실";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
      <button
        className="w-full flex items-center gap-4 px-4 py-4 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold border-2 flex-shrink-0 ${
            isChecking
              ? "border-orange-400 text-orange-500 bg-orange-50"
              : "border-gray-400 text-gray-700 bg-gray-50"
          }`}
        >
          E
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-base text-gray-900">
              {exitNum} 출구
            </span>
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                isChecking
                  ? "bg-orange-50 text-orange-500"
                  : "bg-green-50 text-green-600"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isChecking ? "bg-orange-400" : "bg-green-500"
                }`}
              />
              {elevator.status ?? "정상"}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{route}</p>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transition-transform flex-shrink-0 ${
            expanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 space-y-1.5 text-sm text-gray-600">
          <div className="flex gap-2">
            <span className="text-gray-400 w-20 flex-shrink-0">엘리베이터 ID</span>
            <span className="font-medium text-gray-800">{elevator.elevatorId}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400 w-20 flex-shrink-0">구분</span>
            <span className="font-medium text-gray-800">{elevator.nodeType}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400 w-20 flex-shrink-0">위치</span>
            <span className="font-medium text-gray-800">
              {elevator.districtName} {elevator.dongName}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-gray-400 w-20 flex-shrink-0">역 코드</span>
            <span className="font-medium text-gray-800">{elevator.stationCode}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** 역사 평면 모식도 (SVG 기반 간략 다이어그램) */
function StationDiagram({
  elevators,
  stationName,
  line,
}: {
  elevators: ElevatorItem[];
  stationName: string;
  line: string;
}) {
  // 엘리베이터를 출구 번호 기준으로 배치 (최대 8개 슬롯 표시)
  const totalSlots = Math.max(8, elevators.length + 4);
  // 엘리베이터가 배치될 슬롯 인덱스 (임의로 배치)
  const elevatorSlots = elevators.map((elv, i) => ({
    slot: Math.floor((i * (totalSlots - 1)) / Math.max(elevators.length - 1, 1)),
    elv,
  }));

  const slotWidth = 70;
  const svgWidth = Math.max(500, totalSlots * slotWidth + 60);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-bold text-gray-700 mb-3">역사 평면 모식도</h3>
      {/* 범례 */}
      <div className="flex items-center gap-4 mb-4 flex-wrap text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 border-2 border-gray-500 rounded-sm bg-white" />
          <span>엘리베이터</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 border-2 border-orange-400 rounded-sm bg-orange-50" />
          <span className="text-orange-500">점검 중</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="30" height="10">
            <line
              x1="0"
              y1="5"
              x2="30"
              y2="5"
              stroke="#666"
              strokeWidth="1.5"
              strokeDasharray="4,3"
            />
          </svg>
          <span>추천 경로</span>
        </div>
      </div>

      {/* 다이어그램 */}
      <div className="overflow-x-auto">
        <svg
          width={svgWidth}
          height={200}
          className="block"
          style={{ minWidth: 320 }}
        >
          {/* 지상 레이블 */}
          <text x="8" y="50" fontSize="11" fill="#888" fontWeight="600">
            지상
          </text>
          {/* 지하 레이블 */}
          <text x="8" y="130" fontSize="11" fill="#888" fontWeight="600">
            지하
          </text>

          {/* 지상-지하 경계선 */}
          <rect x="50" y="70" width={svgWidth - 60} height="16" fill="#e5e7eb" rx="2" />

          {/* 대합실 박스 */}
          <rect
            x="70"
            y="92"
            width={svgWidth - 100}
            height="32"
            fill="white"
            stroke="#d1d5db"
            strokeWidth="1"
            rx="4"
          />
          <text
            x={svgWidth / 2}
            y="113"
            textAnchor="middle"
            fontSize="11"
            fill="#6b7280"
          >
            대합실
          </text>

          {/* 플랫폼 박스 */}
          <rect
            x="70"
            y="140"
            width={svgWidth - 100}
            height="40"
            fill="white"
            stroke="#d1d5db"
            strokeWidth="1"
            rx="4"
          />

          {/* 호선 표시 */}
          <circle cx={svgWidth * 0.3} cy="160" r="4" fill={getLineColor(line)} />
          <text
            x={svgWidth * 0.3 + 8}
            y="164"
            fontSize="10"
            fill={getLineColor(line)}
            fontWeight="bold"
          >
            {line}
          </text>

          {/* 출구 슬롯 */}
          {Array.from({ length: Math.min(totalSlots, 8) }).map((_, i) => {
            const x = 70 + i * slotWidth + slotWidth / 2;
            const label = `${i + 1}번`;
            return (
              <g key={i}>
                <text
                  x={x}
                  y="48"
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b7280"
                >
                  {label}
                </text>
              </g>
            );
          })}

          {/* 엘리베이터 표시 */}
          {elevatorSlots.map(({ slot, elv }, i) => {
            const slotIndex = Math.min(slot, 7);
            const x = 70 + slotIndex * slotWidth + slotWidth / 2;
            const isChecking = elv.status === "점검 중";
            const borderColor = isChecking ? "#f97316" : "#374151";
            const bgColor = isChecking ? "#fff7ed" : "#f9fafb";

            // 지상 엘리베이터 박스
            return (
              <g key={i}>
                <rect
                  x={x - 14}
                  y="20"
                  width="28"
                  height="22"
                  rx="4"
                  fill={bgColor}
                  stroke={borderColor}
                  strokeWidth="1.5"
                />
                <text
                  x={x}
                  y="36"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="bold"
                  fill={isChecking ? "#f97316" : "#374151"}
                >
                  E
                </text>

                {/* 추천 경로 점선 */}
                <line
                  x1={x}
                  y1="42"
                  x2={x}
                  y2="92"
                  stroke="#9ca3af"
                  strokeWidth="1.5"
                  strokeDasharray="4,3"
                />

                {/* 지하 엘리베이터 박스 */}
                <rect
                  x={x - 14}
                  y="110"
                  width="28"
                  height="22"
                  rx="4"
                  fill={bgColor}
                  stroke={borderColor}
                  strokeWidth="1.5"
                />
                <text
                  x={x}
                  y="126"
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="bold"
                  fill={isChecking ? "#f97316" : "#374151"}
                >
                  E
                </text>
              </g>
            );
          })}

          {/* 엘리베이터 없을 때 안내 */}
          {elevators.length === 0 && (
            <text
              x={svgWidth / 2}
              y="160"
              textAnchor="middle"
              fontSize="12"
              fill="#9ca3af"
            >
              엘리베이터 정보 없음
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}

export default function StationDetailClient() {
  const router = useRouter();
  const params = useParams<{ stationId?: string | string[] }>();
  const routeStationId = Array.isArray(params.stationId)
    ? params.stationId[0]
    : params.stationId;
  const stationId = routeStationId ? decodeStationPart(routeStationId) : "";
  const [apiStationId, setApiStationId] = useState(stationId);

  const [stationState, setStationState] = useState<FetchState<StationDetail>>({
    data: null,
    loading: true,
    error: null,
  });
  const [elevatorState, setElevatorState] = useState<
    FetchState<ElevatorItem[]>
  >({
    data: null,
    loading: true,
    error: null,
  });
  const [contactState, setContactState] = useState<FetchState<ContactData>>({
    data: null,
    loading: true,
    error: null,
  });

  const fetchStation = useCallback(async () => {
    if (!apiStationId) {
      setStationState({
        data: null,
        loading: false,
        error: "역 정보 주소가 올바르지 않습니다.",
      });
      return;
    }

    setStationState({ data: null, loading: true, error: null });
    try {
      const res = await fetch(stationApiPath(apiStationId));
      const json = await res.json();
      if (!json.success) {
        const resolvedStationId = await resolveStationId(apiStationId);
        if (resolvedStationId && resolvedStationId !== apiStationId) {
          setApiStationId(resolvedStationId);
          return;
        }

        setStationState({
          data: null,
          loading: false,
          error: json.message ?? "역 정보를 불러올 수 없습니다.",
        });
      } else {
        setStationState({ data: json.data, loading: false, error: null });
      }
    } catch {
      setStationState({
        data: null,
        loading: false,
        error: "네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
      });
    }
  }, [apiStationId]);

  const fetchElevators = useCallback(async () => {
    if (!apiStationId) {
      setElevatorState({ data: [], loading: false, error: null });
      return;
    }

    setElevatorState({ data: null, loading: true, error: null });
    try {
      const res = await fetch(
        stationApiPath(apiStationId, "/elevators")
      );
      const json = await res.json();
      if (!json.success) {
        setElevatorState({
          data: null,
          loading: false,
          error: json.message ?? "엘리베이터 정보를 불러올 수 없습니다.",
        });
      } else {
        setElevatorState({
          data: json.data?.items ?? [],
          loading: false,
          error: null,
        });
      }
    } catch {
      setElevatorState({
        data: null,
        loading: false,
        error: "네트워크 오류가 발생했습니다.",
      });
    }
  }, [apiStationId]);

  const fetchContact = useCallback(async () => {
    if (!apiStationId) {
      setContactState({ data: null, loading: false, error: null });
      return;
    }

    setContactState({ data: null, loading: true, error: null });
    try {
      const res = await fetch(
        stationApiPath(apiStationId, "/contact")
      );
      const json = await res.json();
      if (!json.success) {
        setContactState({
          data: null,
          loading: false,
          error: json.message ?? "전화번호 정보를 불러올 수 없습니다.",
        });
      } else {
        setContactState({ data: json.data, loading: false, error: null });
      }
    } catch {
      setContactState({
        data: null,
        loading: false,
        error: "네트워크 오류가 발생했습니다.",
      });
    }
  }, [apiStationId]);

  useEffect(() => {
    fetchStation();
    fetchElevators();
    fetchContact();
  }, [fetchStation, fetchElevators, fetchContact]);

  useEffect(() => {
    setApiStationId(stationId);
  }, [stationId]);

  const station = stationState.data;
  const elevators = elevatorState.data ?? [];
  const contact = contactState.data;

  // 전체 로딩 중
  const isLoading =
    stationState.loading && elevatorState.loading && contactState.loading;

  // 핵심 데이터(역 정보) 오류
  const coreError = stationState.error;

  const fallbackStationName = decodeStationPart(
    stationId.split("_").slice(1).join("_") || stationId
  );
  const stationName = station?.stationName ?? fallbackStationName;
  const line = station?.line ?? (stationId.includes("_") ? stationId.split("_")[0] : "");
  const phone = contact?.phone ?? station?.phone ?? "";

  // 접근성 편의시설 태그 (엘리베이터 수 기반으로 생성)
  const accessibilityTags: string[] = [];
  if (elevators.length > 0) {
    accessibilityTags.push(`엘리베이터 ${elevators.length}대`);
  }
  accessibilityTags.push("장애인 화장실", "점자 블록", "시각장애 음성 안내", "휠체어 대여");

  // 휠체어 좌석 정보 (예시)
  const wheelchairSeats = ["1-4번", "4-4번", "7-1번", "10-1번"];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="flex items-center gap-3 px-4 py-4 max-w-2xl mx-auto">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors flex-shrink-0"
            aria-label="뒤로 가기"
          >
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            {stationState.loading ? (
              <div className="h-7 w-32 bg-gray-200 rounded-lg animate-pulse" />
            ) : (
              <>
                <h1 className="text-xl font-bold text-gray-900 flex-shrink-0">
                  {stationName}역
                </h1>
                {line && <LineBadge line={line} />}
              </>
            )}
          </div>
        </div>
      </header>

      {/* 콘텐츠 */}
      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3"
              >
                <div className="h-4 bg-gray-200 rounded animate-pulse w-1/4" />
                <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && coreError && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-6 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <p className="font-bold text-red-700 text-base mb-1">
              데이터 로딩 실패
            </p>
            <p className="text-sm text-red-600 mb-4">{coreError}</p>
            <button
              onClick={() => {
                fetchStation();
                fetchElevators();
                fetchContact();
              }}
              className="px-5 py-2.5 bg-red-500 text-white rounded-xl text-sm font-semibold hover:bg-red-600 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {!isLoading && !coreError && (
          <>
            {/* 역 기본 정보 */}
            <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-4">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                역 기본 정보
              </h2>

              {/* 주소 */}
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5 flex-shrink-0">📍</span>
                <div>
                  <p className="text-sm text-gray-500 mb-0.5">주소</p>
                  <p className="text-base font-medium text-gray-900">
                    {station?.roadAddress ||
                      station?.address ||
                      "주소 정보를 불러오는 중..."}
                  </p>
                </div>
              </div>

              {/* 운영시간 */}
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5 flex-shrink-0">🕐</span>
                <div>
                  <p className="text-sm text-gray-500 mb-0.5">운영시간</p>
                  <p className="text-base font-medium text-gray-900">
                    05:30 ~ 24:00 (막차 기준)
                  </p>
                </div>
              </div>

              {/* 접근성 편의시설 */}
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5 flex-shrink-0">♿</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-2">접근성 편의시설</p>
                  <div className="flex flex-wrap gap-2">
                    {accessibilityTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium border border-blue-100"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 휠체어 전용석 */}
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5 flex-shrink-0">🪑</span>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-2">휠체어 전용석</p>
                  <div className="flex flex-wrap gap-2">
                    {wheelchairSeats.map((seat) => (
                      <span
                        key={seat}
                        className="px-3 py-1.5 rounded-xl bg-sky-50 text-sky-700 text-sm font-semibold border border-sky-200"
                      >
                        {seat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* 연락처 */}
            <section className="rounded-2xl bg-white border border-gray-200 p-5 space-y-3">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
                연락처
              </h2>

              {contactState.loading ? (
                <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ) : contactState.error ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
                  전화번호 정보를 불러올 수 없습니다.
                </div>
              ) : (
                <a
                  href={`tel:${phone}`}
                  className="flex items-center gap-4 rounded-xl bg-gray-50 border border-gray-200 px-4 py-4 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-gray-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">역 대표번호</p>
                    <p className="text-gray-600 text-sm">
                      {phone || "정보 없음"}
                    </p>
                  </div>
                </a>
              )}
            </section>

            {/* 역사 평면 모식도 */}
            {elevatorState.loading ? (
              <div className="rounded-2xl bg-white border border-gray-200 p-5">
                <div className="h-4 w-32 bg-gray-200 rounded animate-pulse mb-4" />
                <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
              </div>
            ) : elevatorState.error ? (
              <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
                ⚠️ 엘리베이터 정보를 불러올 수 없습니다. {elevatorState.error}
              </div>
            ) : (
              <StationDiagram
                elevators={elevators}
                stationName={stationName}
                line={line}
              />
            )}

            {/* 엘리베이터 목록 */}
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide px-1">
                엘리베이터 상세 정보
              </h2>

              {elevatorState.loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-2xl bg-white border border-gray-200 p-4 flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded animate-pulse w-1/3" />
                      <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                    </div>
                  </div>
                ))
              ) : elevators.length === 0 ? (
                <div className="rounded-2xl bg-white border border-gray-200 p-6 text-center text-gray-500 text-sm">
                  이 역의 엘리베이터 정보가 없습니다.
                </div>
              ) : (
                elevators.map((elv, i) => (
                  <ElevatorCard key={elv.elevatorId} elevator={elv} index={i} />
                ))
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
