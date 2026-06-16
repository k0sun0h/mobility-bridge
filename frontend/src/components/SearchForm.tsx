// ────────────────────────────────────────────────────────────
//  SearchForm — 목적지 검색 입력 + 접근성 모드 칩
// ────────────────────────────────────────────────────────────

import type { AccessibilityMode } from '../types';

interface SearchFormProps {
  query: string;
  onQueryChange: (v: string) => void;
  onSubmit: () => void; // 👈 1. 부모에게 검색 실행을 알릴 함수 추가
  mode: AccessibilityMode;
  onModeChange: (m: AccessibilityMode) => void;
  onBack: () => void;
}

const MODE_CHIPS: { id: AccessibilityMode; label: string }[] = [
  { id: 'wheelchair', label: '♿ 휠체어/유모차' },
  { id: 'visual', label: '🦯 시각장애' },
  { id: 'senior', label: '👴 고령자' },
];

export function SearchForm({
  query,
  onQueryChange,
  onSubmit, // 👈 2. props로 받아오기
  mode,
  onModeChange,
  onBack,
}: SearchFormProps) {
  return (
    <div className="px-4 py-3 border-b border-gray-200">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 border-2 border-gray-300 rounded-full flex items-center justify-center flex-shrink-0"
        >
          <span style={{ fontSize: '16px' }}>←</span>
        </button>
        
        {/* 👈 3. div를 form으로 변경하고 onSubmit 이벤트 연결 */}
        <form 
          onSubmit={(e) => {
            e.preventDefault(); // 페이지 새로고침 방지
            onSubmit(); // 부모 컴포넌트의 검색 함수 실행
          }}
          className="flex-1 flex items-center border-2 border-gray-800 rounded-xl px-3 gap-2 bg-gray-50"
        >
          <span style={{ fontSize: '16px' }}>🔍</span>
          <input
            type="text"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="목적지를 입력하세요"
            className="flex-1 bg-transparent outline-none py-2.5"
            style={{ fontSize: '14px', color: '#111827' }}
          />
          {query && (
            <button 
              type="button" // form 제출을 막기 위해 type="button" 명시
              onClick={() => onQueryChange('')} 
              style={{ fontSize: '14px', color: '#9ca3af' }}
            >
              ✕
            </button>
          )}
        </form>
      </div>

      {/* 접근성 모드 칩 (기존과 동일) */}
      <div className="flex gap-2 mt-3">
        {MODE_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button" // form 안의 버튼이 아니지만 습관적으로 명시하면 좋습니다.
            onClick={() => onModeChange(chip.id)}
            className={`px-3 py-1 rounded-full border-2 ${
              mode === chip.id
                ? 'border-gray-800 bg-gray-800 text-white'
                : 'border-gray-300 text-gray-500 bg-white'
            }`}
            style={{ fontSize: '12px' }}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}