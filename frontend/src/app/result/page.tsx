// ────────────────────────────────────────────────────────────
//  app/result/page.tsx — 경로 선택 결과
// ────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RouteCard } from '../../components/RouteCard';
import { ShapReasonCard } from '../../components/ShapReasonCard';
import { useMobilityStore } from '../../store/useMobilityStore';
import { generateFullMobilityRoute } from '../../lib/routeService';
import type { Route } from '../../types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://blinking-item-process.ngrok-free.dev';

export default function ResultPage() {
  const router = useRouter();

  const {
    origin, destination, accessibilityMode,
    selectedRouteId, setSelectedRouteId,
    setSelectedRouteData, setSelectedAiPayload,
  } = useMobilityStore();

  const [routes, setRoutes]     = useState<Route[]>([]);
  const [loading, setLoading]   = useState(false);
  const [aiCardRouteId, setAiCardRouteId] = useState<number | null>(null);
  const [mobilityInfo]  = useState<any>(null);
  const [parkingInfo]   = useState<any>(null);

  const isVisual = accessibilityMode === 'visual';

  useEffect(() => {
    const load = async () => {
      const startLat = (origin as any)?.lat;
      const startLng = (origin as any)?.lng;
      const destLat  = (destination as any)?.lat;
      const destLng  = (destination as any)?.lng;
      if (!startLat || !destLat) return;

      setLoading(true);
      try {
        const rawRoutes = await generateFullMobilityRoute(
          { lat: startLat, lng: startLng, name: origin.name || '내 위치' },
          { lat: destLat,  lng: destLng,  name: destination.name || '목적지' },
        );

        if (!rawRoutes || rawRoutes.length === 0) { setRoutes([]); setLoading(false); return; }

        const routesWithScores = await Promise.all(rawRoutes.map(async (route: any, index: number) => {
          try {
            const aiPayload = {
              availableVehicles: 4, elevatorCount: route.totalTransfer === 0 ? 5 : 2,
              hasPhone: true, needParking: false, parkingAvailable: 15,
              timeSlot: 'morning', userType: accessibilityMode || 'wheelchair',
              waitingCount: index, withCaregiver: false,
            };
            const aiRes = await fetch(`${API_BASE}/api/ai/recommend-ml`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '69420' },
              body: JSON.stringify(aiPayload),
            });
            if (aiRes.ok) {
              const text = await aiRes.text();
              let raw = parseFloat(text.replace(/"/g, ''));
              if (isNaN(raw) || raw > 100) raw = 95 - index * 3;
              else if (raw < 0) raw = 50 + index;
              return { ...route, aiScore: Math.round(raw), aiPayload };
            }
            return { ...route, aiScore: 85 - index * 4, aiPayload };
          } catch {
            return { ...route, aiScore: 70, aiPayload: {} };
          }
        }));

        const sorted = routesWithScores.sort((a: any, b: any) => (b.aiScore || 0) - (a.aiScore || 0));
        const modeStr = String(accessibilityMode || '').toLowerCase();
        const dynamicIcon = modeStr.includes('visual') ? '🦯' : modeStr.includes('senior') ? '🧓' : '♿';

        const final = sorted.map((route: any, i: number) => ({
          ...route,
          type: i === 0 ? 'AI 최적 추천' : `추천 대안 ${i}`,
          icon: i === 0 ? dynamicIcon : i === 1 ? '🔄' : '💡',
        }));

        setRoutes(final as any);
        setSelectedRouteId(final[0]?.id);
      } catch {
        setRoutes([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [origin, destination, accessibilityMode]);

  const aiCardRoute = routes.find((r) => r.id === aiCardRouteId) ?? null;

  // ✅ 시각장애 모드 전용 대형 경로 카드
  const VisualRouteCard = ({ route, index }: { route: any; index: number }) => {
    const isSelected = selectedRouteId === route.id;
    return (
      <button
        onClick={() => setSelectedRouteId(route.id)}
        className="w-full text-left rounded-3xl transition-all active:scale-[0.98]"
        style={{
          padding: '28px 24px',
          border: `4px solid ${isSelected ? '#facc15' : '#1e3a5f'}`,
          backgroundColor: isSelected ? '#1e3a5f' : '#162032',
        }}
      >
        {/* 순위 + 선택 */}
        <div className="flex items-center justify-between mb-4">
          <span style={{ fontSize: 14, fontWeight: 800, color: isSelected ? '#facc15' : '#94a3b8', letterSpacing: 1 }}>
            {index === 0 ? '✦ AI 최적 추천' : `추천 대안 ${index}`}
          </span>
          <div className="flex items-center justify-center w-8 h-8 rounded-full"
            style={{ border: `2px solid ${isSelected ? '#facc15' : '#334155'}`, backgroundColor: isSelected ? '#facc15' : 'transparent' }}>
            {isSelected && <span style={{ fontSize: 16, color: '#0f172a', fontWeight: 900 }}>✓</span>}
          </div>
        </div>

        {/* 소요시간 — 크게 */}
        <p style={{ fontSize: 52, fontWeight: 900, color: 'white', lineHeight: 1, marginBottom: 8 }}>
          {route.time}
        </p>

        {/* 거리 · 이동수단 */}
        <p style={{ fontSize: 18, color: '#94a3b8', fontWeight: 600, marginBottom: 16 }}>
          {route.distance} · {route.transport}
        </p>

        {/* 태그 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(route.tags || []).map((tag: string) => (
            <span key={tag} className="px-3 py-1.5 rounded-full"
              style={{
                fontSize: 14, fontWeight: 700,
                backgroundColor: isSelected ? '#1e3a5f' : '#0f172a',
                color: isSelected ? '#fde68a' : '#64748b',
                border: `1px solid ${isSelected ? '#facc15' : '#1e3a5f'}`,
              }}>
              {tag}
            </span>
          ))}
        </div>

        {/* AI 점수 */}
        {route.aiScore && (
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center rounded w-6 h-6"
              style={{ backgroundColor: '#facc15' }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: '#111' }}>AI</span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: isSelected ? '#facc15' : '#64748b' }}>
              {route.aiScore}점
            </span>
          </div>
        )}
      </button>
    );
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col overflow-hidden relative"
      style={{ backgroundColor: isVisual ? '#0f172a' : '#f9fafb' }}>

      {/* ── 헤더 ── */}
      <div className="flex-shrink-0 px-4 z-10"
        style={{
          paddingTop: isVisual ? 20 : 12,
          paddingBottom: isVisual ? 20 : 12,
          backgroundColor: isVisual ? '#0f172a' : 'white',
          borderBottom: `${isVisual ? 3 : 1}px solid ${isVisual ? '#facc15' : '#e5e7eb'}`,
        }}>

        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => router.push('/search')}
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: isVisual ? 48 : 36, height: isVisual ? 48 : 36,
              border: `2px solid ${isVisual ? '#facc15' : '#d1d5db'}`,
              color: isVisual ? '#facc15' : '#374151',
              fontSize: isVisual ? 22 : 16,
            }}
          >←</button>
          <h2 style={{ fontSize: isVisual ? 22 : 15, color: isVisual ? 'white' : '#111827', fontWeight: 800 }}>
            경로 선택
          </h2>
        </div>

        {/* 출발·도착 요약 */}
        <div className="rounded-xl p-3"
          style={{
            backgroundColor: isVisual ? '#162032' : '#f9fafb',
            border: `${isVisual ? 2 : 1}px solid ${isVisual ? '#1e3a5f' : '#d1d5db'}`,
            borderStyle: isVisual ? 'solid' : 'dashed',
          }}>
          {/* 출발 */}
          <div className="flex items-start gap-3">
            <div className="rounded-full flex-shrink-0 mt-1"
              style={{ width: isVisual ? 16 : 12, height: isVisual ? 16 : 12, border: `2px solid ${isVisual ? '#facc15' : '#6b7280'}` }} />
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: isVisual ? 13 : 10, color: '#94a3b8', fontWeight: 700, marginBottom: 2 }}>출발</p>
              <p className="truncate" style={{ fontSize: isVisual ? 18 : 14, color: isVisual ? 'white' : '#374151', fontWeight: 800 }}>
                {origin.name || '내 위치'}
              </p>
              {origin.address && (
                <p className="truncate" style={{ fontSize: isVisual ? 14 : 11, color: '#94a3b8' }}>
                  {origin.address}
                </p>
              )}
            </div>
          </div>

          <div style={{ width: 1, height: isVisual ? 16 : 12, backgroundColor: isVisual ? '#1e3a5f' : '#e5e7eb', marginLeft: 6, marginTop: 2, marginBottom: 2 }} />

          {/* 도착 */}
          <div className="flex items-start gap-3">
            <div className="rounded flex-shrink-0 mt-1"
              style={{ width: isVisual ? 16 : 12, height: isVisual ? 16 : 12, backgroundColor: isVisual ? '#facc15' : '#374151' }} />
            <div className="flex-1 min-w-0">
              <p style={{ fontSize: isVisual ? 13 : 10, color: '#94a3b8', fontWeight: 700, marginBottom: 2 }}>도착</p>
              <p className="truncate" style={{ fontSize: isVisual ? 18 : 14, color: isVisual ? 'white' : '#374151', fontWeight: 800 }}>
                {destination.name}
              </p>
              {destination.address && (
                <p className="truncate" style={{ fontSize: isVisual ? 14 : 11, color: '#94a3b8' }}>
                  {destination.address}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 배너 ── */}
      {(mobilityInfo || parkingInfo) && (
        <div className="flex-shrink-0 flex gap-2 px-4 py-2 bg-white border-b border-gray-200 shadow-sm z-10">
          {mobilityInfo && (
            <div className="flex-1 bg-blue-50 border border-blue-100 rounded-xl p-2.5 flex items-center gap-2">
              <span className="text-lg">🚖</span>
              <div>
                <span className="text-[10px] text-blue-600 font-extrabold block">{mobilityInfo.centerName || '콜택시 현황'}</span>
                <span className="text-[12px] text-gray-800 font-bold">여유 차량 {mobilityInfo.availableVehicles || 0}대</span>
              </div>
            </div>
          )}
          {parkingInfo && (
            <div className="flex-1 bg-green-50 border border-green-100 rounded-xl p-2.5 flex items-center gap-2">
              <span className="text-lg">🅿️</span>
              <div className="min-w-0">
                <span className="text-[10px] text-green-700 font-extrabold block">가장 가까운 주차장</span>
                <span className="text-[12px] text-gray-800 font-bold truncate block">
                  {parkingInfo.parkingName || '공영 주차장'} (빈자리 {parkingInfo.emptySpots || 0})
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── 경로 목록 ── */}
      <div className="flex-1 overflow-y-auto">
        <div className={`flex flex-col pb-8 ${isVisual ? 'p-4 gap-4' : 'p-4 gap-3'}`}>

          {loading && (
            <div className="text-center py-16 font-bold"
              style={{ fontSize: isVisual ? 20 : 14, color: isVisual ? '#facc15' : '#9ca3af' }}>
              {isVisual ? '⏳ 최적 경로를 분석 중입니다...' : 'AI 기반 최적의 경로를 분석 중입니다...'}
            </div>
          )}

          {!loading && routes.length === 0 && (
            <div className="text-center py-16 font-bold"
              style={{ fontSize: isVisual ? 20 : 14, color: isVisual ? '#64748b' : '#9ca3af' }}>
              조건에 맞는 경로 결과가 없습니다.
            </div>
          )}

          {!loading && routes.map((route, index) =>
            isVisual ? (
              <VisualRouteCard key={route.id} route={route} index={index} />
            ) : (
              <RouteCard
                key={route.id}
                route={route}
                isSelected={selectedRouteId === route.id}
                onSelect={() => setSelectedRouteId(route.id as number)}
                onAiClick={() => setAiCardRouteId(route.id as number)}
                onStationClick={() => {
                  const stationId = (route as any).stationId || (destination as any).stationId;
                  if (stationId) router.push(`/station/${encodeURIComponent(stationId)}`);
                }}
              />
            )
          )}
        </div>
      </div>

      {/* ── 하단 버튼 ── */}
      <div className="flex-shrink-0 px-4 z-10"
        style={{
          paddingTop: isVisual ? 20 : 12,
          paddingBottom: isVisual ? 24 : 12,
          backgroundColor: isVisual ? '#0f172a' : 'white',
          borderTop: `${isVisual ? 2 : 1}px solid ${isVisual ? '#1e3a5f' : '#e5e7eb'}`,
        }}>
        <button
          disabled={!selectedRouteId || loading}
          onClick={() => {
            const selected = routes.find((r) => r.id === selectedRouteId);
            if (!selected) return;
            setSelectedRouteData(selected as any);
            setSelectedAiPayload((selected as any).aiPayload);
            router.push('/explain');
          }}
          className="w-full flex items-center justify-center gap-3 rounded-2xl active:scale-[0.98] transition-transform disabled:opacity-40"
          style={{
            paddingTop: isVisual ? 28 : 16,
            paddingBottom: isVisual ? 28 : 16,
            backgroundColor: isVisual ? '#facc15' : '#111827',
            color: isVisual ? '#0f172a' : 'white',
          }}
        >
          <span style={{ fontSize: isVisual ? 28 : 20 }}>🧭</span>
          <span style={{ fontSize: isVisual ? 22 : 16, fontWeight: 800 }}>
            이 경로로 안내 시작
          </span>
        </button>
      </div>

      {aiCardRoute && (
        <ShapReasonCard route={aiCardRoute} onClose={() => setAiCardRouteId(null)} />
      )}
    </div>
  );
}