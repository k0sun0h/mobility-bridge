
// ────────────────────────────────────────────────────────────
//  useKakaoMap — 카카오맵 SDK 동적 로드 훅
//
//  사용법:
//    const { isLoaded, isError } = useKakaoMap();
//
//  환경변수 설정 (프로젝트 루트 .env.local):
//    NEXT_PUBLIC_KAKAO_MAP_KEY=발급받은_JavaScript_키
// ────────────────────────────────────────────────────────────
'use client';

import { useState, useEffect } from 'react';

// TODO(api): 실제 키는 .env.local 파일의 NEXT_PUBLIC_KAKAO_MAP_KEY에 설정
const KAKAO_MAP_KEY = process.env.NEXT_PUBLIC_KAKAO_MAP_KEY as string | undefined;

const SCRIPT_ID = 'kakao-map-sdk';

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

// 전역 상태 — 여러 컴포넌트에서 중복 로드 방지
let globalState: LoadState = 'idle';
const listeners: Array<(state: LoadState) => void> = [];

function notify(state: LoadState) {
  globalState = state;
  listeners.forEach((fn) => fn(state));
}

export function useKakaoMap() {
  const [state, setState] = useState<LoadState>(globalState);

  useEffect(() => {
    const handler = (s: LoadState) => setState(s);
    listeners.push(handler);

    if (globalState === 'loaded') {
      setState('loaded');
      return () => {
        listeners.splice(listeners.indexOf(handler), 1);
      };
    }

    if (globalState === 'loading') {
      return () => {
        listeners.splice(listeners.indexOf(handler), 1);
      };
    }

    // 키가 없으면 에러
    if (!KAKAO_MAP_KEY) {
      console.error(
        '[KakaoMap] NEXT_PUBLIC_KAKAO_MAP_KEY 환경변수가 설정되지 않았습니다.\n' +
          '프로젝트 루트에 .env.local 파일을 만들고\n' +
          'NEXT_PUBLIC_KAKAO_MAP_KEY=발급받은_JavaScript_키 를 입력하세요.',
      );
      notify('error');
      return () => {
        listeners.splice(listeners.indexOf(handler), 1);
      };
    }

    // 이미 스크립트가 있으면 재사용
    if (document.getElementById(SCRIPT_ID)) {
      if (typeof kakao !== 'undefined' && kakao.maps) {
        notify('loaded');
      }
      return () => {
        listeners.splice(listeners.indexOf(handler), 1);
      };
    }

    notify('loading');

    // autoload=false → kakao.maps.load() 콜백으로 초기화 시점 제어
    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_KEY}&libraries=services&autoload=false`;
    script.async = true;

    script.onload = () => {
      kakao.maps.load(() => {
        notify('loaded');
      });
    };

    script.onerror = () => {
      console.error('[KakaoMap] SDK 스크립트 로드 실패. JavaScript 키와 도메인 허용 설정을 확인하세요.');
      notify('error');
    };

    document.head.appendChild(script);

    return () => {
      listeners.splice(listeners.indexOf(handler), 1);
    };
  }, []);

  return {
    isLoaded: state === 'loaded',
    isLoading: state === 'loading' || state === 'idle',
    isError: state === 'error',
  };
}