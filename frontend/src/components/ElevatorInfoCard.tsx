// ────────────────────────────────────────────────────────────
//  ElevatorInfoCard — 엘리베이터 단일 상태 카드 (리스트 아이템)
// ────────────────────────────────────────────────────────────

import type { Elevator } from '../types';

interface ElevatorInfoCardProps {
  elevator: Elevator;
  isHighlighted: boolean;
  isFirst: boolean;
  onClick: () => void;
}

export function ElevatorInfoCard({
  elevator,
  isHighlighted,
  isFirst,
  onClick,
}: ElevatorInfoCardProps) {
  const isUnderMaintenance = elevator.status === '점검 중';

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 transition-all text-left ${
        !isFirst ? 'border-t border-gray-100' : ''
      } ${isHighlighted ? 'bg-gray-800' : 'bg-white'}`}
    >
      {/* 아이콘 박스 */}
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{
          background: isHighlighted
            ? 'white'
            : isUnderMaintenance
            ? '#fff7ed'
            : '#f3f4f6',
          border: `2px solid ${isUnderMaintenance ? '#fed7aa' : '#e5e7eb'}`,
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 800,
            color: isHighlighted
              ? '#1f2937'
              : isUnderMaintenance
              ? '#f97316'
              : '#374151',
          }}
        >
          E
        </span>
      </div>

      {/* 정보 */}
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontSize: '13px',
              fontWeight: 700,
              color: isHighlighted ? 'white' : '#111827',
            }}
          >
            {elevator.label}
          </span>
          <span
            className="px-1.5 py-0.5 rounded"
            style={{
              fontSize: '9px',
              fontWeight: 600,
              color: isUnderMaintenance
                ? '#f97316'
                : isHighlighted
                ? '#1f2937'
                : '#16a34a',
              background: isUnderMaintenance
                ? '#fff7ed'
                : isHighlighted
                ? 'white'
                : '#f0fdf4',
            }}
          >
            {isUnderMaintenance ? '⚠ 점검 중' : '● 정상'}
          </span>
        </div>
        <p
          style={{
            fontSize: '11px',
            color: isHighlighted ? '#d1d5db' : '#6b7280',
            marginTop: '2px',
          }}
        >
          {elevator.floors}
        </p>
      </div>

      {/* 펼침 화살표 */}
      <span style={{ fontSize: '12px', color: isHighlighted ? 'white' : '#9ca3af' }}>
        {isHighlighted ? '▲' : '▼'}
      </span>
    </button>
  );
}
