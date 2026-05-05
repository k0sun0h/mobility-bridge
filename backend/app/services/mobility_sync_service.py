"""
외부 mobility API 결과를 DB에 동기화하는 서비스 계층입니다.

역할:
- mobility_service 에서 외부 API 조회
- repository 로 DB upsert
- 필요 시 이벤트 로그 남기기

디버깅 포인트:
- 외부 API 조회는 성공했는데 DB 저장 단계에서 실패하는 경우,
  traceback.print_exc() 를 통해 정확한 SQL/세션 에러를 확인할 수 있도록 함
- 실패 로그 저장이 원래 예외를 덮지 않도록 안전하게 처리
"""

import json
import traceback
from typing import Any, Dict

from app.db.session import SessionLocal
from app.repositories.mobility_repository import (
    insert_user_event_log,
    upsert_transport_centers,
    upsert_transport_vehicle_availability_bulk,
)
from app.services.mobility_service import (
    get_transport_centers,
    get_available_transport_vehicles,
)


async def sync_transport_centers(
    stdg_cd: str,
    page_no: int = 1,
    num_of_rows: int = 20
) -> Dict[str, Any]:
    """
    교통약자 이동지원센터 API를 호출한 뒤,
    응답 데이터를 transport_centers 테이블에 저장합니다.

    처리 순서:
    1) 외부 API 조회
    2) DB 저장용 payload 보강(rawPayload 추가)
    3) transport_centers upsert
    4) user_event_logs 성공 로그 기록
    5) commit

    실패 시:
    - rollback
    - traceback 출력
    - 실패 로그는 별도 try/except 로 감싸서 원래 에러를 덮지 않도록 함
    """
    db = SessionLocal()

    try:
        print(f"[SYNC][CENTERS] START stdg_cd={stdg_cd}, page_no={page_no}, num_of_rows={num_of_rows}")

        # 1) 외부 API 조회
        result = await get_transport_centers(stdg_cd, page_no, num_of_rows)
        items = result.get("items", [])

        print(f"[SYNC][CENTERS] fetched_count={len(items)}")
        if items:
            print(f"[SYNC][CENTERS] first_item_keys={list(items[0].keys())}")
            print(f"[SYNC][CENTERS] first_item_preview={items[0]}")

        # 2) rawPayload 포함 형태로 저장 데이터 보강
        enriched_items = []
        for item in items:
            enriched_item = dict(item)
            enriched_item["rawPayload"] = json.dumps(item, ensure_ascii=False)
            enriched_items.append(enriched_item)

        print(f"[SYNC][CENTERS] enriched_count={len(enriched_items)}")

        # 3) DB upsert
        saved_count = upsert_transport_centers(db, enriched_items)
        print(f"[SYNC][CENTERS] saved_count={saved_count}")

        # 4) 이벤트 로그 기록
        insert_user_event_log(
            db=db,
            event_name="mobility_centers_sync",
            event_type="SYNC",
            event_status="SUCCESS",
            region_code=stdg_cd,
            request_path="/api/mobility/centers/sync",
            request_method="POST",
            event_payload=json.dumps({
                "pageNo": page_no,
                "numOfRows": num_of_rows,
                "fetchedCount": len(items),
                "savedCount": saved_count,
            }, ensure_ascii=False),
        )

        # 5) 커밋
        db.commit()
        print("[SYNC][CENTERS] COMMIT SUCCESS")

        return {
            "fetchedCount": len(items),
            "savedCount": saved_count,
            "items": items,
            "apiMeta": result.get("apiMeta", {}),
        }

    except Exception as e:
        # 저장 중 실패 시 롤백
        db.rollback()

        print("[SYNC][CENTERS] ERROR OCCURRED")
        print(f"[SYNC][CENTERS] ERROR_TYPE={type(e).__name__}")
        print(f"[SYNC][CENTERS] ERROR_MESSAGE={repr(e)}")
        traceback.print_exc()

        # 실패 로그는 별도 보호 처리
        try:
            insert_user_event_log(
                db=db,
                event_name="mobility_centers_sync",
                event_type="SYNC",
                event_status="FAILED",
                region_code=stdg_cd,
                request_path="/api/mobility/centers/sync",
                request_method="POST",
                event_payload=json.dumps({
                    "error": str(e),
                    "errorType": type(e).__name__,
                    "pageNo": page_no,
                    "numOfRows": num_of_rows,
                }, ensure_ascii=False),
            )
            db.commit()
            print("[SYNC][CENTERS] FAILURE LOG COMMIT SUCCESS")
        except Exception as log_error:
            db.rollback()
            print("[SYNC][CENTERS] FAILURE LOG INSERT FAILED")
            print(f"[SYNC][CENTERS] FAILURE_LOG_ERROR={repr(log_error)}")
            traceback.print_exc()

        # 원래 예외를 다시 올려서 라우터에서 500 응답 처리하도록 함
        raise

    finally:
        db.close()
        print("[SYNC][CENTERS] DB SESSION CLOSED")


