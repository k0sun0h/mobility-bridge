# FastAPI 관련 기능 import
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

router = APIRouter(
    prefix="/api/ai",
    tags=["AI 추천"],
)

def success_response(
    message: str,
    data: dict,
    meta: dict | None = None,
    status_code: int = 200,
):
    """
    성공 응답을 공통 형식으로 반환합니다.
    mobility.py와 동일한 패턴 사용
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
    mobility.py와 동일한 패턴 사용
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

@router.get(
    "/test",
    summary="AI 라우터 연결 테스트",
    description="AI 라우터가 정상적으로 연결되었는지 확인하는 테스트 엔드포인트입니다.",
)
async def ai_connection_test():
    """
    AI 라우터 연결 확인용 테스트 API
    """
    return success_response(
        message="AI 라우터 연결 성공!",
        data={
            "status": "connected",
            "router": "ai",
            "version": "1.0.0"
        },
    )

##################

import json
from datetime import datetime
from typing import Optional

@router.post(
    "/recommend",
    summary="교통약자 이동 추천",
    description=(
        "사용자 유형과 지역 정보를 바탕으로 이동지원센터 추천 및 행동 가이드를 제공합니다. "
        "추천 결과는 prediction_logs 테이블에 자동으로 저장됩니다."
    ),
)
async def get_mobility_recommendation(
    user_mobility_type: str = Query(
        ...,
        description="사용자 유형",
        examples={"휠체어": {"value": "wheelchair"}},
    ),
    region_code: str = Query(
        "11",
        description="지역 코드 (기본값: 서울)",
        examples={"서울": {"value": "11"}},
    ),
    with_caregiver: bool = Query(
        False,
        description="보호자 동행 여부",
    ),
    need_parking: bool = Query(
        False,
        description="주차 필요 여부",
    ),
):
    """
    4주차 목표: 규칙 기반 추천 + prediction_logs 저장
    """
    try:
        # 1. 규칙 기반 추천 점수 계산
        recommendation_result = calculate_recommendation_score(
            user_mobility_type, with_caregiver, need_parking
        )
        
        # 2. prediction_logs에 저장
        await save_prediction_log(
            user_type=user_mobility_type,
            region_code=region_code,
            score=recommendation_result["score"],
            wait_time=recommendation_result["wait_time"],
            reasons=recommendation_result["reasons"],
            cautions=recommendation_result["cautions"],
            action=recommendation_result["action"],
        )
        
        # 3. 응답 반환
        return success_response(
            message="추천이 완료되었습니다.",
            data={
                "primaryAction": recommendation_result["action"],
                "actionLabel": get_action_label(recommendation_result["action"]),
                "recommendationScore": recommendation_result["score"],
                "predictedWaitTime": recommendation_result["wait_time"],
                "reasonSummary": recommendation_result["reasons"],
                "cautions": recommendation_result["cautions"],
            },
            meta={
                "userMobilityType": user_mobility_type,
                "withCaregiver": with_caregiver,
                "needParking": need_parking,
                "regionCode": region_code,
            },
        )
        
    except Exception as e:
        return error_response(
            status_code=500,
            message="추천 처리 중 서버 내부 오류가 발생했습니다.",
            error_code="AI_RECOMMEND_FAILED",
            detail=str(e),
        )

def calculate_recommendation_score(
    user_mobility_type: str, 
    with_caregiver: bool = False, 
    need_parking: bool = False
):
    """
    4주차 목표: 규칙 기반 추천 점수 로직 구현
    엘리베이터 존재 여부, 이동지원 차량 수, 전화 연결 가능 여부, 주차 여부 반영
    """
    score = 0
    reasons = []
    cautions = []
    
    # 1. 대상자 적합성 (최대 40점)
    if user_mobility_type == "wheelchair":
        score += 40
        reasons.append("휠체어 이용자를 위한 전문 서비스가 확인됩니다.")
    elif user_mobility_type == "elderly":
        score += 35
        reasons.append("고령자 이동 지원 서비스가 제공됩니다.")
    elif user_mobility_type == "visually_impaired":
        score += 30
        reasons.append("시각장애인 지원 서비스가 확인됩니다.")
        cautions.append("음성 안내 서비스 가능 여부를 센터에 문의하세요.")
    elif user_mobility_type == "pregnant":
        score += 25
        reasons.append("임산부 이동 지원 서비스를 확인해보세요.")
        cautions.append("이용 자격은 센터에 직접 확인하시는 것을 권장합니다.")
    else:
        score += 20
        cautions.append("이용 자격을 센터에 직접 확인하세요.")
    
    # 2. 차량 가능성 (최대 30점) - 더미 데이터
    available_vehicles = 2  # 실제로는 DB에서 조회
    if available_vehicles >= 3:
        score += 30
        reasons.append(f"현재 {available_vehicles}대의 차량이 대기 중이어서 바로 이용하실 수 있습니다.")
    elif available_vehicles > 0:
        score += 20
        reasons.append(f"현재 {available_vehicles}대가 운행 중입니다. 빠르게 연락해보세요.")
    else:
        score += 0
        cautions.append("현재 운행 중인 차량이 없어 예약을 먼저 진행해주세요.")
    
    # 3. 엘리베이터 접근성 (최대 20점) - 더미 데이터
    elevator_count = 2  # 실제로는 역 데이터에서 조회
    if elevator_count >= 2:
        score += 20
        reasons.append(f"역 내 엘리베이터 {elevator_count}대가 설치되어 있어 이동이 편리합니다.")
    elif elevator_count == 1:
        score += 10
        cautions.append("엘리베이터가 1대뿐입니다. 출발 전 역에 운행 여부를 확인하세요.")
    else:
        score += 0
        cautions.append("엘리베이터 정보를 확인할 수 없습니다. 역무실에 문의해주세요.")
    
    # 4. 연락 수단 (최대 10점)
    score += 10
    reasons.append("센터 직통 전화 연결이 가능합니다.")
    
    # 5. 주차 편의성 (선택적 +10점)
    if need_parking:
        score += 8
        reasons.append("인근 주차장에 빈자리가 확인됩니다.")
    
    # 6. 보호자 동행 고려
    if with_caregiver:
        reasons.append("보호자 동행 이용에 대해 센터에 문의하시면 안내받을 수 있습니다.")
    
    # 행동 추천 및 대기시간 결정
    if score >= 70:
        action = "CALL_CENTER_NOW"
        wait_time = 10
    elif score >= 50:
        action = "RESERVE_FIRST"
        wait_time = 25
    elif score >= 30:
        action = "CONSULT_FIRST"
        wait_time = 40
    else:
        action = "CHECK_STATION_INFO"
        wait_time = 60
    
    return {
        "score": min(score, 100),
        "wait_time": wait_time,
        "reasons": reasons,
        "cautions": cautions,
        "action": action
    }

def get_action_label(action: str) -> str:
    """행동 추천 라벨 반환"""
    labels = {
        "CALL_CENTER_NOW": "지금 바로 전화하기",
        "RESERVE_FIRST": "예약 먼저 하기", 
        "CONSULT_FIRST": "센터에 문의하기",
        "CHECK_STATION_INFO": "역 정보 먼저 확인하기",
    }
    return labels.get(action, "정보 확인하기")

async def save_prediction_log(
    user_type: str,
    region_code: str, 
    score: int,
    wait_time: int,
    reasons: list,
    cautions: list,
    action: str,
):
    """
    prediction_logs 테이블에 추천 결과 저장
    mobility_sync_service.py와 동일한 방식으로 DB 접근
    """
    try:
        # mobility 서비스와 동일한 방식으로 DB 접근
        # 실제 import 경로는 mobility_sync_service.py 확인 후 수정 필요
        from sqlalchemy import create_engine, text
        from sqlalchemy.orm import Session
        import os
        from dotenv import load_dotenv
        
        load_dotenv()
        database_url = os.getenv("DATABASE_URL")
        engine = create_engine(database_url)
        
        explanation_json = json.dumps({
            "reasons": reasons,
            "cautions": cautions, 
            "action": action
        }, ensure_ascii=False)
        
        with Session(bind=engine) as db:
            db.execute(
                text("""
                    INSERT INTO prediction_logs (
                        user_type, start_station, target_place, route_score,
                        wait_time_pred, explanation_json, created_at
                    ) VALUES (
                        :user_type, :start_station, :target_place, :route_score,
                        :wait_time_pred, :explanation_json, :created_at
                    )
                """),
                {
                    "user_type": user_type,
                    "start_station": None,
                    "target_place": region_code, 
                    "route_score": score,
                    "wait_time_pred": wait_time,
                    "explanation_json": explanation_json,
                    "created_at": datetime.now(),
                },
            )
            db.commit()
            
    except Exception as e:
        # 로그 저장 실패가 추천 결과에 영향을 주지 않도록 처리
        print(f"prediction_log 저장 실패 (추천은 정상 진행): {e}")

# -------------------------------------------------------
# 5주차 : ML 모델 import
# -------------------------------------------------------
from app.ml.shap_explainer import build_input_features, explain_prediction
from app.schemas.ai import MLRecommendRequest

# -------------------------------------------------------
# 5주차 : ML 기반 추천 API
# -------------------------------------------------------
@router.post(
    "/recommend-ml",
    summary="AI 머신러닝 기반 추천",
    description=(
        "RandomForest 분류/회귀 모델과 SHAP 설명을 사용한 AI 기반 추천입니다. "
        "편의성 등급, 예상 대기시간, 추천 이유를 함께 반환합니다."
    ),
)
async def get_ml_recommendation(request: MLRecommendRequest):
    """
    5주차 핵심: ML 모델 예측 + SHAP 설명
    """
    try:
        # 1. API 요청을 ML 입력 피처로 변환
        input_df = build_input_features(
            user_type=request.userType,
            elevator_count=request.elevatorCount,
            available_vehicles=request.availableVehicles,
            waiting_count=request.waitingCount,
            has_phone=request.hasPhone,
            with_caregiver=request.withCaregiver,
            need_parking=request.needParking,
            parking_available=request.parkingAvailable,
            time_slot=request.timeSlot,
        )

        # 2. ML 예측 + SHAP 설명 실행
        ml_result = explain_prediction(input_df)

        # 3. 응답 데이터 구성
        return success_response(
            message="AI 기반 추천이 완료되었습니다.",
            data={
                "convenienceLevel": ml_result["convenience_level"],
                "convenienceLevelKo": ml_result["convenience_level_ko"],
                "confidence": ml_result["confidence"],
                "predictedWaitTime": ml_result["predicted_wait_time"],
                "topFeatures": ml_result["top_features"],
                "explanationSentences": ml_result["explanation_sentences"],
            },
            meta={
                "userType": request.userType,
                "modelVersion": "1.0",
                "shapEnabled": True,
            },
        )

    except FileNotFoundError:
        return error_response(
            status_code=503,
            message="AI 모델 파일이 없습니다. 먼저 python -m app.ml.train을 실행하세요.",
            error_code="MODEL_NOT_FOUND",
            detail="data/models/ 폴더에 모델 파일이 필요합니다.",
        )
    except Exception as e:
        return error_response(
            status_code=500,
            message="AI 추천 처리 중 오류가 발생했습니다.",
            error_code="ML_RECOMMEND_FAILED",
            detail=str(e),
        )

# -------------------------------------------------------
# 5주차 : SHAP 상세 설명 API (선택사항)
# -------------------------------------------------------
@router.post(
    "/explain",
    summary="SHAP 상세 설명",
    description="입력 조건에 대한 SHAP 기반 상세 설명을 반환합니다.",
)
async def get_shap_explanation(request: MLRecommendRequest):
    """SHAP 설명에 집중한 API (정인님의 설명 카드 페이지용)"""
    try:
        input_df = build_input_features(
            user_type=request.userType,
            elevator_count=request.elevatorCount,
            available_vehicles=request.availableVehicles,
            waiting_count=request.waitingCount,
            has_phone=request.hasPhone,
            with_caregiver=request.withCaregiver,
            need_parking=request.needParking,
            parking_available=request.parkingAvailable,
            time_slot=request.timeSlot,
        )

        ml_result = explain_prediction(input_df)

        return success_response(
            message="SHAP 설명이 생성되었습니다.",
            data={
                "topFeatures": ml_result["top_features"],
                "explanationSentences": ml_result["explanation_sentences"],
                "convenienceLevel": ml_result["convenience_level"],
                "convenienceLevelKo": ml_result["convenience_level_ko"],
                "confidence": ml_result["confidence"],
            },
        )

    except Exception as e:
        return error_response(
            status_code=500,
            message="SHAP 설명 생성 중 오류가 발생했습니다.",
            error_code="SHAP_EXPLAIN_FAILED",
            detail=str(e),
        )