# 정규식 처리를 위한 라이브러리
import re

# 타입 힌트용 라이브러리
from typing import Optional, List, Dict, Any, Tuple

# 환경변수 읽기
import os

# 외부 API 요청용 라이브러리
import httpx

# .env 파일 로드
from dotenv import load_dotenv


# ---------------------------------------------------
# .env 파일 불러오기
# ---------------------------------------------------
load_dotenv()


# ---------------------------------------------------
# 서울 열린데이터광장 설정
# ---------------------------------------------------
SEOUL_OPEN_API_KEY = (os.getenv("SEOUL_OPEN_API_KEY") or "").strip()
SEOUL_BASE_URL = "http://openapi.seoul.go.kr:8088"

# 역 주소 및 전화번호 서비스명
SEOUL_STATION_SERVICE = "StationAdresTelno"

# 지하철역 엘리베이터 위치 서비스명
SEOUL_ELEVATOR_SERVICE = "tbTraficElvtr"


# ---------------------------------------------------
# 역 데이터 캐시
#
# 서울시 API를 매 요청마다 호출하면 30초씩 대기가 발생합니다.
# 서버 시작 후 최초 1회만 API를 호출하고, 이후 요청은
# 메모리에 저장된 캐시에서 즉시 반환하도록 설계했습니다.
#
# 효과:
# - 최초 요청: 최대 3초 (타임아웃) 또는 실제 API 응답 시간
# - 이후 요청: 0.01초 이하 즉시 응답
# ---------------------------------------------------
_station_cache: List[Dict[str, Any]] = []
_cache_loaded: bool = False


# ---------------------------------------------------
# 공통 유틸 함수
# ---------------------------------------------------
def ensure_seoul_api_key() -> str:
    """
    서울 열린데이터광장 인증키 존재 여부 확인
    """
    if not SEOUL_OPEN_API_KEY:
        raise ValueError("SEOUL_OPEN_API_KEY가 없습니다. .env 파일을 확인하세요.")
    return SEOUL_OPEN_API_KEY


def safe_str(value: Any) -> Optional[str]:
    """
    값을 안전하게 문자열로 변환
    - None이면 None 반환
    - 공백뿐인 문자열이면 None 반환
    """
    if value is None:
        return None

    text = str(value).strip()
    return text if text else None


def build_station_id(line_name: Optional[str], station_name: Optional[str]) -> str:
    """
    역 상세 조회용 고정 stationId 생성
    예: 2호선 + 강남 -> 2호선_강남

    원본 역코드가 아닌 프론트엔드 URL에서 안정적으로 사용하기 위한 내부 식별자
    """
    line = safe_str(line_name) or "unknown-line"
    station = safe_str(station_name) or "unknown-station"

    raw_id = f"{line}_{station}"
    raw_id = re.sub(r"\s+", "", raw_id)  # 공백 제거
    raw_id = raw_id.replace("/", "_")    # 슬래시를 언더스코어로 변환

    return raw_id


def normalize_station_name_for_match(name: Optional[str]) -> str:
    """
    역명 비교를 위한 정규화
    - 공백 제거, 소문자 변환, 끝의 '역' 제거
    """
    if not name:
        return ""

    text = str(name).strip().lower()
    text = re.sub(r"\s+", "", text)

    if text.endswith("역"):
        text = text[:-1]

    return text


