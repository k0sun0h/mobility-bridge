// ────────────────────────────────────────────────────────────
//  app/explain/page.tsx
// ────────────────────────────────────────────────────────────
'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { MapView } from '../../components/MapView';
import { useMobilityStore } from '../../store/useMobilityStore';
import { generateFullMobilityRoute } from '../../lib/routeService';
import type { Coordinate } from '../../lib/map';
import { getLineDisplay, normalizeLineName } from '../../lib/lineColors';
import type { ElevatorItem } from '../../types/station';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://blinking-item-process.ngrok-free.dev';

const BUS_TYPE_LABEL: Record<number, string> = {
  1: '일반', 2: '좌석', 3: '마을', 4: '직행', 5: '공항',
  6: '간선급행', 11: '심야', 12: '시내', 13: '급행',
};
const BUS_TYPE_COLOR: Record<number, string> = {
  1: '#1d4ed8', 2: '#0891b2', 3: '#16a34a', 4: '#dc2626',
  5: '#7c3aed', 6: '#ea580c', 11: '#374151', 12: '#1d4ed8', 13: '#dc2626',
};

// ─────────────────────────────────────────
// 좌표 유틸
// ─────────────────────────────────────────

/** ODsay linestring 파싱 ("lng,lat lng,lat ...") */
function parseCoordinateString(pathStr: string): Coordinate[] {
  if (!pathStr || typeof pathStr !== 'string') return [];
  return pathStr
    .trim()
    .split(' ')
    .map((pair) => {
      const parts = pair.split(',');
      if (parts.length < 2) return null;
      const a = Number(parts[0]);
      const b = Number(parts[1]);
      if (isNaN(a) || isNaN(b)) return null;
      // 한국 경도 ~124~133, 위도 ~33~39
      const lng = a > 90 ? a : b;
      const lat = a > 90 ? b : a;
      if (lat < 33 || lat > 39 || lng < 124 || lng > 133) return null;
      return { lat, lng };
    })
    .filter(Boolean) as Coordinate[];
}

