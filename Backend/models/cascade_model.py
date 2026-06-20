import math
import networkx as nx
from typing import Dict, Any, List
from utils.helpers import haversine_distance

# Predefined key junctions in Bengaluru
JUNCTIONS = {
    "J1": {"name": "Silk Board", "lat": 12.9176, "lon": 77.6244, "police_station": "Madiwala"},
    "J2": {"name": "Electronic City", "lat": 12.8485, "lon": 77.6769, "police_station": "Electronic City"},
    "J3": {"name": "HSR Layout", "lat": 12.9116, "lon": 77.6388, "police_station": "HSR Layout"},
    "J4": {"name": "Koramangala", "lat": 12.9352, "lon": 77.6244, "police_station": "Koramangala"},
    "J5": {"name": "Bellandur", "lat": 12.9304, "lon": 77.6784, "police_station": "Bellandur"},
    "J6": {"name": "Marathahalli", "lat": 12.9569, "lon": 77.6967, "police_station": "Marathahalli"},
    "J7": {"name": "Indiranagar", "lat": 12.9719, "lon": 77.6412, "police_station": "Indiranagar"},
    "J8": {"name": "MG Road", "lat": 12.9740, "lon": 77.6085, "police_station": "Ashok Nagar"},
    "J9": {"name": "Whitefield", "lat": 12.9698, "lon": 77.7500, "police_station": "Whitefield"},
    "J10": {"name": "Hebbal", "lat": 13.0359, "lon": 77.5978, "police_station": "Hebbal"},
    "J11": {"name": "Majestic", "lat": 12.9779, "lon": 77.5724, "police_station": "Upparpet"},
    "J12": {"name": "Shivajinagar", "lat": 12.9857, "lon": 77.5978, "police_station": "Shivajinagar"},
    "J13": {"name": "Domlur", "lat": 12.9610, "lon": 77.6387, "police_station": "Jeevanbheemanagar"},
    "J14": {"name": "Agara Junction", "lat": 12.9254, "lon": 77.6508, "police_station": "HSR Layout"}
}

# Predefined road connections (edges)
EDGES = [
    ("J1", "J3"), ("J1", "J4"), ("J1", "J2"), ("J1", "J14"),
    ("J3", "J14"),
    ("J14", "J5"),
    ("J5", "J6"), ("J5", "J13"),
    ("J6", "J9"), ("J6", "J7"),
    ("J7", "J13"), ("J7", "J8"),
    ("J13", "J4"),
    ("J4", "J8"),
    ("J8", "J12"), ("J8", "J11"),
    ("J11", "J12"), ("J11", "J10"),
    ("J12", "J10")
]

def build_road_graph() -> nx.Graph:
    """
    Constructs the NetworkX Graph of Bengaluru junctions with physical distances (in km) as edge weights.
    """
    G = nx.Graph()
    for jid, info in JUNCTIONS.items():
        G.add_node(jid, name=info["name"], lat=info["lat"], lon=info["lon"], police_station=info["police_station"])
        
    for u, v in EDGES:
        lat1, lon1 = JUNCTIONS[u]["lat"], JUNCTIONS[u]["lon"]
        lat2, lon2 = JUNCTIONS[v]["lat"], JUNCTIONS[v]["lon"]
        dist = haversine_distance(lat1, lon1, lat2, lon2)
        G.add_edge(u, v, weight=dist)
        
    return G

def find_nearest_junction(lat: float, lon: float) -> str:
    """
    Finds the junction ID in the graph closest to the specified coordinates.
    """
    min_dist = float("inf")
    nearest_jid = "J1" # default fallback
    for jid, info in JUNCTIONS.items():
        dist = haversine_distance(lat, lon, info["lat"], info["lon"])
        if dist < min_dist:
            min_dist = dist
            nearest_jid = jid
    return nearest_jid