# ---------------------------------------------------
# 역 좌표 매핑 함수
#
# [배경 설명]
# 서울시 StationAdresTelno API는 역명, 호선, 주소, 전화번호는 제공하지만
# 카카오맵 마커에 필요한 위도/경도 좌표는 제공하지 않습니다.
#
# 해결 방안:
# 1. 카카오 지오코딩 API: 주소→좌표 변환 (API 키 추가 필요, 비용 발생)
# 2. 별도 좌표 DB 연동: 시간 소요
# 3. 주요 역 하드코딩: MVP 단계에서 즉시 사용 가능
#
# 현재는 3번을 선택하여 개발 속도를 우선시했습니다.
# 향후 지오코딩 API 연동으로 전체 역 좌표 자동화 예정입니다.
# ---------------------------------------------------
def get_station_coordinates(station_name: Optional[str]) -> Tuple[Optional[float], Optional[float]]:
    """
    역명 기준 위도/경도 반환

    반환값: (latitude, longitude)
    매핑되지 않은 역은 (None, None) 반환
    """
    if not station_name:
        return None, None

    # 수도권 주요 역 좌표 매핑 테이블
    station_coords: Dict[str, Tuple[float, float]] = {
        "기흥": (37.2749, 127.1151),
        "강남": (37.4979, 127.0276),
        "홍대입구": (37.5567, 126.9234),
        "신촌": (37.5559, 126.9364),
        "명동": (37.5636, 126.9816),
        "종로3가": (37.5703, 126.9911),
        "을지로입구": (37.5663, 126.9820),
        "서울": (37.5547, 126.9706),
        "용산": (37.5298, 126.9647),
        "영등포": (37.5157, 126.9070),
        "신도림": (37.5085, 126.8912),
        "구로디지털단지": (37.4851, 126.9015),
        "사당": (37.4766, 126.9816),
        "교대": (37.4934, 127.0144),
        "역삼": (37.5008, 127.0366),
        "선릉": (37.5048, 127.0498),
        "삼성": (37.5088, 127.0633),
        "잠실": (37.5133, 127.1000),
        "건대입구": (37.5403, 127.0699),
        "왕십리": (37.5614, 127.0374),
        "성수": (37.5447, 127.0558),
        "합정": (37.5497, 126.9138),
        "마포": (37.5441, 126.9520),
        "공덕": (37.5445, 126.9516),
        "이태원": (37.5345, 126.9944),
        "한강진": (37.5390, 126.9986),
        "동대문": (37.5718, 127.0097),
        "동대문역사문화공원": (37.5656, 127.0092),
        "충무로": (37.5613, 126.9942),
        "약수": (37.5551, 127.0097),
        "옥수": (37.5467, 127.0186),
        "압구정": (37.5271, 127.0283),
        "신사": (37.5199, 127.0202),
        "잠원": (37.5154, 127.0046),
        "고속터미널": (37.5047, 127.0047),
        "반포": (37.5044, 127.0121),
        "이수": (37.4867, 126.9819),
        "총신대입구": (37.4867, 126.9819),
        "동작": (37.4993, 126.9818),
        "노량진": (37.5134, 126.9428),
        "대방": (37.5148, 126.9267),
        "신길": (37.5177, 126.9148),
        "여의도": (37.5218, 126.9242),
        "여의나루": (37.5265, 126.9324),
        "마곡나루": (37.5702, 126.8016),
        "김포공항": (37.5622, 126.8012),
        "수원": (37.2662, 127.0005),
        "안양": (37.3946, 126.9558),
        "부천": (37.5030, 126.7831),
        "인천": (37.4563, 126.7052),
        "의정부": (37.7381, 127.0444),
        "일산": (37.6760, 126.7701),
        "분당": (37.3595, 127.1082),
        "판교": (37.3948, 127.1112),
    }

    # 역명에서 '역' 제거 후 검색
    clean_name = station_name.replace("역", "").strip()

    for key, coords in station_coords.items():
        if key in clean_name or clean_name in key:
            return coords[0], coords[1]

    return None, None


# ---------------------------------------------------
# 서울 Open API 공통 호출 함수
# ---------------------------------------------------
async def fetch_seoul_api_rows(
    service_name: str,
    start_index: int,
    end_index: int,
) -> List[Dict[str, Any]]:
    """
    서울 열린데이터광장 Open API 공통 호출 함수

    타임아웃: 3초
    - 기존 30초에서 단축하여 서울시 API 장애 시 빠르게 더미 데이터로 전환
    - 에러 발생 시 빈 리스트 반환으로 서버 중단 방지
    """
    api_key = ensure_seoul_api_key()

    url = (
        f"{SEOUL_BASE_URL}/"
        f"{api_key}/json/"
        f"{service_name}/"
        f"{start_index}/{end_index}/"
    )

    try:
        # 타임아웃 3초: 서울시 API가 3초 내 응답 없으면 더미 데이터로 즉시 전환
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(url)
        response.raise_for_status()

    except httpx.ReadTimeout:
        print(f"[{service_name}] API 읽기 타임아웃 발생 (3초 초과)")
        return []
    except httpx.ConnectTimeout:
        print(f"[{service_name}] API 연결 타임아웃 발생")
        return []
    except httpx.HTTPStatusError as e:
        print(f"[{service_name}] HTTP 오류: {e.response.status_code}")
        return []
    except Exception as e:
        print(f"[{service_name}] 알 수 없는 오류: {e}")
        return []

    try:
        data = response.json()
    except Exception as e:
        print(f"[{service_name}] JSON 파싱 실패: {e}")
        return []

    service_block = data.get(service_name, {})
    result = service_block.get("RESULT", {})
    result_code = result.get("CODE")
    result_message = result.get("MESSAGE")

    # INFO-000: 정상, INFO-200: 데이터 없음
    if result_code and result_code not in ("INFO-000", "INFO-200"):
        print(f"[{service_name}] API 응답 오류: {result_code} - {result_message}")
        return []

    rows = service_block.get("row", [])
    if not isinstance(rows, list):
        return []

    return rows


