import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String, unique=True, index=True, nullable=False)
    cause = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    police_station = Column(String, nullable=False)
    corridor = Column(String, nullable=True)
    start_datetime = Column(DateTime, nullable=False)
    closed_datetime = Column(DateTime, nullable=True)
    road_closure = Column(Boolean, default=False)
    description = Column(String, nullable=True)
    status = Column(String, default="active")  # active, resolved, closed
    predicted_impact = Column(String, nullable=True)  # HIGH, MEDIUM, LOW
    confidence = Column(Float, nullable=True)
    actual_impact = Column(String, nullable=True)  # HIGH, MEDIUM, LOW
    resolution_time = Column(Integer, nullable=True)  # in minutes
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    predictions = relationship("Prediction", back_populates="event", cascade="all, delete-orphan")
    cascade_simulations = relationship("CascadeSimulation", back_populates="event", cascade="all, delete-orphan")
    scenarios = relationship("Scenario", back_populates="event", cascade="all, delete-orphan")
    lessons = relationship("Lesson", back_populates="event", cascade="all, delete-orphan")

class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String, ForeignKey("events.event_id", ondelete="CASCADE"), nullable=False)
    impact_level = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    probability_low = Column(Float, nullable=True)
    probability_medium = Column(Float, nullable=True)
    probability_high = Column(Float, nullable=True)
    officers_count = Column(Integer, nullable=True)
    tow_trucks_count = Column(Integer, nullable=True)
    diversion_route = Column(String, nullable=True)
    clearance_time = Column(String, nullable=True)
    send_alert = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    event = relationship("Event", back_populates="predictions")

class CascadeSimulation(Base):
    __tablename__ = "cascade_simulations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String, ForeignKey("events.event_id", ondelete="CASCADE"), nullable=False)
    time_step = Column(String, nullable=False)  # t+0, t+15, t+30, t+45, t+60
    affected_junctions = Column(String, nullable=True)  # JSON array string
    affected_police_stations = Column(String, nullable=True)  # JSON array string
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    event = relationship("Event", back_populates="cascade_simulations")

class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(Integer, primary_key=True, autoincrement=True)
    event_id = Column(String, ForeignKey("events.event_id", ondelete="CASCADE"), nullable=False)
    plan_name = Column(String, nullable=False)  # plan_a, plan_b, plan_c
    officers_count = Column(Integer, nullable=True)
    tow_trucks_count = Column(Integer, nullable=True)
    diversion_route = Column(String, nullable=True)
    clearance_time = Column(String, nullable=True)
    commuters_affected = Column(Integer, nullable=True)
    economic_loss = Column(Integer, nullable=True)
    emergency_risk = Column(Integer, nullable=True)
    selected = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    event = relationship("Event", back_populates="scenarios")

class Lesson(Base):
    __tablename__ = "lessons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False)
    event_id = Column(String, ForeignKey("events.event_id", ondelete="CASCADE"), nullable=True)
    status = Column(String, default="In Progress")  # In Progress, Applied
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    event = relationship("Event", back_populates="lessons")

class ModelMetric(Base):
    __tablename__ = "model_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    accuracy = Column(Float, nullable=False)
    precision_score = Column(Float, nullable=True)
    recall_score = Column(Float, nullable=True)
    f1_score = Column(Float, nullable=True)
    train_size = Column(Integer, nullable=True)
    test_size = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
