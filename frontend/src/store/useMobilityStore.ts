// src/store/useMobilityStore.ts
import { create } from 'zustand';
import type { AccessibilityMode, Route } from '../types';

interface LocationInfo {
  address: string;
  lat: number;
  lng: number;
  name?: string;
}

interface MobilityState {
  accessibilityMode: AccessibilityMode;
  setAccessibilityMode: (mode: AccessibilityMode) => void;

  origin: LocationInfo;
  setOrigin: (v: LocationInfo) => void;
  
  destination: LocationInfo;
  setDestination: (v: LocationInfo) => void;

  selectedRouteId: number | null;
  setSelectedRouteId: (id: number | null) => void;
  
  routes: Route[];
  setRoutes: (routes: Route[]) => void;

  selectedRouteData: Route | null; 
  setSelectedRouteData: (route: Route | null) => void;

  // 🚨 [핵심 추가] AI 분석 입력 데이터(Payload)를 저장할 타입 정의
  selectedAiPayload: any;
  setSelectedAiPayload: (payload: any) => void;

  currentStepIndex: number;
  setCurrentStepIndex: (index: number) => void;
  nextStep: () => void;
  resetNavigation: () => void;
}

export const useMobilityStore = create<MobilityState>((set) => ({
  accessibilityMode: 'wheelchair',
  setAccessibilityMode: (mode) => set({ accessibilityMode: mode }),

  // 출발지 초기값
  origin: { 
    address: ' ', 
    lat: 37.5662, 
    lng: 126.9924,
    name: '' 
  },
  setOrigin: (v) => set({ origin: v }),
  
  destination: { 
    address: ' ', 
    lat: 37.5266, 
    lng: 127.1079, 
    name: ' ' 
  },
  setDestination: (v) => set({ destination: v }),

  selectedRouteId: 1,
  setSelectedRouteId: (id) => set({ selectedRouteId: id }),
  
  routes: [],
  setRoutes: (routes) => set({ routes }),

  // ✅ 경로 바구니 초기값 및 담는 함수 구현
  selectedRouteData: null,
  setSelectedRouteData: (route) => set({ selectedRouteData: route }),

  // 🚨 [핵심 추가] AI Payload 바구니 초기값 및 담는 함수 구현
  selectedAiPayload: null,
  setSelectedAiPayload: (payload) => set({ selectedAiPayload: payload }),

  currentStepIndex: 0,
  setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
  nextStep: () => set((s) => ({ currentStepIndex: s.currentStepIndex + 1 })),
  resetNavigation: () => set({ currentStepIndex: 0 }),
}));