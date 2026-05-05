"""
DB 연결을 위한 공통 세션 설정 파일입니다.

- SQLAlchemy Engine 생성
- SessionLocal 생성
- 다른 repository/service 파일에서 공통으로 사용
"""

import os
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# backend/.env 를 명시적으로 로드합니다.
BASE_DIR = Path(__file__).resolve().parents[2]
ENV_PATH = BASE_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH, override=True)

# 예시:
# DATABASE_URL=postgresql+psycopg2://postgres:password@localhost:5432/mobility_bridge
DATABASE_URL = (os.getenv("DATABASE_URL") or "").strip()

if not DATABASE_URL:
    raise ValueError("DATABASE_URL 이 .env 에 설정되어 있지 않습니다.")

# SQLAlchemy 엔진 생성
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,   # 끊어진 커넥션 자동 감지
    future=True,
)

# 세션 팩토리 생성
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)
