from dotenv import load_dotenv
import os
import httpx
import json

# .env 파일 불러오기
load_dotenv()

# KRIC 서비스키 읽기
service_key = (os.getenv("KRIC_API_KEY") or "").strip()

# 키가 없으면 에러
if not service_key:
    raise ValueError("KRIC_API_KEY가 없습니다. .env 파일을 확인하세요.")

# 역사별 엘리베이터 이동동선 API 주소
url = "https://openapi.kric.go.kr/openapi/vulnerableUserInfo/stationElevatorMovement"

# 문서에 나온 샘플 요청값 사용
params = {
    "serviceKey": service_key,
    "format": "json",
    "railOprIsttCd": "S1",
    "lnCd": "3",
    "stinCd": "322"
}

# 요청 보내기
response = httpx.get(url, params=params, timeout=20.0, follow_redirects=True)

# 상태코드 출력
print("상태코드:", response.status_code)
print("응답 앞부분:")
print(response.text[:1500])

# JSON이면 보기 좋게 출력
if response.status_code == 200:
    try:
        data = response.json()
        print("\n응답 JSON:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
    except Exception as e:
        print("\nJSON 파싱 실패:", e)