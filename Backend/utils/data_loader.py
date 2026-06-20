import os
import httpx
import pandas as pd
from datetime import datetime
from utils.helpers import parse_datetime
from database import SessionLocal
from models.sql_models import Event

CSV_URL = "https://uc.hackerearth.com/he-public-ap-south-1/Astram%20event%20data_anonymized%20-%20Astram%20event%20data_anonymizedb40ac87.csv"
RAW_DATA_DIR = r"d:\Daksh\TrafficPredictor\Backend\data\raw"
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

def load_and_seed_data(chunk_size=1000):
    """
    Loads the cached CSV in chunks and inserts records into the SQLite database.
    """
    download_csv_if_missing()
    
    db = SessionLocal()
    try:
        # Check if database is already seeded
        existing_count = db.query(Event).count()
        if existing_count > 0:
            print(f"Database already contains {existing_count} events. Skipping seeding.")
            return
            
        print("Seeding database from CSV in chunks...")
        processed_ids = set()
        
        # Read CSV in chunks
        for chunk in pd.read_csv(RAW_DATA_PATH, chunksize=chunk_size):
            db_events = []
            for _, row in chunk.iterrows():
                event_id = str(row.get("id"))
                if not event_id or event_id in processed_ids or event_id == "nan":
                    continue
                
                # Check for existing
                # Clean coordinates
                lat = clean_float(row.get("latitude"))
                lon = clean_float(row.get("longitude"))
                
                if lat == 0.0 or lon == 0.0:
                    continue # Skip invalid coordinates
                
                # Parse datetimes
                start_dt = parse_datetime(row.get("start_datetime"))
                
                # Check resolution datetime (can check resolved_datetime first, then closed_datetime)
                res_val = row.get("resolved_datetime")
                if pd.isna(res_val) or str(res_val).strip().upper() in ("NULL", "NONE", ""):
                    res_val = row.get("closed_datetime")
                    
                closed_dt = None
                if not pd.isna(res_val) and str(res_val).strip().upper() not in ("NULL", "NONE", ""):
                    closed_dt = parse_datetime(res_val)
                
                # Calculate resolution time and actual impact
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
                            
                # Fallbacks for empty actual impact if event is resolved
                status = str(row.get("status")).strip().lower()
                if not actual_impact and status in ("resolved", "closed"):
                    # Estimate based on cause priority
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
                
                # Closure flag
                road_closure = False
                closure_str = str(row.get("requires_road_closure")).strip().lower()
                if closure_str in ("true", "yes", "1"):
                    road_closure = True

                # Event description
                desc = str(row.get("description")) if not pd.isna(row.get("description")) else ""
                
                db_event = Event(
                    event_id=event_id,
                    cause=str(row.get("event_cause")) if not pd.isna(row.get("event_cause")) else "others",
                    latitude=lat,
                    longitude=lon,
                    police_station=str(row.get("police_station")) if not pd.isna(row.get("police_station")) else "unknown",
                    corridor=str(row.get("corridor")) if not pd.isna(row.get("corridor")) else "non-corridor",
                    start_datetime=start_dt,
                    closed_datetime=closed_dt,
                    road_closure=road_closure,
                    description=desc,
                    status=status if status in ("active", "resolved", "closed") else "resolved",
                    predicted_impact=None,
                    confidence=None,
                    actual_impact=actual_impact or "LOW",
                    resolution_time=resolution_time or 15
                )
                db_events.append(db_event)
                processed_ids.add(event_id)
                
            db.bulk_save_objects(db_events)
            db.commit()
            print(f"Inserted chunk of {len(db_events)} events.")
            
        print("Database seeding completed.")
    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()
