import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import EventInput from './pages/EventInput';
import Prediction from './pages/Prediction';
import CascadeMap from './pages/CascadeMap';
import Simulator from './pages/Simulator';
import Learning from './pages/Learning';
import { TrafficProvider } from './context/TrafficContext';
import { ToastProvider } from './context/ToastContext';
import './App.css';

export default function App() {
  return (
    <ToastProvider>
      <TrafficProvider>
        <BrowserRouter>
          <div className="app-layout">
            {/* Fixed Left Sidebar */}
            <Sidebar />

            {/* Main content display on the right */}
            <main className="content-layout">
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/event" element={<EventInput />} />
                <Route path="/prediction" element={<Prediction />} />
                <Route path="/cascade" element={<CascadeMap />} />
                <Route path="/simulator" element={<Simulator />} />
                <Route path="/learning" element={<Learning />} />
                
                {/* Fallback routes */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </TrafficProvider>
    </ToastProvider>
  );
}
