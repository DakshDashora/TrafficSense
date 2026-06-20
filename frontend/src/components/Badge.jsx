import React from 'react';
import './Badge.css';

export default function Badge({ type, children }) {
  const getBadgeClass = () => {
    const cleanType = String(type || '').trim().toLowerCase();
    switch (cleanType) {
      case 'critical':
        return 'badge-critical';
      case 'high':
        return 'badge-high';
      case 'medium':
        return 'badge-medium';
      case 'low':
        return 'badge-low';
      case 'active':
        return 'badge-active';
      case 'resolved':
        return 'badge-resolved';
      case 'closed':
        return 'badge-closed';
      case 'cascade-risk':
      case 'warning':
        return 'badge-warning';
      default:
        return 'badge-default';
    }
  };

  return (
    <span className={`badge ${getBadgeClass()}`}>
      {children || type}
    </span>
  );
}
