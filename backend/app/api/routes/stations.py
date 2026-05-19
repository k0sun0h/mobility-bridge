# FastAPI 관련 기능 import
from fastapi import APIRouter, Query, Path, HTTPException
from fastapi.responses import JSONResponse

# 서비스 함수 import
from app.services.station_service import (
    search_stations,
    get_station_detail,
    get_station_elevators,
    get_station_contact,
)
from app.schemas.station import (
    StationSearchResponse,
    StationDetailResponse,
    StationElevatorsResponse,
    StationContactResponse,
    ErrorResponse,
)

router = APIRouter(
    prefix="/api/stations",
    tags=["stations"],
)


def error_response(status_code: int, message: str, code: str, detail: str):
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "message": message,
            "data": None,
            "meta": {},
            "error": {
                "code": code,
                "detail": detail,
            },
        },
    )


@router.get(
    "/search",
    summary="역 검색",
    description="역명 키워드로 역 목록을 검색합니다.",
    response_model=StationSearchResponse,
    responses={
        500: {
            "model": ErrorResponse,
            "description": "서버 내부 오류",
        }
    },
)
async def station_search(
    keyword: str = Query(
        ...,
        min_length=1,
        description="검색할 역명 키워드 예: 강남, 서울, 잠실",
    )
):
    try:
        items = await search_stations(keyword)

        return {
            "success": True,
            "message": "역 검색이 완료되었습니다.",
            "data": {
                "items": items,
            },
            "meta": {
                "count": len(items),
                "keyword": keyword,
            },
            "error": None,
        }
    except Exception as e:
        return error_response(
            status_code=500,
            message="역 검색 처리 중 오류가 발생했습니다.",
            code="STATION_SEARCH_FAILED",
            detail=str(e),
        )


@router.get(
    "/{station_id}/elevators",
    summary="역 엘리베이터 조회",
    description="stationId를 기준으로 해당 역의 엘리베이터 위치 정보를 조회합니다.",
    response_model=StationElevatorsResponse,
    responses={
        404: {
            "model": ErrorResponse,
            "description": "역을 찾을 수 없음",
        },
        500: {
            "model": ErrorResponse,
            "description": "서버 내부 오류",
        },
    },
)
async def station_elevators(
    station_id: str = Path(..., description="검색 결과에서 받은 stationId 값")
):
    try:
        result = await get_station_elevators(station_id)

        if result is None:
            return error_response(
                status_code=404,
                message="해당 역을 찾을 수 없습니다.",
                code="STATION_NOT_FOUND",
                detail="stationId에 해당하는 역 데이터가 없습니다.",
            )

        items = result.get("items", [])

        return {
            "success": True,
            "message": "역 엘리베이터 조회가 완료되었습니다." if items else "엘리베이터 데이터가 없습니다.",
            "data": result,
            "meta": {
                "count": len(items),
            },
            "error": None,
        }
    except Exception as e:
        return error_response(
            status_code=500,
            message="역 엘리베이터 조회 처리 중 오류가 발생했습니다.",
            code="STATION_ELEVATOR_FETCH_FAILED",
            detail=str(e),
        )


@router.get(
    "/{station_id}/contact",
    summary="역 전화번호 조회",
    description="stationId를 기준으로 해당 역의 전화번호 정보를 조회합니다.",
    response_model=StationContactResponse,
    responses={
        404: {
            "model": ErrorResponse,
            "description": "역을 찾을 수 없음",
        },
        500: {
            "model": ErrorResponse,
            "description": "서버 내부 오류",
        },
    },
)
async def station_contact(
    station_id: str = Path(..., description="검색 결과에서 받은 stationId 값")
):
    try:
        result = await get_station_contact(station_id)

        if not result:
            return error_response(
                status_code=404,
                message="해당 역을 찾을 수 없습니다.",
                code="STATION_NOT_FOUND",
                detail="stationId에 해당하는 역 데이터가 없습니다.",
            )

        return {
            "success": True,
            "message": "역 전화번호 조회가 완료되었습니다.",
            "data": result,
            "meta": {},
            "error": None,
        }
    except Exception as e:
        return error_response(
            status_code=500,
            message="역 전화번호 조회 처리 중 오류가 발생했습니다.",
            code="STATION_CONTACT_FETCH_FAILED",
            detail=str(e),
        )


@router.get(
    "/{station_id}",
    summary="역 상세 조회",
    description="stationId를 기준으로 역 상세 정보를 조회합니다.",
    response_model=StationDetailResponse,
    responses={
        404: {
            "model": ErrorResponse,
            "description": "역을 찾을 수 없음",
        },
        500: {
            "model": ErrorResponse,
            "description": "서버 내부 오류",
        },
    },
)
async def station_detail(
    station_id: str = Path(..., description="검색 결과에서 받은 stationId 값")
):
    try:
        result = await get_station_detail(station_id)

        if not result:
            return error_response(
                status_code=404,
                message="해당 역을 찾을 수 없습니다.",
                code="STATION_NOT_FOUND",
                detail="stationId에 해당하는 역 데이터가 없습니다.",
            )

        return {
            "success": True,
            "message": "역 상세 조회가 완료되었습니다.",
            "data": result,
            "meta": {},
            "error": None,
        }
    except Exception as e:
        return error_response(
            status_code=500,
            message="역 상세 조회 처리 중 오류가 발생했습니다.",
            code="STATION_DETAIL_FETCH_FAILED",
            detail=str(e),
        )