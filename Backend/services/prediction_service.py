from models.ml_model import predict_severity
from services.recommendation_service import get_resource_recommendation
from services.impact_service import calculate_citizen_impact
from utils.feature_engineer import extract_features_dict

def get_prediction_and_recommendation(event_data: dict):
    """
    Orchestrates the severity prediction, resource recommendation, and citizen impact analysis.
    """
    cause = event_data.get("cause")
    lat = float(event_data.get("latitude") or 12.9716)
    lon = float(event_data.get("longitude") or 77.5946)
    police_station = event_data.get("police_station") or "unknown"
    
    # 1. Run classifier severity prediction
    impact_level, confidence, probabilities = predict_severity(event_data)
    
    # 2. Get temporal features for impact calculation
    features = extract_features_dict(event_data)
    is_peak_hour = bool(features["is_peak_hour"])
    is_weekend = bool(features["is_weekend"])
    
    # 3. Calculate resource recommendations
    deployment = get_resource_recommendation(impact_level, police_station, lat, lon)
    
    # 4. Calculate citizen impact
    impact = calculate_citizen_impact(impact_level, is_peak_hour, is_weekend)
    
    return {
        "impact_level": impact_level,
        "confidence": confidence,
        "probabilities": probabilities,
        "deployment": deployment,
        "impact": impact
    }
