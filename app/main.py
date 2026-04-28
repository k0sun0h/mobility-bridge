# FastAPI 클래스를 가져옴 
# FastAPI는 파이썬으로 웹 API 서버를 쉽게 만들 수 있게 해주는 도구
from fastapi import FastAPI

# FastAPI 앱 객체를 생성
# title, description, version은 /docs 페이지에서 보이는 정보
app = FastAPI(
    title="Mobility Bridge API",                 # API 이름
    description="교통약자 이동 지원 백엔드 API",   # API 설명
    version="0.1.0"                              # 현재 버전
)


# 기본 주소("/")에 접속했을 때 실행되는 API
# 브라우저에서 http://127.0.0.1:8000/ 로 들어가면 이 함수가 실행됨 
@app.get("/")
def read_root():
    # JSON 형태로 메시지를 반환함 
    return {"message": "Mobility Bridge backend is running!"}


# 서버가 정상적으로 살아있는지 확인하는 API
# 보통 health check(헬스 체크)라고 부름 
@app.get("/health")
def health_check():
    # 서버 상태를 간단히 반환함
    return {"status": "ok"}
