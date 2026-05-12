import os
import numpy as np
import pandas as pd
import joblib
import shap
from typing import Dict, Any, List

# 모델 저장 경로
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "data", "models")

# 피처 한국어 이름 매핑 (사용자 친화적 설명용)
FEATURE_LABELS_KO = {
    "available_vehicles": "이용 가능 차량 수",
    "total_accessibility": "역 접근성 종합 점수",
    "elevator_count": "엘리베이터 개수",
    "user_type_encoded": "사용자 이동 특성",
    "vehicle_demand_ratio": "차량 수요 비율",
    "waiting_count": "현재 대기 인원",
    "has_phone": "전화 연결 가능 여부",
    "with_caregiver": "보호자 동행 여부",
    "need_parking": "주차 필요 여부",
    "parking_available": "주차 가능 면수",
    "time_slot_encoded": "이용 시간대",
}

def load_models():
    """저장된 모델 파일들을 불러오는 함수"""
    clf_path = os.path.join(MODEL_DIR, "rf_classifier.joblib")
    reg_path = os.path.join(MODEL_DIR, "rf_regressor.joblib")
    le_path = os.path.join(MODEL_DIR, "label_encoder.joblib")

    if not all(os.path.exists(p) for p in [clf_path, reg_path, le_path]):
        raise FileNotFoundError(
            "모델 파일이 없습니다. 먼저 python -m app.ml.train을 실행하세요."
        )

    clf = joblib.load(clf_path)
    reg = joblib.load(reg_path)
    le = joblib.load(le_path)

    return clf, reg, le

def build_input_features(
    user_type: str = "wheelchair",
    elevator_count: int = 2,
    available_vehicles: int = 2,
    waiting_count: int = 1,
    has_phone: bool = True,
    with_caregiver: bool = False,
    need_parking: bool = False,
    parking_available: int = 10,
    time_slot: str = "morning",
) -> pd.DataFrame:
    """
    API 입력값을 ML 모델 입력 피처로 변환하는 함수
    train.py의 preprocess_features와 동일한 변환 로직 적용
    """
    user_type_map = {
        "wheelchair": 5, "elderly": 4, "visually_impaired": 3,
        "pregnant": 2, "temporary": 1
    }
    time_slot_map = {
        "morning": 4, "afternoon": 3, "evening": 2, "night": 1
    }

    user_type_encoded = user_type_map.get(user_type, 3)
    time_slot_encoded = time_slot_map.get(time_slot, 3)
    has_phone_int = 1 if has_phone else 0
    with_caregiver_int = 1 if with_caregiver else 0
    need_parking_int = 1 if need_parking else 0
    
    # 파생 피처 계산 (train.py와 동일)
    vehicle_demand_ratio = waiting_count / (available_vehicles + 1)
    total_accessibility = elevator_count + has_phone_int

    feature_columns = [
        "user_type_encoded", "elevator_count", "available_vehicles",
        "waiting_count", "has_phone", "with_caregiver", "need_parking",
        "parking_available", "time_slot_encoded", "vehicle_demand_ratio",
        "total_accessibility"
    ]

    values = [
        user_type_encoded, elevator_count, available_vehicles,
        waiting_count, has_phone_int, with_caregiver_int, need_parking_int,
        parking_available, time_slot_encoded, vehicle_demand_ratio,
        total_accessibility
    ]

    return pd.DataFrame([values], columns=feature_columns)

