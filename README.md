# TrafficSense 🚦

**TrafficSense** is an Event-Driven Traffic Congestion Management System for Bengaluru city. It leverages historical incident reports to forecast localized traffic impacts and suggests optimal enforcement resources (manpower, barricades, towing trucks, wheel clamps) and route diversion plans. It also features a post-event autopsy log with feedback loops and a citizen impact metrics dashboard.

---

## Technical Stack
- **Backend**: FastAPI + SQLite + SQLAlchemy ORM + Pydantic + scikit-learn
- **Frontend**: React (Vite, React Router DOM, native Fetch API)
- **Styling**: Plain CSS (Dark theme accent-oriented, fully responsive)

---

## Getting Started

### 1. Backend Setup

The backend manages the SQLite database, handles ML training, and exposes the REST APIs.

1. Navigate to the `Backend` directory:
   ```bash
   cd Backend
   ```

2. Activate the `uv` virtual environment or install dependencies:
   ```bash
   uv sync
   # OR: .venv\Scripts\pip install -r requirements.txt
   ```

3. Run the FastAPI backend:
   ```bash
   .venv\Scripts\python -m uvicorn main:app --reload --port 8000
   ```

> [!NOTE]
> **Automatic Seeding & ML Training**:
> On first startup, the lifespan hook will automatically download the 8,205-row anonymized traffic incident dataset from the public URL, clean the records, compute derived congestion severities, bulk-insert them into `traffic_sense.db`, and train two **scikit-learn Random Forest regression models** (saved as local `.joblib` files). Subsequent launches skip the seeding and quickly load the cached configuration.

---

### 2. Frontend Setup

The frontend provides the graphical user interface.

1. Navigate to the `frontend` directory:
   ```bash
   cd ../frontend
   ```

2. Run the development server (already configured with Vite):
   ```bash
   npm run dev
   # OR: npm start (if mapped)
   ```

3. Open your browser and navigate to the output address (typically `http://localhost:5173`).

---

## Application Layout (5 Modules)

1. **Events (`/events`)**: Feed of all logged incidents with advanced filters and a manual event creation form.
2. **Predictions (`/predictions`)**: Grid of severity forecast cards detailing peak congestion windows, cascade risks, and comparing rule-based metrics with ML forecasts.
3. **Simulator (`/simulator`)**: "What-If" planning dashboard which calculates necessary enforcement deployments (officers, barricades) and suggestions.
4. **Autopsy (`/autopsy`)**: Post-event enforcement feedback log to measure prediction accuracy and capture lessons.
5. **Impact (`/impact`)**: Aggregated metrics dashboard rendering city productivity loss models and dynamic SVG charts.
