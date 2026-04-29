# FastAPI 관련 기능 import
from fastapi import APIRouter, Query, Path, HTTPException

# 서비스 함수 import
from app.services.station_service import (
    search_stations,
    get_station_detail,
    get_station_elevators,
    get_station_contact,
)

# 라우터 생성
router = APIRouter(
    prefix="/api/stations",
    tags=["stations"]
)


@router.get(
    "/search",
    summary="역 검색",
    description="역명 키워드로 역 목록을 검색합니다."
)
async def station_search(
    keyword: str = Query(
        ...,
        min_length=1,
        description="검색할 역명 키워드 예: 강남, 잠실, 서울"
    )
):
    """
    역 검색 API
    """
    items = await search_stations(keyword)

    return {
        "count": len(items),
        "items": items
    }


@router.get(
    "/{station_id}",
    summary="역 상세 조회",
    description="stationId를 기준으로 역 상세 정보를 조회합니다."
)
async def station_detail(
    station_id: str = Path(
        ...,
        description="검색 결과에서 받은 stationId 값"
    )
):
    """
    역 상세 조회 API
    """
    station = await get_station_detail(station_id)

    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    return station


@router.get(
    "/{station_id}/elevators",
    summary="역 엘리베이터 조회",
    description="stationId를 기준으로 해당 역 주변의 엘리베이터 위치 정보를 조회합니다."
)
async def station_elevators(
    station_id: str = Path(
        ...,
        description="검색 결과에서 받은 stationId 값"
    )
):
    """
    역 엘리베이터 조회 API
    """
    result = await get_station_elevators(station_id)

    if not result:
        raise HTTPException(status_code=404, detail="Station not found")

    return result


@router.get(
    "/{station_id}/contact",
    summary="역 전화번호 조회",
    description="stationId를 기준으로 해당 역의 전화번호 정보를 조회합니다."
)
async def station_contact(
    station_id: str = Path(
        ...,
        description="검색 결과에서 받은 stationId 값"
    )
):
    """
    역 전화번호 조회 API
    """
    result = await get_station_contact(station_id)

    if not result:
        raise HTTPException(status_code=404, detail="Station not found")

    return result
