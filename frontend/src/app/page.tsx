// app/page.tsx
'use client';

import { useRouter } from 'next/navigation';
import { MapView } from '../components/MapView';
import { useMobilityStore } from '../store/useMobilityStore';
import type { AccessibilityMode } from '../types';
import { useEffect, useState, useRef } from 'react';
import { getCurrentPosition } from '../lib/map';
import { useKakaoMap } from '../lib/useKakaoMap';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '';
const HEADERS = { 'ngrok-skip-browser-warning': '69420' };

const MODES: { id: AccessibilityMode; icon: string; label: string }[] = [
  { id: 'wheelchair', icon: '♿', label: '휠체어/유모차' },
  { id: 'visual',     icon: '🦯', label: '시각장애' },
  { id: 'senior',     icon: '🧓', label: '고령자' },
];

const BOTTOM_TABS = [
  { icon: '🗺️', label: '지도',  active: true },
  { icon: '🔍', label: '검색', active: false },
  { icon: '📍', label: '저장', active: false },
  { icon: '⚙️', label: '설정', active: false },
];

function extractItems(payload: any): any[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.response?.body?.items?.item)) return payload.response.body.items.item;
  if (Array.isArray(payload?.response?.body?.items)) return payload.response.body.items;
  if (payload?.data && typeof payload.data === 'object') return [payload.data];
  return [];
}

