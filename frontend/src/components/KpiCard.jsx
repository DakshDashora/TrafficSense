import React from 'react';
import './KpiCard.css';

export default function KpiCard({ title, value, icon, description }) {
  return (
    <div className="kpi-card">
      <div className="kpi-card-header">
        <span className="kpi-card-title">{title}</span>
        <span className="kpi-card-icon">{icon}</span>
      </div>
      <div className="kpi-card-body">
        <h3 className="kpi-card-value">{value}</h3>
        {description && <p className="kpi-card-desc">{description}</p>}
      </div>
    </div>
  );
}