def explain_prediction(input_df: pd.DataFrame) -> Dict[str, Any]:
    """
    SHAP 기반 예측 설명 생성 함수
    분류 모델과 회귀 모델 모두에 대한 설명을 반환
    """
    clf, reg, le = load_models()

    # 분류 예측
    clf_pred_encoded = clf.predict(input_df)[0]
    clf_pred_label = le.inverse_transform([clf_pred_encoded])[0]
    clf_pred_proba = clf.predict_proba(input_df)[0]
    clf_confidence = float(max(clf_pred_proba))

    # 회귀 예측
    reg_pred = float(reg.predict(input_df)[0])

    # SHAP 설명 생성 (분류 모델)
    clf_explainer = shap.TreeExplainer(clf)
    clf_shap_values = clf_explainer.shap_values(input_df)

    # 예측된 클래스에 해당하는 SHAP 값 추출
    class_names = list(le.classes_)
    class_idx = class_names.index(clf_pred_label)
    
    # ========== 핵심 수정 부분: SHAP 버전 호환성 처리 ==========
    if isinstance(clf_shap_values, list):
        # 구버전: 클래스별 리스트 형태 [array1, array2, array3]
        shap_vals = clf_shap_values[class_idx][0]
    elif isinstance(clf_shap_values, np.ndarray):
        if clf_shap_values.ndim == 3:
            # 신버전: 3차원 배열 (samples, features, classes)
            shap_vals = clf_shap_values[0, :, class_idx]
        elif clf_shap_values.ndim == 2:
            # 2차원 배열: (samples, features)
            shap_vals = clf_shap_values[0]
        else:
            shap_vals = clf_shap_values[0]
    else:
        raise ValueError(f"예상치 못한 SHAP 값 형태: {type(clf_shap_values)}")
    # ========== 수정 부분 끝 ==========

    feature_names = input_df.columns.tolist()

    # SHAP 값을 피처명과 매핑하여 중요도 순 정렬
    shap_dict = {
        feature_names[i]: float(shap_vals[i])
        for i in range(len(feature_names))
    }

    sorted_shap = sorted(
        shap_dict.items(),
        key=lambda x: abs(x[1]),
        reverse=True
    )

    # 상위 5개 피처의 영향도 분석
    top_features = []
    for feature_name, shap_value in sorted_shap[:5]:
        feature_value = float(input_df.iloc[0][feature_name])
        top_features.append({
            "feature": feature_name,
            "feature_ko": FEATURE_LABELS_KO.get(feature_name, feature_name),
            "shap_value": round(shap_value, 4),
            "feature_value": feature_value,
            "impact": "positive" if shap_value > 0 else "negative",
            "impact_ko": "긍정적 영향" if shap_value > 0 else "부정적 영향",
        })

    # 자연어 설명 문장 생성
    explanation_sentences = generate_explanation_sentences(top_features, clf_pred_label)

    return {
        # 분류 예측 결과
        "convenience_level": clf_pred_label,
        "convenience_level_ko": {
            "high": "높음", "medium": "보통", "low": "낮음"
        }.get(clf_pred_label, clf_pred_label),
        "confidence": round(clf_confidence, 4),

        # 회귀 예측 결과
        "predicted_wait_time": round(reg_pred, 1),

        # SHAP 설명
        "top_features": top_features,

        # 자연어 설명 (4주차 reasonSummary 형태와 호환)
        "explanation_sentences": explanation_sentences,
    }

