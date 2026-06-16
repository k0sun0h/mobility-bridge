// src/components/search/MapPickerOverlay.tsx
"use client";

import { useEffect, useState, useRef } from 'react';
import { useKakaoMap } from '@/lib/useKakaoMap';
import { useMobilityStore } from '@/store/useMobilityStore';
import { IoArrowBack } from "react-icons/io5";

interface Props {
  onClose: () => void;
  onConfirm: () => void;
}

export default function MapPickerOverlay({ onClose, onConfirm }: Props) {
  const { isLoaded } = useKakaoMap();
  const [address, setAddress] = useState("위치를 확인 중입니다...");
  const [coords, setCoords] = useState({ lat: 37.5665, lng: 126.9780 });
  const mapRef = useRef<any>(null);
  const { setOrigin } = useMobilityStore();

  useEffect(() => {
    if (!isLoaded) return;

    const container = document.getElementById('picker-map');
    const options = { center: new kakao.maps.LatLng(coords.lat, coords.lng), level: 3 };
    const map = new kakao.maps.Map(container!, options);
    mapRef.current = map;

    const geocoder = new kakao.maps.services.Geocoder();

    // 지도가 움직일 때마다 주소 업데이트
    kakao.maps.event.addListener(map, 'idle', () => {
      const center = map.getCenter();
      setCoords({ lat: center.getLat(), lng: center.getLng() });
      
      geocoder.coord2Address(center.getLng(), center.getLat(), (result: any, status: any) => {
        if (status === kakao.maps.services.Status.OK) {
          setAddress(result[0].address.address_name);
        }
      });
    });
  }, [isLoaded]);

  const handleSelect = () => {
    setOrigin({ address, lat: coords.lat, lng: coords.lng, name: address });
    onConfirm();
  };


  return (
    <div className="fixed inset-0 bg-white z-[200] flex flex-col">
      <div className="p-4 flex items-center justify-between border-b">
        <IoArrowBack size={24} onClick={onClose} />
        <span className="font-bold">지도에서 선택</span>
        <div className="w-6" />
      </div>

      <div className="flex-1 relative">
        <div id="picker-map" className="w-full h-full" />
        
        {/* 중앙 고정 핀 아이콘 (IMG_9766.jpg 참고) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none">
          <img src="/images/marker.png" alt="pin" className="w-10 h-10" />
        </div>
      </div>

      {/* 하단 주소 카드 (IMG_9766.jpg 참고) */}
      <div className="p-6 bg-white rounded-t-3xl shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
        <div className="text-lg font-bold mb-1">{address}</div>
        <div className="text-sm text-gray-400 mb-6">지도를 움직여 아이콘을 원하는 위치로 옮기세요</div>
        <button 
          onClick={handleSelect}
          className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg"
        >
          선택
        </button>
      </div>
    </div>
  );
}