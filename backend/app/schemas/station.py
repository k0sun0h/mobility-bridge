from pydantic import BaseModel, Field
from typing import List, Optional


class ErrorResponse(BaseModel):
    detail: str = Field(..., example="Station not found")


class StationSearchItem(BaseModel):
    stationId: str = Field(..., example="2호선_강남", description="역 고유 식별자")
    stationName: str = Field(..., example="강남", description="역명")
    line: str = Field(..., example="2호선", description="호선명")
    phone: str = Field(..., example="02-6110-2221", description="역 대표 전화번호")
    address: str = Field(
        ...,
        example="서울특별시 강남구 강남대로 지하396(역삼동)",
        description="대표 주소"
    )


class StationSearchResponse(BaseModel):
    count: int = Field(..., example=2, description="검색 결과 개수")
    items: List[StationSearchItem]


class StationDetailResponse(BaseModel):
    stationId: str = Field(..., example="2호선_강남", description="역 고유 식별자")
    stationName: str = Field(..., example="강남", description="역명")
    line: str = Field(..., example="2호선", description="호선명")
    phone: str = Field(..., example="02-6110-2221", description="역 대표 전화번호")
    address: str = Field(
        ...,
        example="서울특별시 강남구 강남대로 지하396(역삼동)",
        description="대표 주소"
    )
    roadAddress: str = Field(
        ...,
        example="서울특별시 강남구 강남대로 지하396(역삼동)",
        description="도로명 주소"
    )
    oldAddress: str = Field(
        ...,
        example="",
        description="구주소"
    )


class ElevatorItem(BaseModel):
    elevatorId: str = Field(..., example="123456", description="엘리베이터 노드 ID")
    stationCode: str = Field(..., example="222", description="지하철역 코드")
    stationName: str = Field(..., example="강남", description="역명")
    nodeType: str = Field(..., example="엘리베이터", description="노드 유형")
    nodeTypeCode: str = Field(..., example="14", description="노드 유형 코드")
    districtCode: str = Field(..., example="11680", description="시군구 코드")
    districtName: str = Field(..., example="강남구", description="시군구명")
    dongCode: str = Field(..., example="1168010100", description="읍면동 코드")
    dongName: str = Field(..., example="역삼동", description="읍면동명")
    wkt: str = Field(
        ...,
        example="POINT(127.027123 37.497891)",
        description="WKT 좌표 문자열"
    )
    longitude: Optional[float] = Field(
        None,
        example=127.027123,
        description="경도"
    )
    latitude: Optional[float] = Field(
        None,
        example=37.497891,
        description="위도"
    )


class StationElevatorsResponse(BaseModel):
    stationId: str = Field(..., example="2호선_강남", description="역 고유 식별자")
    stationName: str = Field(..., example="강남", description="역명")
    count: int = Field(..., example=3, description="엘리베이터 개수")
    items: List[ElevatorItem]


class StationContactResponse(BaseModel):
    stationId: str = Field(..., example="2호선_강남", description="역 고유 식별자")
    stationName: str = Field(..., example="강남", description="역명")
    line: str = Field(..., example="2호선", description="호선명")
    phone: str = Field(..., example="02-6110-2221", description="역 대표 전화번호")
