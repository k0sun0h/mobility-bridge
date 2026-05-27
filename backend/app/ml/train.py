import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import classification_report, mean_absolute_error, r2_score, accuracy_score
import joblib
from datetime import datetime

# 모델 저장 경로 설정
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "data", "models")
os.makedirs(MODEL_DIR, exist_ok=True)

def generate_training_data(n_samples: int = 800) -> pd.DataFrame:
    """
    4주차 규칙 기반 시스템을 정확히 모방한 합성 학습 데이터 생성
    """
    np.random.seed(42)
    
    print(f"{n_samples}건의 합성 학습 데이터 생성 중...")
    
    data = []
    user_types = ["wheelchair", "elderly", "visually_impaired", "pregnant", "temporary"]
    time_slots = ["morning", "afternoon", "evening", "night"]
    
    for i in range(n_samples):
        # 현실적 분포를 반영한 입력 피처 생성
        user_type = np.random.choice(user_types, p=[0.3, 0.25, 0.2, 0.15, 0.1])
        elevator_count = np.random.choice([0, 1, 2, 3, 4], p=[0.1, 0.2, 0.4, 0.2, 0.1])
        available_vehicles = np.random.choice([0, 1, 2, 3, 4, 5], p=[0.15, 0.2, 0.25, 0.25, 0.1, 0.05])
        waiting_count = np.random.poisson(2)  # 평균 2명 대기
        has_phone = np.random.choice([0, 1], p=[0.05, 0.95])  # 95% 전화 가능
        with_caregiver = np.random.choice([0, 1], p=[0.7, 0.3])
        need_parking = np.random.choice([0, 1], p=[0.6, 0.4])
        parking_available = np.random.randint(0, 20)
        time_slot = np.random.choice(time_slots)
        
        # 4주차 규칙 기반 점수 계산 (정확한 재현)
        score = 0
        
        # 1. 대상자 적합성 (최대 40점)
        eligibility_scores = {
            "wheelchair": 40, "elderly": 35, "visually_impaired": 30,
            "pregnant": 25, "temporary": 20
        }
        score += eligibility_scores[user_type]
        
        # 2. 차량 가능성 (최대 30점)
        if available_vehicles >= 3:
            score += 30
        elif available_vehicles >= 1:
            score += 20
        else:
            score += 0
        
        # 3. 역 접근성 (최대 20점)
        if elevator_count >= 2:
            score += 20
        elif elevator_count == 1:
            score += 10
        else:
            score += 0
        
        # 4. 연락 수단 (최대 10점)
        score += has_phone * 10
        
        # 5. 주차 편의성 (선택적 추가)
        if need_parking:
            if parking_available >= 10:
                score += 8
            elif parking_available >= 5:
                score += 5
            elif parking_available > 0:
                score += 2
        
        # 6. 시간대별 보정
        time_multipliers = {"morning": 1.0, "afternoon": 1.05, "evening": 0.95, "night": 0.9}
        score = int(score * time_multipliers[time_slot])
        
        # 7. 현실적 노이즈 추가
        noise = np.random.randint(-3, 4)
        score = max(0, min(100, score + noise))
        
        # 대기시간 계산 (4주차 로직 기반)
        if available_vehicles == 0:
            wait_time = np.random.randint(45, 75)
        elif available_vehicles >= 3:
            wait_time = max(5, waiting_count * 6 + np.random.randint(-2, 3))
        else:
            wait_time = max(10, waiting_count * 10 + np.random.randint(-3, 4))
        
        # 편의성 등급 라벨 생성 (분류 타겟)
        if score >= 70:
            convenience_label = "high"
        elif score >= 50:
            convenience_label = "medium"
        else:
            convenience_label = "low"
        
        data.append({
            # 입력 피처
            "user_type": user_type,
            "elevator_count": elevator_count,
            "available_vehicles": available_vehicles,
            "waiting_count": waiting_count,
            "has_phone": has_phone,
            "with_caregiver": with_caregiver,
            "need_parking": need_parking,
            "parking_available": parking_available,
            "time_slot": time_slot,
            # 타겟 변수
            "route_score": score,
            "wait_time": wait_time,
            "convenience_label": convenience_label,
        })
    
    df = pd.DataFrame(data)
    
    print("데이터 생성 완료!")
    print("편의성 등급 분포:")
    print(df["convenience_label"].value_counts())
    print(f"점수 통계: 평균 {df['route_score'].mean():.1f}점, 표준편차 {df['route_score'].std():.1f}점")
    
    return df