def generate_explanation_sentences(
    top_features: List[Dict[str, Any]],
    convenience_level: str
) -> List[str]:
    """
    SHAP 피처 중요도를 사용자 친화적 자연어 문장으로 변환하는 함수
    4주차 reasonSummary와 호환되는 형태로 생성
    """
    sentences = []

    # 전체 판단 결과 설명
    level_descriptions = {
        "high": "이동 편의성이 높은 경로로 판단되었습니다.",
        "medium": "이동 편의성이 보통 수준인 경로입니다.",
        "low": "이동 편의성이 낮아 주의가 필요한 경로입니다.",
    }
    sentences.append(level_descriptions.get(convenience_level, ""))

    # 피처별 구체적 설명 매핑
    feature_sentence_map = {
        "available_vehicles": {
            "positive": "현재 이용 가능한 차량이 충분하여 추천에 긍정적으로 작용했습니다.",
            "negative": "이용 가능한 차량이 부족하여 추천 점수에 영향을 주었습니다.",
        },
        "elevator_count": {
            "positive": "역 내 엘리베이터가 잘 갖춰져 있어 접근성이 높습니다.",
            "negative": "역 내 엘리베이터 수가 적어 접근성에 제한이 있습니다.",
        },
        "total_accessibility": {
            "positive": "역 접근성 종합 점수가 높아 이동에 유리합니다.",
            "negative": "역 접근성 종합 점수가 낮아 이동에 불편이 예상됩니다.",
        },
        "user_type_encoded": {
            "positive": "해당 사용자 유형에 적합한 서비스가 제공됩니다.",
            "negative": "해당 사용자 유형에 대한 서비스 지원이 제한적입니다.",
        },
        "vehicle_demand_ratio": {
            "positive": "현재 차량 수요가 적절하여 대기 없이 이용 가능합니다.",
            "negative": "현재 차량 수요가 높아 대기 시간이 발생할 수 있습니다.",
        },
        "waiting_count": {
            "positive": "현재 대기 인원이 적어 빠른 이용이 가능합니다.",
            "negative": "현재 대기 인원이 많아 이용에 시간이 걸릴 수 있습니다.",
        },
        "has_phone": {
            "positive": "센터 전화 연결이 가능하여 즉시 문의할 수 있습니다.",
            "negative": "센터 전화 연결이 어려워 사전 확인이 필요합니다.",
        },
        "parking_available": {
            "positive": "인근 주차 공간이 충분합니다.",
            "negative": "인근 주차 공간이 부족합니다.",
        },
    }

    # 상위 3개 피처에 대한 설명 문장 생성
    for feat in top_features[:3]:
        feature_name = feat["feature"]
        impact = feat["impact"]
        if feature_name in feature_sentence_map:
            sentence = feature_sentence_map[feature_name].get(impact, "")
            if sentence:
                sentences.append(sentence)

    return sentences

def main():
    """SHAP 설명 기능 테스트 실행"""
    print("SHAP 설명 기능 테스트 시작")
    print("="*60)

    # 테스트 시나리오 1: 휠체어 사용자, 최적 조건
    print("\n시나리오 1: 휠체어 사용자 (최적 조건)")
    test_input_1 = build_input_features(
        user_type="wheelchair",
        elevator_count=3,
        available_vehicles=4,
        waiting_count=0,
        has_phone=True,
        with_caregiver=False,
        need_parking=False,
        parking_available=15,
        time_slot="morning",
    )

    result_1 = explain_prediction(test_input_1)
    print_result(result_1)

    # 테스트 시나리오 2: 고령자, 보호자 동행, 제약 조건
    print("\n" + "="*60)
    print("\n시나리오 2: 고령자 + 보호자 동행 (제약 조건)")
    test_input_2 = build_input_features(
        user_type="elderly",
        elevator_count=1,
        available_vehicles=1,
        waiting_count=3,
        has_phone=True,
        with_caregiver=True,
        need_parking=True,
        parking_available=2,
        time_slot="evening",
    )

    result_2 = explain_prediction(test_input_2)
    print_result(result_2)

    print("\n" + "="*60)
    print("SHAP 설명 기능 테스트 완료!")
    print("다음 단계: 예측 API 및 설명 API 구현")

def print_result(result: Dict[str, Any]):
    """결과를 보기 좋게 출력하는 함수"""
    print(f"편의성 등급: {result['convenience_level_ko']} ({result['convenience_level']})")
    print(f"신뢰도: {result['confidence']:.2%}")
    print(f"예상 대기시간: {result['predicted_wait_time']}분")
    
    print(f"\n상위 영향 피처:")
    for i, feat in enumerate(result["top_features"], 1):
        print(f"  {i}. {feat['feature_ko']}: {feat['shap_value']:+.4f} ({feat['impact_ko']})")
    
    print(f"\nAI 설명 문장:")
    for i, sentence in enumerate(result["explanation_sentences"], 1):
        print(f"  {i}. {sentence}")

if __name__ == "__main__":
    main()
