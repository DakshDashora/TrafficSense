import React from 'react';
import './SvgChart.css';

export default function SvgChart({ type, data, title }) {
  if (!data || (Array.isArray(data) && data.length === 0)) {
    return (
      <div className="chart-container flex-center">
        <span className="text-muted">No data available for {title}</span>
      </div>
    );
  }

  // 1. HORIZONTAL BAR CHART
  if (type === 'horizontal-bar') {
    const maxVal = Math.max(...data.map((d) => d.count), 1);
    const height = data.length * 40 + 20;

    return (
      <div className="chart-container">
        {title && <h4 className="chart-title">{title}</h4>}
        <svg viewBox={`0 0 500 ${height}`} width="100%" height={height} className="svg-chart">
          {data.map((item, idx) => {
            const widthPct = (item.count / maxVal) * 350; // max width 350px
            const y = idx * 40 + 10;
            return (
              <g key={item.name} className="chart-group">
                {/* Cause Label */}
                <text x="5" y={y + 18} className="chart-label-text" textAnchor="start">
                  {item.name.length > 18 ? `${item.name.substring(0, 16)}...` : item.name}
                </text>
                
                {/* Background track */}
                <rect x="130" y={y + 4} width="300" height="18" rx="4" fill="#2d2d2d" />
                
                {/* Active bar */}
                <rect 
                  x="130" 
                  y={y + 4} 
                  width={widthPct} 
                  height="18" 
                  rx="4" 
                  fill="url(#accent-gradient)" 
                  className="chart-bar"
                />
                
                {/* Value Label */}
                <text x="440" y={y + 18} className="chart-value-text" textAnchor="start">
                  {item.count}
                </text>
              </g>
            );
          })}
          <defs>
            <linearGradient id="accent-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#60a5fa" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 2. DONUT CHART
  if (type === 'donut') {
    const planned = data.planned || 0;
    const unplanned = data.unplanned || 0;
    const total = planned + unplanned;
    
    // Circumference = 2 * PI * r. Let r = 40. Circumference = 251.327
    const r = 40;
    const circ = 2 * Math.PI * r;
    
    const plannedPct = total > 0 ? planned / total : 0;
    const unplannedPct = total > 0 ? unplanned / total : 0;
    
    const plannedDash = circ * plannedPct;
    const unplannedDash = circ * unplannedPct;
    
    // Starting offset: planned starts at top (offset = 0)
    // unplanned starts where planned ends (offset = circ - plannedDash)
    const unplannedOffset = circ - plannedDash;

    return (
      <div className="chart-container">
        {title && <h4 className="chart-title">{title}</h4>}
        <div className="donut-layout">
          <svg viewBox="0 0 120 120" width="160" height="160" className="svg-donut">
            {/* Background track */}
            <circle cx="60" cy="60" r={r} fill="transparent" stroke="#2d2d2d" strokeWidth="12" />
            
            {/* Planned segment (Blue) */}
            {planned > 0 && (
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="transparent"
                stroke="#3b82f6"
                strokeWidth="12"
                strokeDasharray={`${plannedDash} ${circ}`}
                strokeDashoffset={circ / 4} // rotate 90 deg counter-clockwise to start at top
                transform="rotate(-90 60 60)"
              />
            )}
            
            {/* Unplanned segment (Orange/Red) */}
            {unplanned > 0 && (
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="transparent"
                stroke="#f59e0b"
                strokeWidth="12"
                strokeDasharray={`${unplannedDash} ${circ}`}
                strokeDashoffset={unplannedOffset + (circ / 4)}
                transform="rotate(-90 60 60)"
              />
            )}
            
            {/* Text center */}
            <text x="60" y="58" className="donut-center-text" textAnchor="middle">
              {total}
            </text>
            <text x="60" y="72" className="donut-sub-text" textAnchor="middle">
              Incidents
            </text>
          </svg>
          
          <div className="donut-legend">
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#3b82f6' }}></span>
              <span className="legend-label">Planned ({Math.round(plannedPct * 100)}%)</span>
              <span className="legend-val">{planned}</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: '#f59e0b' }}></span>
              <span className="legend-label">Unplanned ({Math.round(unplannedPct * 100)}%)</span>
              <span className="legend-val">{unplanned}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. VERTICAL BAR CHART
  if (type === 'vertical-bar') {
    const maxVal = Math.max(...data.map((d) => d.count), 1);
    const width = 500;
    const height = 250;
    const paddingLeft = 40;
    const paddingBottom = 40;
    const paddingTop = 20;
    const paddingRight = 20;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    const barWidth = chartWidth / data.length;

    return (
      <div className="chart-container">
        {title && <h4 className="chart-title">{title}</h4>}
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} className="svg-chart">
          {/* Y-axis gridlines & labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
            const y = paddingTop + chartHeight * (1 - ratio);
            const gridVal = Math.round(maxVal * ratio);
            return (
              <g key={index}>
                <line x1={paddingLeft} y1={y} x2={width - paddingRight} y2={y} stroke="#2d2d2d" strokeDasharray="4" />
                <text x={paddingLeft - 8} y={y + 4} className="chart-grid-text" textAnchor="end">
                  {gridVal}
                </text>
              </g>
            );
          })}
          
          {/* Bars */}
          {data.map((item, idx) => {
            const barHeight = (item.count / maxVal) * chartHeight;
            const x = paddingLeft + idx * barWidth + (barWidth * 0.15); // Add spacing
            const y = paddingTop + chartHeight - barHeight;
            const finalBarWidth = barWidth * 0.7; // 70% width of block
            
            return (
              <g key={item.name} className="chart-group">
                {/* Bar rectangle */}
                <rect
                  x={x}
                  y={y}
                  width={finalBarWidth}
                  height={barHeight}
                  rx="3"
                  fill="url(#vertical-gradient)"
                  className="chart-bar-vertical"
                />
                
                {/* Text label */}
                <text
                  x={x + finalBarWidth / 2}
                  y={height - paddingBottom + 16}
                  className="chart-grid-text"
                  textAnchor="middle"
                  transform={`rotate(-25 ${x + finalBarWidth / 2} ${height - paddingBottom + 16})`}
                >
                  {item.name.length > 8 ? `${item.name.substring(0, 7)}..` : item.name}
                </text>
                
                {/* Value tooltip hint */}
                <text
                  x={x + finalBarWidth / 2}
                  y={y - 6}
                  className="chart-bar-value-text"
                  textAnchor="middle"
                >
                  {item.count}
                </text>
              </g>
            );
          })}
          
          {/* Axes lines */}
          <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={height - paddingBottom} stroke="#444" />
          <line x1={paddingLeft} y1={height - paddingBottom} x2={width - paddingRight} y2={height - paddingBottom} stroke="#444" />
          
          <defs>
            <linearGradient id="vertical-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1e3a8a" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  return null;
}
