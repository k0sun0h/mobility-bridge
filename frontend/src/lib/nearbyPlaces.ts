export type NearbyPlace = {
  icon: string;
  name: string;
  tag: string;
  address: string;
};

// 카카오 카테고리 코드
const CATEGORIES = [
  { code: 'HP8', icon: '🏥', tag: '♿ 접근 가능', label: '병원' },
  { code: 'PO3', icon: '🏛️', tag: '♿ 접근 가능', label: '공공기관' }, // 주민센터 포함
  { code: 'CS2', icon: '🏪', tag: '🛗 엘리베이터', label: '편의점' },
] as const;

export function getNearbyPlaces(
  lat: number,
  lng: number,
  onResult: (places: NearbyPlace[]) => void
) {
  const ps = new kakao.maps.services.Places();
  const results: NearbyPlace[] = [];
  let done = 0;

  CATEGORIES.forEach(({ code, icon, tag }) => {
    ps.categorySearch(
      code,
      (data : any, status : any) => {
        if (status === kakao.maps.services.Status.OK && data[0]) {
          results.push({
            icon,
            name: data[0].place_name,
            address: data[0].road_address_name || data[0].address_name,
            tag,
          });
        }
        done++;
        if (done === CATEGORIES.length) {
          // 버스정류장은 키워드 검색
          ps.keywordSearch(
            '버스정류장',
            (busData : any, busStatus : any) => {
              if (busStatus === kakao.maps.services.Status.OK && busData[0]) {
                results.push({
                  icon: '🚌',
                  name: busData[0].place_name,
                  address: busData[0].road_address_name || busData[0].address_name,
                  tag: '🚌 저상버스',
                });
              }
              onResult(results);
            },
            { x: String(lng), y: String(lat), radius: 500, size: 1 }
          );
        }
      },
      { location: new kakao.maps.LatLng(lat, lng), radius: 500, size: 1 }
    );
  });
}