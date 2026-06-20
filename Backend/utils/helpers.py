import math
from datetime import datetime

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points on the Earth's surface
    specified in decimal degrees (latitude and longitude). Returns distance in km.
    """
    # Earth radius in kilometers
    R = 6371.0
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat / 2) ** 2 + 
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
         
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    distance = R * c
    return distance

def parse_datetime(val) -> datetime:
    """
    Tries to parse a datetime from various string formats. Returns datetime.utcnow() on failure.
    """
    if not val:
        return datetime.utcnow()
        
    val_str = str(val).strip()
    if val_str.upper() in ("NULL", "", "NONE"):
        return datetime.utcnow()
        
    # Clean timezone suffixes
    if val_str.endswith("+00"):
        val_str = val_str[:-3]
    elif val_str.endswith("+00:00"):
        val_str = val_str[:-6]
    elif "T" in val_str and val_str.endswith("Z"):
        val_str = val_str.replace("Z", "")
        
    for fmt in (
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            return datetime.strptime(val_str, fmt)
        except ValueError:
            continue
            
    try:
        return datetime.fromisoformat(val_str)
    except ValueError:
        return datetime.utcnow()
