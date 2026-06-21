# TrafficSense 🚦

**TrafficSense** is an Event-Driven Traffic Congestion Management Digital Twin for Bengaluru city. It leverages historical incident reports to forecast localized traffic impacts, recommends optimal resource dispatches (officers, tow trucks), runs "What-If" planning simulations, and maps wave-like congestion cascades across adjacent road networks. It also features a self-learning autopsy loop that automatically refines prediction models based on resolved operational feedback.

---

## Technical Stack
- **Backend**: FastAPI + SQLAlchemy ORM + scikit-learn + pandas + networkx + python-dotenv
- **Frontend**: React 18 + Vite + Leaflet Maps + Recharts (SVG Charts) + Lucide Icons
- **Styling**: Vanilla CSS (glassmorphic theme, responsive dashboard layouts)

---

## Installation & Setup

### 1. Backend Setup

The backend handles database transactions, ML training/inference, and exposes the REST APIs.

#### Prerequisites
- Python 3.10 or higher
- [uv](https://github.com/astral-sh/uv) (Recommended fast package manager) or standard `pip`

#### Steps
1. Navigate to the `Backend` directory:
   ```bash
   cd Backend
   ```

2. Install dependencies:
   * **Using `uv` (Recommended)**:
     ```bash
     uv sync
     ```
   * **Using standard `pip`**:
     ```bash
     python -m venv .venv
     .venv\Scripts\activate   # On Windows (PowerShell/CMD)
     source .venv/bin/activate # On Unix/macOS
     pip install -r requirements.txt
     ```

3. Configure Environment Variables:
   Create a `.env` file inside the `Backend` folder (copying from `.env.example`):
   ```ini
   DATABASE_URL="your-database-connection-url"
   FRONTEND_URL="http://localhost:5173"
   ```
   *See [Environment Variables](#environment-variables) below for details on how to set these.*

4. Run the FastAPI server:
   * **Using `uv`**:
     ```bash
     uv run uvicorn app:app --reload --port 8000
     ```
   * **Using virtual environment**:
     ```bash
     uvicorn app:app --reload --port 8000
     ```

> [!NOTE]
> **Bootstrapping & ML Training (No DB Bloat)**:
> Upon the first startup, the backend automatically checks if the 100MB historical incident dataset is cached locally on disk (`Backend/data/raw/astram_data.csv`). If missing, it downloads it.
> The backend **does not** seed these 8,000+ historical rows into the SQL database to avoid network latency. Instead, it reads the CSV dataset directly in-memory, combines it with any custom resolved events in the database, fits the Random Forest classifier, and saves it locally as `models/classifier.pkl`.

---

### 2. Frontend Setup

The frontend provides the graphical user interface.

#### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

#### Steps
1. Navigate to the `frontend` directory:
   ```bash
   cd ../frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Environment Variables:
   Create a `.env` file inside the `frontend` folder:
   ```ini
   VITE_API_URL=http://localhost:8000
   ```

4. Start the Vite development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to `http://localhost:5173`.

---

## Environment Variables

### Backend Configuration (`Backend/.env`)

| Variable | Description | Where to Get it / Default |
|---|---|---|
| `DATABASE_URL` | The connection string for the database. | **Local Development**: Leave blank or omit it. The application will automatically default to a local SQLite file (`sqlite:///./traffic_sense.db`). <br><br>**Production / Cloud PostgreSQL**: Enter your connection string (e.g. from Neon). Format: `postgresql://user:password@host/dbname?sslmode=require`. The app automatically maps this to the correct PostgreSQL driver. |
| `FRONTEND_URL` | Used to restrict CORS middleware access. | Set this to your running frontend client URL (e.g., `http://localhost:5173`). You can provide multiple URLs separated by commas. Leave blank or omit to allow any origin (`*`). |

### Frontend Configuration (`frontend/.env`)

| Variable | Description | Value |
|---|---|---|
| `VITE_API_URL` | The URL endpoint of the running FastAPI backend server. | Defaults to `http://localhost:8000`. Update this when deploying the backend to production. |

---

## Application Modules

1. **Operator Guide (`/`)**: Interactive onboarding guide outlining the digital twin event lifecycle (Report $\rightarrow$ Forecast $\rightarrow$ Simulate $\rightarrow$ Monitor $\rightarrow$ Resolve).
2. **Dashboard (`/dashboard`)**: Operations Control Center rendering stats cards (Active Events, Accuracy, Deltas), dynamic trend indicators, and the live incident feed.
3. **Report Event (`/event`)**: Incident logger combining details forms with a Leaflet map coordinate picker.
4. **Predictions (`/prediction`)**: Detailed view displaying AI severity classification, circular confidence gauge, dispatches, and citizen economic loss formulas.
5. **Simulator (`/simulator`)**: "What-If" planning dashboard comparing Default, Aggressive, Minimal, and Custom resource allocations side-by-side.
6. **Cascade Map (`/cascade`)**: Full-screen junction graph mapping congestion wave propagation over time steps $t+0$ to $t+60$.
7. **Autopsy & Self-Learning (`/learning`)**: AI feedback loop showing model accuracy history, lessons learned, and resolving metrics.