def preprocess_features(df: pd.DataFrame) -> pd.DataFrame:
    """피처 전처리 및 엔지니어링"""
    df_processed = df.copy()
    
    # 사용자 유형 인코딩 (중요도 순서 반영)
    user_type_map = {
        "wheelchair": 5,      # 전동/수동 휠체어 (최고 지원 필요)
        "elderly": 4,         # 고령자
        "visually_impaired": 3, # 시각장애인
        "pregnant": 2,        # 임산부
        "temporary": 1        # 일시적 보행 약자 (기본 지원)
    }
    df_processed["user_type_encoded"] = df_processed["user_type"].map(user_type_map)
    
    # 시간대 인코딩 (수요 패턴 반영)
    time_slot_map = {"morning": 4, "afternoon": 3, "evening": 2, "night": 1}
    df_processed["time_slot_encoded"] = df_processed["time_slot"].map(time_slot_map)
    
    # 파생 피처 생성
    df_processed["vehicle_demand_ratio"] = df_processed["waiting_count"] / (df_processed["available_vehicles"] + 1)
    df_processed["total_accessibility"] = df_processed["elevator_count"] + df_processed["has_phone"]
    
    return df_processed

def get_feature_columns():
    """학습에 사용할 피처 컬럼 목록 반환"""
    return [
        "user_type_encoded", "elevator_count", "available_vehicles",
        "waiting_count", "has_phone", "with_caregiver", "need_parking",
        "parking_available", "time_slot_encoded", "vehicle_demand_ratio",
        "total_accessibility"
    ]

