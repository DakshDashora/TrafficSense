import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  BookOpen,
  LayoutDashboard, 
  PlusCircle, 
  BrainCircuit, 
  Map, 
  Sliders, 
  GraduationCap 
} from 'lucide-react';
import './Sidebar.css';

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-logo">🚦</span>
        <h1 className="brand-name">TrafficCoPilot</h1>
      </div>
      
      <nav className="sidebar-nav">
        <NavLink 
          to="/" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          end
        >
          <BookOpen className="nav-icon" size={20} />
          <span>Operator Guide</span>
        </NavLink>

        <NavLink 
          to="/dashboard" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard className="nav-icon" size={20} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink 
          to="/event" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <PlusCircle className="nav-icon" size={20} />
          <span>New Event</span>
        </NavLink>

        <NavLink 
          to="/prediction" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <BrainCircuit className="nav-icon" size={20} />
          <span>Prediction</span>
        </NavLink>

        <NavLink 
          to="/cascade" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Map className="nav-icon" size={20} />
          <span>Cascade Map</span>
        </NavLink>

        <NavLink 
          to="/simulator" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Sliders className="nav-icon" size={20} />
          <span>Simulator</span>
        </NavLink>

        <NavLink 
          to="/learning" 
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <GraduationCap className="nav-icon" size={20} />
          <span>Learning</span>
        </NavLink>
      </nav>
      
      <div className="sidebar-footer">
        <p className="footer-role">Operations Control</p>
        <span className="footer-status-dot"></span>
        <span className="footer-status-text">Connected</span>
      </div>
    </aside>
  );
}
