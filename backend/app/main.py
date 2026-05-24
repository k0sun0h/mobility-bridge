# FastAPI 기본 객체 import
from fastapi import FastAPI

# JSON 응답 형식을 명시적으로 제어하기 위한 클래스 import
from fastapi.responses import JSONResponse

# CORS 미들웨어 import (프론트엔드 연동을 위해 필수)
from fastapi.middleware.cors import CORSMiddleware

# stations 라우터 import
from app.api.routes.stations import router as stations_router

# mobility 라우터 import
from app.api.routes.mobility import router as mobility_router

# feedback 라우터 import (피드백 저장용)
from app.api.routes.feedback import router as feedback_router

# AI 라우터 import (4주차 목표를 위해 추가)
# 만약 아직 ai.py 파일이 없다면 이 줄을 주석처리하고 나중에 활성화
try:
    from app.api.routes.ai import router as ai_router
    AI_ROUTER_AVAILABLE = True
except ImportError:
    AI_ROUTER_AVAILABLE = False
    print("AI 라우터를 찾을 수 없습니다. 나중에 추가하세요.")


# ---------------------------------------------------
# Swagger 태그 메타데이터
# ---------------------------------------------------
tags_metadata = [
    {
        "name": "default",
        "description": "기본 확인용 API입니다. 서버 실행 여부와 상태를 확인할 때 사용합니다.",
    },
    {
        "name": "stations",
        "description": (
            "역 검색, 역 상세 조회, 엘리베이터 조회, 전화번호 조회 API 모음입니다. "
            "프론트엔드의 역 검색 페이지와 상세 페이지에서 사용하는 기본 API입니다."
        ),
    },
    {
        "name": "mobility",
        "description": (
            "교통약자 이동지원센터 및 실시간 이동지원 정보 관련 API입니다. "
            "현재는 center_info_v2 기반 센터 조회 API를 우선 제공합니다."
        ),
    },
    {
        "name": "피드백",
        "description": (
            "경로 이용 후 사용자 피드백(별점, 불편사항, 추가 의견) 저장 API입니다. "
            "수집된 피드백은 서비스 품질 개선 및 AI 모델 고도화에 활용됩니다."
        ),
    },
]

# AI 라우터가 있으면 태그 메타데이터에 추가
if AI_ROUTER_AVAILABLE:
    tags_metadata.append({
        "name": "AI 추천",
        "description": (
            "교통약자 이동 추천 API입니다. "
            "사용자 유형과 지역 정보를 바탕으로 이동지원센터 추천 및 행동 가이드를 제공합니다."
        ),
    })


# ---------------------------------------------------
# FastAPI 앱 생성
# ---------------------------------------------------
app = FastAPI(
    title="Mobility Bridge API",
    description="""
교통약자를 위한 지하철 무장애 이동 지원 백엔드 API입니다.

주요 기능:
- 역 검색
- 역 상세 정보 조회
- 역 주변 엘리베이터 위치 조회
- 역 전화번호 조회
- 교통약자 이동지원센터 조회
- 교통약자 이동 추천 (규칙 기반, AI 라우터 있을 때)
- 경로 이용 후 사용자 피드백 저장

공통 응답 형식:
- success: 요청 성공 여부
- message: 응답 메시지
- data: 실제 데이터
- meta: 부가 정보
- error: 에러 정보
""",
    version="1.3.0",
    openapi_tags=tags_metadata,
    contact={
        "name": "Mobility Bridge Team"
    },
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)


# ---------------------------------------------------
# CORS 미들웨어 설정 (반드시 라우터 등록보다 먼저!)
# ---------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # 모든 도메인에서 요청 허용 (테스트용)
    allow_credentials=False,      # allow_origins=["*"]일 때는 반드시 False
    allow_methods=["*"],          # 모든 HTTP 메서드 허용
    allow_headers=["*"],          # 모든 HTTP 헤더 허용
)


# ---------------------------------------------------
# stations 라우터 등록
# ---------------------------------------------------
app.include_router(stations_router)

# ---------------------------------------------------
# mobility 라우터 등록
# ---------------------------------------------------
app.include_router(mobility_router)

# ---------------------------------------------------
# feedback 라우터 등록
# ---------------------------------------------------
app.include_router(feedback_router)

# ---------------------------------------------------
# AI 라우터 등록 (있는 경우에만)
# ---------------------------------------------------
if AI_ROUTER_AVAILABLE:
    app.include_router(ai_router)


# ---------------------------------------------------
# 루트 페이지
# ---------------------------------------------------
@app.get(
    "/",
    tags=["default"],
    summary="루트 확인",
    description="서버가 정상 실행 중인지 확인하는 기본 엔드포인트입니다."
)
async def read_root():
    """
    루트 응답 함수
    """
    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "message": "Mobility Bridge backend is running!",
            "data": {
                "service": "Mobility Bridge API",
                "version": "1.3.0",
                "docsUrl": "/docs",
                "redocUrl": "/redoc",
                "aiRouterAvailable": AI_ROUTER_AVAILABLE,  # AI 라우터 상태 표시
            },
            "meta": {},
            "error": None,
        },
    )


# ---------------------------------------------------
# 헬스 체크 API
# ---------------------------------------------------
@app.get(
    "/health",
    tags=["default"],
    summary="헬스 체크",
    description="서버 상태를 간단히 확인하는 엔드포인트입니다."
)
async def health_check():
    """
    헬스체크 함수
    """
    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "message": "서버 상태가 정상입니다.",
            "data": {
                "status": "ok",
                "corsEnabled": True,
                "availableRouters": ["stations", "mobility", "feedback"] + (["ai"] if AI_ROUTER_AVAILABLE else [])
            },
            "meta": {},
            "error": None,
        },
    )
