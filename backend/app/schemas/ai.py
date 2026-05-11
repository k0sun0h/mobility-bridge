from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum
from datetime import datetime

class MobilityType(str, Enum):
    wheelchair = "wheelchair"
    elderly = "elderly"
    visually_impaired = "visually_impaired"
    pregnant = "pregnant"
    temporary = "temporary"

class TravelTimeType(str, Enum):
    immediate = "immediate"
    reserved = "reserved"

class ActionType(str, Enum):
    CALL_CENTER_NOW = "CALL_CENTER_NOW"
    RESERVE_FIRST = "RESERVE_FIRST"
    CONSULT_FIRST = "CONSULT_FIRST"
    CHECK_STATION_INFO = "CHECK_STATION_INFO"

class RecommendationRequest(BaseModel):
    user_mobility_type: MobilityType
    with_caregiver: bool = False
    need_parking: bool = False  # 주차 여부 반영
    travel_time_type: TravelTimeType = TravelTimeType.immediate
    region_code: str = Field(..., description="지역코드 (예: 11=서울)")
    station_id: Optional[int] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "user_mobility_type": "wheelchair",
                "with_caregiver": True,
                "need_parking": False,
                "travel_time_type": "immediate",
                "region_code": "11",
                "station_id": 1
            }
        }
    }

class RecommendedCenter(BaseModel):
    center_id: str
    center_name: str
    phone: Optional[str] = None
    reservation_url: Optional[str] = None
    address: Optional[str] = None
    score: int = Field(..., ge=0, le=100)

class StationPriorityInfo(BaseModel):
    priority_order: List[str] = Field(
        ...,
        description="화면 노출 순서 ['elevators', 'station_phone', 'route_guide', 'address']"
    )
    elevator_count: Optional[int] = None
    accessibility_score: Optional[int] = None

class RecommendationResponse(BaseModel):
    # 사용자 프로필 에코
    user_mobility_type: str
    with_caregiver: bool
    
    # 핵심 추천 결과
    primary_action: ActionType
    action_label: str
    recommendation_score: int = Field(..., ge=0, le=100)
    predicted_wait_time: int = Field(default=0, description="예상 대기시간(분)")
    
    # 설명 및 주의사항
    reason_summary: List[str]
    cautions: List[str] = []
    
    # 상세 정보
    recommended_center: Optional[RecommendedCenter] = None
    station_priority: Optional[StationPriorityInfo] = None
