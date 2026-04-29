# 정규식 처리를 위한 라이브러리
import re

# 환경변수 읽기
import os

# 외부 API 요청용 라이브러리
import httpx

# .env 파일 로드
from dotenv import load_dotenv

# .env 파일 불러오기
load_dotenv()

# 서울 열린데이터광장 인증키
SEOUL_OPEN_API_KEY = (os.getenv("SEOUL_OPEN_API_KEY") or "").strip()

# 서울 열린데이터광장 기본 주소
SEOUL_BASE_URL = "http://openapi.seoul.go.kr:8088"

# 역 주소 및 전화번호 서비스명
SEOUL_STATION_SERVICE = "StationAdresTelno"


def build_station_id(line_name: str, station_name: str) -> str:
    """
    역 상세 조회에 사용할 고정 stationId를 만드는 함수
    예: 2호선 + 강남 -> 2호선_강남
    """
    raw_id = f"{line_name}_{station_name}".strip("_")

    # 공백 제거
    raw_id = re.sub(r"\s+", "", raw_id)

    # URL 경로에서 문제될 수 있는 슬래시를 언더스코어로 치환
    raw_id = raw_id.replace("/", "_")

    return raw_id


async def fetch_station_raw_data(start_index: int = 1, end_index: int = 300) -> list:
    """
    서울 열린데이터광장에서 역 주소/전화번호 원본 데이터를 가져오는 함수
    """
    if not SEOUL_OPEN_API_KEY:
        raise ValueError("SEOUL_OPEN_API_KEY가 없습니다. .env 파일을 확인하세요.")

    # 실제 요청 URL
    url = (
        f"{SEOUL_BASE_URL}/"
        f"{SEOUL_OPEN_API_KEY}/json/"
        f"{SEOUL_STATION_SERVICE}/"
        f"{start_index}/{end_index}/"
    )

    # API 요청
    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url)

    response.raise_for_status()

    data = response.json()

    # 서울 API는 서비스명 아래에 실제 데이터가 들어있음
    service_block = data.get(SEOUL_STATION_SERVICE, {})
    rows = service_block.get("row", [])

    return rows


def normalize_station_row(row: dict) -> dict:
    """
    서울 API 원본 row를 우리 서비스용 JSON 형태로 정리하는 함수
    """
    # 역명
    station_name = (
        row.get("SBWY_STNS_NM")
        or row.get("STATN_NM")
        or row.get("STATION_NM")
        or ""
    )

    # 호선
    line_name = (
        row.get("SBWY_ROUT_LN")
        or row.get("LINE_NUM")
        or row.get("ROUTE")
        or ""
    )

    # 역코드가 있으면 사용, 없으면 우리가 만든 고정 ID 사용
    raw_station_id = (
        row.get("STIN_CD")
        or row.get("SBWY_STNS_CD")
        or row.get("STATN_ID")
        or ""
    )

    station_id = str(raw_station_id).strip() if raw_station_id else build_station_id(line_name, station_name)

    # 전화번호
    phone = row.get("TELNO") or row.get("PHONE") or ""

    # 주소
    road_address = row.get("ROAD_NM_ADDR") or ""
    old_address = row.get("OLD_ADDR") or ""
    address = road_address or old_address

    return {
        "stationId": station_id,
        "stationName": station_name,
        "line": line_name,
        "phone": phone,
        "address": address,
        "roadAddress": road_address,
        "oldAddress": old_address,
    }


async def get_all_stations() -> list:
    """
    전체 역 데이터를 정리된 형태로 반환
    """
    rows = await fetch_station_raw_data()
    return [normalize_station_row(row) for row in rows]


async def search_stations(keyword: str) -> list:
    """
    역명 키워드로 역 검색
    """
    items = await get_all_stations()

    keyword = (keyword or "").strip().lower()
    if not keyword:
        return []

    results = []
    for item in items:
        if keyword in item["stationName"].lower():
            results.append(item)

    return results


async def get_station_detail(station_id: str) -> dict | None:
    """
    stationId로 역 상세 정보 조회
    """
    items = await get_all_stations()

    station_id = (station_id or "").strip()

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

###

# 서울시 엘리베이터 위치 서비스명
SEOUL_ELEVATOR_SERVICE = "tbTraficElvtr"


def parse_wkt_point(wkt: str) -> tuple[float | None, float | None]:
    """
    WKT 문자열에서 경도/위도를 추출하는 함수
    예: POINT(127.027123 37.497891)
    반환값: (longitude, latitude)
    """
    if not wkt:
        return None, None

    match = re.match(r"POINT\(([-\d\.]+)\s+([-\d\.]+)\)", wkt.strip())
    if not match:
        return None, None

    longitude = float(match.group(1))
    latitude = float(match.group(2))
    return longitude, latitude


async def fetch_elevator_raw_data(start_index: int = 1, end_index: int = 1000) -> list:
    """
    서울 열린데이터광장에서 지하철역 엘리베이터 위치 원본 데이터를 가져오는 함수
    """
    if not SEOUL_OPEN_API_KEY:
        raise ValueError("SEOUL_OPEN_API_KEY가 없습니다. .env 파일을 확인하세요.")

    url = (
        f"{SEOUL_BASE_URL}/"
        f"{SEOUL_OPEN_API_KEY}/json/"
        f"{SEOUL_ELEVATOR_SERVICE}/"
        f"{start_index}/{end_index}/"
    )

    async with httpx.AsyncClient(timeout=20.0) as client:
        response = await client.get(url)

    response.raise_for_status()

    data = response.json()
    service_block = data.get(SEOUL_ELEVATOR_SERVICE, {})
    rows = service_block.get("row", [])

    return rows


def normalize_elevator_row(row: dict) -> dict:
    """
    서울시 엘리베이터 위치 API 원본 row를 프론트용 형태로 정리
    """
    wkt = row.get("NODE_WKT") or ""
    longitude, latitude = parse_wkt_point(wkt)

    return {
        "elevatorId": str(row.get("NODE_ID") or ""),
        "stationCode": str(row.get("SBWY_STN_CD") or ""),
        "stationName": row.get("SBWY_STN_NM") or "",
        "nodeType": row.get("NODE_TYPE") or "",
        "nodeTypeCode": row.get("NODE_TYPE_CD") or "",
        "districtCode": row.get("SGG_CD") or "",
        "districtName": row.get("SGG_NM") or "",
        "dongCode": row.get("EMD_CD") or "",
        "dongName": row.get("EMD_NM") or "",
        "wkt": wkt,
        "longitude": longitude,
        "latitude": latitude,
    }


async def get_station_elevators(station_id: str) -> dict | None:
    """
    stationId를 기준으로 해당 역의 엘리베이터 목록 반환
    """
    # 먼저 역 상세를 찾아서 역명 확보
    station = await get_station_detail(station_id)
    if not station:
        return None

    station_name = station["stationName"]

    # 엘리베이터 원본 데이터 불러오기
    rows = await fetch_elevator_raw_data()

    # 역명 기준으로 필터링
    matched = []
    for row in rows:
        row_station_name = (row.get("SBWY_STN_NM") or "").strip()

        if row_station_name == station_name:
            matched.append(normalize_elevator_row(row))

    return {
        "stationId": station["stationId"],
        "stationName": station["stationName"],
        "count": len(matched),
        "items": matched,
    }

###

async def get_station_contact(station_id: str) -> dict | None:
    """
    stationId를 기준으로 역 연락처 정보를 반환하는 함수
    """
    # 먼저 기존 역 상세 정보를 재사용
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
