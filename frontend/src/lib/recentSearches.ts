const KEY = 'mobility_recent_searches';
const MAX = 5;

export type RecentSearch = {
  icon: string;
  name: string;
  address: string;
  stationId?: string | number;
};

// 불러오기
export function getRecentSearches(): RecentSearch[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]');
  } catch {
    return [];
  }
}

// 저장 (맨 앞에 추가, 중복 제거, 최대 5개)
export function addRecentSearch(item: RecentSearch) {
  const prev = getRecentSearches().filter((r) => r.name !== item.name);
  const next = [item, ...prev].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(next));
}

// 전체 삭제
export function clearRecentSearches() {
  localStorage.removeItem(KEY);
}