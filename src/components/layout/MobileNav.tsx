import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Clock,
  Receipt,
  BarChart3,
} from 'lucide-react';

export function MobileNav() {
  return (
    <nav className="mobile-nav">
      <div className="mobile-nav-items">
        <NavLink to="/" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`} end>
          <LayoutDashboard />
          <span>Home</span>
        </NavLink>
        <NavLink to="/jobs" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <Briefcase />
          <span>Jobs</span>
        </NavLink>
        <NavLink to="/workers" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <Users />
          <span>Crew</span>
        </NavLink>
        <NavLink to="/time-entries" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <Clock />
          <span>Time</span>
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
          <Receipt />
          <span>Exp</span>
        </NavLink>
      </div>
    </nav>
  );
}