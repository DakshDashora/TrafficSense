import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, 
  Pause, 
  MapPin, 
  Navigation, 
  ShieldAlert, 
  ArrowLeft,
  Clock
} from 'lucide-react';
import { useTraffic } from '../context/TrafficContext';
import './CascadeMap.css';

const timeStepDescriptions = {
  't+0': 'Initial incident occurs. Immediate delay begins accumulating at the source junction.',
  't+15': 'Congestion starts propagating to immediate neighboring junctions. Backlog grows.',
  't+30': 'Peak congestion wave. Secondary gridlocks detected at adjacent critical junctions.',
  't+45': 'First responders and diversion plans active. Spillover congestion starts stabilizing.',
  't+60': 'Dispatches clearing the bottleneck. Congestion dissipating back to normal flow.'
};

export default function CascadeMap() {
  const navigate = useNavigate();
  const { currentEvent, currentCascade, fetchCascade } = useTraffic();
  const [timeStep, setTimeStep] = useState('t+0');
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);

  const mapRef = useRef(null);
  const junctionsLayerGroupRef = useRef(null);
  const routeLayerGroupRef = useRef(null);

  // If no cascade is loaded, try to load it from the current event, or navigate away
  useEffect(() => {
    if (!currentCascade && currentEvent) {
      fetchCascade(currentEvent.latitude, currentEvent.longitude, currentEvent.impact_level);
    }
  }, [currentEvent, currentCascade]);

  // Map Initialization
  useEffect(() => {
    const initMap = () => {
      if (window.L && !mapRef.current && currentEvent) {
        const { latitude, longitude } = currentEvent;
        
        const map = window.L.map('cascade-map-view').setView([latitude, longitude], 13);
        mapRef.current = map;

        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(map);

        // Create Layer Groups for junctions and route
        junctionsLayerGroupRef.current = window.L.layerGroup().addTo(map);
        routeLayerGroupRef.current = window.L.layerGroup().addTo(map);

        // Add custom Pulsing marker at event location
        const pulsingIcon = window.L.divIcon({
          className: 'pulsing-marker-wrapper',
          html: '<div class="pulsing-marker-core"></div><div class="pulsing-marker-ring"></div>',
          iconSize: [30, 30]
        });

        window.L.marker([latitude, longitude], { icon: pulsingIcon })
          .addTo(map)
          .bindPopup(`<strong>Incident Spot</strong><br/>Cause: ${currentEvent.cause.replace('_', ' ')}`)
          .openPopup();
      }
    };

    const interval = setInterval(() => {
      if (window.L && currentEvent) {
        clearInterval(interval);
        initMap();
      }
    }, 100);

    return () => clearInterval(interval);
  }, [currentEvent]);

  // Redraw Junctions when timeStep or currentCascade changes
  useEffect(() => {
    if (mapRef.current && currentCascade && junctionsLayerGroupRef.current) {
      const junctionsGroup = junctionsLayerGroupRef.current;
      junctionsGroup.clearLayers();

      const stepData = currentCascade.time_steps[timeStep];
      if (stepData && stepData.junctions) {
        stepData.junctions.forEach((j) => {
          // Color based on congestion
          let color = '#10b981'; // Green (No/Low congestion)
          if (j.congestion > 80.0) {
            color = '#ef4444'; // Red (High)
          } else if (j.congestion > 50.0) {
            color = '#f59e0b'; // Orange (Medium)
          } else if (j.congestion > 20.0) {
            color = '#eab308'; // Yellow (Low)
          }

          // Size based on congestion
          const radius = 10 + (j.congestion * 0.15);

          // Calculate travel delay minutes based on congestion score
          const travelDelay = j.congestion > 20.0 ? Math.round((j.congestion - 20) * 0.3) + 1 : 0;

          const marker = window.L.circleMarker([j.lat, j.lon], {
            radius: radius,
            fillColor: color,
            color: '#ffffff',
            weight: 2,
            fillOpacity: 0.85
          });

          marker.bindPopup(`
            <div class="leaflet-popup-custom">
              <h4>${j.name} Junction</h4>
              <p>Congestion Index: <strong>${j.congestion}%</strong></p>
              <p>Travel Delay: <strong style="color: ${j.congestion > 50.0 ? '#ef4444' : '#eab308'};">${travelDelay > 0 ? `+${travelDelay} mins` : 'Free Flow (0 mins)'}</strong></p>
              <p>Routing Status: <span style="color: ${color}; font-weight: bold;">
                ${j.congestion > 50.0 ? 'CONGESTED' : 'CLEAR'}
              </span></p>
            </div>
          `);

          marker.addTo(junctionsGroup);
        });
      }
    }
  }, [currentCascade, timeStep]);

  // Draw diversion route green dotted line
  useEffect(() => {
    if (mapRef.current && currentCascade && routeLayerGroupRef.current) {
      const routeGroup = routeLayerGroupRef.current;
      routeGroup.clearLayers();

      const junctions = currentCascade.time_steps['t+0'].junctions;
      
      // Filter out event node and take top clear neighbors coordinates to represent alternate path
      const clearJunctions = junctions
        .filter(j => j.congestion < 45.0)
        .slice(0, 4); // Take some clear nodes to draw diversion path
        
      if (clearJunctions.length >= 2) {
        const latlngs = clearJunctions.map(j => [j.lat, j.lon]);
        
        window.L.polyline(latlngs, {
          color: '#10b981', // green diversion route
          weight: 4,
          dashArray: '6, 12',
          lineCap: 'round',
          opacity: 0.9
        }).addTo(routeGroup);
      }
    }
  }, [currentCascade]);

  // Auto-play control loop
  useEffect(() => {
    if (isPlaying) {
      const steps = ['t+0', 't+15', 't+30', 't+45', 't+60'];
      playIntervalRef.current = setInterval(() => {
        setTimeStep((prevStep) => {
          const currentIndex = steps.indexOf(prevStep);
          const nextIndex = (currentIndex + 1) % steps.length;
          return steps[nextIndex];
        });
      }, 2000);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying]);

  if (!currentEvent || !currentCascade) {
    return (
      <div className="card no-event-card flex-center flex-column animate-fade-in">
        <MapPin size={48} className="no-event-icon" />
        <h3>Map Initialization Pending</h3>
        <p>Report an event to view full cascading congestion spread maps.</p>
        <button className="btn btn-primary" onClick={() => navigate('/event')}>
          Report New Event
        </button>
      </div>
    );
  }

  const stepsList = ['t+0', 't+15', 't+30', 't+45', 't+60'];

  return (
    <div className="cascade-container animate-fade-in">
      {/* Map display */}
      <div className="map-view-wrapper">
        <div id="cascade-map-view" className="full-screen-map"></div>
        
        {/* Floating Back button */}
        <button className="btn btn-secondary map-back-btn flex-center gap-10" onClick={() => navigate('/prediction')}>
          <ArrowLeft size={16} /> Back to Prediction
        </button>

        {/* Floating Legend */}
        <div className="map-legend card">
          <h4 className="legend-title">Congestion Index</h4>
          <div className="legend-item">
            <span className="legend-color color-red"></span>
            <span>Critical (&gt;80%)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color color-orange"></span>
            <span>High (50-80%)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color color-yellow"></span>
            <span>Moderate (20-50%)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color color-green"></span>
            <span>Free Flow (&lt;20%)</span>
          </div>
        </div>

        {/* Floating left information panel */}
        <div className="map-info-panel card">
          <div className="info-header">
            <span className="badge badge-danger">Digital Twin Wave Sim</span>
            <h4>Cascading Impact</h4>
          </div>
          
          <div className="info-body">
            <div className="info-section explanation-section">
              <p className="explanation-text">
                This simulation models how congestion propagates outward along the road network over time. It allows you to predict secondary gridlocks at adjacent junctions before they occur, enabling proactive route diversions.
              </p>
            </div>

            <div className="info-section">
              <span className="info-section-label">Incident details</span>
              <p className="info-section-text text-capitalize">
                <strong>{currentEvent.cause.replace('_', ' ')}</strong> near {currentEvent.police_station} station area.
              </p>
            </div>
            
            <div className="info-section">
              <span className="info-section-label"><ShieldAlert size={14} style={{ marginRight: '4px' }} /> Affected police jurisdictions</span>
              <ul className="affected-stations-list">
                {currentCascade.affected_police_stations?.map((station) => (
                  <li key={station}>{station} Precinct</li>
                ))}
              </ul>
            </div>

            <div className="info-section">
              <span className="info-section-label"><Navigation size={14} style={{ marginRight: '4px' }} /> Dynamic rerouting</span>
              <p className="info-section-text diversion-text">
                {currentCascade.diversion_route}
              </p>
            </div>

            <div className="info-section timeline-info-section">
              <span className="info-section-label"><Clock size={14} style={{ marginRight: '4px' }} /> Phase status ({timeStep.toUpperCase()})</span>
              <p className="info-section-text phase-text">
                {timeStepDescriptions[timeStep]}
              </p>
            </div>
          </div>
        </div>

        {/* Floating time slider controls at bottom */}
        <div className="map-controls-panel card">
          <div className="timeline-hint">
            <Clock size={12} className="hint-clock-icon" />
            <span><strong>{timeStep.toUpperCase()} Phase:</strong> {timeStepDescriptions[timeStep]}</span>
          </div>
          <div className="controls-row flex-between">
            <button 
              className="btn btn-primary play-btn flex-center"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </button>
            
            <div className="time-steps-selector">
              {stepsList.map((step) => (
                <button
                  key={step}
                  className={`time-step-button ${timeStep === step ? 'active' : ''}`}
                  onClick={() => {
                    setTimeStep(step);
                    setIsPlaying(false);
                  }}
                >
                  {step.toUpperCase()}
                  <span className="step-minutes">
                    {step === 't+0' ? 'Start' : `+${step.slice(2)} min`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
