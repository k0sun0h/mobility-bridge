import os
import json
import httpx
from dotenv import load_dotenv

# .env 파일 불러오기
load_dotenv()

# 서울 열린데이터광장 인증키 읽기
# 없으면 sample 키로 먼저 테스트
seoul_api_key = (os.getenv("SEOUL_OPEN_API_KEY") or "sample").strip()

# 서비스명
service_name = "tbTraficElvtr"

# JSON 형식으로 1~5건 테스트
url = f"http://openapi.seoul.go.kr:8088/{seoul_api_key}/json/{service_name}/1/5/"

print("요청 URL:", url.replace(seoul_api_key, "sample" if seoul_api_key == "sample" else "내키"))

# API 요청
response = httpx.get(url, timeout=20.0, follow_redirects=True)

print("상태코드:", response.status_code)
print("응답 앞부분:")
print(response.text[:1000])

# JSON 파싱
if response.status_code == 200:
    try:
        data = response.json()
        print("\n응답 JSON 전체 구조:")
        print(json.dumps(data, indent=2, ensure_ascii=False))

        # 서울 Open API는 보통 서비스명 키 아래에 데이터가 들어있음
        if service_name in data:
            service_block = data[service_name]

            total_count = service_block.get("list_total_count")
            result = service_block.get("RESULT", {})
            rows = service_block.get("row", [])

            print("\n총 데이터 수:", total_count)
            print("결과 코드:", result.get("CODE"))
            print("결과 메시지:", result.get("MESSAGE"))
            print("행 개수:", len(rows))

            if rows:
                print("\n첫 번째 데이터:")
                print(json.dumps(rows[0], indent=2, ensure_ascii=False))
        else:
            print("\n예상한 서비스명 키가 없습니다. 실제 키를 확인하세요.")

    except Exception as e:
        print("\nJSON 파싱 실패:", e)