export default function HomePage() {
  const router = useRouter();
  const { accessibilityMode, setAccessibilityMode, origin, setOrigin } = useMobilityStore();
  const { isLoaded } = useKakaoMap();

  const [mobilityInfo, setMobilityInfo] = useState<any>(null);
  const [centerInfo, setCenterInfo]     = useState<any>(null);
  const [isLoadingWidgets, setIsLoadingWidgets] = useState(true);
  const [stdgCd, setStdgCd]       = useState('');
  const [regionName, setRegionName] = useState('');
  const [isListening, setIsListening] = useState(false);

  const fetchedCd = useRef('');

  useEffect(() => {
    if (!isLoaded) return;

    getCurrentPosition()
      .then(({ lat, lng }) => {
        const kakao = (window as any).kakao;
        if (!kakao?.maps?.services) return;

        const geocoder = new kakao.maps.services.Geocoder();

        geocoder.coord2Address(lng, lat, (result: any, status: any) => {
          if (status === kakao.maps.services.Status.OK && result[0]) {
            const addr =
              result[0].road_address?.address_name ??
              result[0].address?.address_name ??
              '주소 정보 없음';
            const region =
              result[0].address?.region_1depth_name ||
              result[0].address?.region_2depth_name ||
              '내 지역';
            setRegionName(region);
            setOrigin({ address: addr, lat, lng, name: '내 위치' });
          }
        });

        geocoder.coord2RegionCode(lng, lat, (result: any, status: any) => {
          if (status === kakao.maps.services.Status.OK) {
            const legal = result.find((r: any) => r.region_type === 'B');
            if (legal?.code) {
              setStdgCd(legal.code);
            } else {
              const admin = result.find((r: any) => r.region_type === 'H');
              if (admin?.code) setStdgCd(admin.code);
            }
          }
        });
      })
      .catch(() => setIsLoadingWidgets(false));
  }, [isLoaded, setOrigin]);

  useEffect(() => {
    if (!stdgCd) return;
    if (fetchedCd.current === stdgCd) return;
    fetchedCd.current = stdgCd;
    
    const fetchWidgets = async () => {
      setIsLoadingWidgets(true);
      const fallbackCodes = [
        stdgCd,
        stdgCd.slice(0, 8) + '00',
        stdgCd.slice(0, 5) + '00000',
        stdgCd.slice(0, 2) + '00000000'
      ];

      let vehicleData: any = null;
      let centerData: any = null;

      for (const code of fallbackCodes) {
        if (!vehicleData) {
          const res = await fetch(`${API_BASE}/api/mobility/vehicles/available?stdgCd=${code}&pageNo=1&numOfRows=20`, { headers: HEADERS }).catch(() => null);
          if (res?.ok) {
            const json = await res.json();
            const items = extractItems(json);
            if (items.length > 0) vehicleData = { items, code };
          }
        }
        if (!centerData) {
          const res = await fetch(`${API_BASE}/api/mobility/centers?stdgCd=${code}&pageNo=1&numOfRows=20`, { headers: HEADERS }).catch(() => null);
          if (res?.ok) {
            const json = await res.json();
            const items = extractItems(json);
            if (items.length > 0) centerData = { items, code };
          }
        }
        if (vehicleData && centerData) break; 
      }

      if (vehicleData) {
        setMobilityInfo({
          region: regionName || '내 지역',
          availableCars: vehicleData.items.length,
          baseTime: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
        });
      } else {
        setMobilityInfo(null);
      }

      if (centerData) {
        const first = centerData.items[0];
        setCenterInfo({
          name:    first?.centerName || first?.centerNm || first?.name || first?.instNm || '이동지원센터',
          address: first?.address   || first?.roadAddress || first?.addr || '',
          phone:   first?.phone     || first?.telNo || first?.tel || '',
        });
      } else {
        setCenterInfo(null);
      }
      setIsLoadingWidgets(false);
    };

    fetchWidgets();
  }, [stdgCd, regionName]);

  const handleVoiceSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('이 브라우저는 음성 검색을 지원하지 않습니다.'); return; }
    const recognition = new SR();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.onstart  = () => setIsListening(true);
    recognition.onend    = () => setIsListening(false);
    recognition.onerror  = () => { alert('음성 인식에 실패했습니다.'); setIsListening(false); };
    recognition.onresult = (event: any) => {
      router.push(`/search?q=${encodeURIComponent(event.results[0][0].transcript)}`);
    };
    recognition.start();
  };

  const isVisual = accessibilityMode === 'visual';

  return (
    // ✅ 바탕을 남색(bg-gray-900)으로 변경
    <div className={`flex flex-col h-screen overflow-hidden ${isVisual ? 'bg-gray-900' : 'bg-gray-50'}`}>
      
      {/* 상단 헤더 */}
      <div className={`${isVisual ? 'bg-gray-900 border-b-2 border-yellow-400' : 'bg-gray-900 shadow-md'} px-4 pt-2 pb-3 flex-shrink-0 z-10`}>
        <div className="flex items-center justify-between mb-3 mt-1">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isVisual ? 'bg-yellow-400 text-gray-900' : 'bg-gray-800'}`}>
              <span style={{ fontSize: '16px' }}>📍</span>
            </div>
            <div>
              <p style={{ fontSize: isVisual ? '13px' : '11px', color: isVisual ? '#fbbf24' : '#9ca3af', fontWeight: isVisual ? 800 : 400 }}>현재 위치</p>
              <p style={{ fontSize: isVisual ? '18px' : '15px', fontWeight: 800, color: isVisual ? '#ffffff' : '#ffffff' }} aria-live="polite">
                {origin.address || '위치를 찾고 있습니다...'}
              </p>
            </div>
          </div>
        </div>

        {/* 모드 선택 탭 */}
        <div className="flex gap-2">
          {MODES.map((m) => {
            const isSelected = accessibilityMode === m.id;
            return (
              <button key={m.id} onClick={() => setAccessibilityMode(m.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition-colors border-2 ${
                  isVisual 
                    // ✅ 선택된 버튼도 남색 바탕에 어울리도록 수정
                    ? (isSelected ? 'bg-yellow-400 border-yellow-400' : 'bg-gray-800 border-gray-600') 
                    : (isSelected ? 'bg-white border-transparent' : 'bg-gray-700 border-transparent')
                }`}
                aria-pressed={isSelected}
              >
                <span className={isVisual ? 'text-xl' : ''}>{m.icon}</span>
                <span style={{ 
                  fontSize: isVisual ? '15px' : '13px', 
                  fontWeight: isSelected ? 800 : 600, 
                  color: isVisual 
                    ? (isSelected ? '#111827' : '#d1d5db') 
                    : (isSelected ? '#111827' : '#d1d5db') 
                }}>
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 지도 영역 */}
      <MapView variant="home" height={isVisual ? 180 : 260} />

      {/* 본문 콘텐츠 */}
      <div className={`flex-1 overflow-y-auto px-4 pt-4 pb-4 flex flex-col gap-4 ${isVisual ? 'bg-gray-900' : ''}`}>
        
        {/* 음성 검색 메인 버튼 */}
        <button onClick={() => router.push('/search')}
          className={`w-full flex items-center justify-between rounded-2xl px-5 py-5 shadow-sm border-[3px] ${
            isVisual 
              ? 'bg-yellow-400 border-yellow-400 outline outline-4 outline-gray-900 active:bg-yellow-500' 
              : 'bg-white border-gray-900'
          }`}>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: isVisual ? '30px' : '24px' }}>🔍</span>
            <span style={{ fontSize: isVisual ? '22px' : '18px', fontWeight: 900, color: '#111827' }}>
              {isListening ? '말씀해주세요...' : (isVisual ? '음성으로 목적지 검색' : '어디로 갈까요?')}
            </span>
          </div>
          <div onClick={handleVoiceSearch}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
              isListening 
                ? (isVisual ? 'bg-red-500 animate-pulse' : 'bg-red-100 animate-pulse') 
                : (isVisual ? 'bg-gray-900' : 'bg-gray-100')
            }`}>
            <span style={{ fontSize: '24px' }}>{isListening ? (isVisual ? '🔴' : '🔴') : '🎤'}</span>
          </div>
        </button>

        {/* 실시간 위젯 영역 */}
        <div className="flex flex-col gap-3 mt-2">
          <h3 className={`font-extrabold ml-1 ${isVisual ? 'text-yellow-400 text-lg' : 'text-gray-800 text-[13px]'}`}>
            실시간 주변 이동 지원
          </h3>

          {isLoadingWidgets ? (
            <div className="flex items-center gap-2 py-3">
              <div className={`w-5 h-5 border-2 rounded-full animate-spin ${isVisual ? 'border-yellow-400 border-t-transparent' : 'border-gray-400 border-t-transparent'}`} />
              <span className={isVisual ? 'text-yellow-400 text-[15px] font-bold' : 'text-gray-400 text-[13px]'}>정보를 불러오는 중입니다...</span>
            </div>
          ) : (
            <>
              {/* 차량 위젯 */}
              <div className={`rounded-xl p-4 flex items-center gap-4 shadow-sm border-2 ${
                isVisual ? 'bg-gray-800 border-yellow-400 text-white' : 'bg-blue-50 border-blue-100'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 ${
                  isVisual ? 'bg-yellow-400' : 'bg-white'
                }`}>
                  <span style={{ fontSize: '26px' }}>🚖</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-extrabold mb-1 ${isVisual ? 'text-yellow-400 text-[13px]' : 'text-blue-600 text-[11px]'}`}>
                    {mobilityInfo?.region || regionName || '내 지역'} 장애인 콜택시
                  </p>
                  <div className="flex items-end justify-between">
                    <p className={`font-extrabold truncate ${isVisual ? 'text-white text-[18px]' : 'text-gray-900 text-[15px]'}`}>
                      {mobilityInfo?.availableCars !== undefined ? (
                        mobilityInfo.availableCars > 0 ? (
                          <>현재 <span className={isVisual ? 'text-yellow-400 text-[20px]' : 'text-blue-600'}>{mobilityInfo.availableCars}대</span> 호출 가능</>
                        ) : '현재 대기 차량 없음'
                      ) : (
                        <span className={isVisual ? 'text-gray-400' : 'text-gray-400 text-[13px]'}>정보 없음</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* 센터 위젯 */}
              <div className={`rounded-xl p-4 flex items-center gap-4 shadow-sm border-2 ${
                isVisual ? 'bg-gray-800 border-yellow-400 text-white' : 'bg-green-50 border-green-100'
              }`}>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 ${
                  isVisual ? 'bg-yellow-400' : 'bg-white'
                }`}>
                  <span style={{ fontSize: '26px' }}>🏢</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-extrabold mb-1 ${isVisual ? 'text-yellow-400 text-[13px]' : 'text-green-700 text-[11px]'}`}>
                    가장 가까운 이동지원센터
                  </p>
                  <p className={`font-extrabold truncate ${isVisual ? 'text-white text-[17px]' : 'text-gray-900 text-[14px]'}`}>
                    {centerInfo?.name || <span className="text-gray-400">정보 없음</span>}
                  </p>
                  {centerInfo?.phone && (
                    <a href={`tel:${centerInfo.phone}`} 
                       className={`mt-1 font-black block ${isVisual ? 'text-yellow-400 text-[16px] underline' : 'text-green-700 text-[11px]'}`}>
                      ☎ {centerInfo.phone}
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 하단 탭 */}
      <div className={`flex items-center flex-shrink-0 border-t-2 ${isVisual ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`}>
        {BOTTOM_TABS.map((tab) => (
          <button key={tab.label}
            className="flex-1 flex flex-col items-center gap-1 py-3 relative"
            onClick={() => { if (tab.label === '검색') router.push('/search'); }}>
            {/* 글자색 코드는 기존 그대로 유지! (남색 바탕에서 노란색/회색이 가장 예쁨) */}
            <span style={{ fontSize: isVisual ? '28px' : '22px', opacity: tab.active ? 1 : 0.4 }}>{tab.icon}</span>
            <span style={{ 
              fontSize: isVisual ? '13px' : '10px', 
              color: isVisual ? (tab.active ? '#fbbf24' : '#9ca3af') : (tab.active ? '#111827' : '#9ca3af'), 
              fontWeight: tab.active ? 900 : 500 
            }}>
              {tab.label}
            </span>
            {tab.active && (
              <div className={`absolute top-0 w-8 h-1 rounded-b-full ${isVisual ? 'bg-yellow-400' : 'bg-gray-900'}`} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}