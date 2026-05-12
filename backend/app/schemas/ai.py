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

# -------------------------------------------------------
# 5주차 : ML 모델 요청 스키마
# -------------------------------------------------------
class MLRecommendRequest(BaseModel):
    """ML 모델 직접 호출용 요청 스키마"""
    userType: str = Field(default="wheelchair", description="사용자 유형")
    elevatorCount: int = Field(default=2, ge=0, description="엘리베이터 개수")
    availableVehicles: int = Field(default=2, ge=0, description="이용 가능 차량 수")
    waitingCount: int = Field(default=1, ge=0, description="현재 대기 인원")
    hasPhone: bool = Field(default=True, description="전화 연결 가능 여부")
    withCaregiver: bool = Field(default=False, description="보호자 동행 여부")
    needParking: bool = Field(default=False, description="주차 필요 여부")
    parkingAvailable: int = Field(default=10, ge=0, description="주차 가능 면수")
    timeSlot: str = Field(default="morning", description="이용 시간대")

    model_config = {
        "json_schema_extra": {
            "example": {
                "userType": "wheelchair",
                "elevatorCount": 3,
                "availableVehicles": 4,
                "waitingCount": 0,
                "hasPhone": True,
                "withCaregiver": False,
                "needParking": False,
                "parkingAvailable": 15,
                "timeSlot": "morning"
            }
        }
    }

# -------------------------------------------------------
# 5주차 : SHAP 피처 스키마
# -------------------------------------------------------
class ShapFeature(BaseModel):
    """SHAP 피처 중요도 항목"""
    feature: str
    feature_ko: str
    shap_value: float
    feature_value: float
    impact: str
    impact_ko: str

# -------------------------------------------------------
# 5주차 : ML 응답 스키마
# -------------------------------------------------------
class MLRecommendResponse(BaseModel):
    """ML 모델 예측 + SHAP 설명 응답"""
    convenienceLevel: str = Field(..., description="편의성 등급 (high/medium/low)")
    convenienceLevelKo: str = Field(..., description="편의성 등급 한국어")
    confidence: float = Field(..., description="예측 신뢰도")
    predictedWaitTime: float = Field(..., description="예상 대기시간(분)")
    topFeatures: List[ShapFeature] = Field(..., description="상위 피처 중요도")
    explanationSentences: List[str] = Field(..., description="자연어 설명")