# 정규식 처리를 위한 라이브러리
import re

# 타입 힌트용 라이브러리
from typing import Optional, List, Dict, Any

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
# 서울 열린데이터광장 인증키
# ---------------------------------------------------
SEOUL_OPEN_API_KEY = (os.getenv("SEOUL_OPEN_API_KEY") or "").strip()

# 서울 열린데이터광장 기본 주소
SEOUL_BASE_URL = "http://openapi.seoul.go.kr:8088"

# 역 주소 및 전화번호 서비스명
SEOUL_STATION_SERVICE = "StationAdresTelno"

# 지하철역 엘리베이터 위치 서비스명
SEOUL_ELEVATOR_SERVICE = "tbTraficElvtr"


# ---------------------------------------------------
# 공통 유틸 함수
# ---------------------------------------------------
def ensure_seoul_api_key() -> str:
    """
    서울 열린데이터광장 인증키가 있는지 확인하는 함수
    """
    if not SEOUL_OPEN_API_KEY:
        raise ValueError("SEOUL_OPEN_API_KEY가 없습니다. .env 파일을 확인하세요.")
    return SEOUL_OPEN_API_KEY


def safe_str(value: Any) -> Optional[str]:
    """
    값을 안전하게 문자열로 변환하는 함수
    - None 이면 None 반환
    - 공백뿐인 문자열이면 None 반환
    """
    if value is None:
        return None

    text = str(value).strip()
    return text if text else None


def build_station_id(line_name: Optional[str], station_name: Optional[str]) -> str:
    """
    역 상세 조회에 사용할 고정 stationId를 만드는 함수
    예: 2호선 + 강남 -> 2호선_강남

    주의:
    - stationId는 원본 API의 역코드가 아니라
      프론트와 URL 경로에서 안정적으로 쓰기 위한 내부 식별자
    """
    line = safe_str(line_name) or "unknown-line"
    station = safe_str(station_name) or "unknown-station"

    raw_id = f"{line}_{station}"

    # 공백 제거
    raw_id = re.sub(r"\s+", "", raw_id)

    # URL 경로에서 문제될 수 있는 슬래시를 언더스코어로 치환
    raw_id = raw_id.replace("/", "_")

    return raw_id


def normalize_station_name_for_match(name: Optional[str]) -> str:
    """
    역명 비교를 위한 정규화 함수
    - 공백 제거
    - 소문자 처리
    - 끝에 붙은 '역' 제거

    예:
    '강남역' -> '강남'
    ' 강 남 ' -> '강남'
    """
    if not name:
        return ""

    text = str(name).strip().lower()
    text = re.sub(r"\s+", "", text)

    # 끝에 '역'이 붙으면 제거
    if text.endswith("역"):
        text = text[:-1]

    return text


# ---------------------------------------------------
# 서울 Open API 공통 호출 함수
# ---------------------------------------------------
async def fetch_seoul_api_rows(
    service_name: str,
    start_index: int,
    end_index: int,
) -> List[Dict[str, Any]]:
    """
    서울 열린데이터광장 Open API를 공통 형태로 호출하는 함수

    반환:
    - 해당 서비스의 row 리스트
    """
    # 인증키 확인
    api_key = ensure_seoul_api_key()

    # 실제 요청 URL 생성
    url = (
        f"{SEOUL_BASE_URL}/"
        f"{api_key}/json/"
        f"{service_name}/"
        f"{start_index}/{end_index}/"
    )

    # 비동기 HTTP 요청
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url)

    # HTTP 오류 발생 시 예외 처리
    response.raise_for_status()

    # JSON 변환
    data = response.json()

    # 서울 Open API는 서비스명 아래에 데이터가 들어있음
    service_block = data.get(service_name, {})

    # RESULT 블록 확인
    result = service_block.get("RESULT", {})
    result_code = result.get("CODE")
    result_message = result.get("MESSAGE")

    # INFO-000: 정상 처리
    # INFO-200: 해당하는 데이터가 없음
    if result_code and result_code not in ("INFO-000", "INFO-200"):
        raise ValueError(
            f"{service_name} API 오류: {result_code} - {result_message or '알 수 없는 오류'}"
        )

    # row 배열 추출
    rows = service_block.get("row", [])

    # 혹시 list가 아니면 빈 배열 반환
    if not isinstance(rows, list):
        return []

    return rows


# ---------------------------------------------------
# 역 주소/전화번호 관련 함수
# ---------------------------------------------------
async def fetch_station_raw_data(start_index: int = 1, end_index: int = 300) -> List[Dict[str, Any]]:
    """
    서울 열린데이터광장에서 역 주소/전화번호 원본 데이터를 가져오는 함수
    """
    return await fetch_seoul_api_rows(
        service_name=SEOUL_STATION_SERVICE,
        start_index=start_index,
        end_index=end_index,
    )


