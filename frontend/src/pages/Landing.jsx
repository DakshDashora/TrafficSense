import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Shield, 
  MapPin, 
  Brain, 
  GitMerge, 
  TrendingUp, 
  CheckCircle2, 
  Play, 
  ArrowRight, 
  Info,
  Activity
} from 'lucide-react';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();

  const workflowSteps = [
    {
      step: "01",
      title: "Report Traffic Incident",
      icon: <MapPin className="step-icon text-accent" />,
      description: "Log active events (accident, water logging, tree fall) and pin their exact GPS coordinates on the digital twin map of Bengaluru.",
      tip: "Accurate coordinates improve network connectivity mapping."
    },
    {
      step: "02",
      title: "Predict AI Severity & Impact",
      icon: <Brain className="step-icon text-purple" />,
      description: "The AI engine estimates the impact level (LOW, MEDIUM, HIGH), predicted commuters affected, economic loss, and optimal resource requirements.",
      tip: "Self-correcting model updates its coefficients over time."
    },
    {
      step: "03",
      title: "Run What-If Simulations",
      icon: <GitMerge className="step-icon text-blue" />,
      description: "Compare multiple plans side-by-side: Default (Plan A), Aggressive diversion (Plan B), and Minimal (Plan C) to see estimated clearance time savings.",
      tip: "Bypasses gridlocks by analyzing secondary corridors."
    },
    {
      step: "04",
      title: "Monitor Congestion Cascade",
      icon: <Activity className="step-icon text-red" />,
      description: "Watch the congestion propagation simulation over a 60-minute timeline. Trace waves moving outward to downstream road network junctions.",
      tip: "Enables proactive route blocking before congestion peaks."
    },
    {
      step: "05",
      title: "Autopsy & Self-Learning",
      icon: <CheckCircle2 className="step-icon text-green" />,
      description: "Input actual clearance times to resolve the incident. This feeds the autopsy module which runs gap analysis and retrains the model.",
      tip: "Builds a smarter AI with every incident handled."
    }
  ];

  return (
    <div className="landing-container">
      <header className="landing-header">
        <div className="brand-badge">
          <Shield className="badge-shield-icon" />
          <span>Bengaluru Traffic Police Command Center</span>
        </div>
        <h1 className="landing-title">
          Intelligent Traffic <span className="highlight-text">Co-Pilot</span>
        </h1>
        <p className="landing-subtitle">
          An event-driven digital twin designed to predict, simulate, and resolve traffic gridlocks across Bengaluru's road network using real-time machine learning.
        </p>
        <div className="cta-actions">
          <button className="btn btn-primary" onClick={() => navigate('/event')}>
            <Play className="btn-icon" />
            <span>Launch Operator Console</span>
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
            <span>Go to Dashboard</span>
            <ArrowRight className="btn-icon" />
          </button>
        </div>
      </header>

      <section className="workflow-section">
        <h2 className="section-title">Operational Controller Workflow</h2>
        <p className="section-description">
          Follow these five core stages to manage incidents, evaluate deployment plans, and continuously train the co-pilot.
        </p>

        <div className="workflow-grid">
          {workflowSteps.map((s, idx) => (
            <div className="workflow-card" key={idx}>
              <div className="card-header">
                <span className="step-number">{s.step}</span>
                {s.icon}
              </div>
              <h3 className="card-title">{s.title}</h3>
              <p className="card-text">{s.description}</p>
              <div className="card-footer">
                <Info className="info-icon" />
                <span className="card-tip">{s.tip}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="architecture-section">
        <div className="arch-card">
          <div className="arch-text">
            <h3 className="arch-title">Closed-Loop Self-Learning Twin</h3>
            <p className="arch-para">
              Unlike static maps, <strong>Traffic Co-Pilot</strong> links prediction with real-time operational feedback. When an officer closes an incident, the mismatch between the AI prediction and the actual resolution duration is analyzed to trigger an automated retraining job, refining the Random Forest model for future incidents.
            </p>
            <div className="arch-features">
              <div className="feature-item">
                <div className="feat-dot green"></div>
                <span><strong>SQLite Engine:</strong> Real-time event logger</span>
              </div>
              <div className="feature-item">
                <div className="feat-dot purple"></div>
                <span><strong>Random Forest Classifier:</strong> 88%+ Calibrated Accuracy</span>
              </div>
              <div className="feature-item">
                <div className="feat-dot blue"></div>
                <span><strong>NetworkX Graph:</strong> Shortest-path cascade solver</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
