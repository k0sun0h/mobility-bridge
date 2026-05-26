// ────────────────────────────────────────────────────────────
//  app/search/page.tsx — 검색 화면
// ────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchForm } from '@/components/SearchForm';
import { useMobilityStore } from '@/store/useMobilityStore';
import { getCurrentPosition } from '@/lib/map';

import OriginSearchOverlay from '@/components/search/OriginSearchOverlay';
import MapPickerOverlay from '@/components/search/MapPickerOverlay';

const RECENT_KEY = 'mobility_recent_searches';
const RECENT_MAX = 5;

type RecentItem = { 
  icon: string; 
  name: string; 
  address: string; 
  stationId?: string | number;
  lat: number;
  lng: number;
};

function getRecentSearches(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); }
  catch { return []; }
}

function addRecentSearch(item: RecentItem) {
  const prev = getRecentSearches().filter((r) => r.name !== item.name);
  localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...prev].slice(0, RECENT_MAX)));
}

type NearbyItem = { icon: string; name: string; tag: string; lat: number; lng: number };

const DEFAULT_NEARBY: NearbyItem[] = [
  { icon: '🏥', name: '근처 병원', tag: '♿ 접근 가능', lat: 37.5665, lng: 126.9780 },
  { icon: '🏛️', name: '주민센터', tag: '♿ 접근 가능', lat: 37.5665, lng: 126.9780 },
  { icon: '🏪', name: '편의점', tag: '🛗 엘리베이터', lat: 37.5665, lng: 126.9780 },
  { icon: '🚌', name: '버스 정류장', tag: '🚌 저상버스', lat: 37.5665, lng: 126.9780 },
];

const KAKAO_CATEGORIES = [
  { code: 'HP8', icon: '🏥', tag: '♿ 접근 가능' },
  { code: 'PO3', icon: '🏛️', tag: '♿ 접근 가능' },
  { code: 'CS2', icon: '🏪', tag: '🛗 엘리베이터' },
] as const;

