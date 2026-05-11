from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text
import json
from datetime import datetime

from app.schemas.ai import (
    MobilityType, TravelTimeType, ActionType,
    RecommendationRequest, RecommendedCenter, StationPriorityInfo
)

class RecommendationService:
    
    def __init__(self, db: Session):
        self.db = db

    async def get_centers_by_region(self, region_code: str) -> List[Dict[str, Any]]:
        """지역 코드로 센터 + 최신 차량 현황 조회"""
        query = text("""
            SELECT 
                tc.center_id,
                tc.center_name,
                tc.region_code,
                tc.phone,
                tc.address,
                tc.target_users,
                tc.weekday_operation_start,
                tc.weekday_operation_end,
                tc.weekend_operates,
                COALESCE(tva.available_vehicle_count, 0) as available_vehicle_count,
                COALESCE(tva.operating_vehicle_count, 0) as operating_vehicle_count,
                COALESCE(tva.waiting_count, 0) as waiting_count,
                tva.observed_at
            FROM transport_centers tc
            LEFT JOIN (
                SELECT DISTINCT ON (center_id)
                    center_id,
                    available_vehicle_count,
                    operating_vehicle_count,
                    waiting_count,
                    observed_at
                FROM transport_vehicle_availability
                ORDER BY center_id, observed_at DESC
            ) tva ON tc.center_id = tva.center_id
            WHERE tc.region_code = :region_code
            ORDER BY tc.center_name
        """)
        
        result = self.db.execute(query, {"region_code": region_code})
        return [dict(row._mapping) for row in result.fetchall()]

    async def get_station_info(self, station_id: int) -> Optional[Dict[str, Any]]:
        """역 ID로 역 + 엘리베이터 정보 조회"""
        query = text("""
            SELECT 
                s.id as station_id,
                s.station_name,
                s.line_name,
                s.address,
                sc.tel_no as station_phone,
                COUNT(se.id) as elevator_count
            FROM stations s
            LEFT JOIN station_contacts sc ON s.id = sc.station_id
            LEFT JOIN station_elevators se ON s.id = se.station_id
            WHERE s.id = :station_id
            GROUP BY s.id, s.station_name, s.line_name, s.address, sc.tel_no
        """)
        
        result = self.db.execute(query, {"station_id": station_id})
        row = result.fetchone()
        return dict(row._mapping) if row else None

    async def get_parking_info(self, station_id: int) -> Optional[Dict[str, Any]]:
        """역 근처 주차장 정보 조회"""
        # 임시 구현 - 실제로는 주차장 테이블과 연동
        return {
            "available_slots": 5,
            "total_slots": 20,
            "distance_meters": 200
        }

    def calculate_score(
        self,
        request: RecommendationRequest,
        center_data: Dict[str, Any],
        station_data: Optional[Dict[str, Any]] = None,
        parking_data: Optional[Dict[str, Any]] = None
    ) -> Tuple[int, List[str], List[str], int]:
        """
        규칙 기반 추천 점수 계산
        반환: (점수, 추천이유, 주의사항, 예상대기시간)
        """
        score = 0
        reasons = []
        cautions = []
        
        # 사용자 유형별 가중치 설정
        weights = self._get_user_weights(request.user_mobility_type, request.with_caregiver)
        
        # 1. 대상자 적합성 점수 (최대 40점)
        eligibility_score = self._calculate_eligibility_score(
            request, center_data, reasons, cautions
        )
        score += int(eligibility_score * weights["eligibility"])
        
        # 2. 차량 가능성 점수 (최대 30점)
        vehicle_score = self._calculate_vehicle_score(
            center_data, reasons, cautions
        )
        score += int(vehicle_score * weights["vehicle"])
        
        # 3. 역 접근성 점수 (최대 20점)
        if station_data:
            accessibility_score = self._calculate_accessibility_score(
                request, station_data, reasons, cautions
            )
            score += int(accessibility_score * weights["accessibility"])
        
        # 4. 연락 수단 점수 (최대 10점)
        contact_score = self._calculate_contact_score(
            center_data, reasons, cautions
        )
        score += int(contact_score * weights["contact"])
        
        # 5. 주차 점수 (요청 시에만, 최대 10점)
        if request.need_parking and parking_data:
            parking_score = self._calculate_parking_score(
                parking_data, reasons, cautions
            )
            score += parking_score
        elif request.need_parking:
            cautions.append("주차장 정보를 확인할 수 없습니다.")
        
        # 예상 대기시간 계산
        wait_time = self._calculate_wait_time(center_data)
        
        return min(score, 100), reasons, cautions, wait_time

    def _get_user_weights(self, mobility_type: MobilityType, with_caregiver: bool) -> Dict[str, float]:
        """사용자 유형별 가중치 반환"""
        base_weights = {
            "eligibility": 1.0,
            "vehicle": 1.0,
            "accessibility": 1.0,
            "contact": 1.0
        }
        
        if mobility_type == MobilityType.wheelchair:
            base_weights["accessibility"] = 1.5  # 엘리베이터 중요도 증가
        elif mobility_type == MobilityType.visually_impaired:
            base_weights["contact"] = 1.5  # 전화 연결 중요도 증가
        elif mobility_type == MobilityType.elderly:
            base_weights["vehicle"] = 1.2  # 차량 가능성 중요도 증가
            
        if with_caregiver:
            base_weights["contact"] = min(base_weights["contact"] * 1.2, 1.5)
            
        return base_weights

    def _calculate_eligibility_score(
        self, request: RecommendationRequest, center_data: Dict[str, Any],
        reasons: List[str], cautions: List[str]
    ) -> float:
        """대상자 적합성 점수 계산"""
        target_users = (center_data.get("target_users") or "").lower()
        
        # 키워드 매칭
        keyword_matches = {
            MobilityType.wheelchair: ["휠체어", "지체", "뇌병변", "중증"],
            MobilityType.elderly: ["고령", "65세", "노인"],
            MobilityType.visually_impaired: ["시각", "맹인", "저시력"],
            MobilityType.pregnant: ["임산부", "임신"],
            MobilityType.temporary: ["일시적", "단기"]
        }
        
        user_keywords = keyword_matches.get(request.user_mobility_type, [])
        matches = sum(1 for keyword in user_keywords if keyword in target_users)
        
        if matches >= 2:
            reasons.append(f"{request.user_mobility_type.value} 이용자 대상 서비스가 명확히 확인됩니다.")
            return 40.0
        elif matches >= 1:
            reasons.append("이용 대상자 조건에 부합할 가능성이 있습니다.")
            return 25.0
        elif target_users:
            cautions.append("이용 대상자 조건을 센터에 직접 확인하세요.")
            return 15.0
        else:
            cautions.append("대상자 정보가 없어 사전 문의가 필요합니다.")
            return 5.0

    def _calculate_vehicle_score(
        self, center_data: Dict[str, Any], reasons: List[str], cautions: List[str]
    ) -> float:
        """차량 가능성 점수 계산"""
        available = center_data.get("available_vehicle_count", 0)
        waiting = center_data.get("waiting_count", 0)
        
        if available >= 3:
            reasons.append(f"이용 가능한 차량이 충분합니다 ({available}대).")
            return 30.0
        elif available >= 2:
            reasons.append(f"이용 가능한 차량이 있습니다 ({available}대).")
            if waiting > 0:
                cautions.append(f"대기 {waiting}건이 있어 지연될 수 있습니다.")
            return 20.0
        elif available == 1:
            reasons.append("이용 가능한 차량이 1대 있습니다.")
            if waiting >= 3:
                cautions.append(f"대기가 많아 ({waiting}건) 상당한 지연이 예상됩니다.")
            return 10.0
        else:
            cautions.append("현재 이용 가능한 차량이 없습니다.")
            return 0.0

    def _calculate_accessibility_score(
        self, request: RecommendationRequest, station_data: Dict[str, Any],
        reasons: List[str], cautions: List[str]
    ) -> float:
        """역 접근성 점수 계산"""
        elevator_count = station_data.get("elevator_count", 0) or 0
        
        if elevator_count >= 3:
            reasons.append("역 내 엘리베이터가 충분히 설치되어 있습니다.")
            return 20.0
        elif elevator_count == 2:
            reasons.append("역 내 엘리베이터가 2대 있습니다.")
            return 15.0
        elif elevator_count == 1:
            reasons.append("역 내 엘리베이터가 1대 있습니다.")
            cautions.append("엘리베이터가 1대뿐이므로 운행 상태를 미리 확인하세요.")
            return 8.0
        else:
            cautions.append("해당 역의 엘리베이터 정보가 없습니다.")
            return 0.0

    def _calculate_contact_score(
        self, center_data: Dict[str, Any], reasons: List[str], cautions: List[str]
    ) -> float:
        """연락 수단 점수 계산"""
        score = 0.0
        
        if center_data.get("phone"):
            reasons.append("센터 직통 전화 연결이 가능합니다.")
            score += 7.0
            
        # reservation_url이 있다면 추가 점수
        if center_data.get("reservation_url"):
            reasons.append("온라인 예약이 가능합니다.")
            score += 3.0
            
        if score == 0:
            cautions.append("센터 연락 수단이 제한적입니다.")
            
        return score

    def _calculate_parking_score(
        self, parking_data: Dict[str, Any], reasons: List[str], cautions: List[str]
    ) -> float:
        """주차 점수 계산"""
        available_slots = parking_data.get("available_slots", 0)
        total_slots = parking_data.get("total_slots", 0)
        
        if available_slots >= 5:
            reasons.append("인근 주차장에 빈자리가 충분합니다.")
            return 10.0
        elif available_slots > 0:
            reasons.append(f"인근 주차장에 빈자리가 {available_slots}개 있습니다.")
            return 5.0
        else:
            cautions.append("인근 주차장이 만차이거나 정보가 없습니다.")
            return 0.0

    def _calculate_wait_time(self, center_data: Dict[str, Any]) -> int:
        """예상 대기시간 계산 (분 단위)"""
        available = center_data.get("available_vehicle_count", 0)
        waiting = center_data.get("waiting_count", 0)
        
        if available == 0:
            return 60  # 차량이 없으면 1시간 대기
        elif available >= 3:
            return max(5, waiting * 8)  # 차량 충분하면 최소 5분
        else:
            return max(15, waiting * 12)  # 차량 부족하면 최소 15분

    def determine_action(
        self, score: int, center_data: Dict[str, Any], 
        travel_time_type: TravelTimeType
    ) -> Tuple[ActionType, str]:
        """추천 행동 결정"""
        available = center_data.get("available_vehicle_count", 0)
        waiting = center_data.get("waiting_count", 0)
        
        if score >= 70 and available > 0 and travel_time_type == TravelTimeType.immediate:
            return ActionType.CALL_CENTER_NOW, "지금 바로 전화하기"
        elif score >= 50 and (available > 0 or travel_time_type == TravelTimeType.reserved):
            return ActionType.RESERVE_FIRST, "예약 먼저 하기"
        elif score >= 30:
            return ActionType.CONSULT_FIRST, "센터에 문의하기"
        else:
            return ActionType.CHECK_STATION_INFO, "역 정보 먼저 확인하기"

    def get_station_priority(
        self, mobility_type: MobilityType, with_caregiver: bool,
        station_data: Optional[Dict[str, Any]] = None
    ) -> StationPriorityInfo:
        """역 정보 우선노출 순서 결정"""
        if mobility_type == MobilityType.wheelchair:
            priority_order = ["elevators", "route_guide", "station_phone", "address"]
        elif mobility_type == MobilityType.visually_impaired:
            priority_order = ["station_phone", "elevators", "address", "route_guide"]
        else:
            priority_order = ["station_phone", "elevators", "address", "route_guide"]
            
        if with_caregiver:
            # 보호자 동행 시 전화번호를 더 우선시
            if "station_phone" in priority_order:
                priority_order.remove("station_phone")
                priority_order.insert(0, "station_phone")
        
        elevator_count = None
        accessibility_score = None
        
        if station_data:
            elevator_count = station_data.get("elevator_count", 0)
            accessibility_score = min((elevator_count or 0) * 25, 100)
            
        return StationPriorityInfo(
            priority_order=priority_order,
            elevator_count=elevator_count,
            accessibility_score=accessibility_score
        )

    async def save_prediction_log(
        self, request: RecommendationRequest, score: int, wait_time: int,
        action: ActionType, reasons: List[str], cautions: List[str],
        recommended_center_id: Optional[str] = None
    ) -> None:
        """prediction_logs 테이블에 결과 저장"""
        explanation_json = json.dumps({
            "reasons": reasons,
            "cautions": cautions,
            "action": action.value
        }, ensure_ascii=False)
        
        query = text("""
            INSERT INTO prediction_logs (
                user_type, start_station, target_place, route_score,
                wait_time_pred, explanation_json, created_at
            ) VALUES (
                :user_type, :start_station, :target_place, :route_score,
                :wait_time_pred, :explanation_json, :created_at
            )
        """)
        
        self.db.execute(query, {
            "user_type": request.user_mobility_type.value,
            "start_station": str(request.station_id) if request.station_id else None,
            "target_place": request.region_code,
            "route_score": score,
            "wait_time_pred": wait_time,
            "explanation_json": explanation_json,
            "created_at": datetime.now()
        })
        self.db.commit()