def normalize_station_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    서울 API 원본 row를 우리 서비스용 JSON 형태로 정리하는 함수

    주의:
    - stationId는 항상 build_station_id() 규칙으로 생성
    - 원본 역코드는 stationCode로 별도 보관
    """
    # 역명
    station_name = (
        safe_str(row.get("SBWY_STNS_NM"))
        or safe_str(row.get("STATN_NM"))
        or safe_str(row.get("STATION_NM"))
    )

    # 호선명
    line_name = (
        safe_str(row.get("SBWY_ROUT_LN"))
        or safe_str(row.get("LINE_NUM"))
        or safe_str(row.get("ROUTE"))
    )

    # 원본 역코드
    station_code = (
        safe_str(row.get("STIN_CD"))
        or safe_str(row.get("SBWY_STNS_CD"))
        or safe_str(row.get("STATN_ID"))
        or safe_str(row.get("ROW_NUM"))
    )

    # 내부 stationId는 항상 고정 규칙으로 생성
    station_id = build_station_id(line_name, station_name)

    # 전화번호
    phone = safe_str(row.get("TELNO")) or safe_str(row.get("PHONE"))

    # 주소
    road_address = safe_str(row.get("ROAD_NM_ADDR"))
    old_address = safe_str(row.get("OLD_ADDR"))

    # 대표 주소는 도로명 주소 우선, 없으면 지번 주소 사용
    address = road_address or old_address

    return {
        "stationId": station_id,
        "stationCode": station_code,
        "stationName": station_name,
        "line": line_name,
        "phone": phone,
        "address": address,
        "roadAddress": road_address,
        "oldAddress": old_address,
    }


def deduplicate_stations(items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    stationId 기준으로 중복 역을 제거하는 함수
    """
    unique_map: Dict[str, Dict[str, Any]] = {}

    for item in items:
        station_id = item.get("stationId")

        # stationId가 없으면 건너뛰기
        if not station_id:
            continue

        # 처음 나온 데이터만 유지
        if station_id not in unique_map:
            unique_map[station_id] = item

    return list(unique_map.values())


async def get_all_stations() -> List[Dict[str, Any]]:
    """
    전체 역 데이터를 정리된 형태로 반환하는 함수
    """
    rows = await fetch_station_raw_data()
    items = [normalize_station_row(row) for row in rows]

    # 검색/상세에서 중복 문제가 없도록 한 번 정리
    return deduplicate_stations(items)


def station_matches_keyword(item: Dict[str, Any], keyword: str) -> bool:
    """
    검색 키워드가 역명/호선/주소 중 하나에 포함되는지 확인하는 함수
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

    현재는 아래 항목에서 검색 가능:
    - 역명
    - 호선
    - 주소
    """
    keyword = (keyword or "").strip()
    if not keyword:
        return []

    items = await get_all_stations()

    results = []
    for item in items:
        if station_matches_keyword(item, keyword):
            results.append(item)

    return results


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
            }

    return None


# ---------------------------------------------------
# 엘리베이터 관련 함수
# ---------------------------------------------------
def parse_wkt_point(wkt: Optional[str]) -> tuple[Optional[float], Optional[float]]:
    """
    WKT 문자열에서 경도/위도를 추출하는 함수

    예:
    POINT(127.027123 37.497891)

    반환값:
    (longitude, latitude)
    """
    if not wkt:
        return None, None

    # 공백이 조금 달라도 처리 가능하게 정규식 작성
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
    서울 열린데이터광장에서 지하철역 엘리베이터 위치 원본 데이터를 가져오는 함수
    """
    return await fetch_seoul_api_rows(
        service_name=SEOUL_ELEVATOR_SERVICE,
        start_index=start_index,
        end_index=end_index,
    )


def normalize_elevator_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    서울시 엘리베이터 위치 API 원본 row를 프론트용 형태로 정리하는 함수
    """
    # WKT 좌표 문자열
    wkt = safe_str(row.get("NODE_WKT"))

    # WKT에서 경도/위도 파싱
    longitude, latitude = parse_wkt_point(wkt)

    # 역명 / 역코드
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
    stationId를 기준으로 해당 역의 엘리베이터 목록 반환

    반환 형식은 stations.py 라우터와 맞추기 위해
    아래처럼 구성함:
    {
        "stationId": "...",
        "stationName": "...",
        "items": [...]
    }
    """
    # 먼저 역 상세 정보를 찾아 역명을 확보
    station = await get_station_detail(station_id)
    if not station:
        return None

    # 비교용 역명 정규화
    target_station_name = normalize_station_name_for_match(station["stationName"])

    # 엘리베이터 원본 데이터 조회
    rows = await fetch_elevator_raw_data()

    matched_items: List[Dict[str, Any]] = []

    # 중복 제거용 집합
    seen = set()

    for row in rows:
        normalized_item = normalize_elevator_row(row)

        # 현재 row의 역명을 비교용 형태로 정규화
        row_station_name = normalize_station_name_for_match(normalized_item.get("stationName"))

        # 역명이 다르면 제외
        if row_station_name != target_station_name:
            continue

        # 중복 제거 키
        dedupe_key = (
            normalized_item.get("elevatorId"),
            normalized_item.get("stationCode"),
            normalized_item.get("wkt"),
        )

        # 이미 넣은 데이터면 건너뛰기
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
    stationId를 기준으로 역 연락처 정보를 반환하는 함수
    """
    # 기존 역 상세 정보를 재사용
    station = await get_station_detail(station_id)

    # 해당 역이 없으면 None 반환
    if not station:
        return None

    # 연락처 전용 응답 형태로 가공
    return {
        "stationId": station["stationId"],
        "stationName": station["stationName"],
        "line": station["line"],
        "phone": station["phone"],
    }