async def sync_available_transport_vehicles(
    stdg_cd: str,
    page_no: int = 1,
    num_of_rows: int = 20
) -> Dict[str, Any]:
    """
    이용 가능 차량 API를 호출한 뒤,
    응답 데이터를 transport_vehicle_availability 테이블에 저장합니다.

    주의:
    - 현재 info_vehicle_use_v2 응답은 '차량 개별 목록'이 아니라
      '센터 단위 집계 현황'일 가능성이 높음
    - 따라서 repository / 테이블 구조가 현재 응답과 맞는지 반드시 확인 필요

    처리 순서:
    1) 외부 API 조회
    2) DB 저장용 payload 보강(rawPayload 추가)
    3) transport_vehicle_availability upsert
    4) user_event_logs 성공 로그 기록
    5) commit
    """
    db = SessionLocal()

    try:
        print(f"[SYNC][VEHICLES] START stdg_cd={stdg_cd}, page_no={page_no}, num_of_rows={num_of_rows}")

        # 1) 외부 API 조회
        result = await get_available_transport_vehicles(stdg_cd, page_no, num_of_rows)
        items = result.get("items", [])

        print(f"[SYNC][VEHICLES] fetched_count={len(items)}")
        if items:
            print(f"[SYNC][VEHICLES] first_item_keys={list(items[0].keys())}")
            print(f"[SYNC][VEHICLES] first_item_preview={items[0]}")

        # 2) rawPayload 포함
        enriched_items = []
        for item in items:
            enriched_item = dict(item)
            enriched_item["rawPayload"] = json.dumps(item, ensure_ascii=False)
            enriched_items.append(enriched_item)

        print(f"[SYNC][VEHICLES] enriched_count={len(enriched_items)}")

        # 3) DB upsert
        saved_count = upsert_transport_vehicle_availability_bulk(db, enriched_items)
        print(f"[SYNC][VEHICLES] saved_count={saved_count}")

        # 4) 이벤트 로그
        insert_user_event_log(
            db=db,
            event_name="mobility_vehicles_sync",
            event_type="SYNC",
            event_status="SUCCESS",
            region_code=stdg_cd,
            request_path="/api/mobility/vehicles/available/sync",
            request_method="POST",
            event_payload=json.dumps({
                "pageNo": page_no,
                "numOfRows": num_of_rows,
                "fetchedCount": len(items),
                "savedCount": saved_count,
            }, ensure_ascii=False),
        )

        # 5) 커밋
        db.commit()
        print("[SYNC][VEHICLES] COMMIT SUCCESS")

        return {
            "fetchedCount": len(items),
            "savedCount": saved_count,
            "items": items,
            "apiMeta": result.get("apiMeta", {}),
        }

    except Exception as e:
        db.rollback()

        print("[SYNC][VEHICLES] ERROR OCCURRED")
        print(f"[SYNC][VEHICLES] ERROR_TYPE={type(e).__name__}")
        print(f"[SYNC][VEHICLES] ERROR_MESSAGE={repr(e)}")
        traceback.print_exc()

        # 실패 로그는 원래 예외를 덮지 않도록 안전하게 처리
        try:
            insert_user_event_log(
                db=db,
                event_name="mobility_vehicles_sync",
                event_type="SYNC",
                event_status="FAILED",
                region_code=stdg_cd,
                request_path="/api/mobility/vehicles/available/sync",
                request_method="POST",
                event_payload=json.dumps({
                    "error": str(e),
                    "errorType": type(e).__name__,
                    "pageNo": page_no,
                    "numOfRows": num_of_rows,
                }, ensure_ascii=False),
            )
            db.commit()
            print("[SYNC][VEHICLES] FAILURE LOG COMMIT SUCCESS")
        except Exception as log_error:
            db.rollback()
            print("[SYNC][VEHICLES] FAILURE LOG INSERT FAILED")
            print(f"[SYNC][VEHICLES] FAILURE_LOG_ERROR={repr(log_error)}")
            traceback.print_exc()

        raise

    finally:
        db.close()
        print("[SYNC][VEHICLES] DB SESSION CLOSED")
