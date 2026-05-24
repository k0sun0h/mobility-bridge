from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(
    prefix="/api/feedback",
    tags=["피드백"],
)


# ---------------------------------------------------
# 요청/응답 스키마
# ---------------------------------------------------
class FeedbackRequest(BaseModel):
    """
    피드백 저장 요청 스키마
    정인님의 피드백 페이지 UI와 매핑
    """
    destinationName: str = Field(..., description="목적지 이름")
    rating: Optional[int] = Field(None, ge=1, le=5, description="별점 (1~5)")
    inconveniences: Optional[List[str]] = Field(default=None, description="불편사항 목록")
    additionalComment: Optional[str] = Field(None, description="추가 의견")

    model_config = {
        "json_schema_extra": {
            "example": {
                "destinationName": "기흥역 1번 출구",
                "rating": 4,
                "inconveniences": ["엘리베이터 고장", "경사 심한 구간"],
                "additionalComment": "전반적으로 이용하기 편했지만 중간에 엘리베이터가 고장나 있었어요."
            }
        }
    }


def success_response(message: str, data: dict, status_code: int = 200):
    """성공 응답 공통 형식"""
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "message": message,
            "data": data,
            "meta": {},
            "error": None,
        },
    )


def error_response(status_code: int, message: str, error_code: str, detail: str):
    """에러 응답 공통 형식"""
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


# ---------------------------------------------------
# 피드백 저장 API
# ---------------------------------------------------
@router.post(
    "/submit",
    summary="경로 피드백 저장",
    description="경로 이용 후 사용자 피드백(별점, 불편사항, 추가 의견)을 DB에 저장합니다.",
)
async def submit_feedback(request: FeedbackRequest):
    """
    사용자의 경로 이용 피드백을 feedback_logs 테이블에 저장
    저장 완료 후 정인님 프론트엔드에서 홈으로 이동하면 됩니다.
    """
    try:
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise ValueError("DATABASE_URL이 설정되지 않았습니다.")
        
        engine = create_engine(database_url)

        with Session(bind=engine) as db:
            # PostgreSQL 배열 형태로 불편사항 저장
            inconveniences_array = request.inconveniences or []
            
            db.execute(
                text("""
                    INSERT INTO feedback_logs (
                        destination_name,
                        rating,
                        inconveniences,
                        additional_comment,
                        created_at
                    ) VALUES (
                        :destination_name,
                        :rating,
                        :inconveniences,
                        :additional_comment,
                        :created_at
                    )
                """),
                {
                    "destination_name": request.destinationName,
                    "rating": request.rating,
                    "inconveniences": inconveniences_array,
                    "additional_comment": request.additionalComment,
                    "created_at": datetime.now(),
                },
            )
            db.commit()

        # 성공 로그 출력
        print(f"[FEEDBACK] 저장 완료 | 목적지: {request.destinationName} | 별점: {request.rating}")
        if inconveniences_array:
            print(f"[FEEDBACK] 불편사항: {inconveniences_array}")

        return success_response(
            message="소중한 피드백이 저장되었습니다. 감사합니다!",
            data={
                "destinationName": request.destinationName,
                "saved": True,
                "timestamp": datetime.now().isoformat(),
            },
        )

    except Exception as e:
        print(f"[FEEDBACK] 저장 실패: {str(e)}")
        return error_response(
            status_code=500,
            message="피드백 저장 중 오류가 발생했습니다.",
            error_code="FEEDBACK_SAVE_FAILED",
            detail=str(e),
        )