# ---------------------------------------------------
# 역 주소/전화번호 관련 함수
# ---------------------------------------------------
async def fetch_station_raw_data(start_index: int = 1, end_index: int = 300) -> List[Dict[str, Any]]:
    """
    역 주소/전화번호 원본 데이터 조회

    서울시 API 장애 시 개발 환경 유지를 위해 더미 데이터 반환
    """
    rows = await fetch_seoul_api_rows(
        service_name=SEOUL_STATION_SERVICE,
        start_index=start_index,
        end_index=end_index,
    )

    if not rows:
        print("[StationAdresTelno] 외부 API 데이터 없음 - 개발용 더미 데이터 사용")
        return [
            {
                "STATN_NM": "기흥",
                "LINE_NUM": "수인분당선",
                "ROAD_NM_ADDR": "경기도 용인시 기흥구 기흥역로 68",
                "TELNO": "031-283-6588",
            },
            {
                "STATN_NM": "강남",
                "LINE_NUM": "2호선",
                "ROAD_NM_ADDR": "서울특별시 강남구 강남대로 지하396",
                "TELNO": "02-6110-1234",
            },
            {
                "STATN_NM": "홍대입구",
                "LINE_NUM": "2호선",
                "ROAD_NM_ADDR": "서울특별시 마포구 양화로 지하160",
                "TELNO": "02-6110-2678",
            },
            {
                "STATN_NM": "서울",
                "LINE_NUM": "1호선",
                "ROAD_NM_ADDR": "서울특별시 중구 세종대로 지하2",
                "TELNO": "02-6110-1001",
            },
            {
                "STATN_NM": "잠실",
                "LINE_NUM": "2호선",
                "ROAD_NM_ADDR": "서울특별시 송파구 올림픽로 지하265",
                "TELNO": "02-6110-2916",
            },
        ]

    return rows


def normalize_station_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    서울 API 원본 row를 서비스용 JSON 형태로 변환

    latitude, longitude 필드 포함 (카카오맵 마커용)
    """
    station_name = (
        safe_str(row.get("SBWY_STNS_NM"))
        or safe_str(row.get("STATN_NM"))
        or safe_str(row.get("STATION_NM"))
    )

    line_name = (
        safe_str(row.get("SBWY_ROUT_LN"))
        or safe_str(row.get("LINE_NUM"))
        or safe_str(row.get("ROUTE"))
    )

    station_code = (
        safe_str(row.get("STIN_CD"))
        or safe_str(row.get("SBWY_STNS_CD"))
        or safe_str(row.get("STATN_ID"))
        or safe_str(row.get("ROW_NUM"))
    )

    station_id = build_station_id(line_name, station_name)
    phone = safe_str(row.get("TELNO")) or safe_str(row.get("PHONE"))
    road_address = safe_str(row.get("ROAD_NM_ADDR"))
    old_address = safe_str(row.get("OLD_ADDR"))
    address = road_address or old_address

    # 역명으로 좌표 조회
    latitude, longitude = get_station_coordinates(station_name)

    return {
        "stationId": station_id,
        "stationCode": station_code,
        "stationName": station_name,
        "line": line_name,
        "phone": phone,
        "address": address,
        "roadAddress": road_address,
        "oldAddress": old_address,
        "latitude": latitude,
        "longitude": longitude,
    }


def deduplicate_stations(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    stationId 기준으로 중복 역 제거
    """
    unique_map: Dict[str, Dict[str, Any]] = {}

    for item in items:
        station_id = item.get("stationId")
        if not station_id:
            continue
        if station_id not in unique_map:
            unique_map[station_id] = item

    return list(unique_map.values())


async def get_all_stations() -> List[Dict[str, Any]]:
    """
    전체 역 데이터를 정리된 형태로 반환

    캐싱 적용: 서버 시작 후 최초 1회만 서울시 API 호출
    이후 요청은 메모리 캐시에서 즉시 반환하여 응답 속도 개선
    """
    global _station_cache, _cache_loaded

    # 캐시가 이미 있으면 API 호출 없이 즉시 반환
    if _cache_loaded:
        return _station_cache

    # 최초 1회만 서울시 API 호출
    print("[stations] 역 데이터 최초 로딩 중...")
    rows = await fetch_station_raw_data()
    items = [normalize_station_row(row) for row in rows]
    _station_cache = deduplicate_stations(items)
    _cache_loaded = True
    print(f"[stations] 캐시 완료: {len(_station_cache)}개 역 로드됨")

    return _station_cache