def train_classification_model(df: pd.DataFrame):
    """이동 편의성 분류 모델 학습 (high/medium/low)"""
    print("\n" + "="*60)
    print("분류 모델 학습 시작 (RandomForestClassifier)")
    print("="*60)
    
    # 피처 전처리
    df_processed = preprocess_features(df)
    feature_columns = get_feature_columns()
    
    X = df_processed[feature_columns]
    y = df_processed["convenience_label"]
    
    print("학습 데이터 정보:")
    print(f"  - 총 샘플 수: {len(X)}")
    print(f"  - 피처 수: {len(feature_columns)}")
    print(f"  - 클래스 분포: {dict(y.value_counts())}")
    
    # 라벨 인코딩
    le = LabelEncoder()
    y_encoded = le.fit_transform(y)
    
    # 학습/테스트 분할
    X_train, X_test, y_train, y_test = train_test_split(
        X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
    )
    
    print(f"\n데이터 분할:")
    print(f"  - 학습 데이터: {len(X_train)}건")
    print(f"  - 테스트 데이터: {len(X_test)}건")
    
    # RandomForest 모델 정의
    clf = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        min_samples_leaf=2,
        random_state=42,
        class_weight="balanced"
    )
    
    # 모델 학습
    print("\n모델 학습 중...")
    clf.fit(X_train, y_train)
    
    # 교차 검증
    print("\n교차 검증 수행 중...")
    cv_scores = cross_val_score(clf, X, y_encoded, cv=5, scoring="accuracy")
    print(f"  - 교차 검증 정확도: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
    
    # 테스트 성능 평가
    y_pred = clf.predict(X_test)
    test_accuracy = accuracy_score(y_test, y_pred)
    
    print(f"\n모델 성능 평가:")
    print(f"  - 테스트 정확도: {test_accuracy:.4f}")
    print(f"\n상세 분류 보고서:")
    print(classification_report(y_test, y_pred, target_names=le.classes_, zero_division=0))
    
    # 피처 중요도 분석
    feature_importance = pd.DataFrame({
        "feature": feature_columns,
        "importance": clf.feature_importances_
    }).sort_values("importance", ascending=False)
    
    print(f"\n피처 중요도 (상위 5개):")
    for _, row in feature_importance.head().iterrows():
        print(f"  - {row['feature']}: {row['importance']:.4f}")
    
    # 모델 및 라벨 인코더 저장
    model_path = os.path.join(MODEL_DIR, "rf_classifier.joblib")
    encoder_path = os.path.join(MODEL_DIR, "label_encoder.joblib")
    
    joblib.dump(clf, model_path)
    joblib.dump(le, encoder_path)
    
    print(f"\n모델 저장 완료:")
    print(f"  - 분류 모델: {model_path}")
    print(f"  - 라벨 인코더: {encoder_path}")
    
    return {
        "model": clf,
        "label_encoder": le,
        "feature_columns": feature_columns,
        "cv_accuracy": cv_scores.mean(),
        "test_accuracy": test_accuracy,
        "feature_importance": feature_importance.to_dict("records")
    }

def train_regression_model(df: pd.DataFrame):
    """예상 대기시간 회귀 모델 학습"""
    print("\n" + "="*60)
    print("회귀 모델 학습 시작 (RandomForestRegressor)")
    print("="*60)
    
    # 피처 전처리 (분류와 동일)
    df_processed = preprocess_features(df)
    feature_columns = get_feature_columns()
    
    X = df_processed[feature_columns]
    y = df_processed["wait_time"]
    
    print(f"회귀 데이터 정보:")
    print(f"  - 총 샘플 수: {len(X)}")
    print(f"  - 대기시간 통계: 평균 {y.mean():.1f}분, 표준편차 {y.std():.1f}분")
    
    # 데이터 분할
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )
    
    # RandomForest 회귀 모델
    reg = RandomForestRegressor(
        n_estimators=100,
        max_depth=10,
        min_samples_split=5,
        random_state=42
    )
    
    # 모델 학습
    print(f"\n회귀 모델 학습 중...")
    reg.fit(X_train, y_train)
    
    # 교차 검증
    cv_scores = cross_val_score(reg, X, y, cv=5, scoring="neg_mean_absolute_error")
    cv_mae = -cv_scores.mean()
    
    # 테스트 성능
    y_pred = reg.predict(X_test)
    test_mae = mean_absolute_error(y_test, y_pred)
    test_r2 = r2_score(y_test, y_pred)
    
    print(f"\n회귀 모델 성능:")
    print(f"  - 교차 검증 MAE: {cv_mae:.2f}분")
    print(f"  - 테스트 MAE: {test_mae:.2f}분")
    print(f"  - 테스트 R²: {test_r2:.4f}")
    
    # 모델 저장
    model_path = os.path.join(MODEL_DIR, "rf_regressor.joblib")
    joblib.dump(reg, model_path)
    print(f"\n회귀 모델 저장: {model_path}")
    
    return {
        "model": reg,
        "feature_columns": feature_columns,
        "cv_mae": cv_mae,
        "test_mae": test_mae,
        "test_r2": test_r2
    }

def main():
    """메인 실행 함수"""
    print("5주차 머신러닝 모델 학습 시작!")
    print(f"모델 저장 경로: {MODEL_DIR}")
    
    # 1. 합성 데이터 생성
    df = generate_training_data(n_samples=800)
    
    # 2. 분류 모델 학습
    clf_results = train_classification_model(df)
    
    # 3. 회귀 모델 학습  
    reg_results = train_regression_model(df)
    
    # 4. 전체 결과 요약
    print("\n" + "="*60)
    print("전체 학습 완료!")
    print("="*60)
    print(f"분류 모델 (편의성 예측):")
    print(f"  - 교차 검증 정확도: {clf_results['cv_accuracy']:.4f}")
    print(f"  - 테스트 정확도: {clf_results['test_accuracy']:.4f}")
    print(f"\n회귀 모델 (대기시간 예측):")
    print(f"  - 교차 검증 MAE: {reg_results['cv_mae']:.2f}분")
    print(f"  - 테스트 R²: {reg_results['test_r2']:.4f}")
    print(f"\n다음 단계: SHAP 설명 기능 개발")

if __name__ == "__main__":
    main()
