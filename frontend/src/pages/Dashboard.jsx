import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  AlertTriangle, 
  CheckCircle, 
  Activity, 
  CheckSquare, 
  TrendingUp, 
  TrendingDown, 
  ArrowRight,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { useTraffic } from '../context/TrafficContext';
import { useToast } from '../context/ToastContext';
import './Dashboard.css';

export default function Dashboard() {
  const navigate = useNavigate();
  const { setEventData } = useTraffic();
  const { showToast } = useToast();
  const [stats, setStats] = useState({
    total_events_today: 0,
    total_events_today_delta: 0,
    prediction_accuracy: 88.5,
    prediction_accuracy_delta: 0,
    active_events: 0,
    active_events_delta: 0,
    resolved_events_today: 0,
    resolved_events_today_delta: 0
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Modal States for Deployed Event Management
  const [activeDeployedEvent, setActiveDeployedEvent] = useState(null);
  const [activeAutopsyReport, setActiveAutopsyReport] = useState(null);
  const [resolveForm, setResolveForm] = useState({ actual_impact: 'MEDIUM', resolution_time: '' });
  const [resolving, setResolving] = useState(false);
  const [deleteConfirmEventId, setDeleteConfirmEventId] = useState(null);
  const [showResolveModal, setShowResolveModal] = useState(false);

  const fetchData = async () => {
    try {
      const statsData = await api.getDashboardStats();
      const recentData = await api.getRecentEvents();
      setStats(statsData);
      setRecentEvents(recentData);
      setError(null);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to fetch traffic dashboard metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    // Live clock
    const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    
    return () => {
      clearInterval(interval);
      clearInterval(clockInterval);
    };
  }, []);

  const handleRowClick = async (eventItem) => {
    setLoading(true);
    try {
      console.log("Fetching event details for ID:", eventItem.id);
      const eventDetails = await api.getEventDetails(eventItem.id);
      console.log("Fetched event details payload:", eventDetails);
      
      // If the event is already resolved, show its Autopsy Report directly
      if (eventDetails.status === 'resolved' || eventDetails.status === 'closed') {
        console.log("Event is resolved. Fetching autopsy report...");
        const autopsyData = await api.getAutopsyReport(eventItem.id);
        console.log("Autopsy report data:", autopsyData);
        setActiveAutopsyReport(autopsyData);
      }
      // If the event is active and a plan has been deployed, show details modal
      else if (eventDetails.status === 'active' && eventDetails.selected_plan) {
        console.log("Active event with selected plan found. Opening modal...");
        setActiveDeployedEvent(eventDetails);
        const clearanceText = eventDetails.deployed_plan_details?.clearance_time || "30";
        const matches = clearanceText.match(/\d+/g);
        let defaultTime = 30;
        if (matches && matches.length === 2) {
          defaultTime = Math.round((parseInt(matches[0]) + parseInt(matches[1])) / 2);
        } else if (matches && matches.length === 1) {
          defaultTime = parseInt(matches[0]);
        }

        setResolveForm({
          actual_impact: eventDetails.impact_level || 'MEDIUM',
          resolution_time: defaultTime.toString()
        });
      } else {
        // Otherwise, open standard predictions page
        console.log("Active event with no plan selected. Redirecting to predictions...");
        setEventData(eventDetails);
        navigate('/prediction');
      }
    } catch (err) {
      console.error("Error loading historical event details:", err);
      setError("Failed to open event details.");
    } finally {
      setLoading(false);
    }
  };

  const handleRevokePlan = async () => {
    if (!activeDeployedEvent) return;
    setLoading(true);
    try {
      await api.revokePlan(activeDeployedEvent.event_id);
      showToast(`Plan successfully revoked for event ${activeDeployedEvent.event_id}. Redirecting to simulator for re-planning...`, 'info');
      
      // Load event details to context and redirect to Simulator so they can re-select plan
      setEventData(activeDeployedEvent);
      setActiveDeployedEvent(null);
      navigate('/simulator');
    } catch (err) {
      console.error("Error revoking plan:", err);
      showToast("Failed to revoke the deployment plan.", 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveIncident = async () => {
    if (!activeDeployedEvent || !resolveForm.resolution_time) return;
    setResolving(true);
    try {
      await api.resolveEvent(activeDeployedEvent.event_id, {
        actual_impact: resolveForm.actual_impact,
        resolution_time: parseInt(resolveForm.resolution_time),
        actual_officers: activeDeployedEvent.deployed_plan_details.officers,
        actual_trucks: activeDeployedEvent.deployed_plan_details.tow_trucks
      });
      showToast(`Incident ${activeDeployedEvent.event_id} resolved and archived. Autopsy report generated.`, 'success');
      setActiveDeployedEvent(null);
      setResolveForm({ actual_impact: 'MEDIUM', resolution_time: '' });
      fetchData(); // refresh dashboard stats & recent list
    } catch (err) {
      console.error("Error resolving event:", err);
      showToast("Failed to resolve incident.", 'error');
    } finally {
      setResolving(false);
    }
  };

  const handleDeleteIncident = (eventId) => {
    setDeleteConfirmEventId(eventId);
  };

  const executeDeleteIncident = async (eventId) => {
    setLoading(true);
    try {
      await api.deleteEvent(eventId);
      showToast(`Incident ${eventId} has been successfully deleted.`, 'success');
      setActiveDeployedEvent(null);
      setActiveAutopsyReport(null);
      fetchData(); // reload stats and recent list
    } catch (err) {
      console.error("Error deleting event:", err);
      showToast("Failed to delete the incident.", 'error');
    } finally {
      setLoading(false);
    }
  };


  const getImpactBadgeClass = (impact) => {
    const imp = String(impact).toUpperCase();
    if (imp === 'HIGH') return 'badge-danger';
    if (imp === 'MEDIUM') return 'badge-warning';
    return 'badge-success';
  };

  const getStatusBadgeClass = (status) => {
    const stat = String(status).toLowerCase();
    if (stat === 'active') return 'status-active';
    return 'status-resolved';
  };

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <div className="dashboard-container animate-fade-in">
      <header className="dashboard-header page-header flex-between">
        <div>
          <h2 className="page-title">Good morning, Traffic Controller</h2>
          <p className="page-subtitle">Digital Twin interface for Bengaluru traffic operations</p>
        </div>
        <div className="live-clock-card">
          <span className="clock-date">{formattedDate}</span>
          <span className="clock-separator">|</span>
          <span className="clock-time">{formattedTime}</span>
        </div>
      </header>

      {error && <div className="error-banner">{error} <button onClick={fetchData}>Retry</button></div>}

      {/* KPI Stats Cards */}
      <div className="grid-4 stats-grid">
        <div className="card stat-card">
          <div className="stat-icon-wrapper total-events-icon">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{stats.total_events_today}</span>
            <span className="stat-label">Total Events Today</span>
            <span className={`stat-trend ${stats.total_events_today_delta >= 0 ? 'trend-up' : 'trend-down'}`}>
              {stats.total_events_today_delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {stats.total_events_today_delta >= 0 ? '+' : ''}{stats.total_events_today_delta}% from yesterday
            </span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon-wrapper accuracy-icon">
            <CheckCircle size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{stats.prediction_accuracy}%</span>
            <span className="stat-label">Prediction Accuracy</span>
            <span className={`stat-trend ${stats.prediction_accuracy_delta >= 0 ? 'trend-up' : 'trend-down'}`}>
              {stats.prediction_accuracy_delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {stats.prediction_accuracy_delta >= 0 ? '+' : ''}{stats.prediction_accuracy_delta}% this week
            </span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon-wrapper active-events-icon">
            <Activity size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{stats.active_events}</span>
            <span className="stat-label">Active Events</span>
            <span className={`stat-trend ${stats.active_events_delta <= 0 ? 'trend-up' : 'trend-down'}`}>
              {stats.active_events_delta <= 0 ? <TrendingDown size={14} /> : <TrendingUp size={14} />}
              {stats.active_events_delta > 0 ? '+' : ''}{stats.active_events_delta}% response latency
            </span>
          </div>
        </div>

        <div className="card stat-card">
          <div className="stat-icon-wrapper resolved-events-icon">
            <CheckSquare size={24} />
          </div>
          <div className="stat-details">
            <span className="stat-value">{stats.resolved_events_today}</span>
            <span className="stat-label">Resolved Events Today</span>
            <span className={`stat-trend ${stats.resolved_events_today_delta >= 0 ? 'trend-up' : 'trend-down'}`}>
              {stats.resolved_events_today_delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {stats.resolved_events_today_delta >= 0 ? '+' : ''}{stats.resolved_events_today_delta}% dispatch efficiency
            </span>
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="dashboard-content card">
        <div className="flex-between table-header">
          <h3 className="section-title">Recent Incidents</h3>
          <button className="btn btn-secondary flex-center gap-10" onClick={() => navigate('/event')}>
            Report New Event <ArrowRight size={16} />
          </button>
        </div>

        {loading ? (
          <div className="loader-container">
            <div className="spinner"></div>
            <p>Loading recent events...</p>
          </div>
        ) : recentEvents.length === 0 ? (
          <div className="empty-state">
            <AlertTriangle size={32} />
            <p>No traffic events reported today.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Cause</th>
                  <th>Location</th>
                  <th>Time Reported</th>
                  <th>Predicted Impact</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((event) => (
                  <tr key={event.id} className="clickable-row" onClick={() => handleRowClick(event)}>
                    <td className="event-id-cell">{event.id}</td>
                    <td className="event-cause-cell">{event.cause.replace('_', ' ')}</td>
                    <td>{event.location}</td>
                    <td>{event.time}</td>
                    <td>
                      <span className={`badge ${getImpactBadgeClass(event.impact)}`}>
                        {event.impact}
                      </span>
                    </td>
                    <td>
                      <span className={`status-dot-wrapper ${getStatusBadgeClass(event.status)}`}>
                        <span className="status-dot"></span>
                        {event.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Deployed Plan Modal */}
      {activeDeployedEvent && !showResolveModal && (
        <div className="modal-overlay">
          <div className="modal-card card animate-fade-in">
            <div className="modal-header">
              <h4>Deployment Status: {activeDeployedEvent.event_id}</h4>
              <button className="close-modal-btn" onClick={() => setActiveDeployedEvent(null)}><X size={20} /></button>
            </div>
            
            <div className="modal-body">
              <div className="status-summary-card">
                <p><strong>Cause:</strong> <span className="text-capitalize">{activeDeployedEvent.cause.replace('_', ' ')}</span></p>
                <p><strong>Precinct Station:</strong> {activeDeployedEvent.police_station} station area</p>
                <p><strong>Active Deployment Strategy:</strong> <span className="active-strategy-badge">{activeDeployedEvent.deployed_plan_details.name}</span></p>
              </div>

              <div className="deployed-metrics-grid">
                <div className="metric-box">
                  <span className="box-label">Officers</span>
                  <span className="box-value">{activeDeployedEvent.deployed_plan_details.officers}</span>
                </div>
                <div className="metric-box">
                  <span className="box-label">Tow Trucks</span>
                  <span className="box-value">{activeDeployedEvent.deployed_plan_details.tow_trucks}</span>
                </div>
                <div className="metric-box">
                  <span className="box-label">Clearance Time</span>
                  <span className="box-value">{activeDeployedEvent.deployed_plan_details.clearance_time}</span>
                </div>
              </div>

              <div className="diversion-route-info">
                <span className="info-label">Active Diversion Route</span>
                <p>{activeDeployedEvent.deployed_plan_details.diversion}</p>
              </div>
            </div>

            <div className="modal-actions flex-between" style={{ gap: '10px' }}>
              <button 
                className="btn btn-danger"
                onClick={() => handleDeleteIncident(activeDeployedEvent.event_id)}
                disabled={loading || resolving}
              >
                Delete Incident
              </button>
              <button 
                className="btn btn-secondary btn-revoke"
                onClick={handleRevokePlan}
                disabled={loading || resolving}
              >
                Revoke Plan
              </button>
              <button 
                className="btn btn-primary btn-resolve"
                onClick={() => setShowResolveModal(true)}
                disabled={loading || resolving}
              >
                Resolve Incident
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Incident Modal */}
      {showResolveModal && activeDeployedEvent && (
        <div className="modal-overlay" onClick={() => setShowResolveModal(false)}>
          <div className="modal-card card animate-fade-in" style={{ maxWidth: '450px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Resolve Incident: {activeDeployedEvent.event_id}</h4>
              <button className="close-modal-btn" onClick={() => setShowResolveModal(false)}><X size={20} /></button>
            </div>
            
            <div className="modal-body" style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#64748b' }}>
                Please provide the actual parameters to resolve and archive the incident. This data is used to retrain the AI models.
              </p>
              
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'block', color: '#334155' }}>
                  Actual Congestion Severity
                </label>
                <select 
                  className="form-control"
                  value={resolveForm.actual_impact}
                  onChange={(e) => setResolveForm({ ...resolveForm, actual_impact: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '6px', display: 'block', color: '#334155' }}>
                  Actual Clearance Duration (minutes)
                </label>
                <input 
                  type="number" 
                  className="form-control"
                  min="1"
                  placeholder="e.g. 35"
                  value={resolveForm.resolution_time}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolution_time: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  required
                />
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }} 
                onClick={() => setShowResolveModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                style={{ flex: 1 }} 
                onClick={async () => {
                  if (!resolveForm.resolution_time) {
                    showToast("Please enter the clearance duration.", "warning");
                    return;
                  }
                  await handleResolveIncident();
                  setShowResolveModal(false);
                }}
                disabled={loading || resolving || !resolveForm.resolution_time}
              >
                {resolving ? 'Resolving...' : 'Confirm Resolution'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeAutopsyReport && (
        <div className="modal-overlay" onClick={() => setActiveAutopsyReport(null)}>
          <div className="modal-card card animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Incident Autopsy Report: {activeAutopsyReport.event_id}</h4>
              <button className="close-modal-btn" onClick={() => setActiveAutopsyReport(null)}><X size={20} /></button>
            </div>
            
            <div className="modal-body">
              <div className="status-summary-card">
                <p><strong>Cause:</strong> <span className="text-capitalize">{activeAutopsyReport.cause.replace('_', ' ')}</span></p>
                <p><strong>Location:</strong> {activeAutopsyReport.location}</p>
                <p><strong>Gap Analysis:</strong> <span className={`badge ${activeAutopsyReport.gap_analysis.includes('Mismatch') ? 'badge-warning' : 'badge-success'}`}>{activeAutopsyReport.gap_analysis}</span></p>
              </div>

              <div className="autopsy-metrics-section" style={{ marginTop: '12px' }}>
                <h5 className="section-subtitle" style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '8px', color: '#0f172a' }}>Severity & Impact Validation</h5>
                <div className="deployed-metrics-grid" style={{ marginBottom: '14px' }}>
                  <div className="metric-box">
                    <span className="box-label">Predicted Severity</span>
                    <span className={`badge ${getImpactBadgeClass(activeAutopsyReport.predicted_impact)}`} style={{ marginTop: '4px' }}>{activeAutopsyReport.predicted_impact}</span>
                  </div>
                  <div className="metric-box">
                    <span className="box-label">Actual Severity</span>
                    <span className={`badge ${getImpactBadgeClass(activeAutopsyReport.actual_impact)}`} style={{ marginTop: '4px' }}>{activeAutopsyReport.actual_impact}</span>
                  </div>
                </div>

                <h5 className="section-subtitle" style={{ fontSize: '0.9rem', fontWeight: '700', marginBottom: '8px', color: '#0f172a' }}>Resource Deployment Audit</h5>
                <table className="table" style={{ fontSize: '0.85rem', width: '100%', marginBottom: '14px', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '6px 0', color: '#64748b', fontWeight: '600' }}>Resource Type</th>
                      <th style={{ padding: '6px 0', color: '#64748b', fontWeight: '600' }}>Recommended</th>
                      <th style={{ padding: '6px 0', color: '#64748b', fontWeight: '600' }}>Actual Used</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 0', color: '#334155' }}>Officers</td>
                      <td style={{ padding: '6px 0', color: '#334155' }}>{activeAutopsyReport.recommended_resources?.officers}</td>
                      <td style={{ padding: '6px 0', color: '#334155' }}>{activeAutopsyReport.actual_resources_used?.officers}</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 0', color: '#334155' }}>Tow Trucks</td>
                      <td style={{ padding: '6px 0', color: '#334155' }}>{activeAutopsyReport.recommended_resources?.tow_trucks}</td>
                      <td style={{ padding: '6px 0', color: '#334155' }}>{activeAutopsyReport.actual_resources_used?.tow_trucks}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="diversion-route-info" style={{ borderLeftColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.04)', marginBottom: '12px' }}>
                  <span className="info-label" style={{ color: '#2563eb' }}>Lessons Learned</span>
                  <p style={{ fontStyle: 'italic', margin: '4px 0 0 0' }}>"{activeAutopsyReport.lessons}"</p>
                </div>

                <div className="diversion-route-info" style={{ borderLeftColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.04)' }}>
                  <span className="info-label" style={{ color: '#047857' }}>Action Taken</span>
                  <p style={{ margin: '4px 0 0 0' }}><strong>{activeAutopsyReport.action}</strong></p>
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-danger" 
                style={{ flex: 1 }} 
                onClick={() => handleDeleteIncident(activeAutopsyReport.event_id)}
                disabled={loading}
              >
                Delete Log
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }} 
                onClick={() => setActiveAutopsyReport(null)}
              >
                Close Autopsy Report
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteConfirmEventId && (
        <div className="modal-overlay" onClick={() => setDeleteConfirmEventId(null)}>
          <div className="modal-card card animate-fade-in" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4>Confirm Deletion</h4>
              <button className="close-modal-btn" onClick={() => setDeleteConfirmEventId(null)}><X size={20} /></button>
            </div>
            
            <div className="modal-body" style={{ padding: '8px 0' }}>
              <p style={{ margin: '0 0 10px 0', fontSize: '0.95rem' }}>Are you sure you want to permanently delete incident <strong>{deleteConfirmEventId}</strong>?</p>
              <p style={{ color: '#ef4444', fontSize: '0.825rem', fontWeight: '600', margin: 0 }}>This action cannot be undone and will remove all associated logs and scenarios.</p>
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button 
                className="btn btn-secondary" 
                style={{ flex: 1 }} 
                onClick={() => setDeleteConfirmEventId(null)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger" 
                style={{ flex: 1 }} 
                onClick={async () => {
                  const idToDelete = deleteConfirmEventId;
                  setDeleteConfirmEventId(null);
                  await executeDeleteIncident(idToDelete);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
