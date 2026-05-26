// src/components/search/OriginSearchOverlay.tsx
"use client";

import { useState } from 'react';
import { useMobilityStore } from '@/store/useMobilityStore';
import { IoArrowBack, IoSearch, IoCloseCircle, IoMapOutline, IoLocationOutline, IoBookmarkOutline } from "react-icons/io5";
import { getCurrentPosition } from '@/lib/map';

interface Props {
  onClose: () => void;
  onOpenMap: () => void;
}

export default function OriginSearchOverlay({ onClose, onOpenMap }: Props) {
  const [keyword, setKeyword]     = useState('');
  const [results, setResults]     = useState<any[]>([]);
  const [isListening, setIsListening] = useState(false);
  const { setOrigin, accessibilityMode } = useMobilityStore();

  const isVisual = accessibilityMode === 'visual';

  const handleSearch = (val: string) => {
    setKeyword(val);
    if (!val.trim()) return setResults([]);

    const kakao = (window as any).kakao;
    if (!kakao?.maps?.services) return;

    const ps = new kakao.maps.services.Places();
    ps.keywordSearch(val, (data: any, status: any) => {
      if (status === kakao.maps.services.Status.OK) setResults(data);
      else setResults([]);
    });
  };

  const handleCurrentLocation = async () => {
    try {
      const { lat, lng } = await getCurrentPosition();
      const kakao = (window as any).kakao;
      if (!kakao?.maps?.services) { alert('카카오 맵 서비스를 불러올 수 없습니다.'); return; }

      const geocoder = new kakao.maps.services.Geocoder();
      geocoder.coord2Address(lng, lat, (result: any, status: any) => {
        if (status === kakao.maps.services.Status.OK && result[0]) {
          const addr =
            result[0].road_address?.address_name ??
            result[0].address?.address_name ??
            '현재 위치';
          setOrigin({ address: addr, lat, lng, name: '내 위치' });
          onClose();
        } else {
          alert('현재 위치의 주소를 변환할 수 없습니다.');
        }
      });
    } catch {
      alert('현재 위치를 가져올 수 없습니다. GPS 권한을 확인해주세요.');
    }
  };

  // ✅ 음성 인식
  const handleVoice = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('이 브라우저는 음성 검색을 지원하지 않습니다.'); return; }
    const recognition = new SR();
    recognition.lang = 'ko-KR';
    recognition.interimResults = false;
    recognition.onstart  = () => setIsListening(true);
    recognition.onend    = () => setIsListening(false);
    recognition.onerror  = () => { setIsListening(false); alert('음성 인식에 실패했습니다.'); };
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      handleSearch(transcript);
    };
    recognition.start();
  };

  const selectResult = (item: any) => {
    setOrigin({ address: item.address_name, lat: Number(item.y), lng: Number(item.x), name: item.place_name });
    onClose();
  };

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col ${isVisual ? 'bg-slate-900' : 'bg-white'}`}>

      {/* ── 상단 검색바 ── */}
      <div className={`flex items-center gap-3 border-b flex-shrink-0 ${
        isVisual ? 'p-5 border-slate-700 bg-slate-900' : 'p-4 border-gray-200 bg-white'
      }`}>
        <button
          onClick={onClose}
          className={`flex items-center justify-center rounded-full border-2 flex-shrink-0 ${
            isVisual
              ? 'w-12 h-12 border-yellow-400 text-yellow-400'
              : 'w-9 h-9 border-gray-300 text-gray-700'
          }`}
        >
          <IoArrowBack size={isVisual ? 24 : 20} />
        </button>

        <div className={`flex-1 flex items-center gap-2 rounded-2xl ${
          isVisual
            ? 'bg-slate-800 border-2 border-yellow-400 px-4 py-3'
            : 'bg-gray-100 rounded-full px-4 py-2'
        }`}>
          <IoSearch className={isVisual ? 'text-yellow-400 text-xl' : 'text-gray-400'} size={isVisual ? 22 : 16} />
          <input
            className={`bg-transparent flex-1 outline-none font-medium ${
              isVisual ? 'text-white text-[20px]' : 'text-[14px] text-gray-900'
            }`}
            placeholder={isVisual ? '출발지를 입력하세요' : '출발지를 입력하세요'}
            style={{ caretColor: isVisual ? '#facc15' : undefined }}
            value={keyword}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {keyword && (
            <button onClick={() => { setKeyword(''); setResults([]); }}>
              <IoCloseCircle className={isVisual ? 'text-yellow-400 text-2xl' : 'text-gray-400'} size={isVisual ? 24 : 18} />
            </button>
          )}
        </div>
      </div>

      {/* ── 퀵 메뉴 ── */}
      <div className={`flex justify-around border-b flex-shrink-0 ${
        isVisual ? 'p-5 border-slate-700 bg-slate-900' : 'p-4 border-gray-100'
      }`}>
        {/* 현위치 */}
        <button
          onClick={handleCurrentLocation}
          className={`flex flex-col items-center gap-1 transition-colors ${
            isVisual ? 'text-yellow-400' : 'text-gray-600'
          }`}
        >
          <IoLocationOutline size={isVisual ? 30 : 22} />
          <span style={{ fontSize: isVisual ? 16 : 12, fontWeight: 600 }}>현위치</span>
        </button>

        {/* 지도에서 선택 */}
        <button
          onClick={onOpenMap}
          className={`flex flex-col items-center gap-1 transition-colors ${
            isVisual ? 'text-yellow-400' : 'text-gray-600'
          }`}
        >
          <IoMapOutline size={isVisual ? 30 : 22} />
          <span style={{ fontSize: isVisual ? 16 : 12, fontWeight: 600 }}>지도에서 선택</span>
        </button>

        {/* 즐겨찾기 */}
        <button
          className={`flex flex-col items-center gap-1 transition-colors ${
            isVisual ? 'text-yellow-400' : 'text-gray-600'
          }`}
        >
          <IoBookmarkOutline size={isVisual ? 30 : 22} />
          <span style={{ fontSize: isVisual ? 16 : 12, fontWeight: 600 }}>즐겨찾기</span>
        </button>
      </div>

      {/* ── 검색 결과 ── */}
      <div className={`flex-1 overflow-y-auto ${isVisual ? 'bg-slate-900' : 'bg-white'}`}>
        {results.length > 0 ? (
          results.map((item) => (
            <button
              key={item.id}
              onClick={() => selectResult(item)}
              className={`w-full text-left flex items-center gap-4 border-b transition-colors ${
                isVisual
                  ? 'py-6 px-5 border-slate-700 bg-slate-900 active:bg-slate-800'
                  : 'p-4 border-gray-50 hover:bg-gray-50'
              }`}
            >
              {/* 아이콘 */}
              <div className={`flex items-center justify-center rounded-xl flex-shrink-0 ${
                isVisual
                  ? 'w-14 h-14 bg-slate-800 border-2 border-yellow-400'
                  : 'w-10 h-10 bg-gray-100'
              }`}>
                <span style={{ fontSize: isVisual ? 28 : 18 }}>📍</span>
              </div>

              {/* 텍스트 */}
              <div className="flex-1 min-w-0">
                <p className={`font-bold truncate ${
                  isVisual ? 'text-[22px] text-white' : 'text-[15px] text-gray-900'
                }`}>
                  {item.place_name}
                </p>
                <p className={`truncate mt-0.5 ${
                  isVisual ? 'text-[16px] text-gray-400' : 'text-[12px] text-gray-500'
                }`}>
                  {item.address_name}
                </p>
              </div>

              {isVisual && (
                <span className="text-yellow-400 text-2xl flex-shrink-0">›</span>
              )}
            </button>
          ))
        ) : keyword.trim() !== '' ? (
          <p className={`text-center py-16 font-bold ${
            isVisual ? 'text-[20px] text-gray-400' : 'text-sm text-gray-400'
          }`}>
            검색 결과가 없습니다.
          </p>
        ) : null}
      </div>

      {/* ── 하단 음성 검색 버튼 (시각장애 모드) ── */}
      {isVisual && (
        <div className="flex-shrink-0 px-5 py-6 bg-slate-900 border-t border-slate-700">
          <button
            onClick={handleVoice}
            className={`w-full flex items-center justify-center gap-3 rounded-2xl py-6 active:scale-[0.98] transition-all font-extrabold text-[20px] shadow-lg ${
              isListening
                ? 'bg-red-500 text-white animate-pulse'
                : 'bg-yellow-400 text-gray-900'
            }`}
          >
            <span style={{ fontSize: 28 }}>{isListening ? '🔴' : '🎤'}</span>
            {isListening ? '듣고 있습니다...' : '음성으로 출발지 검색'}
          </button>
        </div>
      )}
    </div>
  );
}