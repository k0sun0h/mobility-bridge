"""
교통약자 이동지원 API 결과를 DB에 저장하는 repository 계층입니다.

주요 역할:
- transport_centers 테이블 upsert
- transport_vehicle_availability 테이블 upsert
- user_event_logs 테이블 insert

주의:
- service 계층은 외부 API 호출/정규화 담당
- repository 계층은 DB 저장/조회 담당
"""

from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session


# ---------------------------------------------------
# transport_centers 저장
# ---------------------------------------------------
def upsert_transport_center(db: Session, center: Dict[str, Any]) -> None:
    """
    이동지원센터 1건을 transport_centers 테이블에 upsert 합니다.

    unique 기준:
    - center_id unique 기준 사용

    center 예시:
    {
        "centerId": "10",
        "centerName": "충청북도 청주센터",
        "regionCode": "4311000000",
        "regionName": "충청북도",
        "phone": "15330220",
        "address": "청주시 서원구 사직대로 229",
        "roadAddress": "청주시 서원구 사직대로 229",
        "lotAddress": "청주시 서원구 사직대로 229",
        "latitude": 36.642469,
        "longitude": 127.489537,
        "reservationUrl": "http://...",
        "appServiceName": "충청북도광역이동지원센터",
        "operatorName": "충청북도청",
        "operatorPhone": "0432204255",
        "weekdayReservationStart": "000000",
        "weekdayReservationEnd": "240000",
        "weekdayOperationStart": "000000",
        "weekdayOperationEnd": "240000",
        "weekendOperates": True,
        "weekendOperationHours": "00:00~24:00",
        "wideAreaServiceRegion": "충청북도전지역",
        "crossRegionServiceRegion": "천안+대전+세종",
        "targetUsers": "보행상 중증 장애인",
        "dailyVehicleUsageLimit": "",
        "advanceReservationInfo": "3일전~1일전",
        "baseFareInfo": "관내(10km이내(기본요금) : 2,000원)",
        "extraFareInfo": "...",
        "reservationGuide": "3일전~1일전",
        "holdingVehicleCount": "30",
        "statisticsDate": "20260505",
        "rawPayload": "{...}"
    }
    """

    sql = text("""
        INSERT INTO transport_centers (
            center_id,
            center_name,
            region_code,
            region_name,
            phone,
            address,
            road_address,
            lot_address,
            latitude,
            longitude,
            reservation_url,
            app_service_name,
            operator_name,
            operator_phone,
            weekday_reservation_start,
            weekday_reservation_end,
            weekday_operation_start,
            weekday_operation_end,
            weekend_operates,
            weekend_operation_hours,
            wide_area_service_region,
            cross_region_service_region,
            target_users,
            daily_vehicle_usage_limit,
            advance_reservation_info,
            base_fare_info,
            extra_fare_info,
            reservation_guide,
            holding_vehicle_count,
            statistics_date,
            raw_payload
        )
        VALUES (
            :center_id,
            :center_name,
            :region_code,
            :region_name,
            :phone,
            :address,
            :road_address,
            :lot_address,
            :latitude,
            :longitude,
            :reservation_url,
            :app_service_name,
            :operator_name,
            :operator_phone,
            :weekday_reservation_start,
            :weekday_reservation_end,
            :weekday_operation_start,
            :weekday_operation_end,
            :weekend_operates,
            :weekend_operation_hours,
            :wide_area_service_region,
            :cross_region_service_region,
            :target_users,
            :daily_vehicle_usage_limit,
            :advance_reservation_info,
            :base_fare_info,
            :extra_fare_info,
            :reservation_guide,
            :holding_vehicle_count,
            :statistics_date,
            CAST(:raw_payload AS jsonb)
        )
        ON CONFLICT (center_id)
        DO UPDATE SET
            center_name = EXCLUDED.center_name,
            region_code = EXCLUDED.region_code,
            region_name = EXCLUDED.region_name,
            phone = EXCLUDED.phone,
            address = EXCLUDED.address,
            road_address = EXCLUDED.road_address,
            lot_address = EXCLUDED.lot_address,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            reservation_url = EXCLUDED.reservation_url,
            app_service_name = EXCLUDED.app_service_name,
            operator_name = EXCLUDED.operator_name,
            operator_phone = EXCLUDED.operator_phone,
            weekday_reservation_start = EXCLUDED.weekday_reservation_start,
            weekday_reservation_end = EXCLUDED.weekday_reservation_end,
            weekday_operation_start = EXCLUDED.weekday_operation_start,
            weekday_operation_end = EXCLUDED.weekday_operation_end,
            weekend_operates = EXCLUDED.weekend_operates,
            weekend_operation_hours = EXCLUDED.weekend_operation_hours,
            wide_area_service_region = EXCLUDED.wide_area_service_region,
            cross_region_service_region = EXCLUDED.cross_region_service_region,
            target_users = EXCLUDED.target_users,
            daily_vehicle_usage_limit = EXCLUDED.daily_vehicle_usage_limit,
            advance_reservation_info = EXCLUDED.advance_reservation_info,
            base_fare_info = EXCLUDED.base_fare_info,
            extra_fare_info = EXCLUDED.extra_fare_info,
            reservation_guide = EXCLUDED.reservation_guide,
            holding_vehicle_count = EXCLUDED.holding_vehicle_count,
            statistics_date = EXCLUDED.statistics_date,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = NOW()
    """)

    db.execute(sql, {
        "center_id": center.get("centerId"),
        "center_name": center.get("centerName"),
        "region_code": center.get("regionCode"),
        "region_name": center.get("regionName"),
        "phone": center.get("phone"),
        "address": center.get("address"),
        "road_address": center.get("roadAddress"),
        "lot_address": center.get("lotAddress"),
        "latitude": center.get("latitude"),
        "longitude": center.get("longitude"),
        "reservation_url": center.get("reservationUrl"),
        "app_service_name": center.get("appServiceName"),
        "operator_name": center.get("operatorName"),
        "operator_phone": center.get("operatorPhone"),
        "weekday_reservation_start": center.get("weekdayReservationStart"),
        "weekday_reservation_end": center.get("weekdayReservationEnd"),
        "weekday_operation_start": center.get("weekdayOperationStart"),
        "weekday_operation_end": center.get("weekdayOperationEnd"),
        "weekend_operates": center.get("weekendOperates"),
        "weekend_operation_hours": center.get("weekendOperationHours"),
        "wide_area_service_region": center.get("wideAreaServiceRegion"),
        "cross_region_service_region": center.get("crossRegionServiceRegion"),
        "target_users": center.get("targetUsers"),
        "daily_vehicle_usage_limit": center.get("dailyVehicleUsageLimit"),
        "advance_reservation_info": center.get("advanceReservationInfo"),
        "base_fare_info": center.get("baseFareInfo"),
        "extra_fare_info": center.get("extraFareInfo"),
        "reservation_guide": center.get("reservationGuide"),
        "holding_vehicle_count": center.get("holdingVehicleCount"),
        "statistics_date": center.get("statisticsDate"),
        "raw_payload": center.get("rawPayload", "{}"),
    })


