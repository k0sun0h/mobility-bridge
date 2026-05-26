// ────────────────────────────────────────────────────────────
//  ContactCallButton — 전화 연결 버튼
// ────────────────────────────────────────────────────────────

interface ContactCallButtonProps {
  label: string;
  phoneNumber: string;
  /** 버튼 전체 너비 여부 */
  fullWidth?: boolean;
}

export function ContactCallButton({
  label,
  phoneNumber,
  fullWidth = true,
}: ContactCallButtonProps) {
  const handleCall = () => {
    window.location.href = `tel:${phoneNumber}`;
  };

  return (
    <button
      onClick={handleCall}
      className={`flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2.5 transition-all active:bg-gray-200 ${
        fullWidth ? 'w-full' : ''
      }`}
    >
      <span style={{ fontSize: '16px' }}>📞</span>
      <div className="text-left">
        <p style={{ fontSize: '11px', fontWeight: 700, color: '#111827' }}>{label}</p>
        <p style={{ fontSize: '10px', color: '#6b7280' }}>{phoneNumber}</p>
      </div>
    </button>
  );
}
