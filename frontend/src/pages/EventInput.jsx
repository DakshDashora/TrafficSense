import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, BrainCircuit, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { useTraffic } from '../context/TrafficContext';
import './EventInput.css';

const POLICE_STATIONS = {
  "Madiwala": [12.9226, 77.6219],
  "Bellandur": [12.9304, 77.6784],
  "HSR Layout": [12.9116, 77.6388],
  "Electronic City": [12.8485, 77.6769],
  "Shivajinagar": [12.9857, 77.5978],
  "Koramangala": [12.9352, 77.6244],
  "Whitefield": [12.9698, 77.7500],
  "Hebbal": [13.0359, 77.5978],
  "Majestic": [12.9779, 77.5724],
  "Indiranagar": [12.9719, 77.6412]
};

const CAUSES = [
  { value: "vehicle_breakdown", label: "Vehicle Breakdown" },
  { value: "accident", label: "Accident" },
  { value: "water_logging", label: "Water Logging" },
  { value: "tree_fall", label: "Tree Fall" },
  { value: "public_event", label: "Public Event" },
  { value: "others", label: "Others" }
];

export default function EventInput() {
  const navigate = useNavigate();
  const { setEventData } = useTraffic();
  
  const [cause, setCause] = useState("vehicle_breakdown");
  const [policeStation, setPoliceStation] = useState("Madiwala");
  const [corridor, setCorridor] = useState("ORR East 1");
  const [eventTime, setEventTime] = useState("");
  const [roadClosure, setRoadClosure] = useState(false);
  const [description, setDescription] = useState("");
  
  const [lat, setLat] = useState("12.922600");
  const [lon, setLon] = useState("77.621900");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  // Set default datetime to local current time formatted for input type="datetime-local"
  useEffect(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    setEventTime(now.toISOString().slice(0, 16));
  }, []);

  // Initialize Map
  useEffect(() => {
    const initMap = () => {
      if (window.L && !mapRef.current) {
        // Fix default marker icon asset paths for Vite compatibility
        delete window.L.Icon.Default.prototype._getIconUrl;
        window.L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const map = window.L.map('map-picker').setView([12.9226, 77.6219], 13);
        
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        // Initial marker
        const marker = window.L.marker([12.9226, 77.6219], { draggable: true }).addTo(map);
        markerRef.current = marker;

        // Handle marker drag
        marker.on('dragend', () => {
          const position = marker.getLatLng();
          setLat(position.lat.toFixed(6));
          setLon(position.lng.toFixed(6));
        });

        // Handle map click
        map.on('click', (e) => {
          const { lat, lng } = e.latlng;
          setLat(lat.toFixed(6));
          setLon(lng.toFixed(6));
          marker.setLatLng(e.latlng);
        });

        mapRef.current = map;
      }
    };

    const interval = setInterval(() => {
      if (window.L) {
        clearInterval(interval);
        initMap();
      }
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Update map coordinates on Police Station selection change
  const handleStationChange = (stationName) => {
    setPoliceStation(stationName);
    const coords = POLICE_STATIONS[stationName];
    if (coords) {
      setLat(coords[0].toFixed(6));
      setLon(coords[1].toFixed(6));
      
      if (mapRef.current && markerRef.current) {
        mapRef.current.setView(coords, 14);
        markerRef.current.setLatLng(coords);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cause || !policeStation || !lat || !lon || !eventTime) {
      setError("Please fill in all required fields and pick a location on the map.");
      return;
    }

    setLoading(true);
    setError(null);

    const eventPayload = {
      cause,
      latitude: parseFloat(lat),
      longitude: parseFloat(lon),
      datetime: new Date(eventTime).toISOString(),
      road_closure: roadClosure,
      police_station: policeStation,
      corridor,
      description
    };

    try {
      const predRes = await api.predictImpact(eventPayload);
      
      // Store in Context
      setEventData({
        ...predRes,
        cause,
        latitude: eventPayload.latitude,
        longitude: eventPayload.longitude,
        datetime: eventTime,
        road_closure: roadClosure,
        police_station: policeStation,
        corridor,
        description
      });

      // Redirect to Predictions page
      navigate('/prediction');
    } catch (err) {
      console.error("Error predicting event impact:", err);
      setError(err.message || "Failed to analyze incident congestion impact.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="event-input-container animate-fade-in">
      <header className="page-header">
        <h2 className="page-title">Report New Traffic Event</h2>
        <p className="page-subtitle">Input incident parameters to simulate cascading congestion and deploy response</p>
      </header>

      {error && (
        <div className="error-banner flex-between">
          <div className="flex-center gap-10">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      <div className="event-layout grid-2">
        {/* Form panel */}
        <div className="card form-panel">
          <h3 className="panel-title">Event Parameters</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label">Event Cause *</label>
                <select 
                  className="form-control"
                  value={cause}
                  onChange={(e) => setCause(e.target.value)}
                >
                  {CAUSES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group flex-1">
                <label className="form-label">Jurisdictional Police Station *</label>
                <select 
                  className="form-control"
                  value={policeStation}
                  onChange={(e) => handleStationChange(e.target.value)}
                >
                  {Object.keys(POLICE_STATIONS).map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label className="form-label">Traffic Corridor Name</label>
                <input 
                  type="text"
                  className="form-control"
                  placeholder="e.g. Outer Ring Road, Hosur Road"
                  value={corridor}
                  onChange={(e) => setCorridor(e.target.value)}
                />
              </div>

              <div className="form-group flex-1">
                <label className="form-label">Start Date/Time *</label>
                <input 
                  type="datetime-local"
                  className="form-control"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group closure-checkbox-wrapper">
              <label className="checkbox-container">
                <input 
                  type="checkbox"
                  checked={roadClosure}
                  onChange={(e) => setRoadClosure(e.target.checked)}
                />
                <span className="checkmark"></span>
                <span className="checkbox-label">Requires Complete Road Closure / Diverting Traffic</span>
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Incident Details / Description</label>
              <textarea 
                className="form-control"
                rows="3"
                placeholder="e.g. Multi-car collision blocking central and left lanes on main flyover..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary btn-submit flex-center gap-10"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="btn-spinner"></div>
                  Analyzing Congestion Cascade...
                </>
              ) : (
                <>
                  <BrainCircuit size={18} />
                  Predict Traffic Impact
                </>
              )}
            </button>
          </form>
        </div>

        {/* Map Location panel */}
        <div className="card map-panel">
          <div className="map-header">
            <h3 className="panel-title">Pinpoint Incident Location</h3>
            <p className="panel-subtitle">Click map or drag the marker to adjust coordinates</p>
          </div>
          
          <div id="map-picker" className="leaflet-picker-container"></div>
          
          <div className="coords-display flex-between">
            <div className="coord-box">
              <span className="coord-label">Latitude</span>
              <span className="coord-value"><MapPin size={14} className="coord-icon" /> {lat}</span>
            </div>
            <div className="coord-box">
              <span className="coord-label">Longitude</span>
              <span className="coord-value"><MapPin size={14} className="coord-icon" /> {lon}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
