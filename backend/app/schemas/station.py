from typing import List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict


# -----------------------------
# 공통 에러 모델
# -----------------------------
class ErrorInfo(BaseModel):
    code: str = Field(..., description="에러 코드", examples=["STATION_NOT_FOUND"])
    detail: str = Field(..., description="에러 상세 메시지", examples=["해당 역을 찾을 수 없습니다."])


# -----------------------------
# 공통 메타 모델
# -----------------------------
class BaseMeta(BaseModel):
    model_config = ConfigDict(extra="allow")


class SearchMeta(BaseMeta):
    count: int = Field(..., description="검색 결과 개수", examples=[2])
    keyword: str = Field(..., description="검색 키워드", examples=["강남"])


class CountMeta(BaseMeta):
    count: int = Field(..., description="목록 개수", examples=[3])


class EmptyMeta(BaseMeta):
    pass


# -----------------------------
# 역 검색
# -----------------------------
class StationSearchItem(BaseModel):
    stationId: str = Field(..., description="내부 역 식별자", examples=["2호선_강남"])
    stationName: str = Field(..., description="역명", examples=["강남"])
    line: str = Field(..., description="호선명", examples=["2호선"])
    phone: Optional[str] = Field(None, description="역 대표 전화번호", examples=["02-6110-2221"])
    address: Optional[str] = Field(
        None,
        description="대표 주소",
        examples=["서울특별시 강남구 강남대로 지하396(역삼동)"]
    )


class StationSearchData(BaseModel):
    items: List[StationSearchItem] = Field(default_factory=list, description="검색된 역 목록")


class StationSearchResponse(BaseModel):
    success: bool = Field(True, description="요청 성공 여부")
    message: str = Field("역 검색이 완료되었습니다.", description="응답 메시지")
    data: StationSearchData
    meta: SearchMeta
    error: None = Field(None, description="에러 정보 없음")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "역 검색이 완료되었습니다.",
                "data": {
                    "items": [
                        {
                            "stationId": "2호선_강남",
                            "stationName": "강남",
                            "line": "2호선",
                            "phone": "02-6110-2221",
                            "address": "서울특별시 강남구 강남대로 지하396(역삼동)"
                        },
                        {
                            "stationId": "신분당선_강남",
                            "stationName": "강남",
                            "line": "신분당선",
                            "phone": None,
                            "address": None
                        }
                    ]
                },
                "meta": {
                    "count": 2,
                    "keyword": "강남"
                },
                "error": None
            }
        }
    )


# -----------------------------
# 역 상세
# -----------------------------
class StationDetailData(BaseModel):
    stationId: str = Field(..., description="내부 역 식별자", examples=["2호선_강남"])
    stationName: str = Field(..., description="역명", examples=["강남"])
    line: str = Field(..., description="호선명", examples=["2호선"])
    phone: Optional[str] = Field(None, description="역 대표 전화번호", examples=["02-6110-2221"])
    address: Optional[str] = Field(
        None,
        description="대표 주소",
        examples=["서울특별시 강남구 강남대로 지하396(역삼동)"]
    )
    roadAddress: Optional[str] = Field(
        None,
        description="도로명 주소",
        examples=["서울특별시 강남구 강남대로 지하396(역삼동)"]
    )
    oldAddress: Optional[str] = Field(
        None,
        description="지번 주소",
        examples=["서울특별시 강남구 역삼동 858"]
    )


class StationDetailResponse(BaseModel):
    success: bool = Field(True, description="요청 성공 여부")
    message: str = Field("역 상세 조회가 완료되었습니다.", description="응답 메시지")
    data: StationDetailData
    meta: EmptyMeta = Field(default_factory=EmptyMeta)
    error: None = Field(None, description="에러 정보 없음")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "역 상세 조회가 완료되었습니다.",
                "data": {
                    "stationId": "2호선_강남",
                    "stationName": "강남",
                    "line": "2호선",
                    "phone": "02-6110-2221",
                    "address": "서울특별시 강남구 강남대로 지하396(역삼동)",
                    "roadAddress": "서울특별시 강남구 강남대로 지하396(역삼동)",
                    "oldAddress": "서울특별시 강남구 역삼동 858"
                },
                "meta": {},
                "error": None
            }
        }
    )