function fetchNearbyPlaces(lat: number, lng: number, onResult: (places: NearbyItem[]) => void) {
  const kakao = (window as any).kakao;
  if (!kakao || !kakao.maps) return;
  
  const ps = new kakao.maps.services.Places();
  const results: NearbyItem[] = [];
  let done = 0;

  KAKAO_CATEGORIES.forEach(({ code, icon, tag }) => {
    ps.categorySearch(
      code,
      (data: any, status: any) => {
        if (status === kakao.maps.services.Status.OK && data[0]) {
          results.push({ icon, name: data[0].place_name, tag, lat: Number(data[0].y), lng: Number(data[0].x) });
        }
        done++;
        if (done === KAKAO_CATEGORIES.length) {
          ps.keywordSearch(
            '버스정류장',
            (busData: any, busStatus: any) => {
              if (busStatus === kakao.maps.services.Status.OK && busData[0]) {
                results.push({ icon: '🚌', name: busData[0].place_name, tag: '🚌 저상버스', lat: Number(busData[0].y), lng: Number(busData[0].x) });
              }
              onResult(results);
            },
            { x: String(lng), y: String(lat), radius: 500, size: 1 },
          );
        }
      },
      { location: new kakao.maps.LatLng(lat, lng), radius: 500, size: 1 },
    );
  });
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://blinking-item-process.ngrok-free.dev';

export default function SearchPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get('q'); 

  const { accessibilityMode, setAccessibilityMode, setDestination, origin } = useMobilityStore();
  
  const [query, setQuery] = useState('');
  const [recentSearches, setRecentSearches] = useState<RecentItem[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyItem[]>(DEFAULT_NEARBY);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);

  const isVisual = accessibilityMode === 'visual';

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    getCurrentPosition()
      .then(({ lat, lng }) => {
        fetchNearbyPlaces(lat, lng, (places) => {
          if (places.length > 0) setNearbyPlaces(places);
        });
      })
      .catch(() => {});
  }, []);

  const handleSelectPlace = (item: any) => {
    addRecentSearch({ 
      icon: item.type === 'station' ? '🚉' : '📍', 
      name: item.name, 
      address: item.address || "주소 정보 없음", 
      stationId: item.stationId,
      lat: item.lat || 37.5665,
      lng: item.lng || 126.9780  
    });
    
    setDestination({
      address: item.address || "",
      lat: item.lat || 37.5665,
      lng: item.lng || 126.9780,
      name: item.name,
      stationId: item.stationId
    } as any);
    
    router.push('/result');
  };

  useEffect(() => {
    const processVoiceSearch = async () => {
      if (!q) return;
      setQuery(q);
      setLoading(true);

      try {
        const isStationQuery = q.trim().endsWith('역');

        if (isStationQuery) {
          const backendRes = await fetch(`/api/stations/search?keyword=${encodeURIComponent(q)}`).catch(() => null);

          if (backendRes && backendRes.ok) {
            const json = await backendRes.json();
            if (json.data && json.data.items && json.data.items.length > 0) {
              const firstItem = json.data.items[0];
              const stationData = {
                type: 'station', id: firstItem.stationId, name: firstItem.stationName,
                address: firstItem.address, line: firstItem.lineName || firstItem.line,
                lat: firstItem.lat, lng: firstItem.lng, stationId: firstItem.stationId
              };
              handleSelectPlace(stationData);
              return; 
            }
          }
        }
        handleQueryChange(q);
      } catch (error) {
        console.error("다이렉트 검색 실패:", error);
        handleQueryChange(q);
      }
    };

    processVoiceSearch();
  }, [q]);

  const handleQueryChange = async (val: string) => {
    setQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    let combinedResults: any[] = [];

    try {
      const backendRes = await fetch(`/api/stations/search?keyword=${encodeURIComponent(val)}`).catch(() => null);
      if (backendRes && backendRes.ok) {
        const json = await backendRes.json();
        if (json.data && json.data.items) {
          const stationItems = json.data.items.map((item: any) => ({
            type: 'station', id: item.stationId, name: item.stationName,
            address: item.address, line: item.lineName || item.line,
            lat: item.lat, lng: item.lng, stationId: item.stationId
          }));
          combinedResults = [...combinedResults, ...stationItems];
        }
      }

      const kakao = (window as any).kakao;
      if (kakao && kakao.maps && kakao.maps.services) {
        const ps = new kakao.maps.services.Places();
        const kakaoItems = await new Promise<any[]>((resolve) => {
          ps.keywordSearch(val, (data: any, status: any) => {
            if (status === kakao.maps.services.Status.OK) {
              const mapped = data.map((item: any) => ({
                type: 'place', id: item.id, name: item.place_name, address: item.address_name,
                lat: Number(item.y), lng: Number(item.x)
              }));
              resolve(mapped);
            } else {
              resolve([]);
            }
          });
        });
        combinedResults = [...combinedResults, ...kakaoItems];
      }

      setSearchResults(combinedResults);
    } catch (err) {
      console.error("통합 검색 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRecent = (item: RecentItem) => {
    setDestination({
      address: item.address, lat: item.lat, lng: item.lng,
      name: item.name, stationId: item.stationId
    } as any);
    router.push('/result');
  };

  const handleVoiceSearchClick = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { 
      alert('이 브라우저는 음성 검색을 지원하지 않습니다.'); 
      return; 
    }
    const recognition = new SR();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    
    recognition.onstart  = () => setIsListening(true);
    recognition.onend    = () => setIsListening(false);
    recognition.onerror  = () => { 
      setIsListening(false); 
      alert('음성 인식에 실패했습니다. 다시 시도해 주세요.'); 
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      handleQueryChange(transcript);
    };
    
    recognition.start();
  };

  return (
    <div className={`flex flex-col h-screen overflow-hidden relative ${isVisual ? 'bg-gray-900' : 'bg-white'}`}>
      <SearchForm
        query={query}
        onQueryChange={handleQueryChange}
        onSubmit={() => {}} 
        mode={accessibilityMode}
        onModeChange={setAccessibilityMode}
        onBack={() => router.push('/')}
      />

      {/* ✅ 출발지 표시 — 시각장애 모드에서 크게 */}
      <div className={`px-4 flex items-center gap-3 flex-shrink-0 ${
        isVisual
          ? 'py-5 bg-gray-900 border-b-4 border-yellow-400'
          : 'py-3 bg-white border-b border-gray-100'
      }`}>
        <div className={`rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          isVisual
            ? 'w-12 h-12 border-yellow-400 bg-gray-900'
            : 'w-8 h-8 border-blue-500 bg-white'
        }`}>
          <div className={`rounded-full ${
            isVisual ? 'w-4 h-4 bg-yellow-400' : 'w-2.5 h-2.5 bg-blue-500'
          }`} />
        </div>

        <div className="flex-1 min-w-0">
          <p className={`font-bold uppercase tracking-widest ${
            isVisual ? 'text-[14px] text-yellow-400 mb-1' : 'text-[10px] text-gray-400'
          }`}>
            출발지
          </p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className={`font-extrabold flex-shrink-0 ${
              isVisual ? 'text-[22px] text-white' : 'text-[15px] text-gray-900'
            }`}>
              {origin.name || '내 위치'}
            </p>
            {origin.address && (
              <p className={`truncate font-medium ${
                isVisual ? 'text-[16px] text-gray-300 w-full' : 'text-[12px] text-gray-400'
              }`}>
                {origin.address}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsSearchOpen(true)}
          className={`rounded-xl shadow-sm transition-colors font-bold border flex-shrink-0 ${
            isVisual
              ? 'px-5 py-3 text-[16px] border-yellow-400 bg-gray-800 text-yellow-400 active:bg-gray-700'
              : 'px-3 py-1.5 text-[12px] border-gray-200 bg-white text-gray-600 active:bg-gray-100'
          }`}
        >
          변경
        </button>
      </div>

      {/* 검색 결과 및 본문 */}
      <div className={`flex-1 flex flex-col overflow-y-auto ${isVisual ? 'bg-gray-900' : 'bg-white'}`}>

        {query === '' ? (
          isVisual ? (
            // 시각장애 모드: 음성 검색 버튼
            <div className="flex-1 flex flex-col p-6 items-center justify-center">
              <button 
                onClick={handleVoiceSearchClick}
                className={`w-full max-w-md aspect-square rounded-[3rem] shadow-2xl flex flex-col items-center justify-center gap-6 border-[6px] transition-all active:scale-[0.98] ${
                  isListening 
                    ? 'bg-red-500 border-red-600 animate-pulse' 
                    : 'bg-yellow-400 border-yellow-500'
                }`}
                aria-label="화면을 터치하고 목적지를 말씀하세요."
              >
                <span style={{ fontSize: '80px' }}>{isListening ? '🔴' : '🎤'}</span>
                <div className="text-center px-4">
                  <p className={`text-2xl font-black mb-3 ${isListening ? 'text-white' : 'text-gray-900'}`}>
                    {isListening ? '듣고 있습니다...' : '여기를 눌러 말씀하세요'}
                  </p>
                  <p className={`text-sm font-extrabold px-4 py-2 rounded-full inline-block ${
                    isListening ? 'bg-red-600 text-white' : 'bg-yellow-300 text-gray-800'
                  }`}>
                    예: "시청역", "강남역"
                  </p>
                </div>
              </button>
            </div>
          ) : (
            // 일반 모드: 최근 검색 + 주변 장소
            <div className="px-4 py-3">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500 font-bold">최근 검색</p>
                  {recentSearches.length > 0 && (
                    <button className="text-[11px] text-gray-400 font-bold" onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentSearches([]); }}>
                      전체 삭제
                    </button>
                  )}
                </div>
                {recentSearches.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-gray-50 rounded-2xl">
                    <p className="text-xs text-gray-300">최근 검색 기록이 없습니다</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {recentSearches.map((item) => (
                      <button key={item.name + item.lat} onClick={() => handleSelectRecent(item)} className="flex items-center gap-3 p-3 border border-gray-50 rounded-xl w-full text-left bg-white">
                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-lg">{item.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 font-bold">{item.name}</p>
                          <p className="text-[11px] text-gray-400 truncate">{item.address}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500 font-bold mb-3">주변 접근 가능 장소</p>
                <div className="grid grid-cols-2 gap-2">
                  {nearbyPlaces.map((place) => (
                    <button key={place.tag + place.name} onClick={() => { setDestination({ address: place.name, lat: place.lat, lng: place.lng, name: place.name }); router.push('/result'); }} className="flex flex-col items-start p-4 border border-gray-100 rounded-2xl text-left bg-white shadow-sm">
                      <span className="text-2xl mb-2">{place.icon}</span>
                      <p className="text-[13px] text-gray-900 font-bold mb-1">{place.name}</p>
                      <div className="px-2 py-0.5 bg-blue-50 rounded-full">
                        <span className="text-[9px] text-blue-600 font-bold">{place.tag}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        ) : (
          // ✅ 검색 결과 — 시각장애 모드에서 크게
          <div className="flex flex-col px-4 py-2">
            {loading && (
              <p className={`text-center py-10 font-bold ${
                isVisual ? 'text-[20px] text-yellow-400' : 'text-sm text-gray-400'
              }`}>
                검색 중...
              </p>
            )}
            {!loading && searchResults.length === 0 && (
              <p className={`text-center py-20 font-bold ${
                isVisual ? 'text-[20px] text-gray-400' : 'text-sm text-gray-400'
              }`}>
                검색 결과가 없습니다
              </p>
            )}

            {!loading && searchResults.map((item: any, idx: number) => (
              <button
                key={`${item.id}-${idx}`}
                onClick={() => handleSelectPlace(item)}
                className={`flex items-center gap-4 w-full text-left transition-colors border-b ${
                  isVisual
                    ? 'py-6 border-gray-700 bg-gray-900 active:bg-gray-800'
                    : 'py-4 border-gray-50 bg-white active:bg-gray-50'
                }`}
              >
                {/* 아이콘 */}
                <div className={`rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isVisual
                    ? 'w-14 h-14 bg-gray-800 border-2 border-yellow-400'
                    : 'w-10 h-10 ' + (item.type === 'station' ? 'bg-blue-50' : 'bg-gray-100')
                }`}>
                  <span className={isVisual ? 'text-3xl' : 'text-lg'}>
                    {item.type === 'station' ? '🚉' : '📍'}
                  </span>
                </div>

                {/* 텍스트 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className={`font-bold truncate ${
                      isVisual ? 'text-[22px] text-white' : 'text-[15px] text-gray-900'
                    }`}>
                      {item.name}
                    </p>
                    {item.type === 'station' && item.line && (
                      <span className={`px-2 py-0.5 rounded-md font-extrabold flex-shrink-0 ${
                        isVisual
                          ? 'text-[14px] bg-yellow-400 text-gray-900'
                          : 'text-[10px] bg-blue-100 text-blue-600'
                      }`}>
                        {item.line}
                      </span>
                    )}
                  </div>
                  <p className={`truncate ${
                    isVisual ? 'text-[16px] text-gray-400' : 'text-[12px] text-gray-400'
                  }`}>
                    {item.address || '주소 정보 없음'}
                  </p>
                </div>

                {/* 선택 화살표 (시각장애 모드) */}
                {isVisual && (
                  <span className="text-yellow-400 text-2xl flex-shrink-0">›</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 하단 음성 검색 버튼 */}
      {!(isVisual && query === '') && (
        <div className={`px-4 border-t ${
          isVisual ? 'py-5 bg-gray-900 border-gray-800' : 'py-4 bg-white border-gray-100'
        }`}>
          <button 
            onClick={handleVoiceSearchClick}
            className={`w-full flex items-center justify-center gap-3 rounded-2xl active:scale-[0.98] transition-all shadow-lg ${
              isListening 
                ? 'bg-red-500 text-white animate-pulse'
                : isVisual ? 'bg-yellow-400 text-gray-900' : 'bg-gray-900 text-white'
            } ${isVisual ? 'py-6' : 'py-4'}`}
          >
            <span className={isVisual ? 'text-3xl' : 'text-lg'}>
              {isListening ? '🔴' : '🎤'}
            </span>
            <span className={`font-extrabold ${isVisual ? 'text-[20px]' : 'text-sm'}`}>
              {isListening ? '듣고 있습니다...' : '음성으로 목적지 검색'}
            </span>
          </button>
        </div>
      )}

      {isSearchOpen && (
        <OriginSearchOverlay 
          onClose={() => setIsSearchOpen(false)} 
          onOpenMap={() => setIsMapPickerOpen(true)}
        />
      )}

      {isMapPickerOpen && (
        <MapPickerOverlay 
          onClose={() => setIsMapPickerOpen(false)}
          onConfirm={() => {
            setIsMapPickerOpen(false);
            setIsSearchOpen(false);
          }}
        />
      )}
    </div>
  );
}