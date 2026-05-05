"""
교통약자 이동지원 관련 API 라우터입니다.

포함 기능:
1. 외부 공공데이터 API 조회
   - 센터 조회
   - 이용 가능 차량 조회

2. 외부 API 결과를 내부 DB에 동기화
   - 센터 동기화
   - 이용 가능 차량 동기화

응답 형식:
- 프론트엔드와 합의한 공통 JSON envelope 사용
  {
    "success": true/false,
    "message": "...",
    "data": {...} | null,
    "meta": {...},
    "error": null | {
      "code": "...",
      "detail": "..."
    }
  }
"""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

# 외부 API 조회 서비스
from app.services.mobility_service import (
    get_transport_centers,
    get_available_transport_vehicles,
)

# 외부 API -> DB 저장(동기화) 서비스
from app.services.mobility_sync_service import (
    sync_transport_centers,
    sync_available_transport_vehicles,
)

# mobility 관련 API를 /api/mobility 아래에 묶습니다.
router = APIRouter(
    prefix="/api/mobility",
    tags=["mobility"],
)


def success_response(
    message: str,
    data: dict,
    meta: dict | None = None,
    status_code: int = 200,
):
    """
    성공 응답을 공통 형식으로 반환합니다.
    """
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "message": message,
            "data": data,
            "meta": meta or {},
            "error": None,
        },
    )


def error_response(
    status_code: int,
    message: str,
    error_code: str,
    detail: str,
):
    """
    실패 응답을 공통 형식으로 반환합니다.
    """
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": message,
            "data": None,
            "meta": {},
            "error": {
                "code": error_code,
                "detail": detail,
            },
        },
    )


def map_value_error_to_response(
    error_message: str,
    default_error_code: str,
    default_message: str,
):
    """
    service 계층에서 올라온 ValueError 메시지를
    적절한 HTTP status / 에러 코드 / 사용자 메시지로 매핑합니다.

    예:
    - 인증키 누락
    - 외부 API 401/403
    - 타임아웃
    - 잘못된 응답 구조
    """

    lower_msg = (error_message or "").lower()

    # .env 에 API 키가 비어 있는 경우
    if "public_data_service_key" in lower_msg:
        return error_response(
            status_code=500,
            message="공공데이터 인증키 설정이 필요합니다.",
            error_code="PUBLIC_DATA_SERVICE_KEY_MISSING",
            detail=error_message,
        )

    # 외부 API 인증 실패
    if "401" in lower_msg or "unauthorized" in lower_msg:
        return error_response(
            status_code=502,
            message="공공데이터 API 인증에 실패했습니다.",
            error_code="PUBLIC_DATA_UNAUTHORIZED",
            detail=error_message,
        )

    # 외부 API 접근 권한 문제
    if "403" in lower_msg or "forbidden" in lower_msg:
        return error_response(
            status_code=502,
            message="공공데이터 API 접근 권한이 없습니다.",
            error_code="PUBLIC_DATA_FORBIDDEN",
            detail=error_message,
        )

    # 외부 API 타임아웃
    if "timeout" in lower_msg:
        return error_response(
            status_code=504,
            message="공공데이터 API 응답 시간이 초과되었습니다.",
            error_code="PUBLIC_DATA_TIMEOUT",
            detail=error_message,
        )

    # 외부 API 응답 구조 파싱 실패 등
    if "json" in lower_msg or "parse" in lower_msg or "resultcode" in lower_msg:
        return error_response(
            status_code=502,
            message="공공데이터 API 응답 해석에 실패했습니다.",
            error_code="PUBLIC_DATA_PARSE_ERROR",
            detail=error_message,
        )

    # 기본 처리
    return error_response(
        status_code=502,
        message=default_message,
        error_code=default_error_code,
        detail=error_message,
    )


