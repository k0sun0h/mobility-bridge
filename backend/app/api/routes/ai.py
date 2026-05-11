from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.schemas.ai import RecommendationRequest, RecommendationResponse, RecommendedCenter
from app.services.recommendation_service import RecommendationService
from app.core.database import get_db  # 실제 프로젝트의 DB 의존성으로 수정

router = APIRouter(prefix="/api/ai", tags=["AI 추천"])

@router.post(
    "/recommend", 
    response_model=RecommendationResponse,
    summary="교통약자 이동 추천",
    description="사용자 유형과 지역 정보를 바탕으로 이동지원센터 추천 및 행동 가이드를 제공합니다."
)
async def get_mobility_recommendation(
    request: RecommendationRequest,
    db: Session = Depends(get_db)
):
    try:
        service = RecommendationService(db)
        
        # 1. 지역별 센터 + 차량 현황 조회
        centers = await service.get_centers_by_region(request.region_code)
        
        if not centers:
            # 센터가 없으면 역 정보만 제공
            station_priority = None
            if request.station_id:
                station_info = await service.get_station_info(request.station_id)
                station_priority = service.get_station_priority(
                    request.user_mobility_type,
                    request.with_caregiver,
                    station_info
                )
            
            return RecommendationResponse(
                user_mobility_type=request.user_mobility_type.value,
                with_caregiver=request.with_caregiver,
                primary_action="CHECK_STATION_INFO",
                action_label="역 정보 먼저 확인하기",
                recommendation_score=0,
                predicted_wait_time=0,
                reason_summary=["해당 지역에서 이동지원센터를 찾지 못했습니다."],
                cautions=["역 편의시설 정보를 우선 확인하세요."],
                station_priority=station_priority
            )
        
        # 2. 역 정보 조회 (있는 경우)
        station_info = None
        if request.station_id:
            station_info = await service.get_station_info(request.station_id)
        
        # 3. 주차 정보 조회 (필요한 경우)
        parking_info = None
        if request.need_parking and request.station_id:
            parking_info = await service.get_parking_info(request.station_id)
        
        # 4. 각 센터별 점수 계산 및 최적 센터 선택
        best_center = None
        best_score = 0
        best_reasons = []
        best_cautions = []
        best_wait_time = 0
        
        for center in centers:
            score, reasons, cautions, wait_time = service.calculate_score(
                request, center, station_info, parking_info
            )
            
            if score > best_score:
                best_center = center
                best_score = score
                best_reasons = reasons
                best_cautions = cautions
                best_wait_time = wait_time
        
        # 5. 추천 점수가 너무 낮으면 문의 유도
        if best_score < 20:
            return RecommendationResponse(
                user_mobility_type=request.user_mobility_type.value,
                with_caregiver=request.with_caregiver,
                primary_action="CONSULT_FIRST",
                action_label="센터에 직접 문의하기",
                recommendation_score=best_score,
                predicted_wait_time=best_wait_time,
                reason_summary=best_reasons or ["현재 조건에서 적합한 센터를 찾기 어렵습니다."],
                cautions=best_cautions + ["이용 자격과 차량 현황을 센터에 직접 확인하세요."]
            )
        
        # 6. 행동 추천 결정
        action, action_label = service.determine_action(
            best_score, best_center, request.travel_time_type
        )
        
        # 7. 역 정보 우선순위 결정
        station_priority = service.get_station_priority(
            request.user_mobility_type,
            request.with_caregiver,
            station_info
        )
        
        # 8. prediction_log 저장
        await service.save_prediction_log(
            request, best_score, best_wait_time, action,
            best_reasons, best_cautions, best_center.get("center_id")
        )
        
        # 9. 최종 응답 구성
        return RecommendationResponse(
            user_mobility_type=request.user_mobility_type.value,
            with_caregiver=request.with_caregiver,
            primary_action=action,
            action_label=action_label,
            recommendation_score=best_score,
            predicted_wait_time=best_wait_time,
            reason_summary=best_reasons,
            cautions=best_cautions,
            recommended_center=RecommendedCenter(
                center_id=best_center["center_id"],
                center_name=best_center["center_name"],
                phone=best_center.get("phone"),
                reservation_url=best_center.get("reservation_url"),
                address=best_center.get("address"),
                score=best_score
            ),
            station_priority=station_priority
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"추천 처리 중 오류가 발생했습니다: {str(e)}"
        )
