# .env 파일에 저장된 환경변수를 읽기 위해 사용
from dotenv import load_dotenv

# 운영체제 환경변수에 접근하기 위해 사용
import os

# SQLAlchemy에서 DB 엔진 생성과 SQL 실행을 위해 사용
from sqlalchemy import create_engine, text


# 현재 폴더에 있는 .env 파일을 읽어옴 
load_dotenv()

# .env 파일에서 DATABASE_URL 값을 가져옴 
database_url = os.getenv("DATABASE_URL")

# DATABASE_URL이 비어 있으면 바로 에러를 발생시킴 
if not database_url:
    raise ValueError("DATABASE_URL이 없습니다. .env 파일을 확인하세요.")

# SQLAlchemy 엔진 생성
# pool_pre_ping=True는 연결이 살아있는지 미리 확인해주는 옵션
engine = create_engine(database_url, pool_pre_ping=True)

# 실제로 데이터베이스에 연결해서 간단한 SQL을 실행해봄 
with engine.connect() as connection:
    # PostgreSQL의 현재 시간을 조회하는 간단한 테스트 쿼리
    result = connection.execute(text("SELECT now();"))

    # 결과값 하나를 가져옴 
    current_time = result.scalar()

    print("Supabase PostgreSQL 연결 성공!!")
    print("DB 시간:", current_time)