@router.get(
    "/centers",
    summary="교통약자 이동지원센터 조회",
    description=(
        "법정동코드(stdgCd)를 기준으로 교통약자 이동지원센터 정보를 조회합니다. "
        "외부 공공데이터 API(center_info_v2)를 호출한 결과를 표준 JSON 형식으로 반환합니다."
    ),
)
async def mobility_centers(
    stdgCd: str = Query(
        ...,
        min_length=10,
        max_length=10,
        description="법정동코드 10자리",
        example="4311000000",
    ),
    pageNo: int = Query(
        1,
        ge=1,
        description="페이지 번호",
        example=1,
    ),
    numOfRows: int = Query(
        20,
        ge=1,
        le=100,
        description="페이지당 조회 건수",
        example=20,
    ),
):
    """
    센터 조회 API

    예:
    GET /api/mobility/centers?stdgCd=4311000000&pageNo=1&numOfRows=20
    """
    try:
        result = await get_transport_centers(stdgCd, pageNo, numOfRows)

        items = result.get("items", [])
        api_meta = result.get("apiMeta", {})

        return success_response(
            message="교통약자 이동지원센터 조회가 완료되었습니다.",
            data={
                "items": items,
            },
            meta={
                "count": len(items),
                "stdgCd": stdgCd,
                "pageNo": api_meta.get("pageNo", pageNo),
                "numOfRows": api_meta.get("numOfRows", numOfRows),
                "totalCount": api_meta.get("totalCount", len(items)),
                "resultCode": api_meta.get("resultCode"),
                "resultMsg": api_meta.get("resultMsg"),
            },
        )

    except ValueError as e:
        return map_value_error_to_response(
            error_message=str(e),
            default_error_code="MOBILITY_CENTER_FETCH_FAILED",
            default_message="교통약자 이동지원센터 조회에 실패했습니다.",
        )
    except Exception as e:
        return error_response(
            status_code=500,
            message="센터 조회 중 서버 내부 오류가 발생했습니다.",
            error_code="INTERNAL_SERVER_ERROR",
            detail=str(e),
        )


@router.get(
    "/vehicles/available",
    summary="이용 가능 차량 조회",
    description=(
        "법정동코드(stdgCd)를 기준으로 이용 가능한 교통약자 이동지원 차량 정보를 조회합니다. "
        "외부 공공데이터 API(info_vehicle_use_v2)를 호출한 결과를 표준 JSON 형식으로 반환합니다."
    ),
)
async def mobility_available_vehicles(
    stdgCd: str = Query(
        ...,
        min_length=10,
        max_length=10,
        description="법정동코드 10자리",
        example="4311000000",
    ),
    pageNo: int = Query(
        1,
        ge=1,
        description="페이지 번호",
        example=1,
    ),
    numOfRows: int = Query(
        20,
        ge=1,
        le=100,
        description="페이지당 조회 건수",
        example=20,
    ),
):
    """
    이용 가능 차량 조회 API

    예:
    GET /api/mobility/vehicles/available?stdgCd=4311000000&pageNo=1&numOfRows=20
    """
    try:
        result = await get_available_transport_vehicles(stdgCd, pageNo, numOfRows)

        items = result.get("items", [])
        api_meta = result.get("apiMeta", {})

        return success_response(
            message="이용 가능 차량 조회가 완료되었습니다.",
            data={
                "items": items,
            },
            meta={
                "count": len(items),
                "stdgCd": stdgCd,
                "pageNo": api_meta.get("pageNo", pageNo),
                "numOfRows": api_meta.get("numOfRows", numOfRows),
                "totalCount": api_meta.get("totalCount", len(items)),
                "resultCode": api_meta.get("resultCode"),
                "resultMsg": api_meta.get("resultMsg"),
            },
        )

    except ValueError as e:
        return map_value_error_to_response(
            error_message=str(e),
            default_error_code="MOBILITY_VEHICLE_FETCH_FAILED",
            default_message="이용 가능 차량 조회에 실패했습니다.",
        )
    except Exception as e:
        return error_response(
            status_code=500,
            message="이용 가능 차량 조회 중 서버 내부 오류가 발생했습니다.",
            error_code="INTERNAL_SERVER_ERROR",
            detail=str(e),
        )


