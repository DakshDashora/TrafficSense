from datetime import datetime
import pandas as pd
from utils.helpers import parse_datetime

def get_event_cause_category(cause: str) -> str:
    """
    Standardize the event cause to a predefined category.
    """
    if not cause:
        return "others"
    cause_clean = str(cause).strip().lower()
    valid_causes = {
        "vehicle_breakdown", 
        "accident", 
        "water_logging", 
        "tree_fall", 
        "public_event", 
        "construction", 
        "pot_holes"
    }
    if cause_clean in valid_causes:
        return cause_clean
    return "others"

def get_corridor_priority_encoded(corridor: str) -> str:
    """
    Standardize the corridor name.
    """
    if not corridor:
        return "non-corridor"
    corr_clean = str(corridor).strip().lower()
    if corr_clean in ("null", "none", "", "non-corridor"):
        return "non-corridor"
    return corr_clean

def get_police_station_encoded(police_station: str) -> str:
    """
    Standardize the police station name.
    """
    if not police_station:
        return "unknown"
    station_clean = str(police_station).strip().lower()
    if station_clean in ("null", "none", ""):
        return "unknown"
    return station_clean

def extract_features_dict(event) -> dict:
    """
    Extracts a feature dictionary from an event (SQLAlchemy object or dictionary).
    """
    # Handle both SQLAlchemy objects and dictionaries
    if isinstance(event, dict):
        start_dt = parse_datetime(event.get("datetime") or event.get("start_datetime"))
        cause = event.get("cause") or event.get("event_cause")
        police_station = event.get("police_station")
        corridor = event.get("corridor")
        road_closure = event.get("road_closure") or event.get("requires_road_closure")
        lat = float(event.get("latitude") or 12.9716)
        lon = float(event.get("longitude") or 77.5946)
    else:
        start_dt = event.start_datetime if isinstance(event.start_datetime, datetime) else parse_datetime(event.start_datetime)
        cause = event.cause
        police_station = event.police_station
        corridor = event.corridor
        road_closure = event.road_closure
        lat = float(event.latitude or 12.9716)
        lon = float(event.longitude or 77.5946)

    # Base features
    hour = start_dt.hour
    day_of_week = start_dt.weekday()
    month = start_dt.month
    
    # Peak hours: 7:00 AM - 10:00 AM (7, 8, 9) and 5:00 PM - 9:00 PM (17, 18, 19, 20)
    is_peak_hour = 1 if (7 <= hour <= 9) or (17 <= hour <= 20) else 0
    is_weekend = 1 if day_of_week >= 5 else 0
    
    # Binary closure
    if isinstance(road_closure, str):
        road_closure_binary = 1 if road_closure.lower() in ("true", "yes", "1") else 0
    else:
        road_closure_binary = 1 if road_closure else 0

    return {
        "hour": hour,
        "day_of_week": day_of_week,
        "month": month,
        "is_peak_hour": is_peak_hour,
        "is_weekend": is_weekend,
        "event_cause_category": get_event_cause_category(cause),
        "police_station_encoded": get_police_station_encoded(police_station),
        "corridor_priority_encoded": get_corridor_priority_encoded(corridor),
        "road_closure_binary": road_closure_binary,
        "latitude": lat,
        "longitude": lon
    }

def events_to_features_df(events_list) -> pd.DataFrame:
    """
    Converts a list of events into a pandas DataFrame ready for ML classification.
    """
    features = [extract_features_dict(ev) for ev in events_list]
    return pd.DataFrame(features)
