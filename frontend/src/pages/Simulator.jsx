import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Sliders, 
  CheckCircle, 
  ShieldAlert, 
  ArrowLeft, 
  ThumbsUp 
} from 'lucide-react';
import { useTraffic } from '../context/TrafficContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import './Simulator.css';

export default function Simulator() {
  const navigate = useNavigate();
  const { currentEvent, currentScenarios, fetchScenarios, selectedPlanName, selectActivePlan } = useTraffic();
  const { showToast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState('plan_a');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const [customOfficers, setCustomOfficers] = useState(2);
  const [customTowTrucks, setCustomTowTrucks] = useState(1);
  const [customPlanResult, setCustomPlanResult] = useState(null);
  const [simulatingCustom, setSimulatingCustom] = useState(false);

  // Sync custom inputs with Plan A (baseline) when scenarios load
  useEffect(() => {
    if (currentScenarios?.plan_a) {
      setCustomOfficers(currentScenarios.plan_a.officers);
      setCustomTowTrucks(currentScenarios.plan_a.tow_trucks);
    }
  }, [currentScenarios]);

  const handleRunCustomSimulation = async () => {
    setSimulatingCustom(true);
    try {
      const data = await api.simulateCustomPlan(currentEvent.event_id, parseInt(customOfficers), parseInt(customTowTrucks));
      setCustomPlanResult(data);
      showToast("Custom what-if simulation completed!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to run custom simulation.", "error");
    } finally {
      setSimulatingCustom(false);
    }
  };

  // If page is visited directly but an event exists, load scenarios
  useEffect(() => {
    if (!currentScenarios && currentEvent) {
      setLoading(true);
      fetchScenarios({
        cause: currentEvent.cause,
        latitude: currentEvent.latitude,
        longitude: currentEvent.longitude,
        datetime: currentEvent.datetime || new Date().toISOString(),
        police_station: currentEvent.police_station,
        event_id: currentEvent.event_id
      })
      .then(() => setLoading(false))
      .catch((err) => {
        setError("Failed to generate simulation scenarios.");
        setLoading(false);
      });
    }
  }, [currentEvent, currentScenarios]);

  if (!currentEvent || !currentScenarios) {
    return (
      <div className="card no-event-card flex-center flex-column animate-fade-in">
        <Sliders size={48} className="no-event-icon" />
        <h3>Simulator Inactive</h3>
        <p>Report an event to activate the what-if digital twin simulator.</p>
        <button className="btn btn-primary" onClick={() => navigate('/event')}>
          Report New Event
        </button>
      </div>
    );
  }

  const handlePlanSelect = (planKey) => {
    setSelectedPlan(planKey);
  };

  const handleDeployPlan = async () => {
    setLoading(true);
    try {
      await selectActivePlan(currentEvent.event_id, selectedPlan);
      const planNameStr = selectedPlan === 'plan_a' ? 'Default Plan' : (selectedPlan === 'plan_b' ? 'Aggressive Plan' : (selectedPlan === 'plan_c' ? 'Minimal Plan' : 'Custom Plan'));
      showToast(`Deployment finalized: ${planNameStr} successfully deployed for event ${currentEvent.event_id}!`, 'success');
      navigate('/dashboard');
    } catch (err) {
      console.error(err);
      setError("Failed to finalize plan deployment.");
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    { key: 'plan_a', data: currentScenarios.plan_a, label: 'Plan A (Default)' },
    { key: 'plan_b', data: currentScenarios.plan_b, label: 'Plan B (Aggressive)' },
    { key: 'plan_c', data: currentScenarios.plan_c, label: 'Plan C (Minimal)' }
  ];
  if (customPlanResult) {
    plans.push({
      key: 'custom',
      data: {
        name: "Custom Plan",
        officers: customPlanResult.officers,
        tow_trucks: customPlanResult.tow_trucks,
        diversion: customPlanResult.diversion,
        clearance: customPlanResult.clearance,
        commuters: customPlanResult.commuters,
        economic_loss: customPlanResult.economic_loss,
        emergency_risk: customPlanResult.emergency_risk
      },
      label: 'Custom Plan'
    });
  }

  return (
    <div className="simulator-container animate-fade-in">
      <header className="page-header flex-between">
        <div>
          <h2 className="page-title">What-If Scenario Simulator</h2>
          <p className="page-subtitle">Test and compare response plan strategies for event <span className="event-id-highlight">{currentEvent.event_id}</span></p>
        </div>
        <button className="btn btn-secondary flex-center gap-10" onClick={() => navigate('/prediction')}>
          <ArrowLeft size={16} /> Back to Prediction
        </button>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {loading ? (
        <div className="loader-container">
          <div className="spinner"></div>
          <p>Running simulations...</p>
        </div>
      ) : (
        <>
          {/* Scenario Cards */}
          <div className={`${customPlanResult ? 'grid-4' : 'grid-3'} scenario-cards-row`}>
            {plans.map((p) => {
              const isActive = selectedPlan === p.key;
              return (
                <div 
                  key={p.key} 
                  className={`card scenario-card ${isActive ? 'active' : ''}`}
                  onClick={() => handlePlanSelect(p.key)}
                >
                  <div className="scenario-card-header flex-between">
                    <span className="plan-title-text">{p.data.name}</span>
                    {isActive && <CheckCircle className="check-icon" size={18} />}
                  </div>
                  
                  <div className="scenario-metrics-body">
                    <div className="scen-row">
                      <span className="scen-lbl">Officers:</span>
                      <span className="scen-val font-bold">{p.data.officers} officers</span>
                    </div>
                    <div className="scen-row">
                      <span className="scen-lbl">Tow Trucks:</span>
                      <span className="scen-val">{p.data.tow_trucks} trucks</span>
                    </div>
                    <div className="scen-row">
                      <span className="scen-lbl">Clearance Time:</span>
                      <span className="scen-val duration-badge">{p.data.clearance}</span>
                    </div>
                    <div className="scen-divider"></div>
                    <div className="scen-row">
                      <span className="scen-lbl">Commuters:</span>
                      <span className="scen-val">{p.data.commuters.toLocaleString()}</span>
                    </div>
                    <div className="scen-row">
                      <span className="scen-lbl">Economic Cost:</span>
                      <span className="scen-val">₹{(p.data.economic_loss / 100000).toFixed(2)} Lakh</span>
                    </div>
                    <div className="scen-row">
                      <span className="scen-lbl">Emergency Risk:</span>
                      <span className="scen-val text-danger">+{p.data.emergency_risk} min</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom Simulation Controls */}
          <div className="card custom-simulator-card" style={{ margin: '24px 0', padding: '20px' }}>
            <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Sliders size={20} /> Custom Resource Dispatch Simulator
            </h3>
            
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                  Dispatch Officers: <span style={{ color: '#2563eb', fontWeight: '700' }}>{customOfficers}</span>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="15" 
                  value={customOfficers} 
                  onChange={(e) => setCustomOfficers(e.target.value)} 
                  style={{ width: '100%', accentColor: '#2563eb' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                  <span>0 (None)</span>
                  <span>15 (Max Response Force)</span>
                </div>
              </div>

              <div className="form-group" style={{ flex: '1', minWidth: '200px' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                  Tow Trucks Deployed: <span style={{ color: '#2563eb', fontWeight: '700' }}>{customTowTrucks}</span>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="8" 
                  value={customTowTrucks} 
                  onChange={(e) => setCustomTowTrucks(e.target.value)} 
                  style={{ width: '100%', accentColor: '#2563eb' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                  <span>0 (None)</span>
                  <span>8 (Max Tow Force)</span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '180px' }}>
                <button 
                  className="btn btn-primary" 
                  onClick={handleRunCustomSimulation}
                  disabled={simulatingCustom}
                  style={{ width: '100%', padding: '12px', cursor: 'pointer', fontWeight: '700' }}
                >
                  {simulatingCustom ? "Simulating..." : "Run Custom Simulation"}
                </button>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          <div className="card comparison-table-card">
            <h3 className="section-title">Side-by-Side Plan Comparison</h3>
            
            <div className="table-responsive">
              <table className="table comparison-table">
                <thead>
                  <tr>
                    <th>Metric / Resource</th>
                    <th>Plan A (Default)</th>
                    <th>Plan B (Aggressive)</th>
                    <th>Plan C (Minimal)</th>
                    {customPlanResult && <th style={{ color: '#2563eb', fontWeight: '700' }}>Custom Plan</th>}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Dispatch Officers</strong></td>
                    <td>{currentScenarios.plan_a.officers} personnel</td>
                    <td>{currentScenarios.plan_b.officers} personnel</td>
                    <td>{currentScenarios.plan_c.officers} personnel</td>
                    {customPlanResult && <td style={{ color: '#2563eb', fontWeight: '600' }}>{customPlanResult.officers} personnel</td>}
                  </tr>
                  <tr>
                    <td><strong>Tow Trucks</strong></td>
                    <td>{currentScenarios.plan_a.tow_trucks} trucks</td>
                    <td>{currentScenarios.plan_b.tow_trucks} trucks</td>
                    <td>{currentScenarios.plan_c.tow_trucks} trucks</td>
                    {customPlanResult && <td style={{ color: '#2563eb', fontWeight: '600' }}>{customPlanResult.tow_trucks} trucks</td>}
                  </tr>
                  <tr>
                    <td><strong>Diversion Route</strong></td>
                    <td>{currentScenarios.plan_a.diversion}</td>
                    <td>{currentScenarios.plan_b.diversion}</td>
                    <td>{currentScenarios.plan_c.diversion}</td>
                    {customPlanResult && <td style={{ color: '#2563eb' }}>{customPlanResult.diversion}</td>}
                  </tr>
                  <tr>
                    <td><strong>Clearance Duration</strong></td>
                    <td>{currentScenarios.plan_a.clearance}</td>
                    <td className="highlight-cell">{currentScenarios.plan_b.clearance}</td>
                    <td>{currentScenarios.plan_c.clearance}</td>
                    {customPlanResult && <td style={{ color: '#2563eb', fontWeight: '600' }}>{customPlanResult.clearance}</td>}
                  </tr>
                  <tr>
                    <td><strong>Affected Commuters</strong></td>
                    <td>{currentScenarios.plan_a.commuters.toLocaleString()}</td>
                    <td className="highlight-cell">{currentScenarios.plan_b.commuters.toLocaleString()}</td>
                    <td>{currentScenarios.plan_c.commuters.toLocaleString()}</td>
                    {customPlanResult && <td style={{ color: '#2563eb', fontWeight: '600' }}>{customPlanResult.commuters.toLocaleString()}</td>}
                  </tr>
                  <tr>
                    <td><strong>Economic Impact</strong></td>
                    <td>₹{(currentScenarios.plan_a.economic_loss / 100000).toFixed(2)} Lakh</td>
                    <td className="highlight-cell">₹{(currentScenarios.plan_b.economic_loss / 100000).toFixed(2)} Lakh</td>
                    <td>₹{(currentScenarios.plan_c.economic_loss / 100000).toFixed(2)} Lakh</td>
                    {customPlanResult && <td style={{ color: '#2563eb', fontWeight: '600' }}>₹{(customPlanResult.economic_loss / 100000).toFixed(2)} Lakh</td>}
                  </tr>
                  <tr>
                    <td><strong>Emergency Transit Risk</strong></td>
                    <td>+{currentScenarios.plan_a.emergency_risk} min delay</td>
                    <td className="highlight-cell">+{currentScenarios.plan_b.emergency_risk} min delay</td>
                    <td>+{currentScenarios.plan_c.emergency_risk} min delay</td>
                    {customPlanResult && <td style={{ color: '#2563eb', fontWeight: '600' }}>+{customPlanResult.emergency_risk} min delay</td>}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirm deploying section */}
          <div className="simulator-actions flex-between card">
            <div className="selected-summary-panel">
              <span className="selected-plan-badge">Selected Plan</span>
              <p className="selected-plan-desc">
                Deploying <strong>{plans.find(p => p.key === selectedPlan).data.name}</strong> containing{' '}
                <strong>{plans.find(p => p.key === selectedPlan).data.officers} officers</strong>.
              </p>
            </div>
            
            <button 
              className="btn btn-primary confirm-deploy-btn flex-center gap-10"
              onClick={handleDeployPlan}
              disabled={loading}
            >
              <ThumbsUp size={18} />
              Deploy Selected Plan
            </button>
          </div>
        </>
      )}
    </div>
  );
}