@router.post(
    "/centers/sync",
    summary="교통약자 이동지원센터 동기화",
    description=(
        "외부 공공데이터 API(center_info_v2)를 호출한 뒤, "
        "정규화된 결과를 transport_centers 테이블에 저장/갱신합니다."
    ),
)
async def mobility_centers_sync(
    stdgCd: str = Query(
        ...,
        min_length=10,
        max_length=10,
        description="법정동코드 10자리",
        example="4311000000",
    ),
    pageNo: int = Query(
        1,
        ge=1,
        description="페이지 번호",
        example=1,
    ),
    numOfRows: int = Query(
        20,
        ge=1,
        le=100,
        description="페이지당 조회 건수",
        example=20,
    ),
):
    """
    센터 데이터 동기화 API

    동작:
    1. 외부 API 호출
    2. 응답 정규화
    3. transport_centers 테이블 upsert
    4. user_event_logs 에 sync 로그 기록

    예:
    POST /api/mobility/centers/sync?stdgCd=4311000000
    """
    try:
        result = await sync_transport_centers(stdgCd, pageNo, numOfRows)

        items = result.get("items", [])
        fetched_count = result.get("fetchedCount", 0)
        saved_count = result.get("savedCount", 0)
        api_meta = result.get("apiMeta", {})

        return success_response(
            message="교통약자 이동지원센터 데이터 동기화가 완료되었습니다.",
            data={
                "items": items,
                "sync": {
                    "fetchedCount": fetched_count,
                    "savedCount": saved_count,
                },
            },
            meta={
                "count": len(items),
                "stdgCd": stdgCd,
                "pageNo": api_meta.get("pageNo", pageNo),
                "numOfRows": api_meta.get("numOfRows", numOfRows),
                "totalCount": api_meta.get("totalCount", len(items)),
                "resultCode": api_meta.get("resultCode"),
                "resultMsg": api_meta.get("resultMsg"),
            },
            status_code=200,
        )

    except ValueError as e:
        return map_value_error_to_response(
            error_message=str(e),
            default_error_code="MOBILITY_CENTER_SYNC_FAILED",
            default_message="교통약자 이동지원센터 데이터 동기화에 실패했습니다.",
        )
    except Exception as e:
        return error_response(
            status_code=500,
            message="센터 동기화 중 서버 내부 오류가 발생했습니다.",
            error_code="INTERNAL_SERVER_ERROR",
            detail=str(e),
        )


@router.post(
    "/vehicles/available/sync",
    summary="이용 가능 차량 동기화",
    description=(
        "외부 공공데이터 API(info_vehicle_use_v2)를 호출한 뒤, "
        "정규화된 결과를 transport_vehicle_availability 테이블에 저장/갱신합니다."
    ),
)
async def mobility_available_vehicles_sync(
    stdgCd: str = Query(
        ...,
        min_length=10,
        max_length=10,
        description="법정동코드 10자리",
        example="4311000000",
    ),
    pageNo: int = Query(
        1,
        ge=1,
        description="페이지 번호",
        example=1,
    ),
    numOfRows: int = Query(
        20,
        ge=1,
        le=100,
        description="페이지당 조회 건수",
        example=20,
    ),
):
    """
    이용 가능 차량 데이터 동기화 API

    동작:
    1. 외부 API 호출
    2. 응답 정규화
    3. transport_vehicle_availability 테이블 upsert
    4. user_event_logs 에 sync 로그 기록

    예:
    POST /api/mobility/vehicles/available/sync?stdgCd=4311000000
    """
    try:
        result = await sync_available_transport_vehicles(stdgCd, pageNo, numOfRows)

        items = result.get("items", [])
        fetched_count = result.get("fetchedCount", 0)
        saved_count = result.get("savedCount", 0)
        api_meta = result.get("apiMeta", {})

        return success_response(
            message="이용 가능 차량 데이터 동기화가 완료되었습니다.",
            data={
                "items": items,
                "sync": {
                    "fetchedCount": fetched_count,
                    "savedCount": saved_count,
                },
            },
            meta={
                "count": len(items),
                "stdgCd": stdgCd,
                "pageNo": api_meta.get("pageNo", pageNo),
                "numOfRows": api_meta.get("numOfRows", numOfRows),
                "totalCount": api_meta.get("totalCount", len(items)),
                "resultCode": api_meta.get("resultCode"),
                "resultMsg": api_meta.get("resultMsg"),
            },
            status_code=200,
        )

    except ValueError as e:
        return map_value_error_to_response(
            error_message=str(e),
            default_error_code="MOBILITY_VEHICLE_SYNC_FAILED",
            default_message="이용 가능 차량 데이터 동기화에 실패했습니다.",
        )
    except Exception as e:
        return error_response(
            status_code=500,
            message="이용 가능 차량 동기화 중 서버 내부 오류가 발생했습니다.",
            error_code="INTERNAL_SERVER_ERROR",
            detail=str(e),
        )
