# ---------------------------------------------------
# mobility_service.py
# 교통약자 이동지원 현황 API 연동 서비스 레이어
# - center_info_v2
# - info_vehicle_use_v2
# ---------------------------------------------------

# 경로 처리용
from pathlib import Path

# 환경변수 읽기
import os

# 날짜 파싱용
from datetime import datetime

# 타입 힌트용 라이브러리
from typing import Optional, List, Dict, Any

# 외부 API 요청용 라이브러리
import httpx

# .env 파일 로드
from dotenv import load_dotenv


# ---------------------------------------------------
# backend/.env 경로를 명시적으로 지정
# ---------------------------------------------------
# 현재 파일 위치:
# backend/app/services/mobility_service.py
# parents[2] -> backend/
BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"

# 기존 OS 환경변수보다 .env 값을 우선 적용
# => 예전 셸 환경변수 값이 남아 있어도 .env 값으로 덮어씀
load_dotenv(dotenv_path=ENV_PATH, override=True)


# ---------------------------------------------------
# 교통약자 이동지원 현황 API 기본 주소
# ---------------------------------------------------
TRANSPORT_API_BASE_URL = "https://apis.data.go.kr/B551982/tsdo_v2"

# 교통약자 이동지원센터 현황 엔드포인트
CENTER_INFO_ENDPOINT = "center_info_v2"

# 교통약자 택시 차량 이용가능 정보 엔드포인트
VEHICLE_USE_ENDPOINT = "info_vehicle_use_v2"


# ---------------------------------------------------
# 공통 유틸 함수
# ---------------------------------------------------
def get_public_data_service_key() -> str:
    """
    현재 런타임 기준으로 PUBLIC_DATA_SERVICE_KEY를 다시 읽어오는 함수

    중요:
    - 모듈 import 시점 상수로 고정하지 않고
      함수 호출 시점마다 다시 읽어서
      환경변수 변경/재시작 이슈를 디버깅하기 쉽게 함
    """
    return (os.getenv("PUBLIC_DATA_SERVICE_KEY") or "").strip()


def debug_print_loaded_key() -> None:
    """
    실제 런타임에서 어떤 키가 로드됐는지 확인하는 디버그 함수
    전체 키를 노출하지 않도록 일부만 출력
    """
    key = get_public_data_service_key()

    print("[DEBUG] ENV_PATH:", ENV_PATH)
    print("[DEBUG] KEY_LENGTH:", len(key))

    if len(key) >= 12:
        print("[DEBUG] KEY_MASKED:", f"{key[:8]}...{key[-6:]}")
    else:
        print("[DEBUG] KEY_MASKED:", key)


def ensure_public_data_service_key() -> str:
    """
    PUBLIC_DATA_SERVICE_KEY 존재 여부를 확인하는 함수
    """
    key = get_public_data_service_key()

    if not key:
        raise ValueError("PUBLIC_DATA_SERVICE_KEY가 없습니다. .env 파일을 확인하세요.")

    return key


def safe_str(value: Any) -> Optional[str]:
    """
    값을 안전하게 문자열로 바꾸는 함수
    - None 이면 None 반환
    - 공백뿐이면 None 반환
    """
    if value is None:
        return None

    text = str(value).strip()
    return text if text else None


def to_int_or_none(value: Any) -> Optional[int]:
    """
    문자열/숫자 값을 int로 변환
    실패하면 None 반환
    """
    text = safe_str(value)
    if not text:
        return None

    try:
        return int(text)
    except ValueError:
        return None


def to_float_or_none(value: Any) -> Optional[float]:
    """
    문자열/숫자 값을 float로 변환
    실패하면 None 반환
    """
    text = safe_str(value)
    if not text:
        return None

    try:
        return float(text)
    except ValueError:
        return None


def parse_transport_observed_at(raw_value: Any) -> Optional[datetime]:
    """
    교통약자 차량 집계 API의 totDt 값을 datetime 으로 변환

    예:
    - "20260505173521" -> 2026-05-05 17:35:21
    """
    text = safe_str(raw_value)
    if not text:
        return None

    try:
        return datetime.strptime(text, "%Y%m%d%H%M%S")
    except ValueError:
        return None


def extract_first_value(row: Dict[str, Any], candidate_keys: List[str]) -> Optional[str]:
    """
    여러 후보 키 중 값이 먼저 존재하는 필드를 꺼내는 함수

    이유:
    - 공공데이터 응답은 문서와 실제 필드명이 다를 수 있음
    - snake_case, camelCase, 약어 버전을 모두 방어적으로 탐색
    """
    for key in candidate_keys:
        value = safe_str(row.get(key))
        if value:
            return value
    return None


