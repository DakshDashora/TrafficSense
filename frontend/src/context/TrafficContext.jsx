import React, { createContext, useState, useContext } from 'react';
import { api } from '../services/api';

const TrafficContext = createContext();

export function TrafficProvider({ children }) {
  const [currentEvent, setCurrentEvent] = useState(null);
  const [currentCascade, setCurrentCascade] = useState(null);
  const [currentScenarios, setCurrentScenarios] = useState(null);
  const [selectedPlanName, setSelectedPlanName] = useState('plan_a');
  
  const setEventData = (eventData) => {
    setCurrentEvent(eventData);
    // Reset other related states
    setCurrentCascade(null);
    setCurrentScenarios(null);
    setSelectedPlanName('plan_a');
  };

  const fetchCascade = async (lat, lon, impactLevel) => {
    try {
      const data = await api.getCascadeSimulation(lat, lon, impactLevel);
      setCurrentCascade(data);
      return data;
    } catch (err) {
      console.error("Failed to fetch cascade simulation:", err);
      throw err;
    }
  };

  const fetchScenarios = async (eventDetails) => {
    try {
      const data = await api.getScenarios(eventDetails);
      setCurrentScenarios(data.scenarios);
      return data.scenarios;
    } catch (err) {
      console.error("Failed to fetch what-if scenarios:", err);
      throw err;
    }
  };

  const selectActivePlan = async (eventId, planName) => {
    try {
      const data = await api.selectPlan(eventId, planName);
      setSelectedPlanName(planName);
      return data;
    } catch (err) {
      console.error("Failed to select scenario plan:", err);
      throw err;
    }
  };

  return (
    <TrafficContext.Provider value={{
      currentEvent,
      currentCascade,
      currentScenarios,
      selectedPlanName,
      setEventData,
      setCurrentEvent,
      setCurrentCascade,
      setCurrentScenarios,
      fetchCascade,
      fetchScenarios,
      selectActivePlan
    }}>
      {children}
    </TrafficContext.Provider>
  );
}

export function useTraffic() {
  const context = useContext(TrafficContext);
  if (!context) {
    throw new Error('useTraffic must be used within a TrafficProvider');
  }
  return context;
}
export default TrafficContext;
