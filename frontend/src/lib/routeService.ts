// ────────────────────────────────────────────────────────────
//  src/lib/routeService.ts
// ────────────────────────────────────────────────────────────

const TMAP_KEY = process.env.NEXT_PUBLIC_TMAP_API_KEY;
const ODSAY_KEY = process.env.NEXT_PUBLIC_ODSAY_API_KEY;

interface Coord {
  lat: number;
  lng: number;
  name?: string;
}

export interface WalkResult {
  time: string;
  distance: string;
  coords: { lat: number; lng: number }[];
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}분`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

function toStationName(raw: string | undefined, fallback: string): string {
  const name = raw || fallback;
  return name.endsWith('역') ? name : name + '역';
}

function getTransportLabel(subPath: any[]): string {
  const hasSubway = subPath.some((p) => p.trafficType === 1);
  const hasBus    = subPath.some((p) => p.trafficType === 2);
  if (hasSubway && hasBus) return '도보 + 지하철 + 버스';
  if (hasSubway) return '도보 + 지하철';
  if (hasBus)   return '도보 + 버스';
  return '도보';
}

function getRouteTags(info: any, subPath: any[]): string[] {
  const tags: string[] = [];
  const transfers    = info.totalTransfer ?? 0;
  const hasSubway    = subPath.some((p) => p.trafficType === 1);
  const hasBus       = subPath.some((p) => p.trafficType === 2);
  const walkSegs     = subPath.filter((p) => p.trafficType === 3);
  const totalWalkMin = walkSegs.reduce((s: number, p: any) => s + (p.sectionTime || 0), 0);

  if (transfers === 0) tags.push('직통 노선');
  else tags.push(`환승 ${transfers}회`);
  if (hasSubway) tags.push('엘리베이터 우선');
  if (hasBus)   tags.push('저상버스 연계');
  if (totalWalkMin <= 5)  tags.push('도보 최소');
  else if (totalWalkMin >= 15) tags.push('도보 구간 있음');
  return tags;
}

function assignThemes(paths: any[]): { type: string; icon: string }[] {
  const n = paths.length;
  const result: { type: string; icon: string }[] = new Array(n);
  const assigned = new Set<number>();

  result[0] = { type: '최적 추천', icon: '♿' };
  assigned.add(0);

  const minTransfer = Math.min(...paths.map((p) => p.info.totalTransfer ?? 99));
  const minTransferIdx = paths.findIndex((p) => (p.info.totalTransfer ?? 99) === minTransfer);
  if (!assigned.has(minTransferIdx)) {
    result[minTransferIdx] = { type: '최소 환승', icon: '🔄' };
    assigned.add(minTransferIdx);
  }

  const minTime = Math.min(...paths.map((p) => p.info.totalTime));
  const minTimeIdx = paths.findIndex((p) => p.info.totalTime === minTime);
  if (!assigned.has(minTimeIdx)) {
    result[minTimeIdx] = { type: '최단 시간', icon: '⏱️' };
    assigned.add(minTimeIdx);
  }

  let altCount = 1;
  for (let i = 0; i < n; i++) {
    if (!assigned.has(i)) result[i] = { type: `추천 대안 ${altCount++}`, icon: '💡' };
  }
  return result;
}

// Tmap GeoJSON에서 LineString 좌표 추출
function extractTmapCoords(features: any[]): { lat: number; lng: number }[] {
  const coords: { lat: number; lng: number }[] = [];
  for (const f of features) {
    if (f.geometry?.type === 'LineString') {
      for (const [lng, lat] of f.geometry.coordinates) {
        if (!isNaN(lng) && !isNaN(lat)) coords.push({ lat, lng });
      }
    }
  }
  return coords;
}

// ODsay의 모든 도보 subPath를 실제 보행 경로로 변환
async function buildWalkSegmentCoords(
  subPath: any[],
  origin: Coord,
  destination: Coord
): Promise<{ lat: number; lng: number }[][]> {

  const walkResults: { lat: number; lng: number }[][] = [];

  for (let i = 0; i < subPath.length; i++) {
    const seg = subPath[i];

    // 도보가 아니면 스킵
    if (seg.trafficType !== 3) continue;

    const prev = subPath[i - 1];
    const next = subPath[i + 1];

    let start: Coord | null = null;
    let end: Coord | null = null;

    if (!prev) {
      start = origin;
      if (next) {
        end = {
          lat: Number(next.startY ?? next.y),
          lng: Number(next.startX ?? next.x),
        };
      }
    } else if (!next) {
      end = destination;
      start = {
        lat: Number(prev.endY ?? prev.y),
        lng: Number(prev.endX ?? prev.x),
      };
    } else {
      start = {
        lat: Number(prev.endY ?? prev.y),
        lng: Number(prev.endX ?? prev.x),
      };
      end = {
        lat: Number(next.startY ?? next.y),
        lng: Number(next.startX ?? next.x),
      };
    }

    if (!start || !end) continue;

    if (
      isNaN(start.lat) ||
      isNaN(start.lng) ||
      isNaN(end.lat) ||
      isNaN(end.lng)
    ) continue;

    try {
      const walk = await fetchTmapPedestrian(start, end);
      if (walk.coords.length > 0) {
        walkResults.push(walk.coords);
      }
    } catch (err) {
      console.error('❌ 도보 구간 생성 실패:', err);
    }
  }

  return walkResults;
}

// 1. Tmap 도보 경로
async function fetchTmapPedestrian(start: Coord, end: Coord): Promise<WalkResult> {
  const fallback: WalkResult = { time: '5분', distance: '0.3km', coords: [] };

  try {
    const startLng = Number(start?.lng);
    const startLat = Number(start?.lat);
    const endLng   = Number(end?.lng);
    const endLat   = Number(end?.lat);

    if (
      isNaN(startLng) || isNaN(startLat) || isNaN(endLng) || isNaN(endLat) ||
      startLng === 0  || startLat === 0  || endLng === 0  || endLat === 0
    ) return { time: '0분', distance: '0m', coords: [] };

    if (Math.abs(startLng - endLng) < 0.0002 && Math.abs(startLat - endLat) < 0.0002) {
      return { time: '1분', distance: '10m', coords: [{ lat: startLat, lng: startLng }] };
    }

    const res = await fetch('https://apis.openapi.sk.com/tmap/routes/pedestrian?version=1', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'appKey': TMAP_KEY || '',
      },
      body: JSON.stringify({
        startX: startLng.toFixed(6), startY: startLat.toFixed(6),
        endX:   endLng.toFixed(6),   endY:   endLat.toFixed(6),
        reqCoordType: 'WGS84GEO', resCoordType: 'WGS84GEO',
        startName: 'Start', endName: 'End',
      }),
    });

    if (!res.ok) {
      return fallback;
    }

    const rawText   = await res.text();
    const sanitized = rawText.replace(/[\x00-\x1F\x7F]/g, (ch) => {
      if (ch === '\n') return '\\n';
      if (ch === '\r') return '\\r';
      if (ch === '\t') return '\\t';
      return '';
    });
    const data       = JSON.parse(sanitized);
    const properties = data.features?.[0]?.properties;

    const coords = extractTmapCoords(data.features || []);

    return {
      time:     Math.round((properties?.totalTime || 0) / 60) + '분',
      distance: ((properties?.totalDistance || 0) / 1000).toFixed(1) + 'km',
      coords,
    };
  } catch (err) {
    console.error('❌ Tmap 통신 에러:', err);
    return fallback;
  }
}

// 2. ODsay 대중교통 노선 검색
async function fetchOdsayTransit(start: Coord, end: Coord): Promise<any[]> {
  try {
    const url = `https://api.odsay.com/v1/api/searchPubTransPathT?SX=${start.lng}&SY=${start.lat}&EX=${end.lng}&EY=${end.lat}&apiKey=${encodeURIComponent(ODSAY_KEY || '')}&SearchPathType=0&passShape=1`;
    const res  = await fetch(url);
    const json = await res.json() as any;

    if (json.error) { console.error('❌ ODsay 에러:', json.error); return []; }

    return Array.isArray(json.result?.path) ? json.result.path : [];
  } catch (err) {
    console.error('❌ ODsay 실패:', err);
    return [];
  }
}