def run_cascade_simulation(lat: float, lon: float, impact_level: str) -> Dict[str, Any]:
    """
    Simulates cascading congestion spread outwards from the event coordinates.
    Returns congestion levels at time steps t+0, t+15, t+30, t+45, t+60,
    the list of affected police stations, and a suggested diversion route.
    """
    G = build_road_graph()
    event_jid = find_nearest_junction(lat, lon)
    
    # Establish baseline congestion at t+0
    # Higher impact means higher peak congestion
    if impact_level == "HIGH":
        C_start = 85.0
    elif impact_level == "MEDIUM":
        C_start = 55.0
    else:
        C_start = 25.0
        
    # Baseline congestion for all other nodes (e.g. normal traffic)
    baselines = {jid: float(hash(jid) % 15 + 5) for jid in JUNCTIONS.keys()} # deterministic low traffic 5-20%
    
    time_steps = {}
    time_minutes = [0, 15, 30, 45, 60]
    
    # Wave propagation speed (km per minute)
    wave_speed = 0.15 
    
    for t in time_minutes:
        step_name = f"t+{t}"
        junctions_data = []
        radius = wave_speed * t
        
        for jid in JUNCTIONS.keys():
            info = JUNCTIONS[jid]
            baseline = baselines[jid]
            
            if jid == event_jid:
                # Decays at the center as response teams arrive
                # For LOW impact, it clears very fast. For HIGH, it lingers.
                decay_rate = 0.02 if impact_level == "LOW" else (0.012 if impact_level == "MEDIUM" else 0.008)
                congestion = C_start * math.exp(-decay_rate * t)
                congestion = max(baseline, min(100.0, congestion))
            else:
                # Calculate shortest path distance to this node along the graph
                try:
                    dist = nx.shortest_path_length(G, source=event_jid, target=jid, weight="weight")
                except nx.NetworkXNoPath:
                    dist = float("inf")
                
                if dist <= radius:
                    # Congestion reaches this node. The spread decays with path distance
                    # and begins to dissipate as time progresses after the wavefront pass.
                    time_reached = dist / wave_speed
                    time_elapsed_since_wave = t - time_reached
                    
                    spatial_decay = 0.35 # congestion drops as it spreads
                    temporal_decay = 0.01 # spreads and peaks, then dissipates
                    
                    delta = (C_start - baseline) * math.exp(-spatial_decay * dist) * math.exp(-temporal_decay * time_elapsed_since_wave)
                    congestion = baseline + max(0.0, delta)
                else:
                    # Wave hasn't reached yet, stays at baseline
                    congestion = baseline
                    
            congestion = round(max(0.0, min(100.0, congestion)), 1)
            junctions_data.append({
                "id": jid,
                "name": info["name"],
                "lat": info["lat"],
                "lon": info["lon"],
                "congestion": congestion
            })
            
        time_steps[step_name] = {"junctions": junctions_data}

    # Find affected police stations (police stations containing a junction with > 40% congestion at any point)
    affected_stations = set()
    for step in time_steps.values():
        for j in step["junctions"]:
            if j["congestion"] > 40.0:
                station = JUNCTIONS[j["id"]]["police_station"]
                affected_stations.add(station)
                
    # Always include the primary police station
    primary_station = JUNCTIONS[event_jid]["police_station"]
    affected_stations.add(primary_station)
    
    # Suggest a diversion route
    # Find neighbors of event_jid that have lowest congestion at t+30
    neighbors = list(G.neighbors(event_jid))
    t30_junctions = {j["id"]: j["congestion"] for j in time_steps["t+30"]["junctions"]}
    
    sorted_neighbors = sorted(neighbors, key=lambda n: t30_junctions[n])
    
    if len(sorted_neighbors) >= 2:
        bypass1 = JUNCTIONS[sorted_neighbors[0]]["name"]
        bypass2 = JUNCTIONS[sorted_neighbors[1]]["name"]
        diversion_route = f"Avoid {JUNCTIONS[event_jid]['name']} - Reroute via {bypass1} and {bypass2}."
    elif len(sorted_neighbors) == 1:
        bypass1 = JUNCTIONS[sorted_neighbors[0]]["name"]
        diversion_route = f"Avoid {JUNCTIONS[event_jid]['name']} - Divert traffic through {bypass1}."
    else:
        diversion_route = "No alternate route available. Maintain active single-lane flow control."
        
    return {
        "time_steps": time_steps,
        "affected_police_stations": sorted(list(affected_stations)),
        "diversion_route": diversion_route
    }
