// ────────────────────────────────────────────────────────────
//  Mobility Bridge — 포맷 유틸리티
// ────────────────────────────────────────────────────────────

/** AI 점수(0~100)에 따른 색상 반환 */
export function getScoreColor(score: number): string {
  if (score >= 85) return '#1f2937';
  if (score >= 70) return '#6b7280';
  return '#f97316';
}

/** AI 점수에 따른 배경색 반환 */
export function getScoreBg(score: number): string {
  if (score >= 70) return '#f9fafb';
  return '#fff7ed';
}

/** AI 점수에 따른 테두리 색상 반환 */
export function getScoreBorder(score: number): string {
  if (score >= 70) return '#d1d5db';
  return '#fed7aa';
}

/** 별점(1~5)에 대응하는 한글 라벨 */
export function getRatingLabel(rating: number): string {
  const labels = ['', '매우 불편했어요', '불편했어요', '보통이에요', '편했어요', '매우 편했어요'];
  return labels[rating] ?? '';
}

/** 분 단위 소요시간을 "N분" 형식으로 포맷 */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

/** 미터 단위 거리를 "Nm" 또는 "N.Nkm" 형식으로 포맷 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}
