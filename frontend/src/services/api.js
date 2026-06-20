import { API_URL } from '../config';

/**
 * Custom wrapper around native fetch to simplify API requests and handle errors.
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };
  
  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };
  
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }
  
  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`API Fetch Error [${endpoint}]:`, error);
    throw error;
  }
}

export const api = {
  // Dashboard
  getDashboardStats: () => apiFetch('/api/dashboard/stats'),
  getRecentEvents: () => apiFetch('/api/events/recent'),
  getEventDetails: (eventId) => apiFetch(`/api/events/${eventId}`),
  
  // Event Prediction & Recommendation
  predictImpact: (eventData) => apiFetch('/api/predict', {
    method: 'POST',
    body: eventData,
  }),
  
  // Cascade Propagation Simulation
  getCascadeSimulation: (latitude, longitude, impactLevel) => apiFetch('/api/cascade', {
    method: 'POST',
    body: { latitude, longitude, impact_level: impactLevel },
  }),
  
  // What-If Simulator
  getScenarios: (eventData) => apiFetch('/api/simulate', {
    method: 'POST',
    body: eventData,
  }),
  simulateCustomPlan: (eventId, officers, towTrucks) => apiFetch('/api/simulate/custom', {
    method: 'POST',
    body: { event_id: eventId, officers, tow_trucks: towTrucks },
  }),
  selectPlan: (eventId, planName) => apiFetch('/api/select-plan', {
    method: 'POST',
    body: { event_id: eventId, plan_name: planName },
  }),
  revokePlan: (eventId) => apiFetch(`/api/events/${eventId}/revoke`, {
    method: 'POST',
  }),
  
  // Learning Dashboard
  getLearningMetrics: () => apiFetch('/api/learning/metrics'),
  getAutopsyReport: (eventId) => apiFetch(`/api/learning/autopsy/${eventId}`),
  resolveEvent: (eventId, resolveData) => apiFetch(`/api/events/${eventId}/resolve`, {
    method: 'POST',
    body: resolveData,
  }),
  deleteEvent: (eventId) => apiFetch(`/api/events/${eventId}`, {
    method: 'DELETE',
  }),
};