// ODsay 노선 그래픽 데이터 가져오기
async function fetchOdsayLane(mapObj: string): Promise<{ lat: number; lng: number }[]> {
  if (!mapObj) return [];
  
  try {
    const mapObjectStr = `0:0@${mapObj}`;
    const url = `https://api.odsay.com/v1/api/loadLane?mapObject=${mapObjectStr}&apiKey=${encodeURIComponent(ODSAY_KEY || '')}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.error) {
      const err = Array.isArray(json.error) ? json.error[0] : json.error;
      console.error(`❌ ODsay loadLane 거절 (코드: ${err.code}):`, err.message || err.msg);
      return [];
    }

    const coords: { lat: number; lng: number }[] = [];
    
    if (json.result && json.result.lane) {
      json.result.lane.forEach((lane: any) => {
        if (lane.section) {
          lane.section.forEach((sec: any) => {
            if (sec.graphPos) {
              sec.graphPos.forEach((pos: any) => {
                coords.push({ lat: pos.y, lng: pos.x });
              });
            }
          });
        }
      });
    }
    return coords;
  } catch (error) {
    console.error('❌ ODsay loadLane 통신/파싱 에러:', error);
    return [];
  }
}

// 3. 최종 다중 경로 조립
export async function generateFullMobilityRoute(origin: Coord, destination: Coord) {
  const allPaths = await fetchOdsayTransit(origin, destination);

  // ✅ [수정됨] 대중교통 경로가 없는 너무 가까운 거리일 경우 '도보 전용 단일 경로' 반환
  if (allPaths.length === 0) {
    console.warn('⚠️ ODsay 대중교통 경로 없음 -> 도보 전용 경로 탐색 시도');
    const walkOnly = await fetchTmapPedestrian(origin, destination);

    if (walkOnly.coords.length === 0) return []; // 도보로도 불가능할 경우 예외 처리

    const totalTimeNum = parseInt(walkOnly.time.replace(/[^0-9]/g, '')) || 0;

    return [{
      id: 1,
      type: '최적 추천',
      title: '교통약자 최적 추천',
      icon: '♿',
      time: formatMinutes(totalTimeNum),
      totalTime: totalTimeNum,
      distance: walkOnly.distance,
      payment: 0,
      totalTransfer: 0,
      transport: '도보',
      tags: ['도보 전용', '환승 0회'],
      stationId: '',
      subPath: [{
        trafficType: 3,
        distance: (parseFloat(walkOnly.distance) || 0) * 1000,
        sectionTime: totalTimeNum,
      }],
      firstWalkCoords: walkOnly.coords,
      transitCoords: [],
      lastWalkCoords: [],
      walkSegmentsCoords: [walkOnly.coords],
      pathShape: null,
      steps: [
        {
          icon: '🚶', direction: `도보로 ${destination.name || '목적지'}까지 이동`,
          detail: `도보 약 ${walkOnly.time} · ${walkOnly.distance}`,
          dist: walkOnly.distance, type: 'turn',
        },
        {
          icon: '📍', direction: `${destination.name || '목적지'} 도착`,
          detail: '도보 안내를 종료합니다.', type: 'arrival',
        },
      ],
    }];
  }

  const topPaths = allPaths.slice(0, 5);
  const themeMap = assignThemes(topPaths);
  const results = [];

  for (let index = 0; index < topPaths.length; index++) {
    const path = topPaths[index];
    const info = path.info;
    const subPath: any[] = path.subPath || [];
    const subwaySegments = subPath.filter((p: any) => p.trafficType === 1);
    const busSegments    = subPath.filter((p: any) => p.trafficType === 2);
    const firstSubway    = subwaySegments[0];
    const lastSubway     = subwaySegments[subwaySegments.length - 1];

    const startStationCoord: Coord = {
      name: toStationName(firstSubway?.startName, '출발역'),
      lng:  Number(firstSubway?.startX ?? firstSubway?.x ?? origin.lng),
      lat:  Number(firstSubway?.startY ?? firstSubway?.y ?? origin.lat),
    };
    const endStationCoord: Coord = {
      name: toStationName(lastSubway?.endName, '도착역'),
      lng:  Number(lastSubway?.endX ?? destination.lng),
      lat:  Number(lastSubway?.endY ?? destination.lat),
    };

    const skipLastWalk =
      Math.abs(endStationCoord.lat - destination.lat) < 0.0002 &&
      Math.abs(endStationCoord.lng - destination.lng) < 0.0002;

    const [
      firstWalk,
      lastWalk,
      transitCoords,
      walkSegmentsCoords
    ] = await Promise.all([

      fetchTmapPedestrian(origin, startStationCoord),

      skipLastWalk
        ? Promise.resolve({
            time: '0분',
            distance: '0m',
            coords: [] as { lat: number; lng: number }[],
          })
        : fetchTmapPedestrian(endStationCoord, destination),

      info.mapObj
        ? fetchOdsayLane(info.mapObj)
        : Promise.resolve([] as { lat: number; lng: number }[]),

      buildWalkSegmentCoords(
        subPath,
        origin,
        destination
      )
    ]);

    const firstWalkSeg = subPath[0]?.trafficType === 3 ? subPath[0] : null;
    const lastWalkSeg  = subPath[subPath.length - 1]?.trafficType === 3 ? subPath[subPath.length - 1] : null;

    const firstWalkDesc = firstWalkSeg
      ? `도보 약 ${firstWalkSeg.sectionTime}분${firstWalk?.distance ? ` · ${firstWalk.distance}` : ''}`
      : firstWalk?.distance ? `도보 · ${firstWalk.distance}` : '도보 이동';
    const lastWalkDesc = lastWalkSeg
      ? `도보 약 ${lastWalkSeg.sectionTime}분${lastWalk?.distance ? ` · ${lastWalk.distance}` : ''}`
      : lastWalk?.distance ? `도보 · ${lastWalk.distance}` : '도보 이동';

    const subwayLineNames = subwaySegments.map((s: any) => s.lane?.[0]?.name).filter(Boolean).join(' → ');
    const busLineNames    = busSegments.map((s: any) => s.lane?.[0]?.busNo).filter(Boolean).map((n: string) => `${n}번`).join(', ');

    const currentTheme = themeMap[index];

    results.push({
      id: index + 1,
      type:  currentTheme.type,
      title: `교통약자 ${currentTheme.type}`,
      icon:  currentTheme.icon,
      time:          formatMinutes(info.totalTime),
      totalTime:     info.totalTime,
      distance:      `${(info.totalDistance / 1000).toFixed(1)}km`,
      payment:       info.payment || 0,
      totalTransfer: info.totalTransfer || 0,
      transport:     getTransportLabel(subPath),
      tags:          getRouteTags(info, subPath),
      stationId:     firstSubway?.startStationCityCode || 'jamsil',
      subPath,
      firstWalkCoords: firstWalk.coords,
      transitCoords:   transitCoords,
      lastWalkCoords:  lastWalk.coords,
      walkSegmentsCoords,
      pathShape: path.passShape?.linestring || null,
      steps: [
        {
          icon: '🚶', direction: `도보로 ${startStationCoord.name}까지 이동`,
          detail: firstWalkDesc, dist: firstWalk?.distance, type: 'turn',
        },
        {
          icon: '🛗', direction: '역사 내 엘리베이터 이용',
          detail: `${startStationCoord.name} 대합실 → 승강장`,
          dist: '역내 이동', type: 'elevator', stationLink: true,
          stationId: firstSubway?.startStationCityCode || 'jamsil',
        },
        ...(subwayLineNames ? [{
          icon: '🚇', direction: `${subwayLineNames} 탑승`,
          detail: `${firstSubway?.startName}역 → ${lastSubway?.endName}역`,
          dist: info.subwayDistance != null ? `${(info.subwayDistance / 1000).toFixed(1)}km` : undefined,
          type: 'transit',
        }] : []),
        ...(busLineNames ? [{
          icon: '🚌', direction: `버스 ${busLineNames} 탑승`,
          detail: `${busSegments[0]?.startName} → ${busSegments[busSegments.length - 1]?.endName}`,
          dist: undefined, type: 'transit',
        }] : []),
        {
          icon: '📍', direction: `${destination.name || '목적지'} 도착`,
          detail: skipLastWalk ? '하차 후 바로 도착' : lastWalkDesc,
          dist: skipLastWalk ? undefined : lastWalk?.distance, type: 'arrival',
        },
      ],
    });

    // 200ms 대기 (오디세이 API 호출 제한 방지)
    if (index < topPaths.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  return results;
}