# -----------------------------
# 엘리베이터 조회
# -----------------------------
class ElevatorItem(BaseModel):
    elevatorId: Optional[str] = Field(None, description="엘리베이터 식별값", examples=["ELV-001"])
    stationCode: Optional[str] = Field(None, description="역 코드", examples=["222"])
    stationName: str = Field(..., description="역명", examples=["강남"])
    nodeType: Optional[str] = Field(None, description="시설 유형", examples=["엘리베이터"])
    districtName: Optional[str] = Field(None, description="구 이름", examples=["강남구"])
    dongName: Optional[str] = Field(None, description="동 이름", examples=["역삼동"])
    wkt: Optional[str] = Field(
        None,
        description="원본 WKT 좌표 문자열",
        examples=["POINT(127.027123 37.497891)"]
    )
    longitude: Optional[float] = Field(None, description="경도", examples=[127.027123])
    latitude: Optional[float] = Field(None, description="위도", examples=[37.497891])


class StationElevatorsData(BaseModel):
    stationId: str = Field(..., description="내부 역 식별자", examples=["2호선_강남"])
    stationName: str = Field(..., description="역명", examples=["강남"])
    items: List[ElevatorItem] = Field(default_factory=list, description="엘리베이터 목록")


class StationElevatorsResponse(BaseModel):
    success: bool = Field(True, description="요청 성공 여부")
    message: str = Field("역 엘리베이터 조회가 완료되었습니다.", description="응답 메시지")
    data: StationElevatorsData
    meta: CountMeta
    error: None = Field(None, description="에러 정보 없음")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "역 엘리베이터 조회가 완료되었습니다.",
                "data": {
                    "stationId": "2호선_강남",
                    "stationName": "강남",
                    "items": [
                        {
                            "elevatorId": "ELV-001",
                            "stationCode": "222",
                            "stationName": "강남",
                            "nodeType": "엘리베이터",
                            "districtName": "강남구",
                            "dongName": "역삼동",
                            "wkt": "POINT(127.027123 37.497891)",
                            "longitude": 127.027123,
                            "latitude": 37.497891
                        }
                    ]
                },
                "meta": {
                    "count": 1
                },
                "error": None
            }
        }
    )


# -----------------------------
# 전화번호 조회
# -----------------------------
class StationContactData(BaseModel):
    stationId: str = Field(..., description="내부 역 식별자", examples=["2호선_강남"])
    stationName: str = Field(..., description="역명", examples=["강남"])
    line: str = Field(..., description="호선명", examples=["2호선"])
    phone: Optional[str] = Field(None, description="역 대표 전화번호", examples=["02-6110-2221"])


class StationContactResponse(BaseModel):
    success: bool = Field(True, description="요청 성공 여부")
    message: str = Field("역 전화번호 조회가 완료되었습니다.", description="응답 메시지")
    data: StationContactData
    meta: EmptyMeta = Field(default_factory=EmptyMeta)
    error: None = Field(None, description="에러 정보 없음")

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": True,
                "message": "역 전화번호 조회가 완료되었습니다.",
                "data": {
                    "stationId": "2호선_강남",
                    "stationName": "강남",
                    "line": "2호선",
                    "phone": "02-6110-2221"
                },
                "meta": {},
                "error": None
            }
        }
    )


# -----------------------------
# 공통 실패 응답
# -----------------------------
class ErrorResponse(BaseModel):
    success: bool = Field(False, description="요청 성공 여부")
    message: str = Field("요청 처리에 실패했습니다.", description="응답 메시지")
    data: Optional[Any] = Field(None, description="실패 시 데이터는 null")
    meta: BaseMeta = Field(default_factory=BaseMeta)
    error: ErrorInfo

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "success": False,
                "message": "해당 역을 찾을 수 없습니다.",
                "data": None,
                "meta": {},
                "error": {
                    "code": "STATION_NOT_FOUND",
                    "detail": "stationId에 해당하는 역 데이터가 없습니다."
                }
            }
        }
    )
