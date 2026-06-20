import os
import httpx
import pandas as pd
from datetime import datetime
from utils.helpers import parse_datetime
from database import SessionLocal
from models.sql_models import Event

CSV_URL = "https://uc.hackerearth.com/he-public-ap-south-1/Astram%20event%20data_anonymized%20-%20Astram%20event%20data_anonymizedb40ac87.csv"
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DATA_DIR = os.path.join(BASE_DIR, "data", "raw")
RAW_DATA_PATH = os.path.join(RAW_DATA_DIR, "astram_data.csv")

def download_csv_if_missing():
    """
    Downloads the dataset CSV from HackerEarth if it doesn't exist locally.
    """
    if not os.path.exists(RAW_DATA_DIR):
        os.makedirs(RAW_DATA_DIR, exist_ok=True)
        
    if not os.path.exists(RAW_DATA_PATH):
        print(f"Downloading CSV from {CSV_URL} to {RAW_DATA_PATH}...")
        headers = {"User-Agent": "Mozilla/5.0"}
        with httpx.Client(headers=headers, timeout=120.0) as client:
            response = client.get(CSV_URL)
            response.raise_for_status()
            with open(RAW_DATA_PATH, "w", encoding="utf-8") as f:
                f.write(response.text)
        print("CSV download completed.")
    else:
        print("CSV dataset already exists locally.")

def clean_float(val):
    if pd.isna(val):
        return 0.0
    try:
        return float(val)
    except ValueError:
        return 0.0

def load_historical_events_from_csv() -> list:
    """
    Downloads the CSV dataset if missing, and loads all valid historical events in memory.
    Returns a list of dict objects ready to be passed to events_to_features_df.
    """
    download_csv_if_missing()
    
    if not os.path.exists(RAW_DATA_PATH):
        print(f"Error: dataset CSV not found at {RAW_DATA_PATH}")
        return []
        
    print("Loading historical events from local CSV cache...")
    events_list = []
    processed_ids = set()
    
    try:
        # Load the CSV
        df = pd.read_csv(RAW_DATA_PATH)
        for _, row in df.iterrows():
            event_id = str(row.get("id"))
            if not event_id or event_id in processed_ids or event_id == "nan":
                continue
                
            lat = clean_float(row.get("latitude"))
            lon = clean_float(row.get("longitude"))
            
            if lat == 0.0 or lon == 0.0:
                continue
                
            start_dt = parse_datetime(row.get("start_datetime"))
            if not start_dt:
                continue
                
            res_val = row.get("resolved_datetime")
            if pd.isna(res_val) or str(res_val).strip().upper() in ("NULL", "NONE", ""):
                res_val = row.get("closed_datetime")
                
            closed_dt = None
            if not pd.isna(res_val) and str(res_val).strip().upper() not in ("NULL", "NONE", ""):
                closed_dt = parse_datetime(res_val)
                
            resolution_time = None
            actual_impact = None
            
            if start_dt and closed_dt:
                diff_min = int((closed_dt - start_dt).total_seconds() / 60.0)
                if diff_min >= 0:
                    resolution_time = diff_min
                    if resolution_time < 20:
                        actual_impact = "LOW"
                    elif resolution_time <= 40:
                        actual_impact = "MEDIUM"
                    else:
                        actual_impact = "HIGH"
                        
            status = str(row.get("status")).strip().lower()
            if not actual_impact and status in ("resolved", "closed"):
                cause = str(row.get("event_cause")).strip().lower()
                if cause in ("accident", "public_event"):
                    actual_impact = "HIGH"
                    resolution_time = 45
                elif cause in ("water_logging", "tree_fall"):
                    actual_impact = "MEDIUM"
                    resolution_time = 30
                else:
                    actual_impact = "LOW"
                    resolution_time = 15
                    
            road_closure = False
            closure_str = str(row.get("requires_road_closure")).strip().lower()
            if closure_str in ("true", "yes", "1"):
                road_closure = True
                
            desc = str(row.get("description")) if not pd.isna(row.get("description")) else ""
            
            # Format as a dictionary matching the schema that features extraction expects
            event_dict = {
                "event_id": event_id,
                "cause": str(row.get("event_cause")) if not pd.isna(row.get("event_cause")) else "others",
                "latitude": lat,
                "longitude": lon,
                "police_station": str(row.get("police_station")) if not pd.isna(row.get("police_station")) else "unknown",
                "corridor": str(row.get("corridor")) if not pd.isna(row.get("corridor")) else "non-corridor",
                "start_datetime": start_dt,
                "closed_datetime": closed_dt,
                "road_closure": road_closure,
                "description": desc,
                "status": status if status in ("active", "resolved", "closed") else "resolved",
                "actual_impact": actual_impact or "LOW",
                "resolution_time": resolution_time or 15
            }
            events_list.append(event_dict)
            processed_ids.add(event_id)
            
        print(f"Loaded {len(events_list)} historical events from CSV.")
    except Exception as e:
        print(f"Error loading CSV data: {e}")
        
    return events_list

def load_and_seed_data(chunk_size=1000):
    """
    Ensures that the CSV dataset is downloaded locally.
    Does not seed any rows to the database to optimize database size and speed.
    """
    print("Ensuring local CSV dataset is cached...")
    download_csv_if_missing()
    print("Database seeding from CSV is disabled. Using in-memory CSV training instead.")