def extract_response_items(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    교통약자 이동지원 API 응답에서 item 리스트를 추출하는 함수

    실제 응답 구조:
    - header
    - body
      - item
    """
    if not isinstance(payload, dict):
        return []

    body = payload.get("body", {})
    if not isinstance(body, dict):
        return []

    items = body.get("item", [])

    # item이 객체 하나만 오는 경우도 방어적으로 처리
    if isinstance(items, dict):
        return [items]

    if isinstance(items, list):
        return items

    return []


def extract_response_meta(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    교통약자 이동지원 API 응답에서 메타 정보를 추출하는 함수

    실제 응답 구조:
    - header
    - body
    """
    if not isinstance(payload, dict):
        return {
            "resultCode": None,
            "resultMsg": None,
            "pageNo": None,
            "numOfRows": None,
            "totalCount": None,
        }

    header = payload.get("header", {})
    body = payload.get("body", {})

    return {
        "resultCode": safe_str(header.get("resultCode")),
        "resultMsg": safe_str(header.get("resultMsg")),
        "pageNo": body.get("pageNo"),
        "numOfRows": body.get("numOfRows"),
        "totalCount": body.get("totalCount"),
    }


def validate_response_meta(api_meta: Dict[str, Any], endpoint_name: str) -> None:
    """
    응답의 resultCode를 검사하는 함수

    실제 center_info_v2 / info_vehicle_use_v2 성공 응답 예:
    - resultCode = "K0"
    - resultMsg = "NORMAL_SERVICE"

    일부 공공데이터 API는 "00"을 쓰는 경우도 있어서 같이 허용
    """
    result_code = safe_str(api_meta.get("resultCode"))
    result_msg = safe_str(api_meta.get("resultMsg")) or "알 수 없는 오류"

    print("[DEBUG] API_META:", api_meta)

    # resultCode가 없는 경우는 일단 통과
    if result_code is None:
        return

    # 성공 코드 허용
    if result_code in ("K0", "00"):
        return

    raise ValueError(f"{endpoint_name} API 오류: {result_code} - {result_msg}")


# ---------------------------------------------------
# 공통 외부 API 호출 함수
# ---------------------------------------------------
async def fetch_transport_api_raw(
    endpoint_name: str,
    stdg_cd: str,
    page_no: int = 1,
    num_of_rows: int = 20,
) -> Dict[str, Any]:
    """
    교통약자 이동지원 API 공통 호출 함수

    핵심 디버깅 포인트:
    - 실제로 어떤 키를 읽는지 마스킹 출력
    - 200이어도 응답 본문 일부를 확인
    - JSON 구조를 바로 확인
    """
    # 현재 시점의 키를 다시 읽어서 사용
    service_key = ensure_public_data_service_key()

    # 디버깅용: 현재 어떤 .env / 어떤 키 prefix를 읽는지 출력
    debug_print_loaded_key()

    # 엔드포인트 URL 생성
    url = f"{TRANSPORT_API_BASE_URL}/{endpoint_name}"

    # 요청 파라미터
    params = {
        "serviceKey": service_key,
        "pageNo": page_no,
        "numOfRows": num_of_rows,
        "type": "JSON",
        "stdgCd": stdg_cd,
    }

    # 디버깅용: 민감하지 않은 파라미터만 출력
    print("[DEBUG] REQUEST_URL:", url)
    print("[DEBUG] REQUEST_PARAMS:", {
        "pageNo": page_no,
        "numOfRows": num_of_rows,
        "type": "JSON",
        "stdgCd": stdg_cd,
    })

    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            response = await client.get(url, params=params)

    except httpx.RequestError as e:
        raise ValueError(f"{endpoint_name} 요청 실패: {str(e)}") from e

    # 상태코드 / Content-Type 출력
    print("[DEBUG] RESPONSE_STATUS:", response.status_code)
    print("[DEBUG] RESPONSE_CONTENT_TYPE:", response.headers.get("content-type"))

    # 응답 본문 앞부분은 200이어도 항상 찍어보기
    body_preview = response.text[:1500]
    print("[DEBUG] RESPONSE_BODY_PREVIEW:", body_preview)

    # 4xx / 5xx 면 응답 본문 일부를 같이 보여줌
    if response.status_code >= 400:
        raise ValueError(
            f"{endpoint_name} HTTP 오류: {response.status_code} / response: {body_preview}"
        )

    # JSON 파싱 시도
    try:
        payload = response.json()
    except Exception as e:
        raise ValueError(
            f"{endpoint_name} 응답을 JSON으로 해석할 수 없습니다. raw={body_preview}"
        ) from e

    # JSON top-level 구조 확인
    print("[DEBUG] RESPONSE_TOP_KEYS:", list(payload.keys()) if isinstance(payload, dict) else type(payload))

    # 실제 응답 구조는 최상위에 header, body가 바로 존재
    if isinstance(payload, dict):
        header = payload.get("header")
        body = payload.get("body")

        print("[DEBUG] HEADER:", header)
        print("[DEBUG] BODY_KEYS:", list(body.keys()) if isinstance(body, dict) else body)

    return payload


# ---------------------------------------------------
# center_info_v2 관련 함수
# ---------------------------------------------------
async def fetch_center_info_raw(
    stdg_cd: str,
    page_no: int = 1,
    num_of_rows: int = 20,
) -> Dict[str, Any]:
    """
    교통약자 이동지원센터 현황 원본 응답(JSON)을 가져오는 함수
    """
    return await fetch_transport_api_raw(
        endpoint_name=CENTER_INFO_ENDPOINT,
        stdg_cd=stdg_cd,
        page_no=page_no,
        num_of_rows=num_of_rows,
    )


def normalize_center_row(
    row: Dict[str, Any],
    requested_stdg_cd: Optional[str] = None,
) -> Dict[str, Any]:
    """
    center_info_v2 응답 1건을 내부 표준 형식으로 정규화합니다.

    주의:
    - 저장 로직과 연결되도록 상세 필드까지 최대한 보존
    - regionCode 가 비어 있으면 요청 stdgCd 로 보완
    - API 응답의 lot 필드는 실제로 longitude 값으로 사용
    """
    lat_raw = safe_str(row.get("lat"))
    lon_raw = safe_str(row.get("lot"))  # 실제 응답 필드명이 lot 이지만 경도 값

    latitude = to_float_or_none(lat_raw)
    longitude = to_float_or_none(lon_raw)

    wknd_oper_yn = (safe_str(row.get("wkndOperYn")) or "").upper()

    road_address = safe_str(row.get("cntrRoadNmAddr"))
    lot_address = safe_str(row.get("cntrLotnoAddr"))

    return {
        "centerId": safe_str(row.get("cntrId")),
        "centerName": safe_str(row.get("cntrNm")),
        "regionCode": safe_str(row.get("stdgCd")) or requested_stdg_cd,
        "regionName": safe_str(row.get("lclgvNm")),
        "phone": safe_str(row.get("cntrTelno")),
        "address": road_address or lot_address,
        "roadAddress": road_address,
        "lotAddress": lot_address,
        "latitude": latitude,
        "longitude": longitude,
        "reservationUrl": safe_str(row.get("rsvtSiteUrlAddr")),
        "appServiceName": safe_str(row.get("appSrvcNm")),
        "operatorName": safe_str(row.get("mngInstNm")),
        "operatorPhone": safe_str(row.get("mngInstTelno")),
        "weekdayReservationStart": safe_str(row.get("wkdyRsvtBgngTm")),
        "weekdayReservationEnd": safe_str(row.get("wkdyRsvtEndTm")),
        "weekdayOperationStart": safe_str(row.get("wkdyOprBgngTm")),
        "weekdayOperationEnd": safe_str(row.get("wkdyOprEndTm")),
        "weekendOperates": True if wknd_oper_yn == "Y" else False if wknd_oper_yn == "N" else None,
        "weekendOperationHours": safe_str(row.get("wkndOperHrExpln")),
        "wideAreaServiceRegion": safe_str(row.get("wtjrOprRgnNm")),
        "crossRegionServiceRegion": safe_str(row.get("btjrOprRgnNm")),
        "targetUsers": safe_str(row.get("utztnTrgtExpln")),
        "dailyVehicleUsageLimit": safe_str(row.get("dayVhclUtztnNmtm")),
        "advanceReservationInfo": safe_str(row.get("bfhdRsvtPrdExpln")),
        "baseFareInfo": safe_str(row.get("bscCrgExpln")),
        "extraFareInfo": safe_str(row.get("exchrgCrgExpln")),
        "reservationGuide": safe_str(row.get("rsvtGdMttr")),
        "holdingVehicleCount": safe_str(row.get("hldVhclTcntom")),
        "statisticsDate": safe_str(row.get("totCrtrYmd")),
    }


async def get_transport_centers(
    stdg_cd: str,
    page_no: int = 1,
    num_of_rows: int = 20,
) -> Dict[str, Any]:
    """
    교통약자 이동지원센터 현황 정보를 조회해서
    라우터가 바로 사용할 수 있는 형태로 반환하는 함수
    """
    stdg_cd = (stdg_cd or "").strip()

    if not stdg_cd:
        raise ValueError("stdgCd가 비어 있습니다.")

    # 법정동 코드는 일반적으로 10자리 숫자
    if len(stdg_cd) != 10 or not stdg_cd.isdigit():
        raise ValueError("stdgCd는 10자리 숫자여야 합니다.")

    payload = await fetch_center_info_raw(
        stdg_cd=stdg_cd,
        page_no=page_no,
        num_of_rows=num_of_rows,
    )

    api_meta = extract_response_meta(payload)

    # 응답 코드 검사
    validate_response_meta(api_meta, CENTER_INFO_ENDPOINT)

    raw_items = extract_response_items(payload)

    normalized_items = [
        normalize_center_row(row, requested_stdg_cd=stdg_cd)
        for row in raw_items
    ]

    return {
        "items": normalized_items,
        "apiMeta": api_meta,
    }


# ---------------------------------------------------
# info_vehicle_use_v2 관련 함수
# ---------------------------------------------------
async def fetch_vehicle_use_raw(
    stdg_cd: str,
    page_no: int = 1,
    num_of_rows: int = 20,
) -> Dict[str, Any]:
    """
    교통약자 택시 차량 이용가능 정보 원본 응답(JSON)을 가져오는 함수
    """
    return await fetch_transport_api_raw(
        endpoint_name=VEHICLE_USE_ENDPOINT,
        stdg_cd=stdg_cd,
        page_no=page_no,
        num_of_rows=num_of_rows,
    )


def normalize_vehicle_use_row(
    row: Dict[str, Any],
    requested_stdg_cd: str,
) -> Dict[str, Any]:
    """
    info_vehicle_use_v2 원본 row를 우리 서비스용 JSON 구조로 정리하는 함수

    중요:
    - 실제 응답은 '차량 1대별 목록'이 아니라
      '센터 단위 차량 운영 현황 집계' 구조임
    - 따라서 개별 vehicleId / vehicleNumber 중심이 아니라
      센터 기준 집계 필드로 정규화해야 저장 로직과 맞음
    """
    observed_at_raw = safe_str(row.get("totDt"))
    observed_at = parse_transport_observed_at(observed_at_raw)

    return {
        "centerId": safe_str(row.get("cntrId")),
        "centerName": safe_str(row.get("cntrNm")),
        "regionCode": safe_str(row.get("stdgCd")) or requested_stdg_cd,
        "regionName": safe_str(row.get("lclgvNm")),
        "totalVehicleCount": to_int_or_none(row.get("tvhclCntom")),
        "operatingVehicleCount": to_int_or_none(row.get("oprVhclCntom")),
        "availableVehicleCount": to_int_or_none(row.get("avlVhclCntom")),
        "reservationCount": to_int_or_none(row.get("rsvtNocs")),
        "waitingCount": to_int_or_none(row.get("wtngNocs")),
        "observedAtRaw": observed_at_raw,
        "observedAt": observed_at.isoformat() if observed_at else None,
    }


async def get_available_transport_vehicles(
    stdg_cd: str,
    page_no: int = 1,
    num_of_rows: int = 20,
) -> Dict[str, Any]:
    """
    교통약자 택시 차량 이용가능 정보를 조회해서
    라우터가 바로 사용할 수 있는 형태로 반환하는 함수

    주의:
    - 현재 API 응답은 '이용 가능한 차량 목록'이라기보다
      '센터 단위 차량 운영 현황'에 가까움
    """
    stdg_cd = (stdg_cd or "").strip()

    if not stdg_cd:
        raise ValueError("stdgCd가 비어 있습니다.")

    # 법정동 코드는 일반적으로 10자리 숫자
    if len(stdg_cd) != 10 or not stdg_cd.isdigit():
        raise ValueError("stdgCd는 10자리 숫자여야 합니다.")

    payload = await fetch_vehicle_use_raw(
        stdg_cd=stdg_cd,
        page_no=page_no,
        num_of_rows=num_of_rows,
    )

    api_meta = extract_response_meta(payload)

    # 응답 코드 검사
    validate_response_meta(api_meta, VEHICLE_USE_ENDPOINT)

    raw_items = extract_response_items(payload)

    normalized_items = [
        normalize_vehicle_use_row(row, requested_stdg_cd=stdg_cd)
        for row in raw_items
    ]

    return {
        "items": normalized_items,
        "apiMeta": api_meta,
    }