def upsert_transport_centers(db: Session, centers: List[Dict[str, Any]]) -> int:
    """
    이동지원센터 여러 건을 순회하며 upsert 합니다.
    반환값: 저장 처리 건수
    """
    saved_count = 0

    for center in centers:
        # center_id 없는 데이터는 저장 불가
        if not center.get("centerId"):
            continue

        upsert_transport_center(db, center)
        saved_count += 1

    return saved_count


# ---------------------------------------------------
# transport_vehicle_availability 저장
# ---------------------------------------------------
def upsert_transport_vehicle_availability(db: Session, item: Dict[str, Any]) -> None:
    """
    차량 이용 가능 현황 1건을 transport_vehicle_availability 테이블에 upsert 합니다.

    중요:
    - info_vehicle_use_v2는 '개별 차량 목록'이 아니라
      '센터별 차량 운영 현황 집계' 구조입니다.
    - 따라서 center_id + observed_at_raw 조합을 unique 기준으로 저장합니다.

    item 예시:
    {
        "centerId": "10",
        "centerName": "충청북도 청주센터",
        "regionCode": "4311000000",
        "regionName": "충청북도",
        "totalVehicleCount": 30,
        "operatingVehicleCount": 13,
        "availableVehicleCount": 17,
        "reservationCount": 1,
        "waitingCount": 1,
        "observedAtRaw": "20260505173521",
        "observedAt": "2026-05-05T17:35:21",
        "rawPayload": "{...}"
    }
    """

    sql = text("""
        INSERT INTO transport_vehicle_availability (
            center_id,
            center_name,
            region_code,
            region_name,
            total_vehicle_count,
            operating_vehicle_count,
            available_vehicle_count,
            reservation_count,
            waiting_count,
            observed_at_raw,
            observed_at,
            raw_payload
        )
        VALUES (
            :center_id,
            :center_name,
            :region_code,
            :region_name,
            :total_vehicle_count,
            :operating_vehicle_count,
            :available_vehicle_count,
            :reservation_count,
            :waiting_count,
            :observed_at_raw,
            :observed_at,
            CAST(:raw_payload AS jsonb)
        )
        ON CONFLICT (center_id, observed_at_raw)
        DO UPDATE SET
            center_name = EXCLUDED.center_name,
            region_code = EXCLUDED.region_code,
            region_name = EXCLUDED.region_name,
            total_vehicle_count = EXCLUDED.total_vehicle_count,
            operating_vehicle_count = EXCLUDED.operating_vehicle_count,
            available_vehicle_count = EXCLUDED.available_vehicle_count,
            reservation_count = EXCLUDED.reservation_count,
            waiting_count = EXCLUDED.waiting_count,
            observed_at = EXCLUDED.observed_at,
            raw_payload = EXCLUDED.raw_payload,
            updated_at = NOW()
    """)

    db.execute(sql, {
        "center_id": item.get("centerId"),
        "center_name": item.get("centerName"),
        "region_code": item.get("regionCode"),
        "region_name": item.get("regionName"),
        "total_vehicle_count": item.get("totalVehicleCount"),
        "operating_vehicle_count": item.get("operatingVehicleCount"),
        "available_vehicle_count": item.get("availableVehicleCount"),
        "reservation_count": item.get("reservationCount"),
        "waiting_count": item.get("waitingCount"),
        "observed_at_raw": item.get("observedAtRaw"),
        "observed_at": item.get("observedAt"),
        "raw_payload": item.get("rawPayload", "{}"),
    })


