from dotenv import load_dotenv
import os
import httpx
import json

# .env 파일 불러오기
load_dotenv()

# 공공데이터 인증키 읽기 + 앞뒤 공백 제거
service_key = (os.getenv("KRIC_API_KEY") or "").strip()

# 인증키가 없으면 에러 발생
if not service_key:
    raise ValueError("PUBLIC_DATA_SERVICE_KEY가 없습니다. .env 파일을 확인하세요.")

# 교통약자 이동지원센터 현황정보 API 주소
url = "https://apis.data.go.kr/B551982/tsdo_v2/center_info_v2"

# 요청 파라미터
params = {
    "serviceKey": service_key,
    "pageNo": 1,
    "numOfRows": 5,
    "type": "JSON",
    "stdgCd": "4311000000"
}

# API 요청 보내기
response = httpx.get(url, params=params, timeout=20.0)

# 상태코드 출력
print("상태코드:", response.status_code)

# 응답 본문 먼저 확인
print("응답 본문:")
print(response.text[:2000])

# JSON 파싱 시도
if response.status_code == 200:
    try:
        data = response.json()
        print("응답 JSON:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except Exception:
        print("JSON 파싱 실패")