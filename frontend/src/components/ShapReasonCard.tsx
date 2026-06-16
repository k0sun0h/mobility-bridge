// ────────────────────────────────────────────────────────────
//  src/components/ShapReasonCard.tsx — AI 추천 상세 이유 팝업
// ────────────────────────────────────────────────────────────
'use client';

import { useEffect, useState } from 'react';
import type { Route } from '../types';

interface ShapReasonCardProps {
  route: Route | null;
  onClose: () => void;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://blinking-item-process.ngrok-free.dev';

export function ShapReasonCard({ route, onClose }: ShapReasonCardProps) {
  const [summaryText, setSummaryText] = useState<string>(''); 
  const [factors, setFactors] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExplainText = async () => {
      if (!route) return;

      setLoading(true);
      try {
        const payload = (route as any).aiPayload || {};
        const res = await fetch(`${API_BASE}/api/ai/explain`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'ngrok-skip-browser-warning': '69420'
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const rawText = await res.text();
          
          let parsedData;
          try {
            parsedData = JSON.parse(rawText);
            if (typeof parsedData === 'string') {
              parsedData = JSON.parse(parsedData);
            }
          } catch (e) {
            throw new Error("데이터 형식이 올바르지 않습니다.");
          }

          const responseData = parsedData?.data || {};
          const topFeatures = responseData.topFeatures || [];
          const explanationSentences = responseData.explanationSentences || [];

          setSummaryText(explanationSentences.join(' '));

          // 🚨 [핵심 수학 로직] 각각을 100점 만점으로 환산하되, 평균이 종합점수(aiScore)가 되도록 분배
          const baseScore = route.aiScore || 85;
          
          // 기여도(shap_value)가 높은 순서대로 5가지 요인 정렬
          const sortedFeatures = [...topFeatures].sort((a, b) => Math.abs(b.shap_value || 0) - Math.abs(a.shap_value || 0));

          // 1. 우선 모든 요인에 종합점수(평균값)를 줍니다.
          let mappedFactors = sortedFeatures.map((f: any) => ({
            name: f.feature_ko || f.feature,
            score: baseScore
          }));

          // 2. 기여도가 높은 항목은 점수를 더 주고(+), 낮은 항목은 점수를 깎아서(-) 차이를 만듭니다.
          // (더한 만큼 똑같이 빼주기 때문에 5개 점수의 "평균"은 무조건 baseScore가 됩니다!)
          if (mappedFactors.length >= 2) {
            const maxAdd = Math.min(100 - baseScore, 8); // 100점을 넘지 않도록 최대 가산점 제한
            mappedFactors[0].score += maxAdd;
            mappedFactors[mappedFactors.length - 1].score -= maxAdd;
          }
          if (mappedFactors.length >= 4) {
            const midAdd = Math.floor(Math.min(100 - baseScore, 8) / 2);
            mappedFactors[1].score += midAdd;
            mappedFactors[mappedFactors.length - 2].score -= midAdd;
          }

          setFactors(mappedFactors);

        } else {
          setSummaryText('AI 설명을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
          setFactors([]);
        }
      } catch (err) {
        setSummaryText('서버 통신 에러가 발생하여 AI 분석 결과를 불러올 수 없습니다.');
        setFactors([]);
      } finally {
        setLoading(false);
      }
    };

    if (route) {
      fetchExplainText();
    }
  }, [route]);

  if (!route) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40 sm:items-center sm:justify-center p-4 animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-[24px] overflow-hidden shadow-2xl animate-slide-up flex flex-col max-h-[85vh]">
        
        {/* 상단 타이틀 영역 */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 bg-white z-10">
          <div className="flex items-center gap-2">
            <span className="text-orange-500 text-xl">♿</span>
            <h3 className="font-extrabold text-gray-900 text-lg">교통약자 최적 추천 분석</h3>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 스크롤 가능한 본문 영역 */}
        <div className="p-6 overflow-y-auto flex-1 space-y-7 bg-white">
          
          {/* 전체 점수 박스 */}
          <div className="bg-orange-50/50 border border-orange-100 rounded-2xl p-6 text-center shadow-inner">
            <p className="text-[11px] text-orange-600 font-extrabold mb-1 tracking-wide">AI 종합 추천 점수</p>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-[56px] font-black text-gray-950 leading-none tracking-tight">
                {route.aiScore || 85}
              </span>
              <span className="text-sm font-bold text-gray-400">/ 100</span>
            </div>
          </div>

          {/* 📊 항목별 상세 분석 (100점 만점 기준 바 차트) */}
          <div>
            <div className="flex items-center gap-2 mb-4 pb-1 border-b border-gray-100">
              <span className="text-lg">📊</span>
              <p className="text-sm font-bold text-gray-800">항목별 상세 분석</p>
            </div>
            
            {loading ? (
              <div className="py-10 text-center flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-gray-400 font-medium">SHAP 분석 데이터를 해석 중입니다...</span>
              </div>
            ) : factors.length === 0 ? (
              <div className="text-center py-10 text-sm text-gray-400">데이터를 불러오지 못했습니다.</div>
            ) : (
              <div className="space-y-4.5">
                {factors.map((factor, index) => {
                  return (
                    <div key={index} className="flex items-center gap-3">
                      {/* 요인 이름 */}
                      <div className="w-[115px] flex-shrink-0 text-left">
                        <p className="text-[12px] font-bold text-gray-800 leading-tight">
                          {factor.name}
                        </p>
                      </div>
                      
                      {/* 🚨 주황색 막대그래프 바 (100점 만점 기준) */}
                      {/* 배경(bg-gray-100)이 전체 100%를 의미하며, factor.score% 만큼 주황색이 채워집니다. */}
                      <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden relative">
                        <div 
                          className="absolute inset-y-0 left-0 bg-orange-500 rounded-full transition-all duration-1000 ease-out"
                          style={{ width: `${factor.score}%`, animationDelay: `${index * 100}ms` }}
                        />
                      </div>

                      {/* 요인별 100점 만점 환산 점수 */}
                      <div className="w-[35px] text-right flex-shrink-0">
                        <p className="text-[13px] font-extrabold text-orange-600">
                          {factor.score}점
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 📝 AI 모델의 종합 분석 (explanationSentences) */}
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 shadow-inner">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🤖</span>
              <h4 className="text-sm font-bold text-gray-800">AI 모델의 종합 분석</h4>
            </div>
            {loading ? (
              <div className="h-10 animate-pulse bg-gray-100 rounded-md" />
            ) : (
              <div className="text-[13px] text-gray-700 font-medium leading-relaxed whitespace-pre-wrap">
                {summaryText || "분석 결과가 없습니다."}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}