def upsert_transport_vehicle_availability_bulk(
    db: Session,
    items: List[Dict[str, Any]]
) -> int:
    """
    차량 운영 현황 여러 건을 순회하며 upsert 합니다.
    반환값: 저장 처리 건수
    """
    saved_count = 0

    for item in items:
        # center_id / observed_at_raw 가 없으면 스냅샷 저장 기준이 애매해짐
        if not item.get("centerId"):
            continue

        if not item.get("observedAtRaw"):
            continue

        upsert_transport_vehicle_availability(db, item)
        saved_count += 1

    return saved_count


# ---------------------------------------------------
# user_event_logs 저장
# ---------------------------------------------------
def insert_user_event_log(
    db: Session,
    event_name: str,
    event_type: Optional[str] = None,
    event_status: Optional[str] = None,
    user_id: Optional[str] = None,
    session_id: Optional[str] = None,
    station_id: Optional[str] = None,
    center_id: Optional[str] = None,
    vehicle_id: Optional[str] = None,
    region_code: Optional[str] = None,
    request_path: Optional[str] = None,
    request_method: Optional[str] = None,
    event_payload: Optional[str] = "{}",
) -> None:
    """
    사용자/시스템 이벤트 로그를 기록합니다.

    예:
    - mobility_centers_fetch
    - mobility_centers_sync
    - mobility_vehicles_sync
    - station_detail_view
    """

    sql = text("""
        INSERT INTO user_event_logs (
            user_id,
            session_id,
            event_name,
            event_type,
            event_status,
            station_id,
            center_id,
            vehicle_id,
            region_code,
            request_path,
            request_method,
            event_payload
        )
        VALUES (
            :user_id,
            :session_id,
            :event_name,
            :event_type,
            :event_status,
            :station_id,
            :center_id,
            :vehicle_id,
            :region_code,
            :request_path,
            :request_method,
            CAST(:event_payload AS jsonb)
        )
    """)

    db.execute(sql, {
        "user_id": user_id,
        "session_id": session_id,
        "event_name": event_name,
        "event_type": event_type,
        "event_status": event_status,
        "station_id": station_id,
        "center_id": center_id,
        "vehicle_id": vehicle_id,
        "region_code": region_code,
        "request_path": request_path,
        "request_method": request_method,
        "event_payload": event_payload or "{}",
    })
