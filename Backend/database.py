import os
import re
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Load environment variables from .env file relative to this file's folder
current_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(current_dir, ".env")
load_dotenv(dotenv_path=dotenv_path)

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
if SQLALCHEMY_DATABASE_URL:
    # Strip any enclosing quotes or whitespace from the environment variable
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.strip("'\"").strip()

if not SQLALCHEMY_DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = "sqlite:///./traffic_sense.db"
else:
    # Rewrite postgresql: or postgres: to postgresql+psycopg: for psycopg v3 compatibility
    SQLALCHEMY_DATABASE_URL = re.sub(r"^postgres(ql)?:", "postgresql+psycopg:", SQLALCHEMY_DATABASE_URL)

# connect_args={"check_same_thread": False} is required only for SQLite
connect_args = {}
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    connect_args = {"check_same_thread": False}

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args=connect_args,
    echo=True,
    pool_pre_ping=True,
    pool_recycle=1800
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
