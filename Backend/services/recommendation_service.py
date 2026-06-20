from utils.helpers import haversine_distance

# Coordinates for Bengaluru police stations
POLICE_STATIONS = {
    "Madiwala": (12.9226, 77.6219),
    "Bellandur": (12.9304, 77.6784),
    "HSR Layout": (12.9116, 77.6388),
    "Electronic City": (12.8485, 77.6769),
    "Shivajinagar": (12.9857, 77.5978),
    "Koramangala": (12.9352, 77.6244),
    "Whitefield": (12.9698, 77.7500),
    "Hebbal": (13.0359, 77.5978),
    "Majestic": (12.9779, 77.5724),
    "Indiranagar": (12.9719, 77.6412)
}

# Coordinates for towing truck depots
DEPOTS = {
    "Depot A (South)": (12.9180, 77.6250),
    "Depot B (East)": (12.9320, 77.6800),
    "Depot C (Central)": (12.9750, 77.6090),
    "Depot D (North)": (13.0300, 77.5900)
}

def get_closest_stations(lat: float, lon: float, limit=2):
    """
    Finds the closest police stations to the event location.
    """
    distances = []
    for name, coords in POLICE_STATIONS.items():
        dist = haversine_distance(lat, lon, coords[0], coords[1])
        distances.append((name, round(dist, 1)))
    # Sort by distance ascending
    distances.sort(key=lambda x: x[1])
    return distances[:limit]

def get_closest_depots(lat: float, lon: float, limit=2):
    """
    Finds the closest towing truck depots to the event location.
    """
    distances = []
    for name, coords in DEPOTS.items():
        dist = haversine_distance(lat, lon, coords[0], coords[1])
        distances.append((name, round(dist, 1)))
    # Sort by distance ascending
    distances.sort(key=lambda x: x[1])
    return distances[:limit]

def get_resource_recommendation(impact_level: str, police_station: str, lat: float, lon: float):
    """
    Returns deployment plans and alternate route recommendations based on the impact level.
    """
    closest_stations = get_closest_stations(lat, lon, limit=2)
    closest_depots = get_closest_depots(lat, lon, limit=2)
    
    # 1. Base primary station assignment
    # If the user selected station isn't in our coordinate dict, fall back to closest
    primary_st = police_station if police_station in POLICE_STATIONS else closest_stations[0][0]
    
    # Second closest station for backup
    backup_st = closest_stations[1][0] if closest_stations[0][0] == primary_st else closest_stations[0][0]
    backup_dist = closest_stations[1][1] if closest_stations[0][0] == primary_st else closest_stations[0][1]
    
    primary_dist = 0.0
    if primary_st in POLICE_STATIONS:
        primary_dist = round(haversine_distance(lat, lon, POLICE_STATIONS[primary_st][0], POLICE_STATIONS[primary_st][1]), 1)
    else:
        primary_dist = closest_stations[0][1]

    if impact_level == "HIGH":
        officers = [
            {"count": 2, "station": primary_st, "distance": primary_dist},
            {"count": 2, "station": backup_st, "distance": backup_dist}
        ]
        tow_trucks = [
            {"count": 1, "depot": closest_depots[0][0], "distance": closest_depots[0][1]},
            {"count": 1, "depot": closest_depots[1][0], "distance": closest_depots[1][1]}
        ]
        diversion = f"Route X - via Alternative Road (Bypassing {primary_st} main corridor)"
        clearance_time = "45-60 minutes"
        send_alert = True
    elif impact_level == "MEDIUM":
        officers = [
            {"count": 2, "station": primary_st, "distance": primary_dist}
        ]
        tow_trucks = [
            {"count": 1, "depot": closest_depots[0][0], "distance": closest_depots[0][1]}
        ]
        diversion = "No diversion needed - CCTV monitoring active"
        clearance_time = "20-30 minutes"
        send_alert = False
    else: # LOW
        officers = [
            {"count": 1, "station": primary_st, "distance": primary_dist}
        ]
        tow_trucks = []
        diversion = "No diversion"
        clearance_time = "10-15 minutes"
        send_alert = False

    return {
        "officers": officers,
        "tow_trucks": tow_trucks,
        "diversion": diversion,
        "clearance_time": clearance_time,
        "send_alert": send_alert
    }