def station_matches_keyword(item: Dict[str, Any], keyword: str) -> bool:
    """
    검색 키워드가 역명/호선/주소 중 하나에 포함되는지 확인
    """
    keyword = (keyword or "").strip().lower()
    if not keyword:
        return False

    candidates = [
        item.get("stationName") or "",
        item.get("line") or "",
        item.get("address") or "",
    ]

    return any(keyword in str(value).lower() for value in candidates)


async def search_stations(keyword: str) -> List[Dict[str, Any]]:
    """
    역명 키워드로 역 검색
    """
    keyword = (keyword or "").strip()
    if not keyword:
        return []

    items = await get_all_stations()
    return [item for item in items if station_matches_keyword(item, keyword)]


async def get_station_detail(station_id: str) -> Optional[Dict[str, Any]]:
    """
    stationId로 역 상세 정보 조회
    """
    station_id = (station_id or "").strip()
    if not station_id:
        return None

    items = await get_all_stations()

    for item in items:
        if item["stationId"] == station_id:
            return {
                "stationId": item["stationId"],
                "stationName": item["stationName"],
                "line": item["line"],
                "phone": item["phone"],
                "address": item["address"],
                "roadAddress": item["roadAddress"],
                "oldAddress": item["oldAddress"],
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude"),
            }

    return None


# ---------------------------------------------------
# 엘리베이터 관련 함수
# ---------------------------------------------------
def parse_wkt_point(wkt: Optional[str]) -> Tuple[Optional[float], Optional[float]]:
    """
    WKT 문자열에서 경도/위도 추출

    예: POINT(127.027123 37.497891)
    반환값: (longitude, latitude)
    """
    if not wkt:
        return None, None

    match = re.match(
        r"POINT\s*\(\s*([-\d\.]+)\s+([-\d\.]+)\s*\)",
        str(wkt).strip(),
        re.IGNORECASE,
    )

    if not match:
        return None, None

    try:
        longitude = float(match.group(1))
        latitude = float(match.group(2))
        return longitude, latitude
    except ValueError:
        return None, None


async def fetch_elevator_raw_data(start_index: int = 1, end_index: int = 1000) -> List[Dict[str, Any]]:
    """
    지하철역 엘리베이터 위치 원본 데이터 조회
    """
    return await fetch_seoul_api_rows(
        service_name=SEOUL_ELEVATOR_SERVICE,
        start_index=start_index,
        end_index=end_index,
    )


def normalize_elevator_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    엘리베이터 API 원본 row를 서비스용 형태로 변환
    """
    wkt = safe_str(row.get("NODE_WKT"))
    longitude, latitude = parse_wkt_point(wkt)
    station_name = safe_str(row.get("SBWY_STN_NM"))
    station_code = safe_str(row.get("SBWY_STN_CD"))

    return {
        "elevatorId": safe_str(row.get("NODE_ID")),
        "stationCode": station_code,
        "stationName": station_name,
        "nodeType": safe_str(row.get("NODE_TYPE")) or safe_str(row.get("NODE_TYPE_CD")),
        "districtName": safe_str(row.get("SGG_NM")),
        "dongName": safe_str(row.get("EMD_NM")),
        "wkt": wkt,
        "longitude": longitude,
        "latitude": latitude,
    }


async def get_station_elevators(station_id: str) -> Optional[Dict[str, Any]]:
    """
    stationId 기준으로 해당 역의 엘리베이터 목록 반환
    """
    station = await get_station_detail(station_id)
    if not station:
        return None

    target_station_name = normalize_station_name_for_match(station["stationName"])
    rows = await fetch_elevator_raw_data()

    matched_items: List[Dict[str, Any]] = []
    seen = set()

    for row in rows:
        normalized_item = normalize_elevator_row(row)
        row_station_name = normalize_station_name_for_match(
            normalized_item.get("stationName")
        )

        if row_station_name != target_station_name:
            continue

        dedupe_key = (
            normalized_item.get("elevatorId"),
            normalized_item.get("stationCode"),
            normalized_item.get("wkt"),
        )

        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)
        matched_items.append(normalized_item)

    return {
        "stationId": station["stationId"],
        "stationName": station["stationName"],
        "items": matched_items,
    }


# ---------------------------------------------------
# 연락처 관련 함수
# ---------------------------------------------------
async def get_station_contact(station_id: str) -> Optional[Dict[str, Any]]:
    """
    stationId 기준으로 역 연락처 정보 반환
    """
    station = await get_station_detail(station_id)

    if not station:
        return None

    return {
        "stationId": station["stationId"],
        "stationName": station["stationName"],
        "line": station["line"],
        "phone": station["phone"],
    }
