import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  Map, 
  Sliders, 
  CheckCircle, 
  Info, 
  MessageSquare, 
  Users, 
  Clock, 
  IndianRupee, 
  ShieldAlert 
} from 'lucide-react';
import { useTraffic } from '../context/TrafficContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import Modal from '../components/Modal';
import './Prediction.css';

export default function Prediction() {
  const navigate = useNavigate();
  const { currentEvent, fetchCascade, fetchScenarios } = useTraffic();
  const { showToast } = useToast();

  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actualImpact, setActualImpact] = useState('MEDIUM');
  const [resolutionTime, setResolutionTime] = useState(30);
  const [resolving, setResolving] = useState(false);

  if (!currentEvent) {
    return (
      <div className="card no-event-card flex-center flex-column animate-fade-in">
        <AlertTriangle size={48} className="no-event-icon" />
        <h3>No Event Data Loaded</h3>
        <p>Report an incident first to generate ML predictions and deployment recommendation.</p>
        <button className="btn btn-primary" onClick={() => navigate('/event')}>
          Report New Event
        </button>
      </div>
    );
  }

  const {
    event_id,
    cause,
    latitude,
    longitude,
    police_station,
    corridor,
    datetime,
    road_closure,
    description,
    impact_level,
    confidence,
    probabilities = { LOW: 0, MEDIUM: 0, HIGH: 0 },
    deployment = {},
    impact = {}
  } = currentEvent;

  // Handle routing buttons
  const handleViewCascade = async () => {
    try {
      await fetchCascade(latitude, longitude, impact_level);
      navigate('/cascade');
    } catch (err) {
      console.error(err);
    }
  };

  const handleTrySimulator = async () => {
    try {
      await fetchScenarios({
        cause,
        latitude,
        longitude,
        datetime: new Date().toISOString(),
        police_station,
        event_id: event_id
      });
      navigate('/simulator');
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirmDeploy = async () => {
    try {
      // 1. Initialize scenarios in DB for this event
      await fetchScenarios({
        cause,
        latitude,
        longitude,
        datetime: datetime || new Date().toISOString(),
        police_station,
        event_id: event_id
      });
      // 2. Select default plan_a as active deployed plan in DB
      await api.selectPlan(event_id, 'plan_a');
      
      showToast(`Resource deployment confirmed (Default Plan) for event ${event_id}. Alerts dispatched to emergency teams and commuters!`, 'success');
      navigate('/dashboard');
    } catch (err) {
      console.error("Error deploying default plan:", err);
      showToast("Failed to confirm deployment.", 'error');
    }
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    setResolving(true);
    try {
      await api.resolveEvent(event_id, {
        actual_impact: actualImpact,
        resolution_time: parseInt(resolutionTime)
      });
      showToast(`Event ${event_id} resolved! Model has auto-retrained on new autopsy parameters.`, 'success');
      navigate('/learning');
    } catch (err) {
      console.error(err);
      showToast("Failed to resolve event.", 'error');
    } finally {
      setResolving(false);
      setShowResolveModal(false);
    }
  };

  const handleDeleteIncident = () => {
    setShowDeleteConfirm(true);
  };

  const executeDeleteIncident = async () => {
    try {
      await api.deleteEvent(event_id);
      showToast(`Incident ${event_id} has been deleted.`, 'success');
      navigate('/dashboard');
    } catch (err) {
      console.error("Error deleting incident:", err);
      showToast("Failed to delete incident.", 'error');
    }
  };

  const getImpactColor = (level) => {
    if (level === 'HIGH') return '#ef4444';
    if (level === 'MEDIUM') return '#f59e0b';
    return '#10b981';
  };

  const getImpactBadgeClass = (level) => {
    if (level === 'HIGH') return 'badge-danger';
    if (level === 'MEDIUM') return 'badge-warning';
    return 'badge-success';
  };

  // SVGs circular confidence gauge
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (confidence / 100) * circumference;

  return (
    <div className="prediction-container animate-fade-in">
      <header className="page-header flex-between">
        <div>
          <h2 className="page-title">Prediction & Recommendation</h2>
          <p className="page-subtitle">Analysis results for incident ID: <span className="event-id-highlight">{event_id}</span></p>
        </div>
        <div className="event-type-badge">
          <span>{cause.replace('_', ' ').toUpperCase()}</span>
        </div>
      </header>

      {/* Grid: Left (Impact Level & Gauge) + Right (Citizen Impact) */}
      <div className="grid-2 top-prediction-row">
        {/* Severity analysis card */}
        <div className="card impact-analysis-card">
          <h3 className="card-sec-title flex-center gap-10">
            <Info size={18} /> Severity Assessment
          </h3>
          
          <div className="impact-gauge-row">
            {/* Left circular gauge */}
            <div className="circular-gauge-wrapper">
              <svg width="120" height="120" className="circular-gauge-svg">
                <circle 
                  cx="60" 
                  cy="60" 
                  r={radius} 
                  className="gauge-bg-circle" 
                />
                <circle 
                  cx="60" 
                  cy="60" 
                  r={radius} 
                  className="gauge-fill-circle"
                  style={{
                    strokeDasharray: circumference,
                    strokeDashoffset: strokeDashoffset,
                    stroke: getImpactColor(impact_level)
                  }}
                />
              </svg>
              <div className="gauge-text">
                <span className="gauge-number">{Math.round(confidence)}%</span>
                <span className="gauge-label">Confidence</span>
              </div>
            </div>

            {/* Severity level */}
            <div className="severity-badge-details">
              <span className={`badge large-badge ${getImpactBadgeClass(impact_level)}`}>
                {impact_level} IMPACT
              </span>
              <p className="explanation-text">
                This event has an <strong>{confidence}%</strong> chance of causing {impact_level.toLowerCase()} level traffic congestion.
              </p>
            </div>
          </div>

          {/* Probability Bars */}
          <div className="probability-bars-section">
            <div className="prob-bar-group">
              <div className="flex-between prob-bar-labels">
                <span>LOW Impact Probability</span>
                <span>{probabilities.LOW || 0}%</span>
              </div>
              <div className="prob-bar-track">
                <div className="prob-bar-fill fill-low" style={{ width: `${probabilities.LOW || 0}%` }}></div>
              </div>
            </div>

            <div className="prob-bar-group">
              <div className="flex-between prob-bar-labels">
                <span>MEDIUM Impact Probability</span>
                <span>{probabilities.MEDIUM || 0}%</span>
              </div>
              <div className="prob-bar-track">
                <div className="prob-bar-fill fill-medium" style={{ width: `${probabilities.MEDIUM || 0}%` }}></div>
              </div>
            </div>

            <div className="prob-bar-group">
              <div className="flex-between prob-bar-labels">
                <span>HIGH Impact Probability</span>
                <span>{probabilities.HIGH || 0}%</span>
              </div>
              <div className="prob-bar-track">
                <div className="prob-bar-fill fill-high" style={{ width: `${probabilities.HIGH || 0}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Citizen impact metrics */}
        <div className="card citizen-impact-card">
          <h3 className="card-sec-title">Commuter & Economic Impact</h3>
          
          <div className="impact-metrics-grid">
            <div className="impact-metric-box">
              <Users className="metric-icon icon-blue" size={24} />
              <div className="metric-details">
                <span className="metric-val">{impact.commuters_affected?.toLocaleString()}</span>
                <span className="metric-lbl">Commuters Affected</span>
              </div>
            </div>

            <div className="impact-metric-box">
              <Clock className="metric-icon icon-yellow" size={24} />
              <div className="metric-details">
                <span className="metric-val">+{impact.delay_minutes} min</span>
                <span className="metric-lbl">Commuter Delay</span>
              </div>
            </div>

            <div className="impact-metric-box">
              <IndianRupee className="metric-icon icon-red" size={24} />
              <div className="metric-details">
                <span className="metric-val">₹{(impact.economic_loss / 100000).toFixed(2)} Lakh</span>
                <span className="metric-lbl">Economic Cost</span>
              </div>
            </div>

            <div className="impact-metric-box">
              <ShieldAlert className="metric-icon icon-danger" size={24} />
              <div className="metric-details">
                <span className="metric-val">+{impact.emergency_risk} min</span>
                <span className="metric-lbl">Emergency Response Risk</span>
              </div>
            </div>
          </div>

          <div className="closure-alert-box">
            <span className="alert-badge">Status</span>
            <p className="alert-text">
              {road_closure 
                ? "Warning: Incident requires COMPLETE road closure. Diverting all heavy vehicles." 
                : "Active lane block reported. Standard flow control rules apply."}
            </p>
          </div>
        </div>
      </div>

      {/* Deployment Plan Section */}
      <div className="card deployment-plan-card">
        <h3 className="card-sec-title">Recommended Resource Deployment Plan</h3>
        
        <div className="table-responsive">
          <table className="table borderless-table">
            <tbody>
              <tr>
                <td className="deployment-label">Police Officers Dispatch</td>
                <td className="deployment-value">
                  {deployment.officers && deployment.officers.length > 0 ? (
                    <div className="resource-list">
                      {deployment.officers.map((off, index) => (
                        <div key={index} className="resource-tag">
                          <strong>{off.count} officers</strong> from {off.station} Station ({off.distance} km)
                        </div>
                      ))}
                    </div>
                  ) : "No officers recommended"}
                </td>
              </tr>
              <tr>
                <td className="deployment-label">Towing Trucks Dispatch</td>
                <td className="deployment-value">
                  {deployment.tow_trucks && deployment.tow_trucks.length > 0 ? (
                    <div className="resource-list">
                      {deployment.tow_trucks.map((t, index) => (
                        <div key={index} className="resource-tag">
                          <strong>{t.count} truck</strong> from {t.depot} ({t.distance} km)
                        </div>
                      ))}
                    </div>
                  ) : "No tow trucks needed"}
                </td>
              </tr>
              <tr>
                <td className="deployment-label">Recommended Diversion</td>
                <td className="deployment-value">
                  <span className="diversion-route-text">{deployment.diversion}</span>
                </td>
              </tr>
              <tr>
                <td className="deployment-label">Clearance Window</td>
                <td className="deployment-value">
                  <span className="clearance-time-badge">{deployment.clearance_time}</span>
                </td>
              </tr>
              <tr>
                <td className="deployment-label">Alert Dispatches</td>
                <td className="deployment-value">
                  {deployment.send_alert ? (
                    <div className="alert-dispatch-status dispatched">
                      <MessageSquare size={16} /> Broadcast SMS Alerts sent to {impact.commuters_affected?.toLocaleString()} commuters.
                    </div>
                  ) : (
                    <div className="alert-dispatch-status no-dispatch">
                      CCTV Monitoring active - No commuter alerts dispatched.
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Buttons Action bar */}
      <div className="prediction-actions flex-between">
        <button className="btn btn-secondary flex-center gap-10" onClick={handleViewCascade}>
          <Map size={16} /> View on Cascade Map
        </button>
        <button className="btn btn-secondary flex-center gap-10" onClick={handleTrySimulator}>
          <Sliders size={16} /> Try What-If Scenarios
        </button>
        <div className="flex-center gap-10" style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-danger flex-center gap-10" onClick={handleDeleteIncident}>
            Delete Incident
          </button>
          <button className="btn btn-primary deploy-btn flex-center gap-10" onClick={handleConfirmDeploy}>
            <CheckCircle size={18} /> Confirm & Deploy
          </button>
          <button 
            className="btn btn-primary flex-center gap-10" 
            onClick={() => setShowResolveModal(true)} 
            style={{ backgroundColor: '#f59e0b', color: 'white' }}
          >
            <CheckCircle size={18} /> Resolve Incident
          </button>
        </div>

        {/* Modal for resolving event */}
        <Modal 
          isOpen={showResolveModal} 
          onClose={() => setShowResolveModal(false)} 
          title={`Resolve Incident ${event_id}`}
        >
          <form onSubmit={handleResolveSubmit} className="resolve-form" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>Actual Clearance Time (minutes)</label>
              <input 
                type="number" 
                className="form-control" 
                min="1" 
                value={resolutionTime}
                onChange={(e) => setResolutionTime(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'block' }}>Actual Congestion Impact Level</label>
              <select 
                className="form-control"
                value={actualImpact}
                onChange={(e) => setActualImpact(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary btn-submit flex-center gap-10"
              disabled={resolving}
              style={{ marginTop: '16px', padding: '12px', width: '100%', cursor: 'pointer' }}
            >
              {resolving ? "Processing resolution..." : "Submit Resolution & Retrain Model"}
            </button>
          </form>
        </Modal>

        {/* Modal for deleting event */}
        <Modal 
          isOpen={showDeleteConfirm} 
          onClose={() => setShowDeleteConfirm(false)} 
          title="Confirm Deletion"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ margin: 0, fontSize: '0.95rem' }}>Are you sure you want to permanently delete incident <strong>{event_id}</strong>?</p>
            <p style={{ color: '#ef4444', fontSize: '0.825rem', fontWeight: '600', margin: 0 }}>This action cannot be undone and will remove all associated logs and scenarios.</p>
            
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }} 
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                style={{ flex: 1, backgroundColor: '#ef4444', color: '#ffffff' }} 
                onClick={async () => {
                  setShowDeleteConfirm(false);
                  await executeDeleteIncident();
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
