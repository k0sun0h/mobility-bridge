# .env 파일을 읽기 위해 사용
from dotenv import load_dotenv

# 환경변수를 읽기 위해 사용
import os

# HTTP 요청을 보내기 위해 사용
import httpx


# 현재 폴더의 .env 파일 읽기
load_dotenv()

# 공공데이터 인증키 가져오기
service_key = os.getenv("PUBLIC_DATA_SERVICE_KEY")

if not service_key:
    raise ValueError("PUBLIC_DATA_SERVICE_KEY가 없습니다. .env 파일을 확인하세요.")


# ---------------------------------------------------
# 테스트할 실제 API 요청 URL을 여기에 넣어야 함
# 아직 URL을 못 찾았으면 임시로 비워두고, 다음 단계에서 채움 
# ---------------------------------------------------
# 서울 열린데이터광장 Open API 실제 호출 주소
url = f"http://openapi.seoul.go.kr:8088/{service_key}/xml/StationAdresTelno/1/5/"

# API 호출
response = httpx.get(url, timeout=20.0)

# 결과 출력
print("상태코드:", response.status_code)
print("응답 앞부분:")
print(response.text[:1500])