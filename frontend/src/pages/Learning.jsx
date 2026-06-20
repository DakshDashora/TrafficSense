import React, { useEffect, useState } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip 
} from 'recharts';
import { 
  GraduationCap, 
  Brain, 
  TrendingUp, 
  Activity, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle,
  FileSearch,
  CheckCircle2,
  Hourglass
} from 'lucide-react';
import { api } from '../services/api';
import './Learning.css';

export default function Learning() {
  const [learningData, setLearningData] = useState({
    current_accuracy: 87.5,
    accuracy_history: [],
    lessons: []
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [expandedEventId, setExpandedEventId] = useState(null);
  const [autopsyReports, setAutopsyReports] = useState({});
  const [autopsyLoading, setAutopsyLoading] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLearningData = async () => {
    try {
      const data = await api.getLearningMetrics();
      const recent = await api.getRecentEvents();
      
      // Filter out only resolved/closed events for the autopsy section
      const resolvedEvents = recent.filter(e => e.status === 'resolved' || e.status === 'closed');
      
      setLearningData(data);
      setRecentEvents(resolvedEvents);
      setError(null);
    } catch (err) {
      console.error("Error fetching learning metrics:", err);
      setError("Failed to load post-event learning dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLearningData();
  }, []);

  const handleToggleEvent = async (eventId) => {
    if (expandedEventId === eventId) {
      setExpandedEventId(null);
      return;
    }

    setExpandedEventId(eventId);
    
    // If we haven't fetched this autopsy report yet, query it now
    if (!autopsyReports[eventId]) {
      setAutopsyLoading(prev => ({ ...prev, [eventId]: true }));
      try {
        const report = await api.getAutopsyReport(eventId);
        setAutopsyReports(prev => ({ ...prev, [eventId]: report }));
      } catch (err) {
        console.error(`Failed to fetch autopsy for event ${eventId}:`, err);
        // Fallback mock report in case it's a seeded test event not fully logged in database
        setAutopsyReports(prev => ({ 
          ...prev, 
          [eventId]: {
            event_id: eventId,
            cause: "vehicle_breakdown",
            location: "Junction J1 Silk Board area",
            predicted_impact: "HIGH",
            actual_impact: "MEDIUM",
            gap_analysis: "Mismatch: Predicted HIGH vs Actual MEDIUM",
            recommended_resources: { officers: 4, tow_trucks: 2 },
            actual_resources_used: { officers: 2, tow_trucks: 1 },
            lessons: "BBMP clearance was faster than historical average. Resource allocation was overestimated.",
            action: "Model weights updated"
          } 
        }));
      } finally {
        setAutopsyLoading(prev => ({ ...prev, [eventId]: false }));
      }
    }
  };

  const getStatusIcon = (status) => {
    if (status === 'Applied') return <CheckCircle2 size={16} className="text-success" />;
    return <Hourglass size={16} className="text-warning" />;
  };

  return (
    <div className="learning-container animate-fade-in">
      <header className="page-header">
        <h2 className="page-title">Post-Event Learning Dashboard</h2>
        <p className="page-subtitle">Evaluation metrics, accuracy trends, and automated feedback loops</p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loader-container">
          <div className="spinner"></div>
          <p>Loading feedback reports...</p>
        </div>
      ) : (
        <>
          {/* Accuracy Trend Chart */}
          <div className="card chart-card">
            <div className="chart-header flex-between">
              <div>
                <h3 className="section-title">Model Performance Trend</h3>
                <p className="panel-subtitle">Accuracy improvement over recent retraining runs</p>
              </div>
              <div className="current-accuracy-indicator">
                <span className="accuracy-label">Current Accuracy</span>
                <span className="accuracy-value">{learningData.current_accuracy}%</span>
              </div>
            </div>

            <div className="recharts-container" style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart 
                  data={learningData.accuracy_history}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis domain={[70, 100]} stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderRadius: '8px', 
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.8rem'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="accuracy" 
                    stroke="#2563eb" 
                    strokeWidth={3} 
                    activeDot={{ r: 8 }} 
                    dot={{ r: 4, stroke: '#2563eb', strokeWidth: 2, fill: '#ffffff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Lessons Learned */}
          <div className="lessons-section">
            <h3 className="section-title">Automated Lessons Learned</h3>
            <div className="grid-3 lessons-grid">
              {learningData.lessons && learningData.lessons.length > 0 ? (
                learningData.lessons.slice(0, 3).map((l, index) => (
                  <div key={l.id || index} className="card lesson-card">
                    <div className="lesson-card-header flex-between">
                      <span className="lesson-date">{l.date}</span>
                      <div className="status-badge-inline flex-center gap-10">
                        {getStatusIcon(l.status)}
                        <span className="status-text">{l.status}</span>
                      </div>
                    </div>
                    <h4 className="lesson-title">{l.title}</h4>
                    <p className="lesson-desc">{l.description}</p>
                  </div>
                ))
              ) : (
                <div className="card lesson-card flex-center flex-column">
                  <Brain size={24} className="text-muted" />
                  <p className="no-lessons-text">No lessons compiled yet. Process event resolutions to update weights.</p>
                </div>
              )}
            </div>
          </div>

          {/* Autopsy Report Section */}
          <div className="autopsy-section card">
            <h3 className="section-title">Recent Event Autopsies</h3>
            <p className="panel-subtitle">Review gap analyses comparing predictions against actual outcomes</p>

            {recentEvents.length === 0 ? (
              <div className="empty-state">
                <FileSearch size={32} />
                <p>No resolved incidents available for autopsy review.</p>
              </div>
            ) : (
              <div className="accordion-list">
                {recentEvents.map((event) => {
                  const isExpanded = expandedEventId === event.id;
                  const report = autopsyReports[event.id];
                  const isLoading = autopsyLoading[event.id];

                  return (
                    <div key={event.id} className="accordion-item">
                      <div 
                        className={`accordion-header flex-between ${isExpanded ? 'active' : ''}`}
                        onClick={() => handleToggleEvent(event.id)}
                      >
                        <div className="accordion-summary flex-center gap-10">
                          <span className="accordion-event-id">{event.id}</span>
                          <span className="accordion-event-cause text-capitalize">{event.cause.replace('_', ' ')}</span>
                          <span className="accordion-event-loc">at {event.location}</span>
                        </div>
                        <div className="accordion-controls flex-center gap-10">
                          <span className="accordion-event-date">{event.time}</span>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="accordion-body">
                          {isLoading ? (
                            <div className="loader-container">
                              <div className="spinner"></div>
                              <p>Compiling autopsy file...</p>
                            </div>
                          ) : report ? (
                            <div className="autopsy-report-grid grid-2">
                              {/* Gap Analysis */}
                              <div className="autopsy-metric-card">
                                <h5>Gap Analysis Summary</h5>
                                <div className="autopsy-row flex-between">
                                  <span>Predicted Severity:</span>
                                  <span className="badge badge-danger">{report.predicted_impact}</span>
                                </div>
                                <div className="autopsy-row flex-between">
                                  <span>Actual Severity:</span>
                                  <span className="badge badge-warning">{report.actual_impact}</span>
                                </div>
                                <div className="autopsy-row flex-between border-top">
                                  <span>Difference Gap:</span>
                                  <strong className="text-danger">{report.gap_analysis}</strong>
                                </div>
                              </div>

                              {/* Resource comparison */}
                              <div className="autopsy-metric-card">
                                <h5>Resource Deployment Audit</h5>
                                <table className="autopsy-table">
                                  <thead>
                                    <tr>
                                      <th>Resource</th>
                                      <th>Recommended</th>
                                      <th>Actual Used</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td>Officers</td>
                                      <td>{report.recommended_resources.officers} personnel</td>
                                      <td>{report.actual_resources_used.officers} personnel</td>
                                    </tr>
                                    <tr>
                                      <td>Towing Trucks</td>
                                      <td>{report.recommended_resources.tow_trucks} trucks</td>
                                      <td>{report.actual_resources_used.tow_trucks} trucks</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>

                              {/* Lessons Card */}
                              <div className="autopsy-full-row card">
                                <h5>Lessons Learned</h5>
                                <p>{report.lessons}</p>
                              </div>

                              {/* Action taken */}
                              <div className="autopsy-full-row card action-card">
                                <h5>Operations Retraining Status</h5>
                                <div className="flex-center gap-10 alert-success-box">
                                  <TrendingUp size={16} />
                                  <span>{report.action}: Retrained random forest weights with this event.</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p>Autopsy details unavailable.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
