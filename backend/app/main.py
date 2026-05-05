# FastAPI 기본 객체 import
from fastapi import FastAPI

# JSON 응답 형식을 명시적으로 제어하기 위한 클래스 import
from fastapi.responses import JSONResponse

# stations 라우터 import
from app.api.routes.stations import router as stations_router

# mobility 라우터 import
from app.api.routes.mobility import router as mobility_router


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
]


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

공통 응답 형식:
- success: 요청 성공 여부
- message: 응답 메시지
- data: 실제 데이터
- meta: 부가 정보
- error: 에러 정보
""",
    version="1.1.0",
    openapi_tags=tags_metadata,
    contact={
        "name": "Mobility Bridge Team"
    },
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
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
                "version": "1.1.0",
                "docsUrl": "/docs",
                "redocUrl": "/redoc",
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
                "status": "ok"
            },
            "meta": {},
            "error": None,
        },
    )
