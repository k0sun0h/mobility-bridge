# FastAPI 기본 객체 import
from fastapi import FastAPI

# stations 라우터 import
from app.api.routes import stations

# Swagger 태그 메타데이터
tags_metadata = [
    {
        "name": "stations",
        "description": (
            "역 검색, 역 상세 조회, 엘리베이터 조회, 전화번호 조회 API 모음입니다. "
            "프론트엔드의 역 검색 페이지와 상세 페이지에서 사용하는 기본 API입니다."
        ),
    },
    {
        "name": "default",
        "description": "기본 확인용 API입니다.",
    },
]

# FastAPI 앱 생성
app = FastAPI(
    title="Mobility Bridge API",
    description="""
교통약자를 위한 지하철 무장애 이동 지원 백엔드 API입니다.

주요 기능:
- 역 검색
- 역 상세 정보 조회
- 역 주변 엘리베이터 위치 조회
- 역 전화번호 조회

현재 문서는 프론트엔드 연동을 위한 기본 조회 API를 중심으로 구성되어 있습니다.
""",
    version="0.1.0",
    openapi_tags=tags_metadata,
    contact={
        "name": "Mobility Bridge Team"
    },
)

# stations 라우터 등록
app.include_router(stations.router)

# 루트 페이지
@app.get(
    "/",
    tags=["default"],
    summary="루트 확인",
    description="서버가 정상 실행 중인지 확인합니다."
)
def read_root():
    return {"message": "Mobility Bridge backend is running!"}

# 헬스 체크 API
@app.get(
    "/health",
    tags=["default"],
    summary="헬스 체크",
    description="서버 상태를 간단히 확인합니다."
)
def health_check():
    return {"status": "ok"}
