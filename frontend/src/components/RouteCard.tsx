// ────────────────────────────────────────────────────────────
//  src/components/RouteCard.tsx — 개별 경로 디자인 카드
// ────────────────────────────────────────────────────────────
'use client';

import type { Route } from '../types';

interface RouteCardProps {
  route: Route;
  isSelected: boolean;
  onSelect: () => void;
  onAiClick: () => void;
  onStationClick?: () => void;
}

export function RouteCard({ route, isSelected, onSelect, onAiClick }: RouteCardProps) {
  return (
    <div
      onClick={onSelect}
      className={`w-full text-left rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${
        isSelected
          ? 'border-[#1f2937] bg-white shadow-lg'
          : 'border-dashed border-gray-300 bg-gray-50/80 hover:bg-gray-100'
      }`}
    >
      {/* ── 1. 헤더 영역 ── */}
      <div
        className={`px-4 py-3 flex items-center justify-between ${
          isSelected
            ? 'bg-[#1f2937] text-white'
            : 'bg-transparent text-gray-700 border-b border-gray-200 border-dashed'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{route.icon || '📍'}</span>
          <span className="font-bold text-[15px] tracking-tight">{route.title || '추천 경로'}</span>
        </div>
        
        <div
          className={`px-3 py-1 rounded-full text-[11px] font-bold ${
            isSelected
              ? 'bg-gray-700 text-gray-200 border border-gray-600'
              : 'bg-gray-200 text-gray-500'
          }`}
        >
          {route.type?.replace('AI ', '') || '추천'}
        </div>
      </div>

      {/* ── 2. 바디 영역 ── */}
      <div className="p-4 relative">
        
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[32px] font-black text-gray-900 tracking-tight leading-none">
              {route.time}
            </h3>
            <p className="text-[13px] text-gray-500 font-medium">
              {route.distance} · {route.transport || '도보 + 대중교통'}
            </p>
          </div>

          {route.aiScore && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAiClick();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-full shadow-sm active:bg-gray-50 transition-colors"
            >
              <span className="bg-gray-800 text-white text-[10px] font-black px-1.5 py-0.5 rounded-[4px] leading-none">
                AI
              </span>
              <span className="text-[14px] font-extrabold text-gray-800">
                {route.aiScore}점
              </span>
            </button>
          )}
        </div>

        {/* 3. 태그 영역 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {route.tags?.map((tag, idx) => (
            <span
              key={idx}
              className="text-[11px] text-gray-600 font-bold px-2.5 py-1 bg-gray-100 rounded-full border border-gray-200"
            >
              ✓ {tag}
            </span>
          ))}
        </div>

        {/* 4. 하단 요약 한 줄 (🚨 TypeScript 에러 완벽 해결) */}
        {route.steps && route.steps.length > 0 && (
          <div className="flex items-center gap-2 text-[13px] text-gray-500 font-medium mt-1">
            <span className="text-base">{(route.steps[0] as any).icon || '🚶'}</span>
            <span className="truncate">
              {(route.steps[0] as any).detail || (route.steps[0] as any).direction}
              {(route.steps[0] as any).dist ? ` (${(route.steps[0] as any).dist})` : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}