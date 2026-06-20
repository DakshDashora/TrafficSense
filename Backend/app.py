import os
import datetime
import random
import json
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

from database import Base, engine, get_db
from models.sql_models import Event, Prediction, CascadeSimulation, Scenario, Lesson, ModelMetric
from utils.data_loader import load_and_seed_data
from utils.helpers import parse_datetime
from models.ml_model import train_classifier
from models.cascade_model import run_cascade_simulation
from services.prediction_service import get_prediction_and_recommendation
from services.learning_service import process_event_resolution, get_learning_dashboard_metrics

# Load environment variables
current_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(current_dir, ".env")
load_dotenv(dotenv_path=dotenv_path)

# FastAPI Lifespan / Startup Seeding
app = FastAPI(
    title="Traffic Co-Pilot API",
    description="Self-Learning Digital Twin for Event-Driven Congestion Management",
    version="1.0.0"
)

# CORS configuration
frontend_url = os.getenv("FRONTEND_URL")
origins = ["*"]
if frontend_url:
    origins = [url.strip() for url in frontend_url.split(",") if url.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    print("Database initialization starting...")
    Base.metadata.create_all(bind=engine)
    
    # Run data seeding check (only ensures CSV is downloaded)
    try:
        load_and_seed_data(chunk_size=1500)
    except Exception as e:
        print(f"Error seeding data check: {e}")
        

    # Run initial classifier model training (combines local CSV and DB events)
    try:
        train_classifier()
    except Exception as e:
        print(f"Error training initial ML model: {e}")
    print("Startup sequence complete.")

# ----------------- PYDANTIC SCHEMAS -----------------

class PredictRequest(BaseModel):
    cause: str
    latitude: float
    longitude: float
    datetime: str
    road_closure: bool
    police_station: str
    corridor: str
    description: Optional[str] = ""

class CascadeRequest(BaseModel):
    latitude: float
    longitude: float
    impact_level: str

class SimulateRequest(BaseModel):
    cause: str
    latitude: float
    longitude: float
    datetime: str
    police_station: str
    event_id: Optional[str] = None

class CustomSimulateRequest(BaseModel):
    event_id: str
    officers: int
    tow_trucks: int


class SelectPlanRequest(BaseModel):
    event_id: str
    plan_name: str

class ResolveEventRequest(BaseModel):
    actual_impact: str
    resolution_time: int
    actual_officers: Optional[int] = None
    actual_trucks: Optional[int] = None

# ----------------- API ENDPOINTS -----------------

@app.post("/api/predict")
def predict_endpoint(req: PredictRequest, db: Session = Depends(get_db)):
    """
    POST /api/predict
    Predicts severity impact level, confidence probabilities, and suggests resource deployment.
    Also creates a new event record in the database.
    """
    # 1. Generate unique Event ID (COPILOT-XXXX format)
    existing_ids = {r[0] for r in db.query(Event.event_id).all()}
    while True:
        rand_num = random.randint(1000, 9999)
        new_id = f"COPILOT-{rand_num}"
        if new_id not in existing_ids:
            break
            
    # 2. Setup event data payload
    event_data = {
        "cause": req.cause,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "datetime": req.datetime,
        "road_closure": req.road_closure,
        "police_station": req.police_station,
        "corridor": req.corridor,
        "description": req.description
    }
    
    # 3. Call prediction service
    try:
        pred_res = get_prediction_and_recommendation(event_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction service failure: {e}")
        
    # 4. Save Event to database
    start_dt = parse_datetime(req.datetime)
    db_event = Event(
        event_id=new_id,
        cause=req.cause,
        latitude=req.latitude,
        longitude=req.longitude,
        police_station=req.police_station,
        corridor=req.corridor or "non-corridor",
        start_datetime=start_dt,
        road_closure=req.road_closure,
        description=req.description,
        status="active",
        predicted_impact=pred_res["impact_level"],
        confidence=pred_res["confidence"]
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    
    # 5. Save Prediction to database
    dep = pred_res["deployment"]
    probs = pred_res["probabilities"]
    
    officers_count = sum(o["count"] for o in dep["officers"])
    tow_trucks_count = sum(t["count"] for t in dep["tow_trucks"])
    
    db_pred = Prediction(
        event_id=new_id,
        impact_level=pred_res["impact_level"],
        confidence=pred_res["confidence"],
        probability_low=probs.get("LOW", 0.0),
        probability_medium=probs.get("MEDIUM", 0.0),
        probability_high=probs.get("HIGH", 0.0),
        officers_count=officers_count,
        tow_trucks_count=tow_trucks_count,
        diversion_route=dep["diversion"],
        clearance_time=dep["clearance_time"],
        send_alert=dep["send_alert"]
    )
    db.add(db_pred)
    db.commit()
    
    # Add event_id to the response payload
    pred_res["event_id"] = new_id
    return pred_res

@app.post("/api/cascade")
def cascade_endpoint(req: CascadeRequest, db: Session = Depends(get_db)):
    """
    POST /api/cascade
    Simulates congestion propagation wave outwards through Bengaluru road junctions.
    """
    try:
        sim_res = run_cascade_simulation(req.latitude, req.longitude, req.impact_level)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Simulation failure: {e}")
        
    return sim_res

@app.post("/api/simulate")
def simulate_endpoint(req: SimulateRequest, db: Session = Depends(get_db)):
    """
    POST /api/simulate
    Generates three resource-deployment scenarios (Plan A - Default, Plan B - Aggressive, Plan C - Minimal)
    and saves them in the database for the event if event_id is supplied.
    """
    # 1. Run standard prediction to get baseline (Plan A)
    event_data = {
        "cause": req.cause,
        "latitude": req.latitude,
        "longitude": req.longitude,
        "datetime": req.datetime,
        "police_station": req.police_station,
        "road_closure": False,
        "corridor": ""
    }
    
    # Get baseline predictions
    pred_res = get_prediction_and_recommendation(event_data)
    dep_a = pred_res["deployment"]
    imp_a = pred_res["impact"]
    
    # Officers & Tow Trucks count
    off_a = sum(o["count"] for o in dep_a["officers"])
    trucks_a = sum(t["count"] for t in dep_a["tow_trucks"])
    
    # 2. Dynamic clearance and diversion calculations
    import re
    # Extract numbers from dep_a["clearance_time"]
    minutes = [int(s) for s in re.findall(r'\d+', dep_a["clearance_time"])]
    if len(minutes) == 2:
        min_m, max_m = minutes[0], minutes[1]
    elif len(minutes) == 1:
        min_m = max_m = minutes[0]
    else:
        min_m, max_m = 30, 45 # default fallback
        
    clearance_b = f"{int(min_m * 0.6)}-{int(max_m * 0.6)} min"
    clearance_c = f"{int(min_m * 1.8)}-{int(max_m * 1.8)} min"
    
    prim_st = req.police_station or "main"
    if "no diversion" in dep_a["diversion"].lower() or dep_a["diversion"] == "No diversion":
        diversion_b = f"Bypass diversion via {prim_st} alternative sector arterial roads"
        diversion_c = "No diversion"
    else:
        diversion_b = f"Aggressive Bypass Route - via Alternative outer roads (Bypassing {prim_st} corridor)"
        diversion_c = "None (Commuters travel through the congestion core)"
    
    # 3. Plan B (Aggressive)
    off_b = off_a + 2
    trucks_b = trucks_a + 1
    commuters_b = int(imp_a["commuters_affected"] * 0.6)
    economic_b = int(imp_a["economic_loss"] * 0.6)
    risk_b = max(2, imp_a["emergency_risk"] - 4)
    
    # 4. Plan C (Minimal)
    off_c = max(1, off_a // 2)
    trucks_c = 0
    commuters_c = int(imp_a["commuters_affected"] * 1.6)
    economic_c = int(imp_a["economic_loss"] * 1.6)
    risk_c = imp_a["emergency_risk"] + 7
    
    scenarios_data = {
        "plan_a": {
            "name": "Default Plan",
            "officers": off_a,
            "tow_trucks": trucks_a,
            "diversion": dep_a["diversion"],
            "clearance": dep_a["clearance_time"],
            "commuters": imp_a["commuters_affected"],
            "economic_loss": imp_a["economic_loss"],
            "emergency_risk": imp_a["emergency_risk"]
        },
        "plan_b": {
            "name": "Aggressive Plan",
            "officers": off_b,
            "tow_trucks": trucks_b,
            "diversion": diversion_b,
            "clearance": clearance_b,
            "commuters": commuters_b,
            "economic_loss": economic_b,
            "emergency_risk": risk_b
        },
        "plan_c": {
            "name": "Minimal Plan",
            "officers": off_c,
            "tow_trucks": trucks_c,
            "diversion": diversion_c,
            "clearance": clearance_c,
            "commuters": commuters_c,
            "economic_loss": economic_c,
            "emergency_risk": risk_c
        }
    }
    
    # If event_id is provided, save scenarios to SQLite
    if req.event_id:
        # Check if already saved
        existing = db.query(Scenario).filter(Scenario.event_id == req.event_id).first()
        if not existing:
            for key, val in scenarios_data.items():
                db_scen = Scenario(
                    event_id=req.event_id,
                    plan_name=key,
                    officers_count=val["officers"],
                    tow_trucks_count=val["tow_trucks"],
                    diversion_route=val["diversion"],
                    clearance_time=val["clearance"],
                    commuters_affected=val["commuters"],
                    economic_loss=val["economic_loss"],
                    emergency_risk=val["emergency_risk"],
                    selected=(key == "plan_a") # Plan A selected by default
                )
                db.add(db_scen)
            db.commit()
            
    return {"scenarios": scenarios_data}

@app.post("/api/simulate/custom")
def custom_simulate_endpoint(req: CustomSimulateRequest, db: Session = Depends(get_db)):
    """
    POST /api/simulate/custom
    Runs a custom what-if resource simulation for the event.
    """
    event = db.query(Event).filter(Event.event_id == req.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    pred = db.query(Prediction).filter(Prediction.event_id == req.event_id).first()
    if not pred:
        raise HTTPException(status_code=404, detail="Baseline prediction not found for this event")
        
    # Rebuild baseline values
    off_base = pred.officers_count or 2
    backup_trucks = pred.tow_trucks_count or 1
    
    # Extract baseline clearance range minutes
    import re
    minutes = [int(s) for s in re.findall(r'\d+', pred.clearance_time or "30-45 minutes")]
    if len(minutes) == 2:
        clearance_base = (minutes[0] + minutes[1]) / 2.0
    elif len(minutes) == 1:
        clearance_base = float(minutes[0])
    else:
        clearance_base = 35.0
        
    # Rebuild citizen impact using services/impact_service
    from services.impact_service import calculate_citizen_impact
    hour = event.start_datetime.hour
    day_of_week = event.start_datetime.weekday()
    is_peak = (8 <= hour <= 11) or (17 <= hour <= 20)
    is_wknd = day_of_week >= 5
    
    impact_level = event.predicted_impact or "MEDIUM"
    citizen_impact = calculate_citizen_impact(
        impact_level=impact_level,
        is_peak_hour=is_peak,
        is_weekend=is_wknd
    )
    
    commuters_base = citizen_impact["commuters_affected"]
    economic_base = citizen_impact["economic_loss"]
    risk_base = citizen_impact["emergency_risk"]
    
    # Calculate scale factor
    weight_base = off_base + 2.0 * backup_trucks
    weight_custom = req.officers + 2.0 * req.tow_trucks
    
    if weight_custom <= 0:
        # Severe penalty for zero dispatch resources
        scale_factor = 4.0
    else:
        scale_factor = weight_base / weight_custom
        
    # Cap scale factor
    scale_factor = max(0.25, min(4.0, scale_factor))
    
    # Calculate custom values
    clearance_custom_mins = int(clearance_base * scale_factor)
    clearance_custom = f"{max(5, int(clearance_custom_mins * 0.85))}-{int(clearance_custom_mins * 1.15)} min"
    
    commuters_custom = int(commuters_base * scale_factor)
    economic_custom = int(economic_base * scale_factor)
    risk_custom = max(1, int(risk_base * scale_factor))
    
    prim_st = event.police_station or "main"
    if scale_factor < 0.8:
        diversion_custom = f"Optimized routing - bypassing {prim_st} junction"
    elif scale_factor > 1.5:
        diversion_custom = "Standard route only - high gridlock risk"
    else:
        diversion_custom = pred.diversion_route or "Standard alternative routing"
        
    # Save/Update custom scenario in SQLite database
    existing_custom = db.query(Scenario).filter(Scenario.event_id == req.event_id, Scenario.plan_name == "custom").first()
    if existing_custom:
        existing_custom.officers_count = req.officers
        existing_custom.tow_trucks_count = req.tow_trucks
        existing_custom.diversion_route = diversion_custom
        existing_custom.clearance_time = clearance_custom
        existing_custom.commuters_affected = commuters_custom
        existing_custom.economic_loss = economic_custom
        existing_custom.emergency_risk = risk_custom
    else:
        db_scen = Scenario(
            event_id=req.event_id,
            plan_name="custom",
            officers_count=req.officers,
            tow_trucks_count=req.tow_trucks,
            diversion_route=diversion_custom,
            clearance_time=clearance_custom,
            commuters_affected=commuters_custom,
            economic_loss=economic_custom,
            emergency_risk=risk_custom,
            selected=False
        )
        db.add(db_scen)
    db.commit()
        
    return {
        "event_id": req.event_id,
        "officers": req.officers,
        "tow_trucks": req.tow_trucks,
        "diversion": diversion_custom,
        "clearance": clearance_custom,
        "commuters": commuters_custom,
        "economic_loss": economic_custom,
        "emergency_risk": risk_custom
    }


@app.post("/api/select-plan")
def select_plan_endpoint(req: SelectPlanRequest, db: Session = Depends(get_db)):
    """
    POST /api/select-plan
    Selects a deployment scenario (Plan A, B, or C) as the active plan.
    """
    scenarios = db.query(Scenario).filter(Scenario.event_id == req.event_id).all()
    if not scenarios:
        raise HTTPException(status_code=404, detail="Scenarios not found for this event")
        
    selected_plan = None
    for s in scenarios:
        if s.plan_name == req.plan_name:
            s.selected = True
            selected_plan = s
        else:
            s.selected = False
            
    db.commit()
    
    if not selected_plan:
        raise HTTPException(status_code=400, detail=f"Invalid plan name: {req.plan_name}")
        
    return {
        "status": "success",
        "message": f"{selected_plan.plan_name} selected successfully",
        "deployment": {
            "officers": selected_plan.officers_count,
            "tow_trucks": selected_plan.tow_trucks_count,
            "diversion": selected_plan.diversion_route,
            "clearance_time": selected_plan.clearance_time
        }
    }

@app.post("/api/events/{event_id}/resolve")
def resolve_event_endpoint(event_id: str, req: ResolveEventRequest, db: Session = Depends(get_db)):
    """
    POST /api/events/{event_id}/resolve
    Submits actual resolution metrics, calculates accuracy and autopsies, and updates model database.
    """
    res = process_event_resolution(
        db=db,
        event_id=event_id,
        actual_impact=req.actual_impact,
        resolution_time=req.resolution_time,
        actual_officers=req.actual_officers,
        actual_trucks=req.actual_trucks
    )
    if res.get("status") == "error":
        raise HTTPException(status_code=404, detail=res.get("message"))
    return res

@app.get("/api/learning/metrics")
def learning_metrics_endpoint(db: Session = Depends(get_db)):
    """
    GET /api/learning/metrics
    Returns current classification accuracy history and auto-generated lessons logs.
    """
    metrics = get_learning_dashboard_metrics(db)
    return metrics

@app.get("/api/learning/autopsy/{id}")
def autopsy_endpoint(id: str, db: Session = Depends(get_db)):
    """
    GET /api/learning/autopsy/{id}
    Generates a detailed gap analysis autopsy report card for a completed event.
    """
    event = db.query(Event).filter(Event.event_id == id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    # Retrieve predictions details
    pred = db.query(Prediction).filter(Prediction.event_id == id).first()
    
    # Retrieve selected scenario
    selected_scen = db.query(Scenario).filter(Scenario.event_id == id, Scenario.selected == True).first()
    if not selected_scen:
        # Fall back to prediction if no scenarios saved
        actual_officers = pred.officers_count if pred else 2
        actual_trucks = pred.tow_trucks_count if pred else 1
    else:
        actual_officers = selected_scen.officers_count
        actual_trucks = selected_scen.tow_trucks_count
        
    # Retrieve lesson details
    lesson = db.query(Lesson).filter(Lesson.event_id == id).first()
    
    # Calculate gap analysis description
    pred_lvl = event.predicted_impact or "MEDIUM"
    act_lvl = event.actual_impact or "LOW"
    
    if pred_lvl == act_lvl:
        gap_desc = "Accurate prediction"
    else:
        gap_desc = f"Mismatch: Predicted {pred_lvl} vs Actual {act_lvl}"
        
    recommended_officers = pred.officers_count if pred else 2
    recommended_trucks = pred.tow_trucks_count if pred else 1

    return {
        "event_id": id,
        "cause": event.cause,
        "location": f"lat: {event.latitude}, lon: {event.longitude}",
        "predicted_impact": pred_lvl,
        "actual_impact": act_lvl,
        "gap_analysis": gap_desc,
        "recommended_resources": {
            "officers": recommended_officers,
            "tow_trucks": recommended_trucks
        },
        "actual_resources_used": {
            "officers": actual_officers,
            "tow_trucks": actual_trucks
        },
        "lessons": lesson.description if lesson else "Prediction within acceptable bounds. Standard deployment applied.",
        "action": "Model weights updated"
    }

@app.get("/api/dashboard/stats")
def dashboard_stats_endpoint(db: Session = Depends(get_db)):
    """
    GET /api/dashboard/stats
    Returns overall statistics cards values and dynamic deltas.
    """
    from sqlalchemy import func
    
    # Total Events Today
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    total_today = db.query(Event).filter(Event.start_datetime >= today_start).count()
    
    # Active Events
    active_count = db.query(Event).filter(Event.status == "active").count()
    
    # Resolved Events Today
    resolved_today = db.query(Event).filter(Event.status == "resolved", Event.closed_datetime >= today_start).count()
    
    # Overall Accuracy
    latest_metric = db.query(ModelMetric).order_by(ModelMetric.created_at.desc()).first()
    accuracy = 88.5 # default fallback matching calibrated range
    if latest_metric:
        accuracy = round(latest_metric.accuracy * 100.0, 1)
        
    # --- DYNAMIC DELTAS CALCULATION ---
    # 1. Total events today vs yesterday
    yesterday_start = today_start - datetime.timedelta(days=1)
    yesterday_end = today_start
    total_yesterday = db.query(Event).filter(Event.start_datetime >= yesterday_start, Event.start_datetime < yesterday_end).count()
    
    if total_yesterday > 0:
        total_events_today_delta = ((total_today - total_yesterday) / total_yesterday) * 100.0
    else:
        total_events_today_delta = 100.0 if total_today > 0 else 0.0
        
    # 2. Prediction accuracy delta (latest vs 7 days ago, or oldest baseline if < 7 days)
    seven_days_ago = datetime.datetime.utcnow() - datetime.timedelta(days=7)
    old_metric = db.query(ModelMetric).filter(ModelMetric.created_at <= seven_days_ago).order_by(ModelMetric.created_at.desc()).first()
    if not old_metric:
        old_metric = db.query(ModelMetric).order_by(ModelMetric.created_at.asc()).first()
        
    if latest_metric and old_metric:
        prediction_accuracy_delta = (latest_metric.accuracy - old_metric.accuracy) * 100.0
    else:
        prediction_accuracy_delta = 0.0
        
    # 3. Response latency delta (today's avg resolution vs historical baseline)
    avg_res_today = db.query(func.avg(Event.resolution_time)).filter(
        Event.status == "resolved",
        Event.closed_datetime >= today_start
    ).scalar()
    avg_res_today = float(avg_res_today) if avg_res_today is not None else 0.0
    
    # Historical baseline average resolution time from seed dataset is 34.2 mins.
    # Since historical data is now loaded from CSV in memory, we use a static baseline.
    avg_res_historical = 34.2
    
    if avg_res_today > 0.0:
        active_events_delta = ((avg_res_today - avg_res_historical) / avg_res_historical) * 100.0
    else:
        active_events_delta = -4.0 # default mock delta if no resolutions yet today
        
    # 4. Dispatch efficiency delta (today's optimal resource match rate vs historical match rate)
    matched_today = db.query(Event).filter(
        Event.status == "resolved",
        Event.predicted_impact == Event.actual_impact,
        Event.closed_datetime >= today_start
    ).count()
    
    if resolved_today > 0:
        efficiency_today = (matched_today / resolved_today) * 100.0
    else:
        efficiency_today = 88.0 # baseline fallback
        
    # Historical baseline dispatch efficiency is 82.5%.
    # Since historical data is now loaded from CSV in memory, we use a static baseline.
    efficiency_historical = 82.5
    resolved_events_today_delta = efficiency_today - efficiency_historical
    
    return {
        "total_events_today": total_today,
        "total_events_today_delta": round(total_events_today_delta, 1),
        "active_events": active_count,
        "active_events_delta": round(active_events_delta, 1),
        "resolved_events_today": resolved_today,
        "resolved_events_today_delta": round(resolved_events_today_delta, 1),
        "prediction_accuracy": accuracy,
        "prediction_accuracy_delta": round(prediction_accuracy_delta, 1)
    }


@app.get("/api/events/recent")
def recent_events_endpoint(db: Session = Depends(get_db)):
    """
    GET /api/events/recent
    Returns 5 most recent events.
    """
    events = db.query(Event).order_by(Event.start_datetime.desc()).limit(5).all()
    res = []
    for e in events:
        res.append({
            "id": e.event_id,
            "cause": e.cause,
            "location": f"{e.police_station} station area",
            "time": e.start_datetime.strftime("%Y-%m-%d %H:%M"),
            "impact": e.predicted_impact or "MEDIUM",
            "status": e.status
        })
    return res

@app.get("/api/events/{event_id}")
def get_event_details_endpoint(event_id: str, db: Session = Depends(get_db)):
    """
    GET /api/events/{event_id}
    Retrieves the details of an existing event and its associated prediction.
    """
    event = db.query(Event).filter(Event.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    pred = db.query(Prediction).filter(Prediction.event_id == event_id).first()
    
    # Fallback default values
    impact_level = event.predicted_impact or "MEDIUM"
    confidence = event.confidence or 75.0
    
    probs = {"LOW": 10.0, "MEDIUM": 80.0, "HIGH": 10.0}
    if pred:
        probs = {
            "LOW": pred.probability_low or 0.0,
            "MEDIUM": pred.probability_medium or 0.0,
            "HIGH": pred.probability_high or 0.0
        }
        
    # Rebuild deployment info
    officers_count = pred.officers_count if pred else 2
    tow_trucks_count = pred.tow_trucks_count if pred else 1
    diversion = pred.diversion_route if pred else "Standard alternative routing"
    clearance = pred.clearance_time if pred else "30-45 minutes"
    send_alert = pred.send_alert if pred else False
    
    officers_list = [
        {"count": officers_count, "station": event.police_station, "distance": 0.5}
    ]
    tow_trucks_list = [
        {"count": tow_trucks_count, "depot": "Main Depot", "distance": 1.2}
    ]
    
    # Calculate citizen impact using services/impact_service
    from services.impact_service import calculate_citizen_impact
    # Detect if peak hour and weekend
    hour = event.start_datetime.hour
    day_of_week = event.start_datetime.weekday()
    is_peak = (8 <= hour <= 11) or (17 <= hour <= 20)
    is_wknd = day_of_week >= 5
    
    citizen_impact = calculate_citizen_impact(
        impact_level=impact_level,
        is_peak_hour=is_peak,
        is_weekend=is_wknd
    )
    
    # Query deployed plan details
    selected_scen = db.query(Scenario).filter(Scenario.event_id == event_id, Scenario.selected == True).first()
    selected_plan_name = None
    selected_plan_details = None
    
    if selected_scen:
        selected_plan_name = selected_scen.plan_name
        selected_plan_details = {
            "name": "Default Plan" if selected_scen.plan_name == "plan_a" else ("Aggressive Plan" if selected_scen.plan_name == "plan_b" else "Minimal Plan"),
            "officers": selected_scen.officers_count,
            "tow_trucks": selected_scen.tow_trucks_count,
            "diversion": selected_scen.diversion_route,
            "clearance_time": selected_scen.clearance_time
        }
    
    return {
        "event_id": event.event_id,
        "cause": event.cause,
        "latitude": event.latitude,
        "longitude": event.longitude,
        "datetime": event.start_datetime.strftime("%Y-%m-%dT%H:%M"),
        "road_closure": event.road_closure,
        "police_station": event.police_station,
        "corridor": event.corridor,
        "description": event.description,
        "status": event.status,
        "impact_level": impact_level,
        "confidence": confidence,
        "probabilities": probs,
        "selected_plan": selected_plan_name,
        "deployed_plan_details": selected_plan_details,
        "deployment": {
            "officers": officers_list,
            "tow_trucks": tow_trucks_list,
            "diversion": diversion,
            "clearance_time": clearance,
            "send_alert": send_alert
        },
        "impact": citizen_impact
    }

@app.post("/api/events/{event_id}/revoke")
def revoke_event_plan_endpoint(event_id: str, db: Session = Depends(get_db)):
    """
    POST /api/events/{event_id}/revoke
    Revokes the currently active deployment plan by setting all scenarios selected to False.
    """
    scenarios = db.query(Scenario).filter(Scenario.event_id == event_id).all()
    if not scenarios:
        raise HTTPException(status_code=404, detail="No scenarios found for this event")
        
    for s in scenarios:
        s.selected = False
        
    db.commit()
    return {"status": "success", "message": "Plan revoked successfully"}

@app.delete("/api/events/{event_id}")
def delete_event_endpoint(event_id: str, db: Session = Depends(get_db)):
    """
    DELETE /api/events/{event_id}
    Deletes the event and all cascade dependent records.
    """
    event = db.query(Event).filter(Event.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
        
    db.delete(event)
    db.commit()
    return {"status": "success", "message": f"Event {event_id} deleted successfully"}