/** 두 좌표 간 거리 (km) */
function distanceKm(a: Coordinate, b: Coordinate): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
    Math.cos((b.lat * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** 중복 + 아웃라이어 동시 제거 */
function cleanCoords(coords: Coordinate[], maxKm = 1.5): Coordinate[] {
  if (coords.length === 0) return [];
  const result: Coordinate[] = [coords[0]];
  for (let i = 1; i < coords.length; i++) {
    const prev = result[result.length - 1];
    const cur  = coords[i];
    if (cur.lat === prev.lat && cur.lng === prev.lng) continue;
    if (distanceKm(prev, cur) > maxKm) continue;
    result.push(cur);
  }
  return result;
}

// ─────────────────────────────────────────
// 접근성 관련 유틸
// ─────────────────────────────────────────

interface AccessibilityRouteState {
  loading: boolean;
  items: ElevatorItem[];
  error: string | null;
}

interface AccessibilityStep {
  icon: string;
  title: string;
  desc: string;
  tag: string;
}

function getWheelchairSpaceGuide(segment: any) {
  const door = String(segment?.door ?? '').trim();
  const hasFastTransfer = door && door !== 'null' && door !== 'undefined';
  if (hasFastTransfer) {
    return `빠른환승 위치 ${door} 근처에서는 혼잡할 수 있어, 승강장 바닥의 휠체어 탑승 위치 표지를 우선 확인`;
  }
  return '승강장 바닥의 휠체어 탑승 위치 표지 확인 후, 열차 내 휠체어 전용 공간으로 이동';
}

function normalizeSubwayLineName(raw: unknown): string | undefined {
  return normalizeLineName(String(raw ?? '')) || undefined;
}

function toStationId(segment: any): string | undefined {
  let rawLine = String(segment?.lane?.[0]?.name || '').trim();
  rawLine = rawLine.replace(/수도권\s*/g, '').replace(/\(.*\)/g, '').trim();
  const lineName = normalizeSubwayLineName(rawLine) || rawLine;
  const stationName = String(segment?.startName ?? '').trim().replace(/역$/, '');
  if (!lineName || !stationName) return undefined;
  return `${lineName}_${stationName}`;
}

function getSubwayLineDisplay(segment: any) {
  const lane = segment?.lane?.[0];
  return getLineDisplay(lane?.name ?? lane?.subwayCode);
}

function buildAccessibilitySteps(segment: any, elevators: ElevatorItem[]): AccessibilityStep[] {
  const firstElevator = elevators[0];
  const elevatorLabel = firstElevator
    ? `EV-${String(firstElevator.elevatorId).replace(/\.0$/, '')}`
    : 'EV';
  const area = firstElevator
    ? [firstElevator.districtName, firstElevator.dongName].filter(Boolean).join(' ')
    : '';
  const endName = String(segment?.endName ?? '').trim();
  let rawLine = String(segment?.lane?.[0]?.name || '').replace(/수도권\s*/g, '').replace(/\(.*\)/g, '').trim();
  const lineName = normalizeSubwayLineName(rawLine) ?? rawLine ?? '지하철';
  const way = segment?.way ? `${segment.way}행 방면` : '승강장 방면';
  const wheelchairSpaceGuide = getWheelchairSpaceGuide(segment);

  return [
    { icon: '🚶', title: `${segment?.startName ?? '역'}역 접근`, desc: area ? `${area} 인근 보행로에서 엘리베이터 위치로 이동` : '역 외부 보행로에서 엘리베이터 위치로 이동', tag: '지상' },
    { icon: '🛗', title: `${elevatorLabel} 엘리베이터 이용`, desc: elevators.length > 0 ? `확인된 엘리베이터 ${elevators.length}대 중 가까운 위치 이용` : '역내 엘리베이터 위치 확인 후 이용', tag: '엘리베이터' },
    { icon: '🎫', title: '개찰구 통과', desc: '교통카드 태그 후 넓은 게이트 우선 이용', tag: '대합실' },
    { icon: '🚇', title: `${lineName} ${way} 탑승`, desc: `${wheelchairSpaceGuide}${endName ? ` · ${endName}역 하차` : ''}`, tag: '승강장' },
  ];
}

function AccessibilityRoutePanel({ segment, state, color }: { segment: any; state?: AccessibilityRouteState; color: string }) {
  const [open, setOpen] = useState(false);
  if (!state) {
    return <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5"><div className="h-3 w-36 rounded bg-gray-200 animate-pulse" /></div>;
  }
  if (state.error || (!state.loading && state.items.length === 0)) {
    return <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700">역사 내 접근성 경로를 확인할 수 없습니다.</div>;
  }
  const steps = buildAccessibilitySteps(segment, state.items);
  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-extrabold text-gray-900">역사 내 접근성 이동 경로</span>
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: color }}>{state.items.length}대</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] font-medium text-gray-500">엘리베이터와 넓은 게이트 중심 안내</p>
        </div>
        <span className="text-[12px] font-bold text-gray-400">{open ? '접기 ▲' : '보기 ▼'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-200 px-3 py-3">
          <div className="relative pl-7">
            <div className="absolute left-[11px] top-4 bottom-4 w-0.5 rounded-full" style={{ backgroundColor: `${color}33` }} />
            {steps.map((step) => (
              <div key={`${step.title}-${step.tag}`} className="relative pb-3 last:pb-0">
                <div className="absolute -left-7 top-0 flex h-6 w-6 items-center justify-center rounded-full text-[12px]" style={{ backgroundColor: color, color: 'white' }}>{step.icon}</div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-extrabold text-gray-900">{step.title}</span>
                  <span className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-gray-500">{step.tag}</span>
                </div>
                <p className="mt-0.5 text-[12px] font-medium leading-5 text-gray-500">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(date: Date) {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h >= 12 ? '오후' : '오전'} ${h > 12 ? h - 12 : h}:${m}`;
}

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────

export default function ExplainPage() {
  const router = useRouter();
  const { resetNavigation, selectedRouteData, setSelectedRouteData, setSelectedAiPayload, origin, destination, accessibilityMode } = useMobilityStore();

  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [accessibilityRoutes, setAccessibilityRoutes] = useState<Record<string, AccessibilityRouteState>>({});
  const [isReRouting, setIsReRouting] = useState(false);

  const route    = selectedRouteData as any;
  const subPath: any[] = route?.subPath || [];
  const totalTime: number = route?.totalTime || 0;
  const payment: number   = route?.payment || 0;

  // 시각장애 전용 필터 플래그 판별
  const isVisuallyImpaired = accessibilityMode === 'visual';

  useEffect(() => {
    if (!selectedRouteData) router.replace('/result');
  }, [selectedRouteData, router]);

  // 페이지 이탈 시 켜져 있던 재생 음성 중지 클린업
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const subwayStationIds = useMemo(
    () => Array.from(new Set(
      subPath.filter((seg: any) => seg.trafficType === 1)
        .map((seg: any) => seg.stationId || toStationId(seg))
        .filter(Boolean)
    )) as string[],
    [subPath]
  );

  useEffect(() => {
    if (subwayStationIds.length === 0) return;
    let cancelled = false;
    setAccessibilityRoutes((prev) => {
      const next = { ...prev };
      subwayStationIds.forEach((id) => { if (!next[id]) next[id] = { loading: true, items: [], error: null }; });
      return next;
    });
    subwayStationIds.forEach(async (stationId) => {
      try {
        const res  = await fetch(`/api/stations/${encodeURIComponent(stationId)}/elevators`);
        const json = await res.json();
        const items = json.success ? json.data?.items ?? [] : [];
        if (!cancelled) setAccessibilityRoutes((prev) => ({ ...prev, [stationId]: { loading: false, items, error: json.success ? null : json.message ?? '엘리베이터 정보를 불러올 수 없습니다.' } }));
      } catch {
        if (!cancelled) setAccessibilityRoutes((prev) => ({ ...prev, [stationId]: { loading: false, items: [], error: '엘리베이터 정보를 불러올 수 없습니다.' } }));
      }
    });
    return () => { cancelled = true; };
  }, [subwayStationIds]);

  const handleReRoute = async () => {
    setIsReRouting(true);
    try {
      const newRoutes = await generateFullMobilityRoute(
        { lat: (origin as any)?.lat, lng: (origin as any)?.lng, name: origin.name || '내 위치' },
        { lat: (destination as any)?.lat, lng: (destination as any)?.lng, name: destination.name || '목적지' }
      );
      if (!newRoutes || newRoutes.length === 0) throw new Error('경로를 다시 찾지 못했습니다.');
      const bestRoute = newRoutes[0] as any;
      const aiPayload = { availableVehicles: 4, elevatorCount: bestRoute.totalTransfer === 0 ? 5 : 2, hasPhone: true, needParking: false, parkingAvailable: 15, timeSlot: 'morning', userType: accessibilityMode || 'wheelchair', waitingCount: 0, withCaregiver: false };
      let aiScore = 95;
      try {
        const aiRes = await fetch(`${API_BASE}/api/ai/recommend-ml`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' }, body: JSON.stringify(aiPayload) });
        if (aiRes.ok) { const text = await aiRes.text(); aiScore = Math.round(parseFloat(text.replace(/"/g, ''))) || 95; }
      } catch {}
      setSelectedRouteData({ ...bestRoute, aiScore, aiPayload });
      if (setSelectedAiPayload) setSelectedAiPayload(aiPayload);
    } catch {
      alert('현재 위치에서 최적 경로를 다시 찾을 수 없습니다.');
    } finally {
      setIsReRouting(false);
    }
  };

  // TTS 전체 경로 음성 스트리밍 생성 가이드 함수
  const playVoiceGuide = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel(); // 이전 작동 매커니즘 정지

    const routeText = subPath.map((seg) => {
      if (seg.trafficType === 3) return `도보로 ${seg.sectionTime}분, 약 ${seg.distance}미터 이동합니다.`;
      if (seg.trafficType === 1) return `${seg.startName}역에서 ${seg.lane?.[0]?.name || '지하철'} 탑승, ${seg.stationCount}개 역을 지나 ${seg.endName}역에서 하차합니다.`;
      if (seg.trafficType === 2) return `${seg.startName} 정류장에서 ${seg.lane?.[0]?.busNo || ''}번 버스를 탑승하여, ${seg.endName} 정류장에서 하차합니다.`;
      return '';
    }).filter(Boolean).join(' 그리고, ');

    const text = `총 예상 소요 시간은 ${route?.time || ''}입니다. 전체 안내를 시작합니다. ${routeText}. 이동을 마치려면 맨 아래 안내 종료하기를 선택하세요.`;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    window.speechSynthesis.speak(utterance);
  }, [subPath, route]);

  if (!selectedRouteData) return null;

  const now     = new Date();
  const arrival = new Date(now.getTime() + totalTime * 60000);

  // ✅ 도보: walkSegmentsCoords(Tmap), 대중교통: transitCoords(ODsay loadLane) or pathShape
  const routeCoords = useMemo(() => {
    const walkCoords: Coordinate[][] = (route?.walkSegmentsCoords || []) as Coordinate[][];
    const transitCoords: Coordinate[] = (route?.transitCoords || []) as Coordinate[];
    const pathShape: string | null = route?.pathShape || null;

    const final: Coordinate[] = [];
    const o = origin as any;
    const d = destination as any;

    if (o?.lat && o?.lng) final.push({ lat: o.lat, lng: o.lng });

    let wIdx = 0;
    let hasTransitInserted = false;

    subPath.forEach((seg) => {
      if (seg.trafficType === 3) {
        const wc = walkCoords[wIdx] || [];
        wIdx++;
        if (wc.length > 0) {
          final.push(...wc);
        } else {
          const sx = Number(seg.startX ?? seg.x);
          const sy = Number(seg.startY ?? seg.y);
          if (sx && sy) final.push({ lat: sy, lng: sx });
        }
      } else {
        if (!hasTransitInserted) {
          if (transitCoords.length > 0) {
            final.push(...transitCoords);
            hasTransitInserted = true;
          } else if (pathShape) {
            const shaped = parseCoordinateString(pathShape);
            if (shaped.length > 0) {
              final.push(...shaped);
              hasTransitInserted = true;
            }
          }
          if (!hasTransitInserted) {
            const sx = Number(seg.startX ?? seg.x);
            const sy = Number(seg.startY ?? seg.y);
            const ex = Number(seg.endX ?? seg.x);
            const ey = Number(seg.endY ?? seg.y);
            if (sx && sy) final.push({ lat: sy, lng: sx });
            seg.passStopList?.stations?.forEach((st: any) => {
              const px = Number(st.x), py = Number(st.y);
              if (px && py) final.push({ lat: py, lng: px });
            });
            if (ex && ey) final.push({ lat: ey, lng: ex });
          }
        }
      }
    });

    if (d?.lat && d?.lng) final.push({ lat: d.lat, lng: d.lng });

    return cleanCoords(final, 1.5);
  }, [subPath, route?.walkSegmentsCoords, route?.transitCoords, route?.pathShape, origin, destination]);

  const mapCenter = useMemo<Coordinate | undefined>(() => {
    if (!routeCoords.length) return undefined;
    return routeCoords[Math.floor(routeCoords.length / 2)];
  }, [routeCoords]);

  const totalSec = subPath.reduce((s: number, p: any) => s + (p.sectionTime || 0), 0) || 1;
  const handleEnd = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
    resetNavigation(); 
    router.push('/'); 
  };

  // ─────────────────────────────────────────────────────────────────
  // 조건부 처리 1: [시각장애 전용 UI] (지도를 숨기고 남색 배경 & 노란색 고대비 테마)
  // ─────────────────────────────────────────────────────────────────
  if (isVisuallyImpaired) {
    return (
      <div className="flex flex-col h-[100dvh] w-full bg-[#0f172a] text-white overflow-hidden relative">
        {isReRouting && (
          <div className="absolute inset-0 z-[100] bg-[#0f172a]/90 flex flex-col items-center justify-center backdrop-blur-sm">
            <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-xl font-black text-yellow-400">경로 재탐색중입니다...</p>
          </div>
        )}

        <main className="flex-1 overflow-y-auto px-5 pt-8 pb-24" role="main" aria-label="시각장애인 전용 경로 상세 안내">
          {/* 주요 시간 표시 요약 */}
          <div className="mb-6" tabIndex={0}>
            <h1 className="text-4xl font-black text-yellow-400 mb-2">총 {route.time} 소요</h1>
            <p className="text-xl text-slate-300 font-bold">
              도착 예상: {formatTime(arrival)} 
              {payment > 0 && ` · 요금 ${payment.toLocaleString()}원`}
            </p>
          </div>

          {/* 전체 재생 제어 전용 버튼 컴포넌트 */}
          <button 
            onClick={playVoiceGuide}
            aria-label="전체 이동 경로 음성으로 듣기"
            className="w-full bg-yellow-400 text-slate-950 rounded-2xl py-5 mb-8 flex items-center justify-center gap-3 active:scale-95 transition-transform font-black text-xl shadow-lg focus:ring-4 focus:ring-yellow-300"
          >
            <span aria-hidden="true" className="text-2xl">🔊</span>
            <span>전체 경로 음성으로 듣기</span>
          </button>

          {/* 목록 접근성 트리거 마크업 */}
          <ul className="flex flex-col gap-6" aria-label="구간별 상세 경로 목록">
            {subPath.map((seg: any, i: number) => {
              const isWalk = seg.trafficType === 3;
              const isSubway = seg.trafficType === 1;
              const isBus = seg.trafficType === 2;
              
              let ariaText = '';
              if (isWalk) ariaText = `${i + 1}번 구간, 도보 이동. ${seg.sectionTime}분 동안 약 ${seg.distance}미터 이동합니다.`;
              else if (isSubway) ariaText = `${i + 1}번 구간, 지하철 탑승. ${seg.startName}역에서 ${seg.lane?.[0]?.name || ''} ${seg.way ? seg.way + '행 ' : ''}열차를 타고, ${seg.stationCount}개 역을 지나 ${seg.endName}역에서 내립니다. 소요시간은 ${seg.sectionTime}분입니다.`;
              else if (isBus) ariaText = `${i + 1}번 구간, 버스 탑승. ${seg.startName} 정류장에서 ${seg.lane?.[0]?.busNo || ''}번 버스를 타고, ${seg.stationCount}개 정류장을 지나 ${seg.endName}에서 내립니다. 소요시간은 ${seg.sectionTime}분입니다.`;

              return (
                <li key={i} tabIndex={0} aria-label={ariaText} className="border-b border-slate-800 pb-6 last:border-0 focus:outline-none focus:ring-4 focus:ring-yellow-400 rounded-lg p-2">
                  <div className="flex items-start gap-4">
                    <div aria-hidden="true" className="flex items-center justify-center rounded-full w-12 h-12 flex-shrink-0 bg-slate-800 text-2xl">
                      {isWalk ? '🚶' : isSubway ? '🚇' : '🚌'}
                    </div>

                    <div className="flex-1" aria-hidden="true">
                      {isWalk && (
                        <div>
                          <p className="text-xl font-black text-white">도보 이동</p>
                          <p className="text-lg text-slate-300 mt-1">{seg.sectionTime}분 ({seg.distance}m)</p>
                        </div>
                      )}
                      
                      {isSubway && (
                        <div>
                          <p className="text-xl font-black text-white">
                            {seg.startName}역 <span className="text-yellow-400 text-lg">({seg.lane?.[0]?.name})</span>
                          </p>
                          {seg.way && <p className="text-md text-slate-300 mt-0.5">{seg.way}행 방면</p>}
                          <p className="text-md text-slate-400 mt-1.5">{seg.stationCount}개 역 · {seg.sectionTime}분</p>
                          <div className="mt-2 p-3 bg-slate-800/40 rounded-lg border border-slate-800">
                            <p className="text-lg font-bold text-yellow-400">{seg.endName}역 하차</p>
                          </div>
                        </div>
                      )}

                      {isBus && (
                        <div>
                          <p className="text-xl font-black text-white">{seg.startName}</p>
                          <p className="text-lg font-black text-yellow-400 mt-0.5">{seg.lane?.[0]?.busNo}번 버스</p>
                          <p className="text-md text-slate-400 mt-1.5">{seg.stationCount}개 정류장 · {seg.sectionTime}분</p>
                          <div className="mt-2 p-3 bg-slate-800/40 rounded-lg border border-slate-800">
                            <p className="text-lg font-bold text-yellow-400">{seg.endName} 하차</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </main>

        <div className="absolute bottom-0 left-0 right-0 px-5 py-6 bg-[#0f172a] border-t border-slate-800 z-20 flex gap-3">
          <button 
            onClick={() =>  {
              if (typeof window !== 'undefined' && window.speechSynthesis) {
              window.speechSynthesis.cancel(); 
            }
            router.push('/arrived');
            
            }}
            className="flex-1 bg-yellow-400 text-slate-950 rounded-2xl py-5 text-xl font-black active:scale-95 transition-all focus:ring-4 focus:ring-yellow-300 shadow-lg"
          >
            안내 종료하기
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // 조건부 처리 2: [기존 UI] (휠체어/노약자 기본 필터용 레이아웃) -> 변경 없음
  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[100dvh] w-full bg-white overflow-hidden relative">

      {isReRouting && (
        <div className="absolute inset-0 z-[100] bg-white/85 flex flex-col items-center justify-center backdrop-blur-sm">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-lg font-extrabold text-gray-900">경로 재탐색중입니다...</p>
          <p className="text-[13px] font-medium text-gray-500 mt-2">최신 교통 상황을 반영하여 최적의 경로를 다시 찾고 있습니다.</p>
        </div>
      )}

      {/* 지도 */}
      <div className="relative flex-shrink-0" style={{ height: '45vh' }}>
        <MapView
          variant="navigation"
          height={Math.round((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.45)}
          routeCoords={routeCoords}
          center={mapCenter}
          zoom={6}
        />
        <button onClick={handleEnd} className="absolute top-3 right-3 z-10 bg-white rounded-full shadow-md flex items-center justify-center" style={{ width: 36, height: 36, fontSize: 16, color: '#374151' }}>✕</button>
      </div>

      {/* 바텀 시트 */}
      <div className="flex-1 overflow-y-auto bg-white rounded-t-3xl shadow-[0_-10px_20px_rgba(0,0,0,0.08)] -mt-5 z-10 scrollbar-hide">
        <div className="px-5 pt-4 pb-6">
          <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-5" />

          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 4 }}>{route.time}</h1>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 14 }}>
            {formatTime(now)} - {formatTime(arrival)}
            {payment > 0 && ` · ${payment.toLocaleString()}원`}
          </p>

          {/* 세그먼트 바 */}
          <div className="flex items-center gap-0.5 mb-5" style={{ height: 28 }}>
            {subPath.map((seg: any, i: number) => {
              const isWalk   = seg.trafficType === 3;
              const isSubway = seg.trafficType === 1;
              const lineDisplay = getSubwayLineDisplay(seg);
              const color    = isWalk ? '#e5e7eb' : isSubway ? lineDisplay.color : '#1d4ed8';
              const widthPct = ((seg.sectionTime || 1) / totalSec) * 100;
              const label    = isWalk ? `${seg.sectionTime}분` : isSubway ? lineDisplay.label : String(seg.lane?.[0]?.busNo || '');
              return (
                <div key={i} className="flex items-center justify-center overflow-hidden"
                  style={{ width: `${widthPct}%`, minWidth: isWalk ? 24 : 32, height: 28, backgroundColor: color,
                    borderRadius: i === 0 ? '14px 4px 4px 14px' : i === subPath.length - 1 ? '4px 14px 14px 4px' : 4 }}>
                  <span style={{ fontSize: isWalk ? 10 : 13, fontWeight: isWalk ? 500 : 800, color: isWalk ? '#9ca3af' : 'white' }}>{label}</span>
                </div>
              );
            })}
          </div>

          <div className="h-px bg-gray-100 mb-4" />

          {/* 구간 타임라인 */}
          {subPath.map((seg: any, i: number) => {
            const isWalk   = seg.trafficType === 3;
            const isBus    = seg.trafficType === 2;
            const isSubway = seg.trafficType === 1;
            const lineDisplay = getSubwayLineDisplay(seg);
            const color    = isWalk ? '#9ca3af' : isSubway ? lineDisplay.color : '#1d4ed8';
            const isExpanded = expandedIdx === i;
            const hasDoor  = seg.door && seg.door !== 'null' && seg.door !== null;
            const stationId = seg.stationId || toStationId(seg) || route.stationId || '';

            return (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center" style={{ width: 32, flexShrink: 0 }}>
                  {i > 0 && (
                    <div style={{ width: 2, height: 10, flexShrink: 0,
                      backgroundColor: subPath[i-1].trafficType === 1 ? getSubwayLineDisplay(subPath[i-1]).color : subPath[i-1].trafficType === 2 ? '#1d4ed8' : '#e5e7eb' }} />
                  )}
                  {isSubway ? (
                    <div className="flex items-center justify-center rounded-lg flex-shrink-0" style={{ width: 30, height: 30, backgroundColor: color }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'white' }}>{lineDisplay.label}</span>
                    </div>
                  ) : isBus ? (
                    <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 30, height: 30, backgroundColor: '#1d4ed8' }}>
                      <span style={{ fontSize: 14 }}>🚌</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 24, height: 24, backgroundColor: '#f3f4f6', margin: '0 3px' }}>
                      <span style={{ fontSize: 13 }}>🚶</span>
                    </div>
                  )}
                  {i < subPath.length - 1 && (
                    <div style={{ width: 2, flex: 1, minHeight: 16, backgroundColor: isSubway ? color : isBus ? '#1d4ed8' : '#e5e7eb' }} />
                  )}
                </div>

                <div className="flex-1 pb-4">
                  {isWalk && (
                    <div className="flex items-center gap-2 py-1">
                      <span style={{ fontSize: 13, color: '#6b7280' }}>도보 {seg.sectionTime}분</span>
                      {seg.distance > 0 && (
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>({seg.distance < 1000 ? `${seg.distance}m` : `${(seg.distance / 1000).toFixed(1)}km`})</span>
                      )}
                    </div>
                  )}

                  {isSubway && (
                    <>
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{seg.startName}역</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color }}>{seg.lane?.[0]?.name}</span>
                        <button disabled={!stationId} onClick={() => { if (stationId) router.push(`/station/${encodeURIComponent(stationId)}`); }}
                          style={{ fontSize: 11, fontWeight: 600, color: '#374151', backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 8px' }}>
                          역 정보 ›
                        </button>
                      </div>
                      {hasDoor && <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>빠른환승 {seg.door}</p>}
                      {seg.way && <p style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>{seg.way}행 방면</p>}
                      {stationId && <AccessibilityRoutePanel segment={seg} state={accessibilityRoutes[stationId]} color={color} />}
                      <button onClick={() => setExpandedIdx(isExpanded ? null : i)} className="flex items-center gap-1.5 mb-1 mt-2" style={{ fontSize: 13, color: '#374151' }}>
                        <span style={{ fontWeight: 600 }}>{seg.stationCount}개 역</span>
                        <span style={{ color: '#9ca3af' }}>· {seg.sectionTime}분</span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{isExpanded ? '▲' : '▼'}</span>
                      </button>
                      {isExpanded && seg.passStopList?.stations && (
                        <div className="ml-1 mb-2 border-l-2 pl-3" style={{ borderColor: color }}>
                          {seg.passStopList.stations.map((st: any, si: number) => (
                            <p key={si} style={{ fontSize: 12, color: '#6b7280', paddingBottom: 3 }}>{st.stationName}</p>
                          ))}
                        </div>
                      )}
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{seg.endName}역 하차</span>
                      </div>
                    </>
                  )}

                  {isBus && (
                    <>
                      <div className="flex items-center gap-2 mb-2">
                        <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{seg.startName}</span>
                        {seg.startID && <span style={{ fontSize: 11, color: '#9ca3af' }}>{seg.startID}</span>}
                      </div>
                      <div className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 mb-2">
                        <div className="flex items-center gap-2">
                          {seg.lane?.[0]?.type != null && (
                            <span className="rounded px-1.5 py-0.5 flex-shrink-0"
                              style={{ fontSize: 10, fontWeight: 700, color: 'white', backgroundColor: BUS_TYPE_COLOR[seg.lane[0].type] || '#1d4ed8' }}>
                              {BUS_TYPE_LABEL[seg.lane[0].type] || '버스'}
                            </span>
                          )}
                          <span style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{seg.lane?.[0]?.busNo}</span>
                        </div>
                      </div>
                      <button onClick={() => setExpandedIdx(isExpanded ? null : i)} className="flex items-center gap-1.5 mb-1" style={{ fontSize: 13, color: '#374151' }}>
                        <span style={{ fontWeight: 600 }}>{seg.stationCount}개 정류장</span>
                        <span style={{ color: '#9ca3af' }}>· {seg.sectionTime}분</span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>{isExpanded ? '▲' : '▼'}</span>
                      </button>
                      {isExpanded && seg.passStopList?.stations && (
                        <div className="ml-1 mb-2 border-l-2 pl-3" style={{ borderColor: '#1d4ed8' }}>
                          {seg.passStopList.stations.map((st: any, si: number) => (
                            <div key={si} className="flex items-center gap-1.5 pb-2">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#1d4ed8' }} />
                              <p style={{ fontSize: 12, color: '#374151' }}>{st.stationName}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{seg.endName} 하차</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="px-4 py-4 bg-white border-t border-gray-100 flex gap-3 flex-shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] z-20">
        <button onClick={handleReRoute} disabled={isReRouting}
          className="flex-[1.2] flex items-center justify-center gap-2 bg-gray-100 border border-gray-200 rounded-2xl py-4 active:scale-95 transition-all disabled:opacity-50">
          <span className="text-lg">🔄</span>
          <span className="text-[15px] font-bold text-gray-700">경로 재탐색</span>
        </button>
        <button onClick={() => router.push('/arrived')}
          className="flex-[2] flex items-center justify-center gap-2 bg-gray-900 text-white rounded-2xl py-4 active:scale-95 transition-all shadow-lg">
          <span className="text-lg">🏁</span>
          <span className="text-[15px] font-bold">안내 종료하기</span>
        </button>
      </div>
    </div>
  